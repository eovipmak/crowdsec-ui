package auth

import (
	"context"
	"strings"
	"testing"
	"time"
)

// testPasswordHash is the bcrypt hash of "test-password" (cost 4, test-only).
// It is a real bcrypt hash so tests exercise the actual verification path
// without a live CrowdSec.
const testPasswordHash = "$2a$04$aTaoHi4WDabPBhQsGz1DUO7vxdLb2P.FK6FVEuwP99ZhbCQp1WYC6"

const testPassword = "test-password"

func TestAuthenticateValidPassword(t *testing.T) {
	a := NewBcrypt(testPasswordHash, 8*time.Hour)
	sess, err := a.Authenticate(context.Background(), testPassword)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if !sess.Authenticated {
		t.Fatal("expected authenticated session")
	}
	if sess.CSRF == "" || !strings.HasPrefix(sess.CSRF, "s_csrf_") {
		t.Fatalf("expected a CSRF token, got %q", sess.CSRF)
	}
	if sess.ID == "" {
		t.Fatal("expected a session ID")
	}
	if sess.Token == "" || !strings.HasPrefix(sess.Token, "s_") {
		t.Fatalf("expected an opaque cookie token, got %q", sess.Token)
	}
	if !sess.ExpiresAt.After(time.Now()) {
		t.Fatal("expected a future expiry")
	}
}

func TestAuthenticateWrongPassword(t *testing.T) {
	a := NewBcrypt(testPasswordHash, 8*time.Hour)
	if _, err := a.Authenticate(context.Background(), "wrong-password"); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestAuthenticateEmptyPassword(t *testing.T) {
	a := NewBcrypt(testPasswordHash, 8*time.Hour)
	if _, err := a.Authenticate(context.Background(), ""); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials for empty password, got %v", err)
	}
}

func TestAuthenticateUnconfiguredHashFails(t *testing.T) {
	// An unconfigured hash (empty) must never authenticate anyone.
	a := NewBcrypt("", 8*time.Hour)
	if _, err := a.Authenticate(context.Background(), testPassword); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials for empty hash, got %v", err)
	}
}

func TestAuthenticateMalformedHashFails(t *testing.T) {
	// A malformed hash must fail as invalid credentials, never reveal that
	// the format is unsupported.
	for _, hash := range []string{
		"not-a-hash",
		"$argon2id$garbage",
		"$2a$04$short",
	} {
		a := NewBcrypt(hash, 8*time.Hour)
		if _, err := a.Authenticate(context.Background(), testPassword); err != ErrInvalidCredentials {
			t.Fatalf("hash %q: expected ErrInvalidCredentials, got %v", hash, err)
		}
	}
}

func TestArgon2Verification(t *testing.T) {
	// A self-describing argon2id PHC hash for "test-password" (m=65536,t=3,
	// p=2, 32-byte key). Exercises the argon2id path required by §8.1.
	hash := "$argon2id$v=19$m=65536,t=3,p=2$c2FsdGVk$UaYXWMiA1YEhkydbo8CBcqtjRIJTZGRiO4K5FugNFFA"
	a := NewBcrypt(hash, 8*time.Hour)
	if _, err := a.Authenticate(context.Background(), testPassword); err != nil {
		t.Fatalf("argon2id verify: %v", err)
	}
	if _, err := a.Authenticate(context.Background(), "wrong"); err != ErrInvalidCredentials {
		t.Fatalf("argon2id wrong password: expected ErrInvalidCredentials, got %v", err)
	}
	// A malformed argon2 PHC string is rejected uniformly.
	bad := NewBcrypt("$argon2id$garbage", 8*time.Hour)
	if _, err := bad.Authenticate(context.Background(), testPassword); err != ErrInvalidCredentials {
		t.Fatalf("malformed argon2: expected ErrInvalidCredentials, got %v", err)
	}
}

