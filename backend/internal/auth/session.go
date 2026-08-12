package auth

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// sessionRecord is a live, unexpired server-side session. The browser holds
// only the opaque cookie token; the session ID and CSRF token never leave the
// server except the CSRF token returned at login/status (architecture §4.6).
type sessionRecord struct {
	id        string
	csrf      string
	expiresAt time.Time
}

// sessionStore is an in-memory session store (no application database — the
// no-database architecture §2 is preserved). One expiring session is the
// expected model; a fresh login replaces any prior session for the same
// administrator.
type sessionStore struct {
	mu       sync.Mutex
	sessions map[string]sessionRecord
	now      func() time.Time
}

// newSessionStore returns an empty session store with an injectable clock.
func newSessionStore(now func() time.Time) *sessionStore {
	if now == nil {
		now = time.Now
	}
	return &sessionStore{sessions: map[string]sessionRecord{}, now: now}
}

// create issues a new session and returns its opaque cookie token. The token
// is unguessable (32 random bytes) and the session expires at now+ttl. No
// sliding renewal is performed (architecture §4.2, MVP).
func (s *sessionStore) create(ttl time.Duration) (token string, sess Session) {
	if ttl <= 0 {
		ttl = DefaultSessionTTL
	}
	tokenBytes := make([]byte, 32)
	idBytes := make([]byte, 16)
	csrfBytes := make([]byte, 16)
	_, _ = rand.Read(tokenBytes)
	_, _ = rand.Read(idBytes)
	_, _ = rand.Read(csrfBytes)

	token = "s_" + hex.EncodeToString(tokenBytes)
	id := "sidd_" + hex.EncodeToString(idBytes)
	csrf := "s_csrf_" + hex.EncodeToString(csrfBytes)
	expiresAt := s.now().Add(ttl)

	s.mu.Lock()
	// A fresh login replaces any prior session for the single administrator.
	s.sessions = map[string]sessionRecord{token: {id: id, csrf: csrf, expiresAt: expiresAt}}
	s.mu.Unlock()

	return token, Session{
		Authenticated: true,
		ExpiresAt:     expiresAt,
		CSRF:          csrf,
		ID:            id,
		Token:         token,
	}
}

// lookup returns the session for a token, or ok=false when missing, expired,
// or logged-out. Expiry is checked on every lookup (no lazy sweep needed).
func (s *sessionStore) lookup(token string) (sessionRecord, bool) {
	s.mu.Lock()
	rec, ok := s.sessions[token]
	s.mu.Unlock()
	if !ok {
		return sessionRecord{}, false
	}
	if s.now().After(rec.expiresAt) {
		// Expire server-side on access; a trusted-network MVP does not
		// require a background sweeper.
		s.mu.Lock()
		delete(s.sessions, token)
		s.mu.Unlock()
		return sessionRecord{}, false
	}
	return rec, true
}

// delete removes a session (logout). It is idempotent: deleting a missing or
// already-deleted session is not an error.
func (s *sessionStore) delete(token string) {
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}
