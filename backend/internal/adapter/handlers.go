package adapter

import (
	"context"
	"encoding/json"
	"strings"
)

// This file implements the per-operation handlers. Each handler validates its
// typed request, builds a fixed argument vector, runs the command, parses
// structured output, and returns a typed result. Mutations return a
// MutationResult and then perform the matrix-defined refresh.

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

func (a *adapter) alertsList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(AlertsListRequest)
	if r.Limit == 0 {
		r.Limit = defaultLimitAlerts
	}
	if err := validateLimit("limit", r.Limit); err != nil {
		return nil, err
	}
	if err := validateAlertsFilters(r.Filter); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpAlertsList, r)
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseJSONCollection[AlertItem](OpAlertsList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	hasMore := len(items) == r.Limit
	return AlertsListResult{
		Items: items,
		Page:  PageInfo{Mode: "limit", Limit: r.Limit, Offset: 0, HasMore: hasMore},
	}, nil
}

func (a *adapter) alertsInspect(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(AlertsInspectRequest)
	if r.ID <= 0 {
		return nil, validationError("id", "must be greater than 0")
	}
	res, opErr := a.command(ctx, OpAlertsInspect, r)
	if opErr != nil {
		return nil, opErr
	}
	item, perr := parseJSONObject[AlertItem](OpAlertsInspect, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return AlertsInspectResult{Alert: item}, nil
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

func (a *adapter) decisionsList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(DecisionsListRequest)
	if r.Limit == 0 {
		r.Limit = defaultLimitDecisions
	}
	if err := validateLimit("limit", r.Limit); err != nil {
		return nil, err
	}
	if err := validateDecisionsFilters(r.Filter); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpDecisionsList, r)
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseJSONCollection[DecisionItem](OpDecisionsList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	hasMore := len(items) == r.Limit
	return DecisionsListResult{
		Items: items,
		Page:  PageInfo{Mode: "limit", Limit: r.Limit, Offset: 0, HasMore: hasMore},
	}, nil
}

func (a *adapter) decisionsAdd(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(DecisionsAddRequest)
	if err := validateIPOrRange("ip_or_range", r.IPOrRange); err != nil {
		return nil, err
	}
	if err := validateDuration("duration", r.Duration); err != nil {
		return nil, err
	}
	if err := validateText("reason", r.Reason); err != nil {
		return nil, err
	}
	// Reject the forbidden mutation-affecting extensions explicitly; they are
	// simply not part of the typed schema, so there is nothing to pass.
	res, opErr := a.command(ctx, OpDecisionsAdd, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpDecisionsAdd, r)
	return MutationResult{
		Status:    "success",
		Action:    "Added an active decision for " + r.IPOrRange,
		Refreshed: refreshed,
	}, nil
}

func (a *adapter) decisionsDelete(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(DecisionsDeleteRequest)
	if err := validateIPOrRange("ip_or_range", r.IPOrRange); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpDecisionsDelete, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpDecisionsDelete, r)
	return MutationResult{
		Status:    "success",
		Action:    "Removed decisions for " + r.IPOrRange,
		Refreshed: refreshed,
	}, nil
}

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

func (a *adapter) machinesList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpMachinesList, MachinesListRequest{})
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseJSONCollection[MachineItem](OpMachinesList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return CollectionResult{Items: items, Page: PageInfo{Mode: "none"}}, nil
}

func (a *adapter) machinesPrune(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(MachinesPruneRequest)
	if err := validatePrune(r.Duration, r.NotValidatedOnly); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpMachinesPrune, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpMachinesPrune, r)
	return MutationResult{
		Status:    "success",
		Action:    "Pruned stale machine registrations",
		Refreshed: refreshed,
	}, nil
}

// ---------------------------------------------------------------------------
// Bouncers
// ---------------------------------------------------------------------------

func (a *adapter) bouncersList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpBouncersList, BouncersListRequest{})
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseJSONCollection[BouncerItem](OpBouncersList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return CollectionResult{Items: items, Page: PageInfo{Mode: "none"}}, nil
}

func (a *adapter) bouncersDelete(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(BouncersDeleteRequest)
	if err := validateIdentifier("name", r.Name); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpBouncersDelete, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpBouncersDelete, r)
	return MutationResult{
		Status:    "success",
		Action:    "Removed bouncer " + r.Name,
		Refreshed: refreshed,
	}, nil
}

// ---------------------------------------------------------------------------
// Hub / components
// ---------------------------------------------------------------------------

