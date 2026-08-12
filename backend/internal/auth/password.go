package auth

import (
	"crypto/subtle"
	"encoding/base64"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// verifyPassword checks password against the stored admin_password_hash
// (architecture §8.1: argon2id/bcrypt). It returns ErrInvalidCredentials for
// every failure cause so the api layer produces an identical response and the
// account cannot be enumerated. The hash itself is never logged or returned.
func verifyPassword(hash, password string) error {
	if hash == "" {
		return ErrInvalidCredentials
	}
	switch {
	case strings.HasPrefix(hash, "$2a$"), strings.HasPrefix(hash, "$2b$"), strings.HasPrefix(hash, "$2y$"):
		return verifyBcrypt(hash, password)
	case strings.HasPrefix(hash, "$argon2id$"), strings.HasPrefix(hash, "$argon2i$"):
		return verifyArgon2(hash, password)
	default:
		// Unknown hash format: never accept, and never reveal that the
		// format is unsupported.
		return ErrInvalidCredentials
	}
}

// verifyBcrypt compares a bcrypt hash against the password.
func verifyBcrypt(hash, password string) error {
	// bcrypt.CompareHashAndPassword returns a meaningful error on mismatch;
	// map it to the uniform invalid_credentials sentinel. No hash material is
	// surfaced.
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return ErrInvalidCredentials
	}
	return nil
}

// verifyArgon2 parses an argon2id/argon2i PHC string and compares the derived
// key against the stored password. Parameters are taken from the stored hash
// (self-describing), so existing hashes verify without reconfiguration.
func verifyArgon2(hash, password string) error {
	params, salt, key, err := parseArgon2PHC(hash)
	if err != nil {
		return ErrInvalidCredentials
	}
	derived := argon2.IDKey([]byte(password), salt, params.time, params.memory, params.threads, uint32(len(key)))
	if subtle.ConstantTimeCompare(derived, key) != 1 {
		return ErrInvalidCredentials
	}
	return nil
}

// argon2Params holds the PHC-encoded parameters for argon2 verification.
type argon2Params struct {
	memory  uint32
	time    uint32
	threads uint8
}

// parseArgon2PHC parses a PHC string of the form
// $argon2id$v=19$m=65536,t=3,p=2$<salt>$<hash>.
func parseArgon2PHC(hash string) (argon2Params, []byte, []byte, error) {
	parts := strings.Split(hash, "$")
	if len(parts) != 6 {
		return argon2Params{}, nil, nil, ErrInvalidCredentials
	}
	// parts: [0]="", [1]=algo, [2]=v=, [3]=m,t,p, [4]=salt, [5]=hash
	var params argon2Params
	fields := strings.Split(parts[3], ",")
	for _, f := range fields {
		switch {
		case strings.HasPrefix(f, "m="):
			params.memory = parseUint32(f[2:])
		case strings.HasPrefix(f, "t="):
			params.time = parseUint32(f[2:])
		case strings.HasPrefix(f, "p="):
			params.threads = uint8(parseUint32(f[2:]))
		default:
			return argon2Params{}, nil, nil, ErrInvalidCredentials
		}
	}
	if params.memory == 0 || params.time == 0 || params.threads == 0 {
		return argon2Params{}, nil, nil, ErrInvalidCredentials
	}
	salt, err := decodeArgon2Field(parts[4])
	if err != nil {
		return argon2Params{}, nil, nil, ErrInvalidCredentials
	}
	key, err := decodeArgon2Field(parts[5])
	if err != nil {
		return argon2Params{}, nil, nil, ErrInvalidCredentials
	}
	return params, salt, key, nil
}

// parseUint32 parses a decimal unsigned integer, returning 0 on error.
func parseUint32(s string) uint32 {
	var n uint32
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + uint32(c-'0')
	}
	return n
}

// decodeArgon2Field base64-decodes a PHC field (raw standard encoding, no
// padding). It returns an error for malformed input so malformed hashes are
// uniformly rejected as invalid credentials.
func decodeArgon2Field(s string) ([]byte, error) {
	b, err := base64.RawStdEncoding.DecodeString(s)
	if err != nil {
		return nil, ErrInvalidCredentials
	}
	return b, nil
}
