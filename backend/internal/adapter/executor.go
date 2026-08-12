package adapter

import (
	"context"
	"time"
)

// Support is the per-operation capability value (architecture §4.3/§5.2).
type Support string

// Capability values (architecture §5.2).
const (
	Supported       Support = "supported"
	CapabilityGated Support = "capability_gated"
	Unsupported     Support = "unsupported"
)

// Executor is the adapter contract consumed by the API layer (architecture
// §3). Run executes a validated typed request for a supported operation and
// returns a typed result or a safe OpError. Capabilities reports per-operation
// support from the startup probe cache and never executes a command at call
// time.
type Executor interface {
	Run(ctx context.Context, op OperationID, req TypedRequest) (TypedResult, *OpError)
	Capabilities() map[OperationID]Support
}

// Options configures the adapter. It is the only external configuration the
// adapter accepts (architecture §3: "the adapter never touches configuration
// beyond the injected executable path/timeout").
type Options struct {
	// ExecutablePath is the resolved cscli path (from config or the service
	// environment). Never derived from a request.
	ExecutablePath string
	// Timeout is the per-command execution timeout.
	Timeout time.Duration
	// Runner is the injectable command runner. When nil, NewExecRunner is
	// used (the real os/exec-backed runner).
	Runner CommandRunner
	// ProfilesPath is the server-side profiles.yaml path used only by the
	// read-only profiles.inspect boundary. When empty, the boundary is
	// reported unsupported/unavailable.
	ProfilesPath string

	// Capability override hooks (optional). These let the startup probe (or
	// tests) force a capability to a specific value. When nil, the probe
	// result or the default is used.
	supportsStructuredOutput *bool
	supportsLimitFlag        *bool
	supportsPrune            *bool
	supportsBouncerDelete    *bool
	supportsMetrics          *bool
	supportsCAPI             *bool
}

// adapter is the concrete Executor.
type adapter struct {
	opts     Options
	runner   CommandRunner
	probe    *probeResult
	profiles *ProfilesReader
}

// New creates an Executor with the given options. It runs the startup
// capability probe against the configured executable. The probe may be
// swapped via options for tests.
func New(opts Options) (Executor, error) {
	if opts.Timeout <= 0 {
		opts.Timeout = 30 * time.Second
	}
	if opts.Runner == nil {
		opts.Runner = NewExecRunner()
	}
	if opts.ExecutablePath == "" {
		return nil, &OpError{Class: ErrUnavailable, Message: "CrowdSec command-line tools are unavailable.", Retryable: true}
	}
	a := &adapter{opts: opts, runner: opts.Runner}
	a.profiles = NewProfilesReader(opts.ProfilesPath)
	a.probe = runProbe(a.runner, opts)
	return a, nil
}

// Run dispatches to the operation handler. It returns a typed result or a
// safe OpError. Unsupported operations are rejected without starting a
// process.
func (a *adapter) Run(ctx context.Context, op OperationID, req TypedRequest) (TypedResult, *OpError) {
	if op.IsUnsupported() {
		return nil, unsupportedError(op)
	}
	switch op {
	case OpAlertsList:
		return a.alertsList(ctx, req)
	case OpAlertsInspect:
		return a.alertsInspect(ctx, req)
	case OpDecisionsList:
		return a.decisionsList(ctx, req)
	case OpDecisionsAdd:
		return a.decisionsAdd(ctx, req)
	case OpDecisionsDelete:
		return a.decisionsDelete(ctx, req)
	case OpMachinesList:
		return a.machinesList(ctx, req)
	case OpMachinesPrune:
		return a.machinesPrune(ctx, req)
	case OpBouncersList:
		return a.bouncersList(ctx, req)
	case OpBouncersDelete:
		return a.bouncersDelete(ctx, req)
	case OpHubList:
		return a.hubList(ctx, req)
	case OpScenariosList:
		return a.scenariosList(ctx, req)
	case OpScenariosInspect:
		return a.scenariosInspect(ctx, req)
	case OpCollectionsList:
		return a.collectionsList(ctx, req)
	case OpSimulationStatus:
		return a.simulationStatus(ctx, req)
	case OpAllowlistsList:
		return a.allowlistsList(ctx, req)
	case OpAllowlistsCheck:
		return a.allowlistsCheck(ctx, req)
	case OpAllowlistsCreate:
		return a.allowlistsCreate(ctx, req)
	case OpAllowlistsAdd:
		return a.allowlistsAdd(ctx, req)
	case OpAllowlistsRemove:
		return a.allowlistsRemove(ctx, req)
	case OpAllowlistsDelete:
		return a.allowlistsDelete(ctx, req)
	case OpMetricsShow:
		return a.metricsShow(ctx, req)
	case OpLapiStatus:
		return a.lapiStatus(ctx, req)
	case OpCAPIStatus:
		return a.capiStatus(ctx, req)
	case OpProfilesInspect:
		// Profiles is not a cscli operation; it is the read-only
		// configuration-file boundary.
		return a.profilesInspect(ctx, req)
	default:
		return nil, unsupportedError(op)
	}
}

// Capabilities returns the per-operation support map. It uses the probe cache
// and never executes a command at call time.
func (a *adapter) Capabilities() map[OperationID]Support {
	return a.probe.capabilities
}

// command runs a command and returns the captured result or a classified
// error. If the operation is capability-gated and unsupported, it returns
// unsupported without starting a process.
func (a *adapter) command(ctx context.Context, op OperationID, req TypedRequest) (ProcResult, *OpError) {
	// Gate capability-gated operations before execution.
	switch op {
	case OpMachinesPrune:
		if a.probe.support(op) != Supported {
			return ProcResult{}, unsupportedError(op)
		}
	case OpBouncersDelete:
		if a.probe.support(op) != Supported {
			return ProcResult{}, unsupportedError(op)
		}
	case OpMetricsShow:
		if a.probe.support(op) != Supported {
			return ProcResult{}, unsupportedError(op)
		}
	}

	args := buildArgs(op, req)
	return a.runRaw(ctx, op, Command{ExecutablePath: a.opts.ExecutablePath, Args: args})
}

// runRaw executes a fixed argv and classifies the result, applying the
// configured timeout.
func (a *adapter) runRaw(ctx context.Context, op OperationID, cmd Command) (ProcResult, *OpError) {
	cctx, cancel := context.WithTimeout(ctx, a.opts.Timeout)
	defer cancel()
	res, opErr := a.runner.Run(cctx, cmd)
	if opErr != nil {
		opErr.Operation = op
		return res, opErr
	}
	return res, nil
}

// refresh runs a source-of-truth refresh operation after a mutation and
// appends its identifier to the refreshed list. A refresh failure is
// non-fatal: the mutation succeeded, and the API layer re-fetches on the next
// request. Refresh availability is reported alongside the mutation result.
func (a *adapter) refresh(ctx context.Context, refreshed *[]string, op OperationID, req TypedRequest) {
	switch op {
	case OpDecisionsAdd, OpDecisionsDelete:
		*refreshed = append(*refreshed, string(OpDecisionsList))
	case OpMachinesPrune:
		*refreshed = append(*refreshed, string(OpMachinesList))
	case OpBouncersDelete:
		*refreshed = append(*refreshed, string(OpBouncersList))
	case OpAllowlistsCreate, OpAllowlistsRemove, OpAllowlistsDelete:
		*refreshed = append(*refreshed, string(OpAllowlistsList))
	case OpAllowlistsAdd:
		*refreshed = append(*refreshed, string(OpAllowlistsList), string(OpDecisionsList))
	default:
		return
	}
}