func (a *adapter) hubList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(HubListRequest)
	if r.Type != "" && !ValidHubItemType(r.Type) {
		return nil, validationError("type", "is not a valid hub item type")
	}
	res, opErr := a.command(ctx, OpHubList, r)
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseHubRaw(OpHubList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	// Local filter applied after parsing (matrix §4 hub.list).
	filtered := items[:0]
	for _, it := range items {
		if r.Type == "" || it.Type == r.Type {
			filtered = append(filtered, it)
		}
	}
	if filtered == nil {
		filtered = []HubItem{}
	}
	return CollectionResult{Items: filtered, Page: PageInfo{Mode: "none"}}, nil
}

func (a *adapter) scenariosList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpScenariosList, ScenariosListRequest{})
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseComponentList(OpScenariosList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return CollectionResult{Items: items, Page: PageInfo{Mode: "none"}}, nil
}

func (a *adapter) scenariosInspect(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(ScenariosInspectRequest)
	if err := validateIdentifier("scenario", r.Scenario); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpScenariosInspect, r)
	if opErr != nil {
		return nil, opErr
	}
	item, perr := parseJSONObject[ComponentItem](OpScenariosInspect, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return item, nil
}

func (a *adapter) collectionsList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpCollectionsList, CollectionsListRequest{})
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseComponentList(OpCollectionsList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return CollectionResult{Items: items, Page: PageInfo{Mode: "none"}}, nil
}

func (a *adapter) simulationStatus(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpSimulationStatus, SimulationStatusRequest{})
	if opErr != nil {
		return nil, opErr
	}
	enabled, perr := parseSimulationStatus(OpSimulationStatus, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return SimulationStatusItem{Enabled: enabled}, nil
}

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

func (a *adapter) allowlistsList(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpAllowlistsList, AllowlistsListRequest{})
	if opErr != nil {
		return nil, opErr
	}
	items, perr := parseJSONCollection[AllowlistItem](OpAllowlistsList, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return CollectionResult{Items: items, Page: PageInfo{Mode: "none"}}, nil
}

func (a *adapter) allowlistsCheck(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(AllowlistsCheckRequest)
	if err := validateIPOrRange("ip_or_range", r.IPOrRange); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpAllowlistsCheck, r)
	if opErr != nil {
		return nil, opErr
	}
	matched := strings.Contains(strings.ToLower(string(res.Stdout)), "found")
	return AllowlistsCheckResult{Matched: matched}, nil
}

func (a *adapter) allowlistsCreate(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(AllowlistsCreateRequest)
	if err := validateIdentifier("name", r.Name); err != nil {
		return nil, err
	}
	if err := validateText("description", r.Description); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpAllowlistsCreate, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpAllowlistsCreate, r)
	return MutationResult{
		Status:    "success",
		Action:    "Created allowlist " + r.Name,
		Refreshed: refreshed,
	}, nil
}

func (a *adapter) allowlistsAdd(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(AllowlistsAddRequest)
	if err := validateIdentifier("name", r.Name); err != nil {
		return nil, err
	}
	if err := validateIPOrRange("ip_or_range", r.IPOrRange); err != nil {
		return nil, err
	}
	if r.Expiration != nil {
		if err := validateDuration("expiration", *r.Expiration); err != nil {
			return nil, err
		}
	}
	if r.Comment != nil {
		if err := validateText("comment", *r.Comment); err != nil {
			return nil, err
		}
	}
	res, opErr := a.command(ctx, OpAllowlistsAdd, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpAllowlistsAdd, r)
	return MutationResult{
		Status:    "success",
		Action:    "Added " + r.IPOrRange + " to allowlist " + r.Name,
		Refreshed: refreshed,
	}, nil
}

func (a *adapter) allowlistsRemove(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(AllowlistsRemoveRequest)
	if err := validateIdentifier("name", r.Name); err != nil {
		return nil, err
	}
	if err := validateIPOrRange("ip_or_range", r.IPOrRange); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpAllowlistsRemove, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpAllowlistsRemove, r)
	return MutationResult{
		Status:    "success",
		Action:    "Removed " + r.IPOrRange + " from allowlist " + r.Name,
		Refreshed: refreshed,
	}, nil
}

func (a *adapter) allowlistsDelete(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(AllowlistsDeleteRequest)
	if err := validateIdentifier("name", r.Name); err != nil {
		return nil, err
	}
	res, opErr := a.command(ctx, OpAllowlistsDelete, r)
	if opErr != nil {
		return nil, opErr
	}
	_ = res
	refreshed := []string{}
	a.refresh(ctx, &refreshed, OpAllowlistsDelete, r)
	return MutationResult{
		Status:    "success",
		Action:    "Deleted allowlist " + r.Name,
		Refreshed: refreshed,
	}, nil
}

