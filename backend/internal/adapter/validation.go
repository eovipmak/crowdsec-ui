package adapter

import (
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// This file implements parameter validation. Validation happens BEFORE any
// process is started. Malformed parameters must never reach os/exec; the
// adapter returns a validation error without invoking the executable.

// IdentifierRule validates a CrowdSec identifier (matrix §3): a non-empty
// string matching `^[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}$`. This is used for
// name, scenario, and collection identifiers. Hub identifiers may contain a
// single `/` (e.g. crowdsecurity/ssh-bf); the rule already permits `/`.
var identifierRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}$`)

// safeTokenRe validates a safe token for filter scope/kind/type/origin
// (matrix §3, architecture §6.1): `^[A-Za-z][A-Za-z0-9_-]{0,63}$`.
var safeTokenRe = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]{0,63}$`)

// durationRe accepts the adapter duration grammar (matrix §3):
// `^[0-9]+(s|m|h|d)$`.
var durationRe = regexp.MustCompile(`^[0-9]+(s|m|h|d)$`)

// defaultLimitAlerts is the alerts.list default limit (matrix §3).
const defaultLimitAlerts = 50

// defaultLimitDecisions is the decisions.list default limit (matrix §3).
const defaultLimitDecisions = 100

// maxLimit is the upper bound for limit (matrix §3).
const maxLimit = 500

// maxDuration365d is the maximum accepted duration (matrix §3).
const maxDuration365d = 365 * 24 * time.Hour

// minPruneDuration is the minimum machines.prune duration without
// --not-validated-only (matrix §4 machines.prune).
const minPruneDuration = 2 * time.Minute

// maxTextLen is the maximum length for reason/description/comment (matrix §3).
const maxTextLen = 256

// validateIdentifier validates a CrowdSec identifier.
func validateIdentifier(field, value string) *OpError {
	if value == "" {
		return validationError(field, "must not be empty")
	}
	if !identifierRe.MatchString(value) {
		return validationError(field, "is not a valid CrowdSec identifier")
	}
	return nil
}

// validateSafeToken validates a filter token (scope/kind/type/origin).
func validateSafeToken(field, value string) *OpError {
	if value == "" {
		return validationError(field, "must not be empty")
	}
	if !safeTokenRe.MatchString(value) {
		return validationError(field, "contains invalid characters")
	}
	return nil
}

// validateIPOrRange validates an IP address or CIDR using the standard parser.
func validateIPOrRange(field, value string) *OpError {
	if value == "" {
		return validationError(field, "must not be empty")
	}
	if ip := net.ParseIP(value); ip != nil {
		return nil
	}
	if _, _, err := net.ParseCIDR(value); err == nil {
		return nil
	}
	return validationError(field, "is not a valid IP address or CIDR range")
}

// validateDuration validates a duration against the adapter grammar and the
// 365-day upper bound.
func validateDuration(field, value string) *OpError {
	if value == "" {
		return validationError(field, "must not be empty")
	}
	if !durationRe.MatchString(value) {
		return validationError(field, "must match the duration grammar (e.g. 4h, 30m, 2d)")
	}
	d, err := parseDuration(value)
	if err != nil {
		return validationError(field, err.Error())
	}
	if d > maxDuration365d {
		return validationError(field, "must not exceed 365 days")
	}
	return nil
}

// parseDuration parses the adapter duration grammar into a time.Duration.
func parseDuration(value string) (time.Duration, error) {
	unit := value[len(value)-1]
	num := value[:len(value)-1]
	n, err := strconv.ParseInt(num, 10, 64)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("invalid duration")
	}
	switch unit {
	case 's':
		return time.Duration(n) * time.Second, nil
	case 'm':
		return time.Duration(n) * time.Minute, nil
	case 'h':
		return time.Duration(n) * time.Hour, nil
	case 'd':
		return time.Duration(n) * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("invalid duration unit")
	}
}

// validateText validates a free-form text field (reason/description/comment):
// UTF-8, 1..256 chars, newline-free.
func validateText(field, value string) *OpError {
	if value == "" {
		return validationError(field, "must not be empty")
	}
	if strings.ContainsAny(value, "\r\n") {
		return validationError(field, "must not contain newlines")
	}
	if utf8.RuneCountInString(value) > maxTextLen {
		return validationError(field, fmt.Sprintf("must not exceed %d characters", maxTextLen))
	}
	return nil
}

// validateLimit validates the limit parameter (matrix §3): 1..500.
func validateLimit(field string, limit int) *OpError {
	if limit < 1 || limit > maxLimit {
		return validationError(field, fmt.Sprintf("must be between 1 and %d", maxLimit))
	}
	return nil
}

// validatePrune validates machines.prune parameters (matrix §4): without
// --not-validated-only, duration must be >= 2m; with it, no minimum applies.
func validatePrune(duration *string, notValidatedOnly bool) *OpError {
	if duration == nil {
		return nil
	}
	if err := validateDuration("duration", *duration); err != nil {
		return err
	}
	if !notValidatedOnly {
		d, err := parseDuration(*duration)
		if err != nil {
			return validationError("duration", "invalid duration")
		}
		if d < minPruneDuration {
			return validationError("duration", "must be at least 2m unless not_validated_only is set")
		}
	}
	return nil
}

// validationError builds an invalid_parameters OpError for the field.
func validationError(field, msg string) *OpError {
	return &OpError{
		Class:     ErrInvalidParameters,
		Message:   fmt.Sprintf("%s %s.", field, msg),
		Retryable: false,
	}
}
