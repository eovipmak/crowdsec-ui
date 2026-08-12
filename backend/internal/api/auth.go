package api

// This file defines the api-layer authentication seam. Per architecture §3
// the api layer only calls the Authenticator hook; it never verifies
// passwords or cryptographically validates session tokens itself. The
// concrete implementation lives in internal/auth (task 06). The api layer
// aliases those types so the middleware and handler call sites use the same
// names as the task-05 seam.

import (
	"crowdsec-dashboard/backend/internal/auth"
)

// Session is the opaque authenticated identity the api layer receives from
// the auth hook (architecture §3 "Handlers exchange typed values only").
// Handlers never see credential material.
type Session = auth.Session

// Authenticator is the auth hook contract (architecture §3). Task 06 owns the
// real implementation in internal/auth.
type Authenticator = auth.Authenticator

// errUnauthenticated signals a missing/invalid/expired session.
func errUnauthenticated() error { return auth.ErrUnauthenticated }

// errInvalidCredentials signals a failed login.
func errInvalidCredentials() error { return auth.ErrInvalidCredentials }

// isAuthError reports whether err is an auth sentinel and returns its code.
func isAuthError(err error) (string, bool) { return auth.IsAuthError(err) }
