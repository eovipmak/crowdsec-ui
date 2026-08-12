package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// This file implements the mutation confirmation service (architecture §4.6,
// §4.7). Confirmation is server-verifiable and bound to the operation
// identifier plus the canonical (validated) typed request plus the issuing
// session. The token is opaque to the frontend; there is no
// client-computable confirmation.
//
// Task 05 binds the token to the operation + canonical request + the stub
// session identity. Task 06 replaces the stub identity with real sessions.
// The token itself is a random value stored in an in-memory store (no
// application database — the no-database architecture is preserved).

// confirmationTTL is the token lifetime (architecture §4.6: 5 minutes).
const confirmationTTL = 5 * time.Minute

// mutationCommand is the fixed source.command label for a mutation operation.
// It is a fixed matrix operation label, never an executed argument vector.
var mutationCommand = map[string]string{
	"decisions.add":     "cscli decisions add",
	"decisions.delete":  "cscli decisions delete",
	"machines.prune":    "cscli machines prune",
	"bouncers.delete":   "cscli bouncers delete",
	"allowlists.create": "cscli allowlists create",
	"allowlists.add":    "cscli allowlists add",
	"allowlists.remove": "cscli allowlists remove",
	"allowlists.delete": "cscli allowlists delete",
}

// mutationAction is a fixed human label identifying the CrowdSec action
// (architecture §4.6/§6.2). It is never a command line.
var mutationAction = map[string]string{
	"decisions.add":     "Add an active decision",
	"decisions.delete":  "Delete active decisions",
	"machines.prune":    "Prune stale machine registrations",
	"bouncers.delete":   "Remove a bouncer",
	"allowlists.create": "Create an allowlist",
	"allowlists.add":    "Add an entry to an allowlist",
	"allowlists.remove": "Remove an entry from an allowlist",
	"allowlists.delete": "Delete an allowlist",
}

// confirmationRecord is a stored, unexpired confirmation token binding.
type confirmationRecord struct {
	Operation string
	Request   string // canonical JSON of the validated typed request
	SessionID string
	ExpiresAt time.Time
}

// ConfirmationService issues and verifies confirmation tokens.
type ConfirmationService struct {
	mu    sync.Mutex
	store map[string]confirmationRecord
	now   func() time.Time
}

// NewConfirmationService returns an in-memory confirmation service.
func NewConfirmationService() *ConfirmationService {
	return &ConfirmationService{
		store: map[string]confirmationRecord{},
		now:   time.Now,
	}
}

// Issue creates a token bound to operation + canonical request + session.
// It returns the opaque token and its expiry.
func (c *ConfirmationService) Issue(op string, request any, sessionID string) (string, time.Time, error) {
	canonical, err := json.Marshal(request)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("cannot canonicalize request")
	}
	token, err := randomToken("c_")
	if err != nil {
		return "", time.Time{}, err
	}
	rec := confirmationRecord{
		Operation: op,
		Request:   string(canonical),
		SessionID: sessionID,
		ExpiresAt: c.now().Add(confirmationTTL),
	}
	c.mu.Lock()
	c.store[token] = rec
	c.mu.Unlock()
	return token, rec.ExpiresAt, nil
}

// Verify checks that token is valid, unexpired, and bound to the exact
// operation + canonical request + session. It returns an error when missing,
// mismatched, or expired (architecture §4.7 → 409 invalid_confirmation).
func (c *ConfirmationService) Verify(token, op string, request any, sessionID string) error {
	canonical, err := json.Marshal(request)
	if err != nil {
		return errInvalidConfirmation()
	}
	c.mu.Lock()
	rec, ok := c.store[token]
	if ok {
		delete(c.store, token) // single-use
	}
	c.mu.Unlock()
	if !ok {
		return errInvalidConfirmation()
	}
	if rec.Operation != op {
		return errInvalidConfirmation()
	}
	if rec.Request != string(canonical) {
		return errInvalidConfirmation()
	}
	if rec.SessionID != sessionID {
		return errInvalidConfirmation()
	}
	if c.now().After(rec.ExpiresAt) {
		return errInvalidConfirmation()
	}
	return nil
}

// ConfirmationIssuanceResponse is the §4.6 confirmation issuance body.
type ConfirmationIssuanceResponse struct {
	Confirmation confirmationBody `json:"confirmation"`
}

type confirmationBody struct {
	Operation    string `json:"operation"`
	Token        string `json:"token"`
	ExpiresAt    string `json:"expires_at"`
	Action       string `json:"action"`
	CommandLabel string `json:"command_label"`
}

// errInvalidConfirmationError is the sentinel for a 409.
type invalidConfirmationError struct{}

func (e *invalidConfirmationError) Error() string { return "invalid_confirmation" }

func errInvalidConfirmation() error { return &invalidConfirmationError{} }

func isInvalidConfirmation(err error) bool {
	_, ok := err.(*invalidConfirmationError)
	return ok
}

// randomToken returns a cryptographically random opaque token with the given
// prefix.
func randomToken(prefix string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(b), nil
}

// canonicalRequestOf is a helper to view a typed request's canonical JSON for
// logging-free debugging. It is not used for secret material.
func canonicalRequestOf(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