func TestValidateExpiryAndLogout(t *testing.T) {
	now := time.Now()
	a := NewBcryptWithClock(testPasswordHash, 8*time.Hour, func() time.Time { return now })

	sess, err := a.Authenticate(context.Background(), testPassword)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}

	// Validate the issued token.
	got, err := a.Validate(context.Background(), sess.Token)
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if !got.Authenticated || got.ID != sess.ID || got.CSRF != sess.CSRF {
		t.Fatalf("validated session mismatch: %+v", got)
	}

	// A random/unknown token is rejected.
	if _, err := a.Validate(context.Background(), "s_unknown"); err != ErrUnauthenticated {
		t.Fatalf("expected ErrUnauthenticated for unknown token, got %v", err)
	}

	// Logout invalidates server-side; reuse is rejected.
	if err := a.Invalidate(context.Background(), sess.Token); err != nil {
		t.Fatalf("Invalidate: %v", err)
	}
	if _, err := a.Validate(context.Background(), sess.Token); err != ErrUnauthenticated {
		t.Fatalf("expected ErrUnauthenticated after logout, got %v", err)
	}

	// Invalidate is idempotent.
	if err := a.Invalidate(context.Background(), sess.Token); err != nil {
		t.Fatalf("second Invalidate: %v", err)
	}
}

func TestSessionExpiry(t *testing.T) {
	now := time.Now()
	a := NewBcryptWithClock(testPasswordHash, 8*time.Hour, func() time.Time { return now })
	sess, err := a.Authenticate(context.Background(), testPassword)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}

	// Advance the clock past expiry.
	now = now.Add(9 * time.Hour)
	if _, err := a.Validate(context.Background(), sess.Token); err != ErrUnauthenticated {
		t.Fatalf("expected ErrUnauthenticated after expiry, got %v", err)
	}
}

func TestSessionReplayResistance(t *testing.T) {
	// A single-issue session token must be unique; two logins produce two
	// distinct tokens/IDs, and each token is accepted only once while valid.
	now := time.Now()
	a := NewBcryptWithClock(testPasswordHash, 8*time.Hour, func() time.Time { return now })

	s1, _ := a.Authenticate(context.Background(), testPassword)
	s2, _ := a.Authenticate(context.Background(), testPassword)
	if s1.Token == s2.Token || s1.ID == s2.ID || s1.CSRF == s2.CSRF {
		t.Fatal("expected distinct session tokens after fresh login")
	}
	// The second login replaces the first (single administrator model).
	if _, err := a.Validate(context.Background(), s1.Token); err != ErrUnauthenticated {
		t.Fatalf("expected prior session to be invalidated by fresh login, got %v", err)
	}
	if _, err := a.Validate(context.Background(), s2.Token); err != nil {
		t.Fatalf("expected current session valid, got %v", err)
	}
}

func TestNoSlidingRenewal(t *testing.T) {
	// The expiry is fixed at issue time; validating/using a session must not
	// extend it. Use a mutable clock to move time forward within the TTL.
	now := time.Now()
	a := NewBcryptWithClock(testPasswordHash, time.Hour, func() time.Time { return now })
	sess, err := a.Authenticate(context.Background(), testPassword)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	expiry := sess.ExpiresAt

	// Move the clock forward 30 minutes (still within the 1h TTL) and
	// re-validate. The new clock is shared via the setter below.
	now = now.Add(30 * time.Minute)
	// Re-validate using the same store (same authenticator) after the clock
	// moved; expiry must be unchanged.
	got, err := a.Validate(context.Background(), sess.Token)
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if !got.ExpiresAt.Equal(expiry) {
		t.Fatalf("no sliding renewal: expiry changed from %v to %v", expiry, got.ExpiresAt)
	}
}

func TestIsAuthError(t *testing.T) {
	if code, ok := IsAuthError(ErrUnauthenticated); !ok || code != "unauthenticated" {
		t.Fatalf("IsAuthError(ErrUnauthenticated) = %q, %v", code, ok)
	}
	if code, ok := IsAuthError(ErrInvalidCredentials); !ok || code != "invalid_credentials" {
		t.Fatalf("IsAuthError(ErrInvalidCredentials) = %q, %v", code, ok)
	}
	if _, ok := IsAuthError(context.Canceled); ok {
		t.Fatal("IsAuthError on a non-auth error should be false")
	}
}
