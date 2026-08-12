package adapter

import (
	"bytes"
	"context"
	"errors"
	"os/exec"
	"syscall"
)

// runProcess executes the command directly with exec.CommandContext (no
// shell), captures stdout/stderr, and classifies the outcome into a stable
// error class. It never returns raw stderr to callers; the caller decides how
// to surface diagnostics.
func runProcess(ctx context.Context, c Command) (ProcResult, *OpError) {
	cmd := exec.CommandContext(ctx, c.ExecutablePath, c.Args...)
	cmd.Dir = c.Dir

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	res := ProcResult{
		Stdout:   stdout.Bytes(),
		Stderr:   stderr.Bytes(),
		ExitCode: exitCode(err),
	}

	if err == nil {
		return res, nil
	}

	// Context deadline exceeded or cancellation -> timeout class.
	if errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(ctx.Err(), context.Canceled) {
		return res, newOpError(ErrTimeout, "")
	}

	// The executable itself could not be found or started -> unavailable.
	var pathErr *exec.Error
	if errors.As(err, &pathErr) {
		return res, newOpError(ErrUnavailable, "")
	}

	// Permission denied on exec surfaces as syscall.EACCES.
	if errors.Is(err, syscall.EACCES) {
		return res, newOpError(ErrPermissionDenied, "")
	}

	// Any other start/exec failure is reported as unavailable (the process
	// did not produce CrowdSec output).
	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		return res, newOpError(ErrUnavailable, "")
	}

	// The process started and exited non-zero -> CrowdSec-reported failure.
	return res, newOpError(ErrCrowdsecFailure, "")
}

// exitCode extracts the process exit status, or -1 when none is available.
func exitCode(err error) int {
	if err == nil {
		return 0
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return exitErr.ExitCode()
	}
	return -1
}
