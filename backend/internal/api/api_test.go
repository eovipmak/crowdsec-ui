package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"crowdsec-dashboard/backend/internal/adapter"
	"crowdsec-dashboard/backend/internal/auth"
	"crowdsec-dashboard/backend/internal/config"
)

// testPasswordHash is the bcrypt hash of "test-password" (cost 4, test-only).
// It lets tests drive the real authenticator without a live CrowdSec.
const testPasswordHash = "$2a$04$aTaoHi4WDabPBhQsGz1DUO7vxdLb2P.FK6FVEuwP99ZhbCQp1WYC6"

// testPassword is the plaintext matching testPasswordHash (test-only).
const testPassword = "test-password"

// --- test helpers -----------------------------------------------------------

func testConfig() *config.Config {
	return &config.Config{
		Server:  config.Server{Bind: "127.0.0.1", Port: 8090},
		Session: config.Session{TTL: 8 * time.Hour, CookieName: "crowdsec_dashboard_session"},
	}
}

// newTestServer builds a router with a fake adapter and the real
// authenticator wired to the test password hash.
func newTestServer(t *testing.T, fake *fakeAdapter) *httptest.Server {
	t.Helper()
	confirm := NewConfirmationService()
	au := auth.NewBcrypt(testPasswordHash, 8*time.Hour)
	router := NewRouterOpts(Options{
		Config:   testConfig(),
		Executor: fake,
		Auth:     au,
		Confirm:  confirm,
	})
	ts := httptest.NewServer(router)
	t.Cleanup(ts.Close)
	return ts
}

// login returns the session cookie and CSRF token for the real authenticator.
func login(t *testing.T, ts *httptest.Server) (*http.Cookie, string) {
	t.Helper()
	body := `{"password":"` + testPassword + `"}`
	resp, err := http.Post(ts.URL+"/api/v1/session", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login status: %d", resp.StatusCode)
	}
	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	sess := out["session"].(map[string]any)
	csrf := sess["csrf_token"].(string)
	for _, c := range resp.Cookies() {
		if c.Name == "crowdsec_dashboard_session" {
			return c, csrf
		}
	}
	t.Fatal("no session cookie set")
	return nil, csrf
}

// doJSON performs a request with optional cookie and CSRF header.
func doJSON(t *testing.T, ts *httptest.Server, method, path, body string, cookie *http.Cookie, csrf string) (*http.Response, string) {
	t.Helper()
	var rd *bytes.Reader
	if body == "" {
		rd = bytes.NewReader(nil)
	} else {
		rd = bytes.NewReader([]byte(body))
	}
	req, err := http.NewRequest(method, ts.URL+path, rd)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	if csrf != "" {
		req.Header.Set("X-CSRF-Token", csrf)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do: %v", err)
	}
	defer resp.Body.Close()
	buf := new(bytes.Buffer)
	_, _ = buf.ReadFrom(resp.Body)
	return resp, buf.String()
}

// issueConfirmation returns a confirmation token for a mutation.
func issueConfirmation(t *testing.T, ts *httptest.Server, cookie *http.Cookie, csrf, op, request string) string {
	t.Helper()
	body := `{"operation":"` + op + `","request":` + request + `}`
	resp, out := doJSON(t, ts, "POST", "/api/v1/confirmations", body, cookie, csrf)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("issue confirmation status %d: %s", resp.StatusCode, out)
	}
	var parsed struct {
		Confirmation struct {
			Token string `json:"token"`
		} `json:"confirmation"`
	}
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		t.Fatalf("decode confirmation: %v", err)
	}
	return parsed.Confirmation.Token
}

// --- health (public) ----------------------------------------------------------

