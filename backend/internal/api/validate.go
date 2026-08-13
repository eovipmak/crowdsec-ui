package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"crowdsec-dashboard/backend/internal/adapter"
)

// This file implements request decoding and validation at the API boundary
// (architecture §6). Validation happens BEFORE any adapter call. Bodies are
// decoded with json.Decoder.DisallowUnknownFields; unknown query parameters
// are rejected via an explicit allowlist. The api layer re-validates the same
// rules the adapter enforces (the adapter's validators are unexported), so
// malformed parameters never reach a process.

// maxBodyBytes is the maximum request body size (§4.1).
const maxBodyBytes = 16 * 1024 // 16 KiB

// Validation regexes mirroring the matrix §3 rules.
var (
	identifierRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}$`)
	safeTokenRe  = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]{0,63}$`)
	durationRe   = regexp.MustCompile(`^[0-9]+(s|m|h|d)$`)
)

const (
	maxLimit        = 500
	maxDuration365d = 365 * 24 * time.Hour
	minPrune        = 2 * time.Minute
	maxTextLen      = 256
)

// validationError is a request-level invalid_parameters error (HTTP 400).
type validationError struct{ msg string }

func (e *validationError) Error() string { return e.msg }

func invalid(field, reason string) error {
	return &validationError{msg: field + " " + reason}
}

// validateIdentifier validates a CrowdSec identifier (matrix §3).
func validateIdentifier(field, value string) error {
	if value == "" {
		return invalid(field, "must not be empty")
	}
	if !identifierRe.MatchString(value) {
		return invalid(field, "is not a valid CrowdSec identifier")
	}
	return nil
}

// validateSafeToken validates a filter token (scope/kind/type/origin).
func validateSafeToken(field, value string) error {
	if value == "" {
		return invalid(field, "must not be empty")
	}
	if !safeTokenRe.MatchString(value) {
		return invalid(field, "contains invalid characters")
	}
	return nil
}

// validateIPOrRange validates an IP address or CIDR (matrix §3).
func validateIPOrRange(field, value string) error {
	if value == "" {
		return invalid(field, "must not be empty")
	}
	if net.ParseIP(value) != nil {
		return nil
	}
	if _, _, err := net.ParseCIDR(value); err == nil {
		return nil
	}
	return invalid(field, "is not a valid IP address or CIDR range")
}

// validateDuration validates a duration against the adapter grammar and the
// 365-day bound (matrix §3).
func validateDuration(field, value string) error {
	if value == "" {
		return invalid(field, "must not be empty")
	}
	if !durationRe.MatchString(value) {
		return invalid(field, "must match the duration grammar (e.g. 4h, 30m, 2d)")
	}
	d, err := parseDurationVal(value)
	if err != nil {
		return invalid(field, "is not a valid duration")
	}
	if d > maxDuration365d {
		return invalid(field, "must not exceed 365 days")
	}
	return nil
}

func parseDurationVal(value string) (time.Duration, error) {
	n, err := strconv.ParseInt(value[:len(value)-1], 10, 64)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("invalid")
	}
	switch value[len(value)-1] {
	case 's':
		return time.Duration(n) * time.Second, nil
	case 'm':
		return time.Duration(n) * time.Minute, nil
	case 'h':
		return time.Duration(n) * time.Hour, nil
	case 'd':
		return time.Duration(n) * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("invalid unit")
	}
}

// validateText validates reason/description/comment: UTF-8, 1..256 chars,
// newline-free (matrix §3).
func validateText(field, value string) error {
	if value == "" {
		return invalid(field, "must not be empty")
	}
	if strings.ContainsAny(value, "\r\n") {
		return invalid(field, "must not contain newlines")
	}
	if utf8.RuneCountInString(value) > maxTextLen {
		return invalid(field, fmt.Sprintf("must not exceed %d characters", maxTextLen))
	}
	return nil
}

// validateLimit validates limit 1..500 (matrix §3).
func validateLimit(limit int) error {
	if limit < 1 || limit > maxLimit {
		return invalid("limit", fmt.Sprintf("must be between 1 and %d", maxLimit))
	}
	return nil
}

