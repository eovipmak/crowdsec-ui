package adapter

import (
	"encoding/json"
	"fmt"
	"strings"
)

// This file parses supported structured cscli output (`-o json`, and `-o raw`
// for hub.list) into stable typed results. It never returns raw stderr or
// command lines. Malformed JSON is mapped to malformed_output; empty
// collections are returned as `items: []`, not errors.

// Hub raw columns are name,status,version,description,type (matrix §4
// hub.list).
const hubRawColumns = 5

// parseJSONCollection decodes a JSON array into items. An empty/blank input is
// a valid empty collection. Malformed JSON is malformed_output.
func parseJSONCollection[T any](op OperationID, out []byte) ([]T, *OpError) {
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return []T{}, nil
	}
	var items []T
	if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
		return nil, newOpError(ErrMalformedOutput, op)
	}
	if items == nil {
		items = []T{}
	}
	return items, nil
}

// parseJSONObject decodes a JSON object into a value. Malformed JSON is
// malformed_output.
func parseJSONObject[T any](op OperationID, out []byte) (T, *OpError) {
	var zero T
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return zero, newOpError(ErrMalformedOutput, op)
	}
	if err := json.Unmarshal([]byte(trimmed), &zero); err != nil {
		return zero, newOpError(ErrMalformedOutput, op)
	}
	return zero, nil
}

// parseHubRaw parses `cscli hub list -o raw` CSV rows with the fixed columns
// name,status,version,description,type. It rejects malformed rows and
// unexpected column counts. The returned rows are then filtered locally by
// the optional type enum.
func parseHubRaw(op OperationID, out []byte) ([]HubItem, *OpError) {
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	items := make([]HubItem, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// The raw output may include a header or a formatting line; skip
		// lines that are not 5-comma fields.
		cols := strings.Split(line, ",")
		if len(cols) != hubRawColumns {
			continue
		}
		item := HubItem{
			Name:        strings.TrimSpace(cols[0]),
			Status:      strings.TrimSpace(cols[1]),
			Version:     strings.TrimSpace(cols[2]),
			Description: strings.TrimSpace(cols[3]),
			Type:        HubItemType(strings.TrimSpace(cols[4])),
		}
		if item.Name == "" {
			return nil, newOpError(ErrMalformedOutput, op)
		}
		items = append(items, item)
	}
	return items, nil
}

// parseComponentJSON parses `cscli scenarios list -o json` /
// `cscli collections list -o json` output, which is a JSON object keyed by the
// item type containing an array of records, e.g. `{"scenarios":[...]}`. An
// absent/empty type key is an empty collection.
func parseComponentJSON(op OperationID, out []byte) ([]ComponentItem, *OpError) {
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return []ComponentItem{}, nil
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return nil, newOpError(ErrMalformedOutput, op)
	}
	return []ComponentItem{}, nil
}

// parseMetricsJSON validates metrics output as a section-keyed JSON object.
// The concrete shape is component-specific; we validate it is a JSON object
// and return the raw map for the API to render known fields.
func parseMetricsJSON(op OperationID, out []byte) (map[string]any, *OpError) {
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return nil, newOpError(ErrMalformedOutput, op)
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(trimmed), &m); err != nil {
		return nil, newOpError(ErrMalformedOutput, op)
	}
	return m, nil
}

// parseDecisionsList decodes `cscli decisions list -o json`. The cscli 1.7.x
// decision list is NOT a flat array of decisions: it is an array of
// alert-shaped blobs, each carrying an embedded `decisions` array (see
// matrix §4 `decisions.list`). Each row in `decisions[]` carries the actual
// decision fields (origin/type/scope/value/duration) but no alert-level id or
// scenario, so each output DecisionItem is a synthesis: identity/time/scenario/
// events/alert_id/country/AS from the alert blob, and origin/type/scope/value/
// duration from the embedded decision. An alert with no decisions (e.g. a
// simulated/none scenario) is skipped. Malformed JSON is malformed_output; an
// empty input is an empty list.
func parseDecisionsList(op OperationID, out []byte) ([]DecisionItem, *OpError) {
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return []DecisionItem{}, nil
	}
	// cscli emits decision records (not alert blobs) when there are no
	// decisions in the last fetched window; the top-level shape is then a flat
	// array of decision objects. Detect that and parse directly.
	if flat, ok := tryParseFlatDecisions(trimmed); ok {
		return flat, nil
	}
	var blobs []cscliDecisionsEntry
	if err := json.Unmarshal([]byte(trimmed), &blobs); err != nil {
		return nil, newOpError(ErrMalformedOutput, op)
	}
	items := make([]DecisionItem, 0, len(blobs))
	for _, b := range blobs {
		for _, d := range b.Decisions {
			item := DecisionItem{
				ID:        b.ID,
				Origin:    d.Origin,
				Type:      d.Type,
				Scope:     d.Scope,
				Value:     d.Value,
				Scenario:  b.Scenario,
				CreatedAt: b.CreatedAt,
				Until:     d.Until,
				Duration:  d.Duration,
				Events:    b.Events,
				AlertID:   b.ID,
			}
			if b.Source != nil {
				item.Country = b.Source.Country
				item.ASNumber = b.Source.ASNumber
				item.ASName = b.Source.ASName
			}
			items = append(items, item)
		}
	}
	if items == nil {
		items = []DecisionItem{}
	}
	return items, nil
}

