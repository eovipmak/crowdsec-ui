// Package auth implements the single-admin authentication hook for the
// dashboard (architecture §3, §4.2). It owns password verification, session
// issue/validate/invalidate, and CSRF token binding. It never knows operation
// identifiers or command vectors, and it never imports os/exec.
//
// The administrator is a single local account represented only by a strong
// password hash (auth.admin_password_hash). Plaintext passwords, session
// tokens, and hashes never reach logs or responses.
package auth

import (
	"context"
	"errors"
	"time"
)

// DefaultSessionTTL is the fallback session lifetime when a zero/negative TTL
// is supplied (architecture §8.1 default is 8h).
const DefaultSessionTTL = 8 * time.Hour

// Session is the opaque authenticated identity the api layer receives from
// this hook (architecture §3 "Handlers exchange typed values only"). Handlers
// never see credential material.
type Session struct {
	// Authenticated reports whether the request carried a valid session.
	Authenticated bool
	// ExpiresAt is the session expiry.
	ExpiresAt time.Time
	// CSRF is the session-bound CSRF token returned at login/status.
	CSRF string
	// ID is the opaque server-side session identity stored by the api
	// confirmation service (architecture §4.7). It is never the cookie token.
	ID string
	// Token is the opaque cookie token carried by the browser. It is consumed
	// by the api layer when writing/scoping the session cookie; it is never
	// returned in a response body and never logged.
	Token string
}

// Authenticator is the auth hook contract (architecture §3). The api layer
// calls only these methods; it never verifies passwords or cryptographically
// validates session tokens itself.
type Authenticator interface {
	// Authenticate checks a login password and returns a session on success.
	Authenticate(ctx context.Context, password string) (Session, error)
	// Validate resolves a session token from the request cookie into a
	// Session, or an error when missing/expired/invalid/logged-out.
	Validate(ctx context.Context, token string) (Session, error)
	// Invalidate server-side invalidates a session token (logout).
	Invalidate(ctx context.Context, token string) error
}

// ErrAuthentication is returned for any failed login or invalid session; the
// api layer maps it to the §4.4 codes. It carries a stable code so callers can
// distinguish a failed login (invalid_credentials) from a missing/expired
// session (unauthenticated) without inspecting credential material.
type ErrAuthentication struct{ code string }

func (e *ErrAuthentication) Error() string { return e.code }

// Code returns the stable §4.4 code ("unauthenticated" or
// "invalid_credentials").
func (e *ErrAuthentication) Code() string { return e.code }

// ErrUnauthenticated signals a missing/invalid/expired/logged-out session.
var ErrUnauthenticated = &ErrAuthentication{code: "unauthenticated"}

// ErrInvalidCredentials signals a failed login. It is returned for every
// failure cause (wrong password, unparseable hash, hash mismatch) so the
// response message is identical and the account cannot be enumerated
// (architecture §4.2).
var ErrInvalidCredentials = &ErrAuthentication{code: "invalid_credentials"}

// IsAuthError reports whether err is an *ErrAuthentication and returns its
// code.
func IsAuthError(err error) (string, bool) {
	var ae *ErrAuthentication
	if errors.As(err, &ae) {
		return ae.code, true
	}
	return "", false
}
