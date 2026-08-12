package adapter

// This file defines the typed request and result structs for every supported
// operation. These mirror the matrix §4 row schemas and architecture §6
// request schemas. The API layer (task 05) decodes browser requests into
// these types before any adapter call; the adapter validates them again
// before constructing a command, so malformed parameters never start a
// process.

// ---------------------------------------------------------------------------
// Common parameter types (matrix §3)
// ---------------------------------------------------------------------------

// AlertsFilter is the named, typed filter set for alerts.list.
type AlertsFilter struct {
	Scenario string `json:"scenario,omitempty"` // hub identifier
	IP       string `json:"ip,omitempty"`       // IP or CIDR
	Scope    string `json:"scope,omitempty"`    // safe token
	Kind     string `json:"kind,omitempty"`     // safe token
}

// DecisionsFilter is the named, typed filter set for decisions.list.
type DecisionsFilter struct {
	IP       string `json:"ip,omitempty"`       // IP or CIDR
	Scope    string `json:"scope,omitempty"`    // safe token
	Type     string `json:"type,omitempty"`     // safe token
	Origin   string `json:"origin,omitempty"`   // safe token
	Scenario string `json:"scenario,omitempty"` // hub identifier
}

// HubItemType is the enum of hub item types used by hub.list.
type HubItemType string

// Valid hub item types (matrix §4 hub.list; plural item-type strings from the
// raw CSV `type` column).
const (
	HubItemParsers       HubItemType = "parsers"
	HubItemPostOverflows HubItemType = "postoverflows"
	HubItemScenarios     HubItemType = "scenarios"
	HubItemContexts      HubItemType = "contexts"
	HubItemAppsecConfigs HubItemType = "appsec-configs"
	HubItemAppsecRules   HubItemType = "appsec-rules"
	HubItemCollections   HubItemType = "collections"
)

// ValidHubItemType reports whether t is a valid hub item type enum value.
func ValidHubItemType(t HubItemType) bool {
	switch t {
	case HubItemParsers, HubItemPostOverflows, HubItemScenarios, HubItemContexts,
		HubItemAppsecConfigs, HubItemAppsecRules, HubItemCollections:
		return true
	default:
		return false
	}
}

// MetricComponent is the enum of metrics.show components.
type MetricComponent string

// Valid metric components (matrix §4 metrics.show).
const (
	MetricAcquisition MetricComponent = "acquisition"
	MetricAppsec      MetricComponent = "appsec"
	MetricLAPI        MetricComponent = "lapi"
)

// ValidMetricComponent reports whether c is a valid metric component enum.
func ValidMetricComponent(c MetricComponent) bool {
	switch c {
	case MetricAcquisition, MetricAppsec, MetricLAPI:
		return true
	default:
		return false
	}
}

// ---------------------------------------------------------------------------
// Read requests
// ---------------------------------------------------------------------------

// AlertsListRequest is the typed request for alerts.list.
type AlertsListRequest struct {
	Limit  int           `json:"limit,omitempty"`  // 1..500; page mode limit only when the -l flag is supported
	Filter *AlertsFilter `json:"filter,omitempty"` // named, typed filters only
}

// AlertsInspectRequest is the typed request for alerts.inspect.
type AlertsInspectRequest struct {
	ID int64 `json:"id"` // > 0
}

// DecisionsListRequest is the typed request for decisions.list.
type DecisionsListRequest struct {
	Limit  int              `json:"limit,omitempty"`  // 1..500 (CrowdSec default 100)
	Filter *DecisionsFilter `json:"filter,omitempty"` // named, typed filters only
}

// MachinesListRequest is the typed request for machines.list (no params).
type MachinesListRequest struct{}

// BouncersListRequest is the typed request for bouncers.list (no params).
type BouncersListRequest struct{}

// HubListRequest is the typed request for hub.list.
type HubListRequest struct {
	Type HubItemType `json:"type,omitempty"` // optional local filter after parsing
}

// ScenariosListRequest is the typed request for scenarios.list (no params).
type ScenariosListRequest struct{}

// ScenariosInspectRequest is the typed request for scenarios.inspect.
type ScenariosInspectRequest struct {
	Scenario string `json:"scenario"` // hub identifier
}

// CollectionsListRequest is the typed request for collections.list (no params).
type CollectionsListRequest struct{}

// ProfilesInspectRequest is the typed request for profiles.inspect (no
// params; read-only file boundary).
type ProfilesInspectRequest struct{}

