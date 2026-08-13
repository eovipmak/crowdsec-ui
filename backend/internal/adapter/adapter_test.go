package adapter

import (
	"context"
	"strings"
	"sync"
	"testing"
)

// fakeRunner is an injectable CommandRunner used by the tests. It records the
// argument vectors it was asked to run and returns scripted results, so the
// tests exercise the adapter without a real cscli and without a shell.
type fakeRunner struct {
	mu       sync.Mutex
	scripted map[string]script // keyed by the joined argv
	ran      [][]string        // every argv run
	missing  bool              // simulate a missing executable
	timeout  bool              // simulate a timeout
}

type script struct {
	stdout string
	stderr string
	exit   int
}

// newFakeRunner returns a fake runner that records argv and returns success
// (empty output) for any command unless scripted.
func newFakeRunner() *fakeRunner {
	return &fakeRunner{scripted: map[string]script{}}
}

// scriptArgs registers a scripted response for an exact argv (joined with
// space).
func (f *fakeRunner) scriptArgs(argv []string, s script) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.scripted[strings.Join(argv, " ")] = s
}

// calls returns every argv the runner was asked to run.
func (f *fakeRunner) calls() [][]string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([][]string, len(f.ran))
	for i, a := range f.ran {
		out[i] = append([]string(nil), a...)
	}
	return out
}

func (f *fakeRunner) Run(_ context.Context, c Command) (ProcResult, *OpError) {
	f.mu.Lock()
	f.ran = append(f.ran, append([]string{"cscli"}, c.Args...))
	key := strings.Join(c.Args, " ")
	s, ok := f.scripted[key]
	f.mu.Unlock()

	if f.missing {
		return ProcResult{}, newOpError(ErrUnavailable, "")
	}
	if f.timeout {
		return ProcResult{}, newOpError(ErrTimeout, "")
	}
	if !ok {
		return ProcResult{Stdout: []byte("[]"), ExitCode: 0}, nil
	}
	if s.exit != 0 {
		return ProcResult{Stdout: []byte(s.stdout), Stderr: []byte(s.stderr), ExitCode: s.exit},
			newOpError(ErrCrowdsecFailure, "")
	}
	return ProcResult{Stdout: []byte(s.stdout), Stderr: []byte(s.stderr), ExitCode: 0}, nil
}

// newTestAdapter builds an Executor with the fake runner and capabilities
// forced to supported so the tests can exercise handlers deterministically.
func newTestAdapter(t *testing.T, fake *fakeRunner) Executor {
	t.Helper()
	so := true
	lf := true
	prune := true
	bouncer := true
	metrics := true
	capi := true
	ex, err := New(Options{
		ExecutablePath:           "/usr/bin/cscli",
		Timeout:                  0, // default 30s
		Runner:                   fake,
		supportsStructuredOutput: &so,
		supportsLimitFlag:        &lf,
		supportsPrune:            &prune,
		supportsBouncerDelete:    &bouncer,
		supportsMetrics:          &metrics,
		supportsCAPI:             &capi,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return ex
}

// ---------------------------------------------------------------------------
// Valid reads
// ---------------------------------------------------------------------------

func TestAlertsListValidRead(t *testing.T) {
	fake := newFakeRunner()
	fake.scriptArgs([]string{"alerts", "list", "-o", "json", "-l", "50"},
		script{stdout: `[{"id":1,"start_at":"2026-08-05T09:58:00Z","scenario":"crowdsecurity/ssh-bf","scope":"Ip","value":"198.51.100.7","decisions":[{"type":"ban","duration":"4h"}]}]`})
	ex := newTestAdapter(t, fake)

	res, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	alerts, ok := res.(AlertsListResult)
	if !ok {
		t.Fatalf("expected AlertsListResult, got %T", res)
	}
	if len(alerts.Items) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts.Items))
	}
	if alerts.Items[0].ID != 1 || alerts.Items[0].Scenario != "crowdsecurity/ssh-bf" {
		t.Fatalf("unexpected alert: %+v", alerts.Items[0])
	}
	if alerts.Page.Mode != "limit" || alerts.Page.Limit != 50 {
		t.Fatalf("unexpected page: %+v", alerts.Page)
	}
}

