package auth

import (
	"context"
	"time"
)

// BcryptAuthenticator is the real single-admin authenticator (architecture
// §4.2, §8). It verifies the login password against the stored
// auth.admin_password_hash using bcrypt (argon2id hashes are also verified
// for compatibility), issues expiring opaque sessions, and invalidates them
// on logout.
type BcryptAuthenticator struct {
	hash  string
	ttl   time.Duration
	store *sessionStore
}

// NewBcrypt returns a real authenticator for the given admin password hash
// and session TTL. The hash is the only secret; it is stored in memory and
// never logged. The caller must have already ensured the hash is configured
// (config.HashSet()); an empty hash makes every login fail as invalid
// credentials rather than ever succeeding.
func NewBcrypt(hash string, ttl time.Duration) *BcryptAuthenticator {
	return &BcryptAuthenticator{
		hash:  hash,
		ttl:   ttl,
		store: newSessionStore(time.Now),
	}
}

// NewBcryptWithClock is NewBcrypt with an injectable clock for tests.
func NewBcryptWithClock(hash string, ttl time.Duration, now func() time.Time) *BcryptAuthenticator {
	return &BcryptAuthenticator{
		hash:  hash,
		ttl:   ttl,
		store: newSessionStore(now),
	}
}

// Authenticate verifies the login password against the configured hash. On
// success it issues a fresh session; on any failure (wrong password,
// malformed/unparseable hash) it returns ErrInvalidCredentials so the api
// layer responds identically and the account cannot be enumerated.
func (a *BcryptAuthenticator) Authenticate(_ context.Context, password string) (Session, error) {
	if err := verifyPassword(a.hash, password); err != nil {
		return Session{}, err
	}
	_, sess := a.store.create(a.ttl)
	return sess, nil
}

// Validate resolves a cookie token into a Session. It returns
// ErrUnauthenticated when the token is missing, unknown, expired, or logged
// out.
func (a *BcryptAuthenticator) Validate(_ context.Context, token string) (Session, error) {
	rec, ok := a.store.lookup(token)
	if !ok {
		return Session{}, ErrUnauthenticated
	}
	return Session{
		Authenticated: true,
		ExpiresAt:     rec.expiresAt,
		CSRF:          rec.csrf,
		ID:            rec.id,
		Token:         token,
	}, nil
}

// Invalidate server-side invalidates a session (logout). It is idempotent.
func (a *BcryptAuthenticator) Invalidate(_ context.Context, token string) error {
	a.store.delete(token)
	return nil
}
