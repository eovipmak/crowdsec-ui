package adapter

import (
	"context"
)

// CommandRunner is the process-execution boundary. The adapter depends on this
// interface so tests can inject a fake `cscli` without invoking a real
// process. Command contains the resolved executable path and the fixed,
// already-validated argument vector; the callee builds the command with
// exec.CommandContext and runs it, capturing stdout, stderr, and exit status.
//
// Command.Cancel is an optional context that is cancelled when the caller
// wants to stop the process (timeout or cancellation). Implementations must
// propagate it to exec.CommandContext.
type CommandRunner interface {
	// Run executes the command and returns its stdout, stderr, and exit
	// status. It returns an error classified into one of the stable error
	// classes.
	Run(ctx context.Context, c Command) (ProcResult, *OpError)
}

// Command is a fully-constructed, validated invocation. Args is the fixed
// argument vector (beginning after the executable name). It is constructed
// internally from validated typed parameters and never from browser input.
type Command struct {
	// ExecutablePath is the resolved cscli path (from config or the service
	// environment). It is never derived from a request.
	ExecutablePath string
	// Args is the fixed argument vector, e.g. ["alerts", "list", "-o", "json"].
	Args []string
	// Dir is the working directory, or "" for the service account's default.
	Dir string
}

// ProcResult captures the outcome of a command execution. Stdout/Stderr are
// captured for parsing and diagnostics; the adapter never returns raw stderr
// or command lines to callers.
type ProcResult struct {
	Stdout   []byte
	Stderr   []byte
	ExitCode int
}

// execRunner is the real CommandRunner backed by os/exec.
type execRunner struct{}

// NewExecRunner returns the production CommandRunner backed by os/exec. It
// never invokes a shell and never interpolates user input.
func NewExecRunner() CommandRunner { return &execRunner{} }

// RunClass is a helper for classifying a process-start failure.
func (r *execRunner) Run(ctx context.Context, c Command) (ProcResult, *OpError) {
	return runProcess(ctx, c)
}