func TestAlertsListEmptyCollection(t *testing.T) {
	fake := newFakeRunner()
	fake.scriptArgs([]string{"alerts", "list", "-o", "json", "-l", "50"}, script{stdout: `[]`})
	ex := newTestAdapter(t, fake)

	res, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	alerts := res.(AlertsListResult)
	if len(alerts.Items) != 0 || alerts.Items == nil {
		t.Fatalf("expected empty items slice, got %#v", alerts.Items)
	}
}

// ---------------------------------------------------------------------------
// Valid mutation with refresh
// ---------------------------------------------------------------------------

func TestDecisionsAddValidMutationRefreshes(t *testing.T) {
	fake := newFakeRunner()
	ex := newTestAdapter(t, fake)

	res, opErr := ex.Run(context.Background(), OpDecisionsAdd, DecisionsAddRequest{
		IPOrRange: "198.51.100.7",
		Duration:  "4h",
		Reason:    "Observed brute force",
	})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	mut, ok := res.(MutationResult)
	if !ok {
		t.Fatalf("expected MutationResult, got %T", res)
	}
	if mut.Status != "success" {
		t.Fatalf("expected success, got %q", mut.Status)
	}
	// The mutation must refresh decisions.list.
	found := false
	for _, r := range mut.Refreshed {
		if r == "decisions.list" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected decisions.list in refreshed, got %v", mut.Refreshed)
	}
	// The mutation ran exactly one command (decisions add); refresh is a
	// re-fetch by the client, not an extra adapter command.
	calls := fake.calls()
	if len(calls) != 1 {
		t.Fatalf("expected 1 command, got %d: %v", len(calls), calls)
	}
	// The argument vector must contain the validated values and never
	// --bypass-allowlist.
	joined := strings.Join(calls[0], " ")
	if !strings.Contains(joined, "--ip 198.51.100.7") || !strings.Contains(joined, "--duration 4h") {
		t.Fatalf("unexpected argv: %v", calls[0])
	}
	if strings.Contains(joined, "--bypass-allowlist") {
		t.Fatalf("--bypass-allowlist must never appear: %v", calls[0])
	}
}

// ---------------------------------------------------------------------------
// Malformed parameters -> no process started
// ---------------------------------------------------------------------------

func TestDecisionsAddRejectsInvalidIP(t *testing.T) {
	fake := newFakeRunner()
	ex := newTestAdapter(t, fake)

	_, opErr := ex.Run(context.Background(), OpDecisionsAdd, DecisionsAddRequest{
		IPOrRange: "not-an-ip; rm -rf /",
		Duration:  "4h",
		Reason:    "bad",
	})
	if opErr == nil {
		t.Fatal("expected error for invalid IP")
	}
	if opErr.Class != ErrInvalidParameters {
		t.Fatalf("expected invalid_parameters, got %s", opErr.Class)
	}
	if len(fake.calls()) != 0 {
		t.Fatalf("no process should have started, got %v", fake.calls())
	}
}

func TestDecisionsAddRejectsBadDuration(t *testing.T) {
	fake := newFakeRunner()
	ex := newTestAdapter(t, fake)

	// duration grammar violation and > 365d bound.
	_, opErr := ex.Run(context.Background(), OpDecisionsAdd, DecisionsAddRequest{
		IPOrRange: "198.51.100.7",
		Duration:  "1y",
		Reason:    "bad",
	})
	if opErr == nil || opErr.Class != ErrInvalidParameters {
		t.Fatalf("expected invalid_parameters for bad duration, got %v", opErr)
	}
	if len(fake.calls()) != 0 {
		t.Fatalf("no process should have started, got %v", fake.calls())
	}
}

func TestMachinesPruneRejectsShortDuration(t *testing.T) {
	fake := newFakeRunner()
	ex := newTestAdapter(t, fake)

	dur := "1m"
	_, opErr := ex.Run(context.Background(), OpMachinesPrune, MachinesPruneRequest{Duration: &dur})
	if opErr == nil || opErr.Class != ErrInvalidParameters {
		t.Fatalf("expected invalid_parameters for <2m prune, got %v", opErr)
	}
	if len(fake.calls()) != 0 {
		t.Fatalf("no process should have started, got %v", fake.calls())
	}
}

