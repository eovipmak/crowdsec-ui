// Package adapter implements the strict `cscli` execution boundary between
// the dashboard and CrowdSec (architecture §3, matrix §2).
//
// The adapter owns every argument vector. It constructs them internally from
// validated typed parameters and runs them directly with exec.CommandContext;
// it never invokes a shell and never concatenates raw browser input into a
// command. The package never imports net/http, and it never reads secrets
// from requests or returns raw stderr/command lines to callers.
package adapter

// OperationID is the fixed matrix operation identifier (matrix §4). A browser
// request can select only one of these identifiers plus its typed request
// schema; it can never supply a command name, executable path, shell
// fragment, or raw argument array (matrix §5 "No command passthrough").
type OperationID string

// Supported and capability-gated operation identifiers (matrix §4, architecture
// §5.1). These are the operations that have an executable handler.
const (
	// Alerts
	OpAlertsList    OperationID = "alerts.list"
	OpAlertsInspect OperationID = "alerts.inspect"

	// Decisions
	OpDecisionsList   OperationID = "decisions.list"
	OpDecisionsAdd    OperationID = "decisions.add"
	OpDecisionsDelete OperationID = "decisions.delete"

	// Machines
	OpMachinesList  OperationID = "machines.list"
	OpMachinesPrune OperationID = "machines.prune"

	// Bouncers
	OpBouncersList   OperationID = "bouncers.list"
	OpBouncersDelete OperationID = "bouncers.delete"

	// Hub / components
	OpHubList OperationID = "hub.list"

	// Scenarios
	OpScenariosList    OperationID = "scenarios.list"
	OpScenariosInspect OperationID = "scenarios.inspect"

	// Collections
	OpCollectionsList OperationID = "collections.list"

	// Profiles (read-only configuration-file boundary, not a cscli operation)
	OpProfilesInspect OperationID = "profiles.inspect"

	// Simulation
	OpSimulationStatus OperationID = "simulation.status"

	// Allowlists
	OpAllowlistsList   OperationID = "allowlists.list"
	OpAllowlistsCheck  OperationID = "allowlists.check"
	OpAllowlistsCreate OperationID = "allowlists.create"
	OpAllowlistsAdd    OperationID = "allowlists.add"
	OpAllowlistsRemove OperationID = "allowlists.remove"
	OpAllowlistsDelete OperationID = "allowlists.delete"

	// Metrics
	OpMetricsShow OperationID = "metrics.show"

	// Status
	OpLapiStatus OperationID = "lapi.status"
	OpCAPIStatus OperationID = "capi.status"

	// Matrix rows explicitly unsupported in the MVP (architecture §5.3).
	// These receive NO executable handler and are reported as unsupported.
	OpAlertsDelete       OperationID = "alerts.delete"
	OpDecisionsImport    OperationID = "decisions.import"
	OpMachinesDelete     OperationID = "machines.delete"
	OpBouncersAdd        OperationID = "bouncers.add"
	OpHubUpdate          OperationID = "hub.update"
	OpScenariosInstall   OperationID = "scenarios.install"
	OpCollectionsInstall OperationID = "collections.install"
	OpCollectionsRemove  OperationID = "collections.remove"
	OpSimulationEnable   OperationID = "simulation.enable"
	OpSimulationDisable  OperationID = "simulation.disable"
	OpAllowlistsImport   OperationID = "allowlists.import"
)

// UnsupportedOperationIDs lists the matrix rows that are explicitly
// unsupported in the MVP. They are reported by Capabilities as unsupported
// and have NO executable handler; any attempt to Run one returns an error
// without starting a process.
var UnsupportedOperationIDs = []OperationID{
	OpAlertsDelete, OpDecisionsImport, OpMachinesDelete, OpBouncersAdd,
	OpHubUpdate, OpScenariosInstall, OpCollectionsInstall, OpCollectionsRemove,
	OpSimulationEnable, OpSimulationDisable, OpAllowlistsImport,
}

// AllOperationIDs lists every matrix row (supported, capability-gated, and
// unsupported) in the authoritative §5.1/§5.3 order. The startup capability
// probe and the Capabilities method report a value for every entry.
func AllOperationIDs() []OperationID {
	return []OperationID{
		OpAlertsList, OpAlertsInspect, OpAlertsDelete,
		OpDecisionsList, OpDecisionsAdd, OpDecisionsDelete, OpDecisionsImport,
		OpMachinesList, OpMachinesDelete, OpMachinesPrune,
		OpBouncersList, OpBouncersAdd, OpBouncersDelete,
		OpHubList, OpHubUpdate,
		OpScenariosList, OpScenariosInspect, OpScenariosInstall,
		OpCollectionsList, OpCollectionsInstall, OpCollectionsRemove,
		OpProfilesInspect,
		OpSimulationStatus, OpSimulationEnable, OpSimulationDisable,
		OpAllowlistsList, OpAllowlistsCheck, OpAllowlistsCreate, OpAllowlistsAdd,
		OpAllowlistsImport, OpAllowlistsRemove, OpAllowlistsDelete,
		OpMetricsShow, OpLapiStatus, OpCAPIStatus,
	}
}

// IsUnsupported reports whether the operation is a matrix row marked
// explicitly unsupported in the MVP.
func (op OperationID) IsUnsupported() bool {
	for _, u := range UnsupportedOperationIDs {
		if op == u {
			return true
		}
	}
	return false
}

func (op OperationID) String() string { return string(op) }

// unsupportedError builds an OpError for unsupported operations.
func unsupportedError(op OperationID) *OpError {
	return &OpError{
		Class:     ErrUnsupported,
		Message:   "This CrowdSec installation does not support the requested operation.",
		Retryable: false,
		Operation: op,
	}
}