func TestHealthPublicNoAuth(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	resp, out := doJSON(t, ts, "GET", "/api/v1/health", "", nil, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	var h map[string]any
	if err := json.Unmarshal([]byte(out), &h); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if h["status"] != "ok" || h["service"] != "crowdsec-dashboard" {
		t.Fatalf("health: %v", h)
	}
}

// --- read route ---------------------------------------------------------------

func TestAlertsListReadSuccess(t *testing.T) {
	fake := newFakeAdapter()
	fake.script(adapter.OpAlertsList, adapter.AlertsListResult{
		Items: []adapter.AlertItem{{ID: 1, Scenario: "crowdsecurity/ssh-bf", Scope: "Ip", Value: "198.51.100.7"}},
		Page:  adapter.PageInfo{Mode: "limit", Limit: 50, Offset: 0, HasMore: false},
	}, nil)
	ts := newTestServer(t, fake)
	cookie, csrf := login(t, ts)
	_ = csrf

	resp, out := doJSON(t, ts, "GET", "/api/v1/alerts?limit=50", "", cookie, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d: %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, `"operation":"alerts.list"`) {
		t.Fatalf("missing operation: %s", out)
	}
	if !strings.Contains(out, `"source"`) || !strings.Contains(out, `"command":"cscli alerts list"`) {
		t.Fatalf("missing source: %s", out)
	}
	if !strings.Contains(out, `"result"`) {
		t.Fatalf("missing result: %s", out)
	}
	if resp.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("expected no-store cache control")
	}
}

// v2 contract (task 02): dropped filter query params are ignored, not rejected
// with 400, so stale cached browser requests keep working during rollout.

func TestAlertsListIgnoresDroppedScopeAndKindFilters(t *testing.T) {
	fake := newFakeAdapter()
	ts := newTestServer(t, fake)
	cookie, csrf := login(t, ts)
	_ = csrf

	// Dropped filter.scope/filter.kind must not 400 and must not be forwarded.
	resp, out := doJSON(t, ts, "GET",
		"/api/v1/alerts?limit=50&filter.scope=Ip&filter.kind=crowdsec&filter.scenario=crowdsecurity/ssh-bf&filter.ip=198.51.100.7",
		"", cookie, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d: %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, `"operation":"alerts.list"`) {
		t.Fatalf("missing operation: %s", out)
	}
}

func TestDecisionsListIgnoresDroppedOriginAndScopeFilters(t *testing.T) {
	fake := newFakeAdapter()
	ts := newTestServer(t, fake)
	cookie, csrf := login(t, ts)
	_ = csrf

	// Dropped filter.origin/filter.scope must not 400 and must not be forwarded.
	resp, out := doJSON(t, ts, "GET",
		"/api/v1/decisions?limit=100&filter.origin=cscli&filter.scope=Ip&filter.ip=198.51.100.7&filter.type=ban&filter.scenario=crowdsecurity/ssh-bf",
		"", cookie, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d: %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, `"operation":"decisions.list"`) {
		t.Fatalf("missing operation: %s", out)
	}
}

// --- mutation route with confirmation flow -----------------------------------

func TestDecisionsAddMutationFlow(t *testing.T) {
	fake := newFakeAdapter()
	fake.script(adapter.OpDecisionsAdd, adapter.MutationResult{
		Status: "success", Action: "Added an active decision for 198.51.100.7", Refreshed: []string{"decisions.list"},
	}, nil)
	ts := newTestServer(t, fake)
	cookie, csrf := login(t, ts)

	// 1. Issue a confirmation token.
	req := `{"ip_or_range":"198.51.100.7","duration":"4h","reason":"Observed brute force"}`
	token := issueConfirmation(t, ts, cookie, csrf, "decisions.add", req)

	// 2. Perform the mutation with the token.
	mut := `{"operation":"decisions.add","request":` + req + `,"confirmation":"` + token + `"}`
	resp, out := doJSON(t, ts, "POST", "/api/v1/decisions", mut, cookie, csrf)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("mutation status: %d: %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, `"operation":"decisions.add"`) || !strings.Contains(out, `"result"`) {
		t.Fatalf("bad mutation envelope: %s", out)
	}
	if len(fake.calls()) == 0 || fake.calls()[0] != adapter.OpDecisionsAdd {
		t.Fatalf("adapter not called with decisions.add: %v", fake.calls())
	}
}