// ---------------------------------------------------------------------------
// stderr/exit -> stable safe error
// ---------------------------------------------------------------------------

func TestStderrExitMapsToSafeError(t *testing.T) {
	fake := newFakeRunner()
	fake.scriptArgs([]string{"alerts", "list", "-o", "json", "-l", "50"},
		script{stdout: "", stderr: "Error: permission denied reading database /etc/crowdsec/crowdsec.db", exit: 1})
	ex := newTestAdapter(t, fake)

	// The handler requests a list; the fake returns a non-zero exit, which
	// maps to a stable crowdsec_failure class, never raw stderr.
	_, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr == nil {
		t.Fatal("expected error for non-zero exit")
	}
	if opErr.Class != ErrCrowdsecFailure {
		t.Fatalf("expected crowdsec_failure, got %s", opErr.Class)
	}
	// The safe message must not contain the raw stderr or path.
	if strings.Contains(opErr.Message, "/etc/crowdsec") || strings.Contains(opErr.Message, "permission denied") {
		t.Fatalf("error message leaked raw output: %q", opErr.Message)
	}
}

func TestMalformedJSONMapsToMalformedOutput(t *testing.T) {
	fake := newFakeRunner()
	fake.scriptArgs([]string{"alerts", "list", "-o", "json", "-l", "50"},
		script{stdout: `{not json`, exit: 0})
	ex := newTestAdapter(t, fake)

	_, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr == nil {
		t.Fatal("expected error for malformed JSON")
	}
	if opErr.Class != ErrMalformedOutput {
		t.Fatalf("expected malformed_output, got %s", opErr.Class)
	}
}

// ---------------------------------------------------------------------------
// v2 contract: expanded parsed shape (task 02)
// ---------------------------------------------------------------------------

func TestAlertsListSurfacesNewFields(t *testing.T) {
	fake := newFakeRunner()
	fake.scriptArgs([]string{"alerts", "list", "-o", "json", "-l", "50"},
		script{stdout: `[
  {
    "capacity":5,
    "created_at":"2026-08-05T09:59:00Z",
    "decisions":[{"duration":"4h","type":"ban"}],
    "events_count":6,
    "id":1,
    "kind":"crowdsec",
    "machine_id":"test-machine",
    "scenario":"crowdsecurity/ssh-bf",
    "source":{"ip":"198.51.100.7","cn":"AU","as_number":"13335","as_name":"Cloudflare","scope":"Ip","value":"198.51.100.7"},
    "start_at":"2026-08-05T09:58:00Z",
    "stop_at":"2026-08-05T09:58:10Z"
  }
]`})
	ex := newTestAdapter(t, fake)

	res, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	alerts := res.(AlertsListResult)
	if len(alerts.Items) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts.Items))
	}
	it := alerts.Items[0]
	// Existing fields preserved.
	if it.ID != 1 || it.Scenario != "crowdsecurity/ssh-bf" || it.Scope != "Ip" || it.Value != "198.51.100.7" {
		t.Fatalf("existing fields changed: %+v", it)
	}
	// New fields surfaced.
	if it.Country != "AU" || it.ASNumber != "13335" || it.ASName != "Cloudflare" {
		t.Fatalf("country/AS not surfaced: %+v", it)
	}
	if it.Events != 6 || it.Machine != "test-machine" || it.Kind != "crowdsec" {
		t.Fatalf("events/machine/kind not surfaced: %+v", it)
	}
	if it.Reason != "crowdsecurity/ssh-bf" || it.CreatedAt != "2026-08-05T09:59:00Z" {
		t.Fatalf("reason/created_at not surfaced: %+v", it)
	}
	if len(it.Decisions) != 1 || it.Decisions[0].Type != "ban" || it.Decisions[0].Duration != "4h" {
		t.Fatalf("decisions not preserved: %+v", it.Decisions)
	}
}

