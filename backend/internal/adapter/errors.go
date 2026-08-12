package adapter

import "fmt"

// ErrorClass is the stable adapter-level error class (matrix §2, architecture
// §4.5). These are the only error codes the adapter emits; they are mapped to
// safe, secret-free client messages by the API layer.
type ErrorClass string

// Adapter-level error classes (architecture §4.5).
const (
	// ErrInvalidParameters: cscli rejected a parameter value at execution
	// time. Not retryable.
	ErrInvalidParameters ErrorClass = "invalid_parameters"
	// ErrPermissionDenied: the service account lacks permission. Never
	// retried with elevation. Not retryable.
	ErrPermissionDenied ErrorClass = "permission_denied"
	// ErrTimeout: the command exceeded the configured timeout. Retryable.
	ErrTimeout ErrorClass = "timeout"
	// ErrUnavailable: the cscli executable is missing or not resolvable.
	// Retryable.
	ErrUnavailable ErrorClass = "unavailable"
	// ErrUnsupported: the installed command/flag/capability is not
	// supported. Not retryable.
	ErrUnsupported ErrorClass = "unsupported"
	// ErrMalformedOutput: expected JSON/raw output was malformed. Not
	// retryable.
	ErrMalformedOutput ErrorClass = "malformed_output"
	// ErrCrowdsecFailure: non-zero exit with no more specific class. Not
	// retryable.
	ErrCrowdsecFailure ErrorClass = "crowdsec_failure"
)

// Retryable reports the matrix-defined retryability for a class.
func (c ErrorClass) Retryable() bool {
	switch c {
	case ErrTimeout, ErrUnavailable:
		return true
	default:
		return false
	}
}

// OpError is a stable, secret-safe operation error. Message is always a fixed
// safe phrase; it never contains raw stderr, command lines, secrets, tokens,
// or file paths. Operation records the operation that failed (informational).
type OpError struct {
	Class     ErrorClass
	Message   string
	Retryable bool
	Operation OperationID
}

func (e *OpError) Error() string {
	return fmt.Sprintf("%s: %s", e.Class, e.Message)
}

// newOpError builds an OpError for the class with the architecture §4.5 safe
// default message and the class-defined retryability.
func newOpError(class ErrorClass, op OperationID) *OpError {
	return &OpError{
		Class:     class,
		Message:   safeMessage(class),
		Retryable: class.Retryable(),
		Operation: op,
	}
}

// safeMessage returns the architecture §4.5 safe default message for a class.
func safeMessage(class ErrorClass) string {
	switch class {
	case ErrInvalidParameters:
		return "The requested parameters were rejected by CrowdSec."
	case ErrPermissionDenied:
		return "The dashboard does not have permission to perform this operation."
	case ErrTimeout:
		return "The operation timed out. Try again."
	case ErrUnavailable:
		return "CrowdSec command-line tools are unavailable."
	case ErrUnsupported:
		return "This CrowdSec installation does not support the requested operation."
	case ErrMalformedOutput:
		return "CrowdSec returned unexpected output."
	default: // ErrCrowdsecFailure
		return "CrowdSec rejected the requested operation."
	}
}
