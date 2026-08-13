package adapter

import "strconv"

// This file defines the fixed operation -> argument-vector template functions.
// Each handler builds its complete, fixed argv internally from validated typed
// parameters. No API input can alter the executable path or add flags; the
// vector is always constructed here and passed to exec.CommandContext as-is.

// buildArgs returns the fixed argument vector (after the executable name) for
// the operation and validated request. It panics-free: it assumes the request
// has already passed validation. The returned slice is the complete argv.
func buildArgs(op OperationID, req TypedRequest) []string {
	switch op {
	case OpAlertsList:
		return alertsListArgs(req)
	case OpAlertsInspect:
		r := req.(AlertsInspectRequest)
		return []string{"alerts", "inspect", strconv.FormatInt(r.ID, 10), "-o", "json"}
	case OpDecisionsList:
		return decisionsListArgs(req)
	case OpDecisionsAdd:
		return decisionsAddArgs(req)
	case OpDecisionsDelete:
		r := req.(DecisionsDeleteRequest)
		return []string{"decisions", "delete", "--ip", r.IPOrRange}
	case OpMachinesList:
		return []string{"machines", "list", "-o", "json"}
	case OpMachinesPrune:
		return machinesPruneArgs(req)
	case OpBouncersList:
		return []string{"bouncers", "list", "-o", "json"}
	case OpBouncersDelete:
		r := req.(BouncersDeleteRequest)
		return []string{"bouncers", "delete", r.Name}
	case OpHubList:
		return []string{"hub", "list", "-o", "raw"}
	case OpScenariosList:
		return []string{"scenarios", "list", "-o", "json"}
	case OpScenariosInspect:
		r := req.(ScenariosInspectRequest)
		return []string{"scenarios", "inspect", r.Scenario, "-o", "json"}
	case OpCollectionsList:
		return []string{"collections", "list", "-o", "json"}
	case OpSimulationStatus:
		return []string{"simulation", "status"}
	case OpAllowlistsList:
		return []string{"allowlists", "list", "-o", "json"}
	case OpAllowlistsCheck:
		r := req.(AllowlistsCheckRequest)
		return []string{"allowlists", "check", r.IPOrRange}
	case OpAllowlistsCreate:
		r := req.(AllowlistsCreateRequest)
		return []string{"allowlists", "create", r.Name, "-d", r.Description}
	case OpAllowlistsAdd:
		return allowlistsAddArgs(req)
	case OpAllowlistsRemove:
		r := req.(AllowlistsRemoveRequest)
		return []string{"allowlists", "remove", r.Name, r.IPOrRange}
	case OpAllowlistsDelete:
		r := req.(AllowlistsDeleteRequest)
		return []string{"allowlists", "delete", r.Name}
	case OpMetricsShow:
		r := req.(MetricsShowRequest)
		return []string{"metrics", "show", string(r.Component), "-o", "json"}
	case OpLapiStatus:
		return []string{"lapi", "status"}
	case OpCAPIStatus:
		return []string{"capi", "status"}
	default:
		// Unsupported operations never reach here; the dispatcher rejects
		// them before building arguments.
		return nil
	}
}

// alertsListArgs builds `alerts list -o json` plus optional fixed -l and
// supported filter flags. The v2 contract dropped `--scope`/`--kind`;
// `--scenario` and `--ip` remain.
func alertsListArgs(req TypedRequest) []string {
	r := req.(AlertsListRequest)
	args := []string{"alerts", "list", "-o", "json"}
	args = appendLimit(args, r.Limit)
	if r.Filter != nil {
		args = appendFilter(args, "scenario", r.Filter.Scenario)
		args = appendFilter(args, "ip", r.Filter.IP)
	}
	return args
}

// decisionsListArgs builds `decisions list -o json` plus optional fixed -l and
// named filters. The v2 contract dropped `--origin`/`--scope`; `--ip`,
// `--type`, and `--scenario` remain.
func decisionsListArgs(req TypedRequest) []string {
	r := req.(DecisionsListRequest)
	args := []string{"decisions", "list", "-o", "json"}
	args = appendLimit(args, r.Limit)
	if r.Filter != nil {
		args = appendFilter(args, "ip", r.Filter.IP)
		args = appendFilter(args, "type", r.Filter.Type)
		args = appendFilter(args, "scenario", r.Filter.Scenario)
	}
	return args
}

// decisionsAddArgs builds `decisions add --ip --duration --reason`.
func decisionsAddArgs(req TypedRequest) []string {
	r := req.(DecisionsAddRequest)
	return []string{
		"decisions", "add",
		"--ip", r.IPOrRange,
		"--duration", r.Duration,
		"--reason", r.Reason,
	}
}

// machinesPruneArgs builds `machines prune` plus optional fixed --duration and
// --not-validated-only. --force is never appended.
func machinesPruneArgs(req TypedRequest) []string {
	r := req.(MachinesPruneRequest)
	args := []string{"machines", "prune"}
	if r.Duration != nil {
		args = append(args, "--duration", *r.Duration)
	}
	if r.NotValidatedOnly {
		args = append(args, "--not-validated-only")
	}
	return args
}

// allowlistsAddArgs builds `allowlists add <name> <ip_or_range>` plus optional
// fixed -e and -d.
func allowlistsAddArgs(req TypedRequest) []string {
	r := req.(AllowlistsAddRequest)
	args := []string{"allowlists", "add", r.Name, r.IPOrRange}
	if r.Expiration != nil {
		args = append(args, "-e", *r.Expiration)
	}
	if r.Comment != nil {
		args = append(args, "-d", *r.Comment)
	}
	return args
}

// appendLimit adds the -l flag and value when limit is non-zero.
func appendLimit(args []string, limit int) []string {
	if limit > 0 {
		args = append(args, "-l", strconv.Itoa(limit))
	}
	return args
}

// appendFilter adds a named filter flag when the value is non-empty.
func appendFilter(args []string, name, value string) []string {
	if value != "" {
		args = append(args, "--"+name, value)
	}
	return args
}