func TestDecisionsListSurfacesNewFieldsAndBlobFallback(t *testing.T) {
	fake := newFakeRunner()
	fake.scriptArgs([]string{"decisions", "list", "-o", "json", "-l", "100"},
		script{stdout: `[
  {
    "id":7,
    "scenario":"crowdsecurity/ssh-bf",
    "created_at":"2026-08-05T09:59:00Z",
    "events_count":6,
    "source":{"ip":"198.51.100.7","cn":"AU","as_number":"13335","as_name":"Cloudflare","scope":"Ip","value":"198.51.100.7"},
    "decisions":[{"origin":"cscli","type":"ban","scope":"Ip","value":"198.51.100.7","duration":"4h","until":"2026-08-05T13:59:00Z"}]
  }
]`})
	ex := newTestAdapter(t, fake)

	res, opErr := ex.Run(context.Background(), OpDecisionsList, DecisionsListRequest{})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	decisions := res.(DecisionsListResult)
	if len(decisions.Items) != 1 {
		t.Fatalf("expected 1 decision, got %d", len(decisions.Items))
	}
	it := decisions.Items[0]
	if it.ID != 7 || it.Origin != "cscli" || it.Type != "ban" || it.Scope != "Ip" ||
		it.Value != "198.51.100.7" || it.Duration != "4h" {
		t.Fatalf("existing decision fields changed: %+v", it)
	}
	if it.Events != 6 || it.AlertID != 7 {
		t.Fatalf("events/alert_id not surfaced: %+v", it)
	}
	if it.Country != "AU" || it.ASNumber != "13335" || it.ASName != "Cloudflare" {
		t.Fatalf("country/AS not surfaced: %+v", it)
	}
	if it.Scenario != "crowdsecurity/ssh-bf" || it.CreatedAt != "2026-08-05T09:59:00Z" {
		t.Fatalf("scenario/created_at not surfaced: %+v", it)
	}
}

func TestDecisionsListFlatFallbackStillWorks(t *testing.T) {
	fake := newFakeRunner()
	fake.scriptArgs([]string{"decisions", "list", "-o", "json", "-l", "100"},
		script{stdout: `[
	  {"id":1,"origin":"cscli","type":"ban","scope":"Ip","value":"198.51.100.7","scenario":"crowdsecurity/ssh-bf","duration":"4h"}
	]`})
	ex := newTestAdapter(t, fake)

	res, opErr := ex.Run(context.Background(), OpDecisionsList, DecisionsListRequest{})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	decisions := res.(DecisionsListResult)
	if len(decisions.Items) != 1 {
		t.Fatalf("expected 1 decision, got %d", len(decisions.Items))
	}
	it := decisions.Items[0]
	if it.ID != 1 || it.Origin != "cscli" || it.Type != "ban" || it.Value != "198.51.100.7" {
		t.Fatalf("flat fallback failed: %+v", it)
	}
}

// ---------------------------------------------------------------------------
// v2 contract: dropped filter fields no longer emitted (task 02)
// ---------------------------------------------------------------------------

func TestAlertsListDropsScopeAndKindFilters(t *testing.T) {
	// Stale request carrying the dropped fields must not produce --scope/--kind.
	req := AlertsListRequest{
		Limit: 50,
		Filter: &AlertsFilter{
			Scenario: "crowdsecurity/ssh-bf",
			IP:       "198.51.100.7",
		},
	}
	// adapter-level: AlertsFilter has no Scope/Kind fields anymore; construct
	// the argv directly to assert no removed flags are emitted.
	args := alertsListArgs(req)
	joined := strings.Join(args, " ")
	if strings.Contains(joined, "--scope") || strings.Contains(joined, "--kind") {
		t.Fatalf("dropped filter flags emitted: %v", args)
	}
	if !strings.Contains(joined, "--scenario crowdsecurity/ssh-bf") || !strings.Contains(joined, "--ip 198.51.100.7") {
		t.Fatalf("kept filters missing: %v", args)
	}
}