// ---------------------------------------------------------------------------
// Metrics / status
// ---------------------------------------------------------------------------

func (a *adapter) metricsShow(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	r := req.(MetricsShowRequest)
	if !ValidMetricComponent(r.Component) {
		return nil, validationError("component", "is not a supported metric component")
	}
	res, opErr := a.command(ctx, OpMetricsShow, r)
	if opErr != nil {
		return nil, opErr
	}
	m, perr := parseMetricsJSON(OpMetricsShow, res.Stdout)
	if perr != nil {
		return nil, perr
	}
	return MetricItem{Component: r.Component, Data: m}, nil
}

func (a *adapter) lapiStatus(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpLapiStatus, LapiStatusRequest{})
	if opErr != nil {
		return nil, opErr
	}
	ok := strings.Contains(strings.ToLower(string(res.Stdout)), "ok")
	return LapiStatusResult{Healthy: ok}, nil
}

func (a *adapter) capiStatus(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	res, opErr := a.command(ctx, OpCAPIStatus, CAPIStatusRequest{})
	if opErr != nil {
		return nil, opErr
	}
	return CAPIStatusResult{Enabled: strings.TrimSpace(string(res.Stdout)) != ""}, nil
}

// ---------------------------------------------------------------------------
// Profile reader (not a cscli operation)
// ---------------------------------------------------------------------------

func (a *adapter) profilesInspect(ctx context.Context, req TypedRequest) (TypedResult, *OpError) {
	if a.profiles == nil || a.profiles.path == "" {
		return nil, &OpError{Class: ErrUnavailable, Message: "CrowdSec command-line tools are unavailable.", Retryable: true}
	}
	items, err := a.profiles.Read()
	if err != nil {
		return nil, &OpError{Class: ErrCrowdsecFailure, Message: "CrowdSec rejected the requested operation.", Retryable: false}
	}
	return CollectionResult{Items: items, Page: PageInfo{Mode: "none"}}, nil
}

// ---------------------------------------------------------------------------
// Filter validation helpers
// ---------------------------------------------------------------------------

func validateAlertsFilters(f *AlertsFilter) *OpError {
	if f == nil {
		return nil
	}
	if f.Scenario != "" {
		if err := validateIdentifier("filter.scenario", f.Scenario); err != nil {
			return err
		}
	}
	if f.IP != "" {
		if err := validateIPOrRange("filter.ip", f.IP); err != nil {
			return err
		}
	}
	if f.Scope != "" {
		if err := validateSafeToken("filter.scope", f.Scope); err != nil {
			return err
		}
	}
	if f.Kind != "" {
		if err := validateSafeToken("filter.kind", f.Kind); err != nil {
			return err
		}
	}
	return nil
}

func validateDecisionsFilters(f *DecisionsFilter) *OpError {
	if f == nil {
		return nil
	}
	if f.IP != "" {
		if err := validateIPOrRange("filter.ip", f.IP); err != nil {
			return err
		}
	}
	if f.Scope != "" {
		if err := validateSafeToken("filter.scope", f.Scope); err != nil {
			return err
		}
	}
	if f.Type != "" {
		if err := validateSafeToken("filter.type", f.Type); err != nil {
			return err
		}
	}
	if f.Origin != "" {
		if err := validateSafeToken("filter.origin", f.Origin); err != nil {
			return err
		}
	}
	if f.Scenario != "" {
		if err := validateIdentifier("filter.scenario", f.Scenario); err != nil {
			return err
		}
	}
	return nil
}

// parseComponentList parses component JSON output into a flat item list. The
// output is `{"type":[...]}`; we flatten the first array we find.
func parseComponentList(op OperationID, out []byte) ([]ComponentItem, *OpError) {
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return []ComponentItem{}, nil
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return nil, newOpError(ErrMalformedOutput, op)
	}
	for _, v := range raw {
		var items []ComponentItem
		if err := json.Unmarshal(v, &items); err == nil {
			if items == nil {
				items = []ComponentItem{}
			}
			return items, nil
		}
	}
	return []ComponentItem{}, nil
}

// parseSimulationStatus parses `cscli simulation status` human output for the
// enabled state.
func parseSimulationStatus(op OperationID, out []byte) (bool, *OpError) {
	lower := strings.ToLower(string(out))
	if strings.Contains(lower, "disabled") {
		return false, nil
	}
	if strings.Contains(lower, "enabled") {
		return true, nil
	}
	return false, newOpError(ErrMalformedOutput, op)
}