func TestMutationMissingConfirmation(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, csrf := login(t, ts)
	_ = csrf
	mut := `{"operation":"decisions.add","request":{"ip_or_range":"198.51.100.7","duration":"4h","reason":"x"}}`
	resp, out := doJSON(t, ts, "POST", "/api/v1/decisions", mut, cookie, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	if !strings.Contains(out, "confirmation_required") {
		t.Fatalf("expected confirmation_required: %s", out)
	}
}

func TestMutationMismatchedConfirmation(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, csrf := login(t, ts)
	// Issue a token for one request, then mutate with a different request.
	req := `{"ip_or_range":"198.51.100.7","duration":"4h","reason":"first"}`
	_ = issueConfirmation(t, ts, cookie, csrf, "decisions.add", req)
	other := `{"ip_or_range":"198.51.100.8","duration":"4h","reason":"first"}`
	mut := `{"operation":"decisions.add","request":` + other + `,"confirmation":"stale-token"}`
	resp, out := doJSON(t, ts, "POST", "/api/v1/decisions", mut, cookie, csrf)
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, "invalid_confirmation") {
		t.Fatalf("expected invalid_confirmation: %s", out)
	}
}

func TestMutationOperationMismatch(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, csrf := login(t, ts)
	_ = csrf
	mut := `{"operation":"alerts.list","request":{"items":[]}}`
	resp, out := doJSON(t, ts, "POST", "/api/v1/decisions", mut, cookie, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", resp.StatusCode, out)
	}
}

// --- malformed request: unknown field -> 400 ---------------------------------

func TestMutationUnknownFieldRejected(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, csrf := login(t, ts)
	_ = csrf
	mut := `{"operation":"decisions.add","request":{"ip_or_range":"198.51.100.7","duration":"4h","reason":"x","evil":"=1"}}`
	resp, out := doJSON(t, ts, "POST", "/api/v1/decisions", mut, cookie, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, "invalid_parameters") {
		t.Fatalf("expected invalid_parameters: %s", out)
	}
}

func TestReadUnknownQueryParamRejected(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, _ := login(t, ts)
	resp, out := doJSON(t, ts, "GET", "/api/v1/alerts?nonsense=1", "", cookie, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", resp.StatusCode, out)
	}
}

// --- adapter failure -> 200 error envelope ------------------------------------

func TestAdapterFailureReturns200ErrorEnvelope(t *testing.T) {
	fake := newFakeAdapter()
	fake.script(adapter.OpAlertsList, nil, &adapter.OpError{
		Class: adapter.ErrCrowdsecFailure, Message: "CrowdSec rejected the requested operation.", Retryable: false,
	})
	ts := newTestServer(t, fake)
	cookie, _ := login(t, ts)
	resp, out := doJSON(t, ts, "GET", "/api/v1/alerts", "", cookie, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200 for operation-level failure, got %d", resp.StatusCode)
	}
	if !strings.Contains(out, `"error"`) || !strings.Contains(out, "crowdsec_failure") {
		t.Fatalf("expected error envelope: %s", out)
	}
	if strings.Contains(out, `"result"`) {
		t.Fatalf("error envelope must not contain result: %s", out)
	}
}

// --- unsupported rows -> 404 (no endpoint) ------------------------------------

func TestUnsupportedRowsAre404(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, csrf := login(t, ts)
	_ = csrf
	// These are §5.3 rows with no endpoint; they must be 404, never functional.
	tests := []struct{ method, path string }{
		{"DELETE", "/api/v1/alerts"},
		{"GET", "/api/v1/decisions/import"},
		{"DELETE", "/api/v1/machines"},
		{"POST", "/api/v1/bouncers"},
		{"POST", "/api/v1/hub/update"},
		{"POST", "/api/v1/scenarios/install"},
		{"POST", "/api/v1/collections/install"},
		{"DELETE", "/api/v1/collections"},
		{"POST", "/api/v1/simulation/enable"},
		{"POST", "/api/v1/simulation/disable"},
		{"POST", "/api/v1/allowlists/import"},
	}
	for _, tc := range tests {
		resp, out := doJSON(t, ts, tc.method, tc.path, "", cookie, "")
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("%s %s: expected 404, got %d: %s", tc.method, tc.path, resp.StatusCode, out)
		}
	}
}

// --- unknown /api route -> 404 JSON -------------------------------------------

