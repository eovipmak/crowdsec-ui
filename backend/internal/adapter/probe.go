package adapter

import (
	"context"
	"os"
	"strings"
	"time"
)

// probeResult holds per-operation support derived at startup.
type probeResult struct {
	capabilities map[OperationID]Support
	// structuredOutput is true when the installed cscli accepts -o json.
	structuredOutput bool
	// limitFlag is true when -l is accepted for alerts/decisions list.
	limitFlag bool
}

// runProbe performs the startup capability probe. It does not guess a
// capability into existence: version-dependent rows are reported as
// capability_gated unless the probe confirms support. Unsupported rows are
// always unsupported.
func runProbe(runner CommandRunner, opts Options) *probeResult {
	pr := &probeResult{
		capabilities: map[OperationID]Support{},
	}

	// Binary-level support that does not depend on the executable: profiles
	// reads a file, not a command.
	// Every matrix row must have a value; seed with capability_gated for
	// env-dependent or supported for verified, then refine below.
	for _, op := range AllOperationIDs() {
		if op.IsUnsupported() {
			pr.capabilities[op] = Unsupported
			continue
		}
		pr.capabilities[op] = CapabilityGated // conservative default
	}

	// Structured output support: run a cheap probe command that exercises
	// -o json. We use `cscli alerts list -o json -l 1` (a verified read).
	so := opts.supportsStructuredOutput
	if so == nil {
		_, err := runner.Run(context.Background(), Command{
			ExecutablePath: opts.ExecutablePath,
			Args:           []string{"alerts", "list", "-o", "json", "-l", "1"},
		})
		pr.structuredOutput = err == nil
	} else {
		pr.structuredOutput = *so
	}

	// Limit flag support mirrors structured output support for the read lists.
	lf := opts.supportsLimitFlag
	if lf == nil {
		pr.limitFlag = pr.structuredOutput
	} else {
		pr.limitFlag = *lf
	}

	// Refine read operations that depend on -o json.
	if pr.structuredOutput {
		for _, op := range []OperationID{
			OpAlertsList, OpAlertsInspect, OpDecisionsList, OpMachinesList,
			OpBouncersList, OpScenariosList, OpScenariosInspect,
			OpCollectionsList, OpAllowlistsList, OpMetricsShow,
		} {
			pr.capabilities[op] = Supported
		}
	}

	// hub.list uses -o raw (verified), a fixed feature.
	pr.capabilities[OpHubList] = Supported

	// simulation.status and lapi.status are verified commands with human
	// output; they do not depend on -o json.
	pr.capabilities[OpSimulationStatus] = Supported
	pr.capabilities[OpLapiStatus] = Supported

	// allowlists.check is a verified command.
	pr.capabilities[OpAllowlistsCheck] = Supported

	// Mutations. decisions.add/delete are MVP included but environment
	// dependent (allowlist may reject). They are capability_gated unless
	// confirmed.
	pr.capabilities[OpDecisionsAdd] = CapabilityGated
	pr.capabilities[OpDecisionsDelete] = Supported

	// machines.prune is only supported when the probe confirms it (it always
	// prompts interactively, so without a non-interactive mechanism it is
	// unsupported). We expose it as capability_gated; the handler refuses to
	// run unless the probe marks it supported.
	if opts.supportsPrune != nil {
		if *opts.supportsPrune {
			pr.capabilities[OpMachinesPrune] = Supported
		} else {
			pr.capabilities[OpMachinesPrune] = Unsupported
		}
	} else {
		pr.capabilities[OpMachinesPrune] = CapabilityGated
	}

	// bouncers.delete is only supported when the dashboard is co-located with
	// LAPI. Reported capability_gated; handler refuses to run unless confirmed.
	if opts.supportsBouncerDelete != nil {
		if *opts.supportsBouncerDelete {
			pr.capabilities[OpBouncersDelete] = Supported
		} else {
			pr.capabilities[OpBouncersDelete] = Unsupported
		}
	} else {
		pr.capabilities[OpBouncersDelete] = CapabilityGated
	}

	// metrics.show is optional/environment-dependent.
	if opts.supportsMetrics != nil {
		if *opts.supportsMetrics {
			pr.capabilities[OpMetricsShow] = Supported
		} else {
			pr.capabilities[OpMetricsShow] = Unsupported
		}
	} else {
		pr.capabilities[OpMetricsShow] = CapabilityGated
	}

	// capi.status is optional/environment-dependent.
	if opts.supportsCAPI != nil {
		if *opts.supportsCAPI {
			pr.capabilities[OpCAPIStatus] = Supported
		} else {
			pr.capabilities[OpCAPIStatus] = Unsupported
		}
	} else {
		pr.capabilities[OpCAPIStatus] = CapabilityGated
	}

	// profiles.inspect is supported when the profiles path is configured and
	// readable.
	if opts.ProfilesPath != "" {
		if _, err := os.Stat(opts.ProfilesPath); err == nil {
			pr.capabilities[OpProfilesInspect] = Supported
		} else {
			pr.capabilities[OpProfilesInspect] = CapabilityGated
		}
	} else {
		pr.capabilities[OpProfilesInspect] = Unsupported
	}

	return pr
}

// support returns the capability for an operation.
func (p *probeResult) support(op OperationID) Support {
	if s, ok := p.capabilities[op]; ok {
		return s
	}
	return Unsupported
}

// resolveExecutable locates cscli from the configured path or the controlled
// service environment (architecture §8.1). It never derives the path from a
// request.
func resolveExecutable(configured string) string {
	if configured != "" {
		return configured
	}
	// Controlled service-environment lookup: check common installed paths.
	for _, p := range []string{
		"/usr/bin/cscli",
		"/usr/local/bin/cscli",
		"/opt/crowdsec/bin/cscli",
	} {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}
	return ""
}

// probeTimeout is the per-probe command timeout.
const probeTimeout = 5 * time.Second

// probeCommand runs a probe command with a short timeout and returns its
// stdout on success.
func (a *adapter) probeCommand(op OperationID, args []string) (string, *OpError) {
	ctx, cancel := context.WithTimeout(context.Background(), probeTimeout)
	defer cancel()
	res, opErr := a.runRaw(ctx, op, Command{
		ExecutablePath: a.opts.ExecutablePath,
		Args:           args,
	})
	if opErr != nil {
		return "", opErr
	}
	return strings.TrimSpace(string(res.Stdout)), nil
}