// tryParseFlatDecisions attempts to decode `out` as a flat array of
// DecisionItem-shaped objects. This covers the cscli variant where rows are
// already decision records. The boolean reports whether such a flat array
// could be decoded.
func tryParseFlatDecisions(out string) ([]DecisionItem, bool) {
	var flat []DecisionItem
	if err := json.Unmarshal([]byte(out), &flat); err != nil {
		return nil, false
	}
	// Heuristic: a flat decision record carries a non-empty `type` and
	// `scope` (or `value`) at the top level. cscli's alert-blob shape leaves
	// those empty at the blob root, so a row with a non-empty type/scope means
	// the flat decoder succeeded.
	for _, d := range flat {
		if d.Type != "" || d.Scope != "" || d.Value != "" {
			if flat == nil {
				flat = []DecisionItem{}
			}
			return flat, true
		}
	}
	return nil, false
}

// cscliDecisionsEntry is the alert-blob shape emitted by `cscli decisions list
// -o json`. Only the fields we synthesize DecisionItem from are decoded; the
// remainder (events, meta, capacity) is ignored by the dashboard (matrix §4).
// Country/AS come from the nested `source` object; events from `events_count`.
type cscliDecisionsEntry struct {
	ID        int64                   `json:"id"`
	Scenario  string                  `json:"scenario"`
	CreatedAt string                  `json:"created_at"`
	Events    int64                   `json:"events_count"`
	Source    *cscliSource            `json:"source,omitempty"`
	Decisions []cscliEmbeddedDecision `json:"decisions"`
}

// cscliSource is the alert/decision blob `source` object. cscli 1.7.x nests
// scope/value and the GeoIP enrichment (country/AS) here.
type cscliSource struct {
	Scope    string `json:"scope,omitempty"`
	Value    string `json:"value,omitempty"`
	Country  string `json:"cn,omitempty"`
	ASNumber string `json:"as_number,omitempty"`
	ASName   string `json:"as_name,omitempty"`
}

// cscliAlert is the raw alert-blob shape emitted by `cscli alerts list -o json`
// (and `cscli alerts inspect`). It mirrors the authoritative models.Alert JSON
// tags so the decoder is robust regardless of version: scope/value/country/AS
// live under the nested `source` object, while events_count/machine_id/kind/
// created_at are root fields. The Reason (table "reason" column) is the
// scenario. Unknown/ignored fields are dropped.
type cscliAlert struct {
	ID          *int64          `json:"id,omitempty"`
	StartAt     *string         `json:"start_at,omitempty"`
	StopAt      *string         `json:"stop_at,omitempty"`
	Scenario    *string         `json:"scenario,omitempty"`
	CreatedAt   *string         `json:"created_at,omitempty"`
	EventsCount *int64          `json:"events_count,omitempty"`
	MachineID   *string         `json:"machine_id,omitempty"`
	Kind        *string         `json:"kind,omitempty"`
	Source      *cscliSource    `json:"source,omitempty"`
	Decisions   []AlertDecision `json:"decisions,omitempty"`
}

// UnmarshalJSON flattens the cscli alert blob into the flat AlertItem shape the
// dashboard exposes. Existing flat fields (id/start_at/scenario/scope/value/
// decisions) are preserved; new operator-facing fields (country/as/as_name/
// events/machine/kind/reason/created_at) are surfaced. Malformed JSON is left
// to the collection parser, which returns malformed_output.
func (a *AlertItem) UnmarshalJSON(data []byte) error {
	var raw cscliAlert
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if raw.ID != nil {
		a.ID = *raw.ID
	}
	if raw.StartAt != nil {
		a.StartAt = *raw.StartAt
	}
	if raw.StopAt != nil {
		a.StopAt = *raw.StopAt
	}
	if raw.Scenario != nil {
		a.Scenario = *raw.Scenario
	}
	if raw.CreatedAt != nil {
		a.CreatedAt = *raw.CreatedAt
	}
	if raw.EventsCount != nil {
		a.Events = *raw.EventsCount
	}
	if raw.MachineID != nil {
		a.Machine = *raw.MachineID
	}
	if raw.Kind != nil {
		a.Kind = *raw.Kind
	}
	if raw.Source != nil {
		a.Scope = raw.Source.Scope
		a.Value = raw.Source.Value
		a.Country = raw.Source.Country
		a.ASNumber = raw.Source.ASNumber
		a.ASName = raw.Source.ASName
	}
	a.Reason = a.Scenario
	a.Decisions = raw.Decisions
	return nil
}

// cscliEmbeddedDecision is the per-decision record inside an alert blob. It
// carries the decision-specific fields the dashboard surfaces to operators
// (origin/type/scope/value/duration).
type cscliEmbeddedDecision struct {
	Origin   string `json:"origin"`
	Type     string `json:"type"`
	Scope    string `json:"scope"`
	Value    string `json:"value"`
	Duration string `json:"duration"`
	Until    string `json:"until"`
}

// describeJSONError is a helper for tests/diagnostics only; it never leaks to
// client-facing errors.
func describeJSONError(err error) string { return fmt.Sprintf("%v", err) }