func TestUnknownAPIRouteIs404JSON(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, _ := login(t, ts)
	resp, out := doJSON(t, ts, "GET", "/api/v1/does-not-exist", "", cookie, "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
	if !strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") {
		t.Fatalf("expected JSON 404, got %s", resp.Header.Get("Content-Type"))
	}
	if !strings.Contains(out, "not_found") {
		t.Fatalf("expected not_found: %s", out)
	}
}

// --- unauthenticated -> 401 -----------------------------------------------------

func TestProtectedRouteRequiresAuth(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	resp, out := doJSON(t, ts, "GET", "/api/v1/alerts", "", nil, "")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	if !strings.Contains(out, "unauthenticated") {
		t.Fatalf("expected unauthenticated: %s", out)
	}
}

// --- capabilities ---------------------------------------------------------------

func TestCapabilities(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, _ := login(t, ts)
	resp, out := doJSON(t, ts, "GET", "/api/v1/capabilities", "", cookie, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	if !strings.Contains(out, `"alerts.delete":"unsupported"`) {
		t.Fatalf("capabilities should report unsupported rows as unsupported: %s", out)
	}
	if !strings.Contains(out, `"alerts.list"`) {
		t.Fatalf("capabilities missing operation: %s", out)
	}
}

// --- pagination bounds -----------------------------------------------------------

func TestLimitRejectedWhenUnsupported(t *testing.T) {
	fake := newFakeAdapter()
	fake.setCapability(adapter.OpAlertsList, adapter.CapabilityGated)
	ts := newTestServer(t, fake)
	cookie, _ := login(t, ts)
	resp, out := doJSON(t, ts, "GET", "/api/v1/alerts?limit=50", "", cookie, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 when limit unsupported, got %d: %s", resp.StatusCode, out)
	}
}

func TestOffsetAlwaysRejected(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, _ := login(t, ts)
	resp, _ := doJSON(t, ts, "GET", "/api/v1/alerts?offset=10", "", cookie, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for offset, got %d", resp.StatusCode)
	}
}

// --- session / logout ------------------------------------------------------------

func TestLoginSessionStatusLogoutFlow(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	// Login
	resp, out := doJSON(t, ts, "POST", "/api/v1/session", `{"password":"`+testPassword+`"}`, nil, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login: %d %s", resp.StatusCode, out)
	}
	var loginBody struct {
		Session struct {
			Authenticated bool   `json:"authenticated"`
			CSRF          string `json:"csrf_token"`
		} `json:"session"`
	}
	if err := json.Unmarshal([]byte(out), &loginBody); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	if !loginBody.Session.Authenticated || loginBody.Session.CSRF == "" {
		t.Fatalf("login body: %s", out)
	}
	// Capture the session cookie.
	var cookie *http.Cookie
	for _, c := range resp.Cookies() {
		if c.Name == "crowdsec_dashboard_session" {
			cookie = c
		}
	}
	if cookie == nil {
		t.Fatal("no session cookie")
	}
	// Session status
	resp, out = doJSON(t, ts, "GET", "/api/v1/session", "", cookie, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d %s", resp.StatusCode, out)
	}
	// Logout (state-changing, needs CSRF)
	resp, out = doJSON(t, ts, "DELETE", "/api/v1/session", "", cookie, loginBody.Session.CSRF)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("logout: %d %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, `"authenticated":false`) {
		t.Fatalf("logout should report unauthenticated: %s", out)
	}
}

// --- CSRF enforcement on state-changing requests --------------------------------

func TestConfirmIssueRequiresCSRF(t *testing.T) {
	ts := newTestServer(t, newFakeAdapter())
	cookie, _ := login(t, ts)
	// Valid session but NO CSRF header -> 403 csrf_failed.
	resp, out := doJSON(t, ts, "POST", "/api/v1/confirmations", `{"operation":"decisions.add","request":{"ip_or_range":"198.51.100.7","duration":"4h","reason":"x"}}`, cookie, "")
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.StatusCode, out)
	}
	if !strings.Contains(out, "csrf_failed") {
		t.Fatalf("expected csrf_failed: %s", out)
	}
}
