package api

import (
	"context"
	"time"
)

// This file defines the authentication seam that task 06 attaches to. Per
// architecture §3 the api layer only calls the Authenticator hook; it never
// verifies passwords or cryptographically validates session tokens itself.
//
// Task 05 provides a stub Authenticator so the server compiles and every
// protected route is enforced through the same middleware path. Task 06
// replaces the stub with real password verification, session issuance,
// expiry, and CSRF token binding. The middleware and handler call sites below
// are the exact attachment points task 06 fills in.

// Session is the opaque authenticated identity the api layer receives from
// the auth hook (architecture §3 "Handlers exchange typed values only").
// Handlers never see credential material.
type Session struct {
	// Authenticated reports whether the request carried a valid session.
	Authenticated bool
	// ExpiresAt is the session expiry.
	ExpiresAt time.Time
	// CSRF is the session-bound CSRF token returned at login/status.
	CSRF string
	// ID is an opaque session identity. Task 05 binds confirmation tokens to
	// a placeholder identity; task 06 binds them to real sessions.
	ID string
}

// Authenticator is the auth hook contract (architecture §3). Task 06 owns the
// real implementation.
type Authenticator interface {
	// Authenticate checks a login password and returns a session on success.
	Authenticate(ctx context.Context, password string) (Session, error)
	// Validate resolves a session token from the request cookie into a
	// Session, or an error when missing/expired/invalid/logged-out.
	Validate(ctx context.Context, token string) (Session, error)
	// Invalidate server-side invalidates a session token (logout).
	Invalidate(ctx context.Context, token string) error
}

// ErrAuthentication is the sentinel the api layer uses to write a 401
// unauthenticated / invalid_credentials response from the auth hook.
type authError struct{ code string }

func (e *authError) Error() string { return e.code }

// errUnauthenticated signals a missing/invalid/expired session.
func errUnauthenticated() error { return &authError{code: "unauthenticated"} }

// errInvalidCredentials signals a failed login.
func errInvalidCredentials() error { return &authError{code: "invalid_credentials"} }

// isAuthError reports whether err is an auth sentinel and returns its code.
func isAuthError(err error) (string, bool) {
	if ae, ok := err.(*authError); ok {
		return ae.code, true
	}
	return "", false
}

// StubAuthenticator is the task-05 placeholder. It accepts any password and
// any session token, returning a fixed placeholder session. It is clearly
// marked as NOT production-safe and MUST be replaced by task 06.
type StubAuthenticator struct {
	SessionTTL time.Duration
}

// NewStubAuthenticator returns a stub authenticator with the given session
// TTL. This is used only until task 06 provides the real implementation.
func NewStubAuthenticator(ttl time.Duration) *StubAuthenticator {
	if ttl <= 0 {
		ttl = 8 * time.Hour
	}
	return &StubAuthenticator{SessionTTL: ttl}
}

// Authenticate accepts any password (placeholder). Task 06 verifies against
// auth.admin_password_hash.
func (s *StubAuthenticator) Authenticate(_ context.Context, _ string) (Session, error) {
	return s.newSession(), nil
}

// Validate accepts any session token (placeholder). Task 06 resolves the real
// session store.
func (s *StubAuthenticator) Validate(_ context.Context, _ string) (Session, error) {
	return s.newSession(), nil
}

// Invalidate is a no-op placeholder. Task 06 performs real server-side
// invalidation.
func (s *StubAuthenticator) Invalidate(_ context.Context, _ string) error { return nil }

func (s *StubAuthenticator) newSession() Session {
	return Session{
		Authenticated: true,
		ExpiresAt:     time.Now().Add(s.SessionTTL),
		CSRF:          "s_csrf_stub",
		ID:            "stub-session",
	}
}