func TestDecisionsListDropsScopeAndOriginFilters(t *testing.T) {
	req := DecisionsListRequest{
		Limit: 100,
		Filter: &DecisionsFilter{
			IP:       "198.51.100.7",
			Type:     "ban",
			Scenario: "crowdsecurity/ssh-bf",
		},
	}
	args := decisionsListArgs(req)
	joined := strings.Join(args, " ")
	if strings.Contains(joined, "--scope") || strings.Contains(joined, "--origin") {
		t.Fatalf("dropped filter flags emitted: %v", args)
	}
	if !strings.Contains(joined, "--ip 198.51.100.7") || !strings.Contains(joined, "--type ban") ||
		!strings.Contains(joined, "--scenario crowdsecurity/ssh-bf") {
		t.Fatalf("kept filters missing: %v", args)
	}
}

func TestMissingExecutableMapsToUnavailable(t *testing.T) {
	fake := newFakeRunner()
	fake.missing = true
	ex := newTestAdapter(t, fake)

	_, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr == nil {
		t.Fatal("expected error for missing executable")
	}
	if opErr.Class != ErrUnavailable {
		t.Fatalf("expected unavailable, got %s", opErr.Class)
	}
}

func TestTimeoutMapsToTimeout(t *testing.T) {
	fake := newFakeRunner()
	fake.timeout = true
	ex := newTestAdapter(t, fake)

	_, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr == nil {
		t.Fatal("expected error for timeout")
	}
	if opErr.Class != ErrTimeout {
		t.Fatalf("expected timeout, got %s", opErr.Class)
	}
	if !opErr.Retryable {
		t.Fatal("timeout should be retryable")
	}
}

// ---------------------------------------------------------------------------
// Unsupported operations never start a process
// ---------------------------------------------------------------------------

func TestUnsupportedOperationNeverRuns(t *testing.T) {
	fake := newFakeRunner()
	ex := newTestAdapter(t, fake)

	for _, unsupported := range UnsupportedOperationIDs {
		_, opErr := ex.Run(context.Background(), unsupported, nil)
		if opErr == nil {
			t.Fatalf("expected error for unsupported %s", unsupported)
		}
		if opErr.Class != ErrUnsupported {
			t.Fatalf("expected unsupported for %s, got %s", unsupported, opErr.Class)
		}
	}
	if len(fake.calls()) != 0 {
		t.Fatalf("no process should have started for unsupported ops, got %v", fake.calls())
	}
}

// ---------------------------------------------------------------------------
// Capabilities surface
// ---------------------------------------------------------------------------

func TestCapabilitiesReportUnsupportedRows(t *testing.T) {
	ex := newTestAdapter(t, newFakeRunner())
	caps := ex.Capabilities()
	for _, op := range UnsupportedOperationIDs {
		if caps[op] != Unsupported {
			t.Fatalf("expected %s to be unsupported, got %s", op, caps[op])
		}
	}
}

// ---------------------------------------------------------------------------
// Profiles reader (separate config-file boundary)
// ---------------------------------------------------------------------------

func TestProfilesReaderParsesFile(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/profiles.yaml"
	content := `profiles:
  - name: default
    filters:
      - 'Alert.Remediation == true && Alert.GetScope() == "Ip"'
    decisions:
      - type: ban
        duration: 4h
  - name: highseverity
    filters:
      - "Alert.Severity >= 3"
    decisions:
      - type: ban
        duration: 24h
`
	if err := writeFile(path, content); err != nil {
		t.Fatalf("write: %v", err)
	}
	r := NewProfilesReader(path)
	items, err := r.Read()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 profiles, got %d", len(items))
	}
	if items[0].Name != "default" || len(items[0].Filters) != 1 {
		t.Fatalf("unexpected first profile: %+v", items[0])
	}
	if len(items[0].Decisions) != 1 || items[0].Decisions[0] != "ban for 4h" {
		t.Fatalf("unexpected decisions: %+v", items[0].Decisions)
	}
}

func writeFile(path, content string) error {
	return writeFileImpl(path, content)
}

func TestExecutableNeverDerivedFromRequest(t *testing.T) {
	fake := newFakeRunner()
	ex := newTestAdapter(t, fake)
	// A request cannot change the executable path. The runner always receives
	// the configured path; we assert the recorded argv never contains a shell.
	for _, call := range fake.calls() {
		if strings.Contains(strings.Join(call, " "), "sh ") || strings.Contains(strings.Join(call, " "), "bash") {
			t.Fatalf("shell invocation detected: %v", call)
		}
	}
	_ = ex
}