// validatePrune validates machines.prune duration rules (matrix §4).
func validatePrune(duration *string, notValidatedOnly bool) error {
	if duration == nil {
		return nil
	}
	if err := validateDuration("duration", *duration); err != nil {
		return err
	}
	if !notValidatedOnly {
		d, err := parseDurationVal(*duration)
		if err != nil {
			return invalid("duration", "is not a valid duration")
		}
		if d < minPrune {
			return invalid("duration", "must be at least 2m unless not_validated_only is set")
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Query-parameter allowlists and decoding
// ---------------------------------------------------------------------------

// allowedQueryParams maps each read route to its allowed query keys (§6.1).
// Any query key not listed yields a 400 invalid_parameters.
//
// v2 contract (task 02): `filter.scope`/`filter.kind` (alerts) and
// `filter.origin`/`filter.scope` (decisions) were dropped from the UI. They
// remain in the allowlist (not rejected) so stale cached browser requests work
// during rollout, but the decoder ignores their values; they never reach argv.
var allowedQueryParams = map[string]map[string]bool{
	"alerts.list":       {"limit": true, "filter.scenario": true, "filter.ip": true, "filter.scope": true, "filter.kind": true},
	"alerts.inspect":    {},
	"decisions.list":    {"limit": true, "filter.ip": true, "filter.scope": true, "filter.type": true, "filter.origin": true, "filter.scenario": true},
	"machines.list":     {},
	"bouncers.list":     {},
	"hub.list":          {"type": true},
	"scenarios.list":    {},
	"scenarios.inspect": {},
	"collections.list":  {},
	"profiles.inspect":  {},
	"simulation.status": {},
	"allowlists.list":   {},
	"allowlists.check":  {"ip_or_range": true},
	"metrics.show":      {},
	"lapi.status":       {},
	"capi.status":       {},
}

// decodeQueryParams validates that every query key is allowed for the
// operation and returns the raw values.
func decodeQueryParams(r *http.Request, op string) (map[string]string, error) {
	allowed, ok := allowedQueryParams[op]
	if !ok {
		return nil, invalid("query", "operation does not accept query parameters")
	}
	values := map[string]string{}
	for key, vals := range r.URL.Query() {
		if !allowed[key] {
			return nil, invalid("query", fmt.Sprintf("unknown query parameter %q", key))
		}
		if len(vals) > 1 {
			return nil, invalid("query", fmt.Sprintf("query parameter %q may only be provided once", key))
		}
		values[key] = vals[0]
	}
	return values, nil
}

// ---------------------------------------------------------------------------
// Read request decoding
// ---------------------------------------------------------------------------

// decodeAlertsList builds a validated adapter.AlertsListRequest from query
// params. The page mode is `limit` only when the -l flag is supported
// (§4.8); otherwise limit is rejected.
func decodeAlertsList(r *http.Request, limitSupported bool) (adapter.AlertsListRequest, error) {
	q, err := decodeQueryParams(r, "alerts.list")
	if err != nil {
		return adapter.AlertsListRequest{}, err
	}
	req := adapter.AlertsListRequest{}
	if v, ok := q["limit"]; ok {
		if !limitSupported {
			return req, invalid("limit", "is not supported for this CrowdSec installation")
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return req, invalid("limit", "must be an integer")
		}
		if err := validateLimit(n); err != nil {
			return req, err
		}
		req.Limit = n
	}
	f := &adapter.AlertsFilter{}
	set := false
	if v, ok := q["filter.scenario"]; ok {
		if err := validateIdentifier("filter.scenario", v); err != nil {
			return req, err
		}
		f.Scenario = v
		set = true
	}
	if v, ok := q["filter.ip"]; ok {
		if err := validateIPOrRange("filter.ip", v); err != nil {
			return req, err
		}
		f.IP = v
		set = true
	}
	// v2 contract (task 02): filter.scope/filter.kind were dropped from the UI.
	// They remain in allowedQueryParams so stale cached browser requests do not
	// 400, but their values are intentionally ignored here.
	if set {
		req.Filter = f
	}
	return req, nil
}

// decodeDecisionsList builds a validated adapter.DecisionsListRequest.
func decodeDecisionsList(r *http.Request, limitSupported bool) (adapter.DecisionsListRequest, error) {
	q, err := decodeQueryParams(r, "decisions.list")
	if err != nil {
		return adapter.DecisionsListRequest{}, err
	}
	req := adapter.DecisionsListRequest{}
	if v, ok := q["limit"]; ok {
		if !limitSupported {
			return req, invalid("limit", "is not supported for this CrowdSec installation")
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return req, invalid("limit", "must be an integer")
		}
		if err := validateLimit(n); err != nil {
			return req, err
		}
		req.Limit = n
	}
	f := &adapter.DecisionsFilter{}
	set := false
	for _, fk := range []struct{ key, field string }{
		{"filter.ip", "filter.ip"},
		{"filter.type", "filter.type"},
		{"filter.scenario", "filter.scenario"},
	} {
		if v, ok := q[fk.key]; ok {
			switch fk.field {
			case "filter.ip":
				if err := validateIPOrRange(fk.field, v); err != nil {
					return req, err
				}
				f.IP = v
			case "filter.scenario":
				if err := validateIdentifier(fk.field, v); err != nil {
					return req, err
				}
				f.Scenario = v
			default:
				if err := validateSafeToken(fk.field, v); err != nil {
					return req, err
				}
				f.Type = v
			}
			set = true
		}
	}
	// v2 contract (task 02): filter.origin/filter.scope were dropped from the
	// UI. They remain in allowedQueryParams so stale cached browser requests do
	// not 400, but their values are intentionally ignored here.
	if set {
		req.Filter = f
	}
	return req, nil
}

// decodeHubList builds a validated adapter.HubListRequest.
func decodeHubList(r *http.Request) (adapter.HubListRequest, error) {
	q, err := decodeQueryParams(r, "hub.list")
	if err != nil {
		return adapter.HubListRequest{}, err
	}
	req := adapter.HubListRequest{}
	if v, ok := q["type"]; ok {
		t := adapter.HubItemType(v)
		if !adapter.ValidHubItemType(t) {
			return req, invalid("type", "is not a valid hub item type")
		}
		req.Type = t
	}
	return req, nil
}

// decodeAllowlistsCheck builds a validated adapter.AllowlistsCheckRequest.
func decodeAllowlistsCheck(r *http.Request) (adapter.AllowlistsCheckRequest, error) {
	q, err := decodeQueryParams(r, "allowlists.check")
	if err != nil {
		return adapter.AllowlistsCheckRequest{}, err
	}
	v, ok := q["ip_or_range"]
	if !ok {
		return adapter.AllowlistsCheckRequest{}, invalid("ip_or_range", "is required")
	}
	if err := validateIPOrRange("ip_or_range", v); err != nil {
		return adapter.AllowlistsCheckRequest{}, err
	}
	return adapter.AllowlistsCheckRequest{IPOrRange: v}, nil
}

// ---------------------------------------------------------------------------
// Body decoding (mutations and confirmation issuance)
// ---------------------------------------------------------------------------

// readJSONBody decodes a JSON body with unknown-field rejection and a 16 KiB
// cap. It enforces Content-Type application/json (§4.1).
func readJSONBody(w http.ResponseWriter, r *http.Request, dst any) error {
	ct := r.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		return invalid("body", "must be sent with Content-Type application/json")
	}
	body := http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return invalid("body", "contains malformed or unknown fields")
	}
	// Ensure no trailing garbage.
	if dec.More() {
		return invalid("body", "contains unexpected trailing data")
	}
	return nil
}

// mutationRequest is the outer mutation body: operation + request +
// confirmation (§6.2).
type mutationRequest struct {
	Operation    string          `json:"operation"`
	Request      json.RawMessage `json:"request"`
	Confirmation string          `json:"confirmation"`
}

// decodeRequestField decodes the nested typed request with unknown-field
// rejection.
func decodeRequestField(dst any, raw json.RawMessage) error {
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return invalid("request", "contains malformed or unknown fields")
	}
	return nil
}

// decodeBodyOnce reads the body into dst with unknown-field rejection,
// returning a request-level error on failure.
func decodeBodyOnce(w http.ResponseWriter, r *http.Request, dst any) {
	if err := readJSONBody(w, r, dst); err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
	}
}

// io.EOF is referenced for providers that want to distinguish empty bodies.
var _ = io.EOF