// SimulationStatusRequest is the typed request for simulation.status (no params).
type SimulationStatusRequest struct{}

// AllowlistsListRequest is the typed request for allowlists.list (no params).
type AllowlistsListRequest struct{}

// AllowlistsCheckRequest is the typed request for allowlists.check.
type AllowlistsCheckRequest struct {
	IPOrRange string `json:"ip_or_range"`
}

// MetricsShowRequest is the typed request for metrics.show.
type MetricsShowRequest struct {
	Component MetricComponent `json:"component"` // enum acquisition|appsec|lapi
}

// LapiStatusRequest is the typed request for lapi.status (no params).
type LapiStatusRequest struct{}

// CAPIStatusRequest is the typed request for capi.status (no params).
type CAPIStatusRequest struct{}

// ---------------------------------------------------------------------------
// Mutation requests (architecture §6.2)
// ---------------------------------------------------------------------------

// DecisionsAddRequest is the typed request for decisions.add.
type DecisionsAddRequest struct {
	IPOrRange string `json:"ip_or_range"` // IP or CIDR
	Duration  string `json:"duration"`    // duration grammar; <= 365d
	Reason    string `json:"reason"`      // 1..256 chars, newline-free
}

// DecisionsDeleteRequest is the typed request for decisions.delete.
type DecisionsDeleteRequest struct {
	IPOrRange string `json:"ip_or_range"` // IP or CIDR
}

// MachinesPruneRequest is the typed request for machines.prune.
type MachinesPruneRequest struct {
	Duration         *string `json:"duration,omitempty"`           // duration grammar; >= 2m unless not_validated_only
	NotValidatedOnly bool    `json:"not_validated_only,omitempty"` // boolean
}

// BouncersDeleteRequest is the typed request for bouncers.delete.
type BouncersDeleteRequest struct {
	Name string `json:"name"` // identifier
}

// AllowlistsCreateRequest is the typed request for allowlists.create.
type AllowlistsCreateRequest struct {
	Name        string `json:"name"`        // identifier
	Description string `json:"description"` // 1..256 chars (required by cscli 1.7.8)
}

// AllowlistsAddRequest is the typed request for allowlists.add.
type AllowlistsAddRequest struct {
	Name       string  `json:"name"`                 // identifier
	IPOrRange  string  `json:"ip_or_range"`          // IP or CIDR
	Expiration *string `json:"expiration,omitempty"` // duration grammar
	Comment    *string `json:"comment,omitempty"`    // 1..256 chars
}

// AllowlistsRemoveRequest is the typed request for allowlists.remove.
type AllowlistsRemoveRequest struct {
	Name      string `json:"name"`        // identifier
	IPOrRange string `json:"ip_or_range"` // IP or CIDR
}

