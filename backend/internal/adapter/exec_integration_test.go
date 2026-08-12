package adapter

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// execIntegrationTest exercises the REAL exec runner (NewExecRunner, backed by
// os/exec.CommandContext) against the fake cscli fixture script. This verifies
// that the adapter builds a valid argv and that the real process-execution
// path works without a shell.

// fakeCscliPath returns the path to the executable fake-cscli fixture. On
// non-executable platforms it falls back to a skip.
func fakeCscliPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Skip("cannot locate testdata")
	}
	dir := filepath.Dir(file)
	exe := filepath.Join(dir, "testdata", "fake-cscli")
	if runtime.GOOS == "windows" {
		t.Skip("fake-cscli is a POSIX shell script")
	}
	return exe
}

func TestExecRunnerRunsFakeCscliAlertsList(t *testing.T) {
	exe := fakeCscliPath(t)
	// Ensure the fake script is executable.
	if err := os.Chmod(exe, 0o755); err != nil {
		t.Fatalf("chmod: %v", err)
	}

	fake := newFakeRunner() // not used by the exec path; keeps adapter construction identical
	so := true
	lf := true
	prune := true
	bouncer := true
	metrics := true
	capi := true
	ex, err := New(Options{
		ExecutablePath:           exe,
		Runner:                   NewExecRunner(),
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

	res, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	alerts := res.(AlertsListResult)
	if len(alerts.Items) != 1 || alerts.Items[0].Scenario != "crowdsecurity/ssh-bf" {
		t.Fatalf("unexpected alerts: %+v", alerts.Items)
	}
	_ = fake
}

func TestExecRunnerRunsMutationAndRefreshAdvertised(t *testing.T) {
	exe := fakeCscliPath(t)
	if err := os.Chmod(exe, 0o755); err != nil {
		t.Fatalf("chmod: %v", err)
	}
	so := true
	lf := true
	prune := true
	bouncer := true
	metrics := true
	capi := true
	ex, err := New(Options{
		ExecutablePath:           exe,
		Runner:                   NewExecRunner(),
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

	res, opErr := ex.Run(context.Background(), OpDecisionsAdd, DecisionsAddRequest{
		IPOrRange: "198.51.100.7",
		Duration:  "4h",
		Reason:    "Observed brute force",
	})
	if opErr != nil {
		t.Fatalf("unexpected error: %v", opErr)
	}
	mut := res.(MutationResult)
	if mut.Status != "success" {
		t.Fatalf("expected success, got %q", mut.Status)
	}
	if len(mut.Refreshed) == 0 || mut.Refreshed[0] != "decisions.list" {
		t.Fatalf("expected decisions.list refresh, got %v", mut.Refreshed)
	}
}

func TestExecRunnerMissingExecutableIsUnavailable(t *testing.T) {
	so := false
	lf := false
	ex, err := New(Options{
		ExecutablePath:           "/nonexistent/cscli",
		Runner:                   NewExecRunner(),
		supportsStructuredOutput: &so,
		supportsLimitFlag:        &lf,
	})
	if err != nil {
		t.Fatalf("New should not fail on a missing executable (probe handles it): %v", err)
	}
	// Run reports unavailable without leaking the path.
	_, opErr := ex.Run(context.Background(), OpAlertsList, AlertsListRequest{})
	if opErr == nil {
		t.Fatal("expected unavailable for missing executable")
	}
	if opErr.Class != ErrUnavailable {
		t.Fatalf("expected unavailable, got %s", opErr.Class)
	}
	if strings.Contains(opErr.Message, "/nonexistent") {
		t.Fatalf("error leaked executable path: %q", opErr.Message)
	}
}