// AllowlistsDeleteRequest is the typed request for allowlists.delete.
type AllowlistsDeleteRequest struct {
	Name string `json:"name"` // identifier
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

// PageInfo mirrors architecture §4.8 pagination.
type PageInfo struct {
	Mode    string `json:"mode"` // limit | none
	Limit   int    `json:"limit,omitempty"`
	Offset  int    `json:"offset,omitempty"`
	HasMore bool   `json:"has_more"`
}

// CollectionResult is the envelope for a collection read.
type CollectionResult struct {
	Items any      `json:"items"`
	Page  PageInfo `json:"page"`
}

// AlertDecision is a decision embedded in an alert.
type AlertDecision struct {
	Type     string `json:"type"`
	Duration string `json:"duration"`
}

// AlertItem is a single alert record produced from `cscli alerts list -o json`.
type AlertItem struct {
	ID        int64           `json:"id"`
	StartAt   string          `json:"start_at"`
	StopAt    string          `json:"stop_at,omitempty"`
	Scenario  string          `json:"scenario"`
	Scope     string          `json:"scope"`
	Value     string          `json:"value"`
	Decisions []AlertDecision `json:"decisions"`
}

// AlertsListResult is the typed result for alerts.list.
type AlertsListResult struct {
	Items []AlertItem `json:"items"`
	Page  PageInfo    `json:"page"`
}

// AlertsInspectResult is the typed result for alerts.inspect.
type AlertsInspectResult struct {
	Alert AlertItem `json:"alert"`
}

// DecisionItem is a single decision record from `cscli decisions list -o json`.
type DecisionItem struct {
	ID        int64  `json:"id"`
	Origin    string `json:"origin"`
	Type      string `json:"type"`
	Scope     string `json:"scope"`
	Value     string `json:"value"`
	Scenario  string `json:"scenario,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
	Until     string `json:"until,omitempty"`
	Duration  string `json:"duration,omitempty"`
}

// DecisionsListResult is the typed result for decisions.list.
type DecisionsListResult struct {
	Items []DecisionItem `json:"items"`
	Page  PageInfo       `json:"page"`
}

// MachineItem is a machine record from `cscli machines list -o json`. cscli
// 1.7.x emits camelCase keys (machineId/ipAddress/isValidated) at the alert/
// machine blob root; earlier releases used snake_case. We expose the camelCase
// shape that the currently verified cscli 1.7.8 returns.
type MachineItem struct {
	MachineID      string `json:"machineId"`
	IPAddress      string `json:"ipAddress,omitempty"`
	Version        string `json:"version,omitempty"`
	LastHeartbeat  string `json:"last_heartbeat,omitempty"`
	UpdatedAt      string `json:"updated_at,omitempty"`
	IsValidated    bool   `json:"isValidated"`
	AuthType        string `json:"auth_type,omitempty"`
	OS              string `json:"os,omitempty"`
}

// BouncerItem is a bouncer record from `cscli bouncers list -o json`.
type BouncerItem struct {
	Name      string `json:"name"`
	IPAddress string `json:"ip_address,omitempty"`
	Type      string `json:"type,omitempty"`
	Version   string `json:"version,omitempty"`
	LastPull  string `json:"last_pull,omitempty"`
}

// HubItem is a hub inventory row from `cscli hub list -o raw` (fixed columns
// name,status,version,description,type).
type HubItem struct {
	Name        string      `json:"name"`
	Status      string      `json:"status"`
	Version     string      `json:"version"`
	Description string      `json:"description"`
	Type        HubItemType `json:"type"`
}

// ComponentItem is a generic scenario/collection record from `cscli
// scenarios list -o json` / `cscli collections list -o json`.
type ComponentItem struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version,omitempty"`
	Status      string `json:"status,omitempty"`
}

// ProfileItem is a summary of a profile parsed from profiles.yaml (read-only
// configuration-file boundary, not a cscli operation).
type ProfileItem struct {
	Name      string   `json:"name,omitempty"`
	Filters   []string `json:"filters,omitempty"`
	Decisions []string `json:"decisions,omitempty"`
}

// SimulationStatusItem is the parsed simulation status.
type SimulationStatusItem struct {
	Enabled  bool   `json:"enabled"`
	Duration string `json:"duration,omitempty"`
}

// AllowlistEntry is an entry within an allowlist.
type AllowlistEntry struct {
	IP         string `json:"ip"`
	Comment    string `json:"comment,omitempty"`
	Source     string `json:"source"`
	Expiration string `json:"expiration,omitempty"`
	CreatedAt  string `json:"created_at,omitempty"`
}

// AllowlistItem is a single allowlist from `cscli allowlists list -o json`.
type AllowlistItem struct {
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	Source      string           `json:"source"`
	Entries     []AllowlistEntry `json:"entries"`
}

// AllowlistsCheckResult is the typed result for allowlists.check.
type AllowlistsCheckResult struct {
	Matched bool `json:"matched"`
}

// MetricItem is a section-keyed metric payload from `cscli metrics show -o json`.
type MetricItem struct {
	Component MetricComponent `json:"component"`
	Data      map[string]any  `json:"data"`
}

// LapiStatusResult is the parsed lapi status.
type LapiStatusResult struct {
	Healthy bool   `json:"healthy"`
	Message string `json:"message,omitempty"`
}

// CAPIStatusResult is the parsed capi status.
type CAPIStatusResult struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message,omitempty"`
}

// MutationResult is the typed result for every mutation. Refreshed lists the
// matrix-defined refresh operation(s) executed after the mutation.
type MutationResult struct {
	Status    string   `json:"status"` // "success"
	Action    string   `json:"action"`
	Refreshed []string `json:"refreshed"`
}

// TypedRequest is the type-erased view of a validated typed request. The API
// layer decodes into a concrete struct; the adapter asserts the concrete type
// it expects for the operation. This keeps the Executor contract simple while
// ensuring every handler receives a validated typed value.
type TypedRequest = any

// TypedResult is the type-erased view of a typed result.
type TypedResult = any
