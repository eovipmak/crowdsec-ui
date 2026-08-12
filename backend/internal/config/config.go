// Package config parses and validates the dashboard configuration file
// (architecture §8). The local YAML file is the only persistence; it is read
// once at startup and never consulted per request. The package touches no
// HTTP, sessions, or requests, and never imports os/exec.
//
// The only secret is auth.admin_password_hash. Config exposes a Redacted()
// form for logging so secrets never cross a boundary (architecture §3 "Secrets
// never cross a boundary"). An invalid file must produce a clear startup
// error so the server exits without listening.
package config

import (
	"fmt"
	"net"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Defaults (architecture §8.1).
const (
	DefaultBind         = "127.0.0.1"
	DefaultPort         = 8090
	DefaultExecPath     = "/usr/bin/cscli"
	DefaultTimeout      = 30 * time.Second
	DefaultConfigDir    = "/etc/crowdsec"
	DefaultSessionTTL   = 8 * time.Hour
	DefaultCookieName   = "crowdsec_dashboard_session"
	DefaultLogLevel     = "info"
	DefaultLogFormat    = "text"
	DefaultLogOutput    = "stderr"
	DefaultProfilesFile = "profiles.yaml"
)

// Version is the matrix target version reported in source.version.
const Version = "1.7.8"

// ServiceName is the fixed service identifier in health/logging.
const ServiceName = "crowdsec-dashboard"

// AppVersion is the dashboard's own version reported by health.
const AppVersion = "0.1.0"

// Duration bounds (architecture §8.1).
var (
	minTimeout    = time.Second
	maxTimeout    = 120 * time.Second
	minSessionTTL = 15 * time.Minute
	maxSessionTTL = 24 * time.Hour
)

// cookieNameRe validates session.cookie_name (§8.1).
var cookieNameRe = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// Server settings (§8.1).
type Server struct {
	// Bind is the listen address; never 0.0.0.0 by default (REQ-061).
	Bind string `yaml:"bind"`
	// Port is the listen port; must not collide with LAPI's 8080 on the same host.
	Port int `yaml:"port"`
}

// Cscli settings (§8.1).
type Cscli struct {
	// ExecutablePath is the resolved cscli path. Absolute; if unset it is
	// resolved from the controlled service environment at startup.
	ExecutablePath string `yaml:"executable_path"`
	// Timeout is the per-command execution timeout.
	Timeout time.Duration `yaml:"-"`
	// TimeoutRaw is the YAML raw duration string; parsed into Timeout.
	TimeoutRaw string `yaml:"timeout"`
	// CrowdsecConfigDir is a server-side directory used only by the read-only
	// profiles.inspect boundary (<dir>/profiles.yaml). Never browser-controlled.
	CrowdsecConfigDir string `yaml:"crowdsec_config_dir"`
}

// Auth settings (§8.1). The only secret in the file.
type Auth struct {
	// AdminPasswordHash is the argon2id/bcrypt hash of the administrator
	// password (algorithm chosen by task 06). Never plaintext; no default.
	AdminPasswordHash string `yaml:"admin_password_hash"`
}

// Session settings (§8.1).
type Session struct {
	// TTL is the fixed session expiry (no sliding renewal in MVP).
	TTL time.Duration `yaml:"-"`
	// TTLRaw is the YAML raw duration string; parsed into TTL.
	TTLRaw string `yaml:"ttl"`
	// CookieName is the HttpOnly session cookie name.
	CookieName string `yaml:"cookie_name"`
}

// Logging settings (§8.1).
type Logging struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
	Output string `yaml:"output"`
}

// Config is the validated, typed view of the configuration file.
type Config struct {
	Server  Server  `yaml:"server"`
	Cscli   Cscli   `yaml:"cscli"`
	Auth    Auth    `yaml:"auth"`
	Session Session `yaml:"session"`
	Logging Logging `yaml:"logging"`
}

// newConfig returns a Config pre-filled with defaults.
func newConfig() *Config {
	return &Config{
		Server:  Server{Bind: DefaultBind, Port: DefaultPort},
		Cscli:   Cscli{ExecutablePath: DefaultExecPath, Timeout: DefaultTimeout, CrowdsecConfigDir: DefaultConfigDir},
		Session: Session{TTL: DefaultSessionTTL, CookieName: DefaultCookieName},
		Logging: Logging{Level: DefaultLogLevel, Format: DefaultLogFormat, Output: DefaultLogOutput},
	}
}

// Load reads and validates the configuration file at path. It returns a
// clear startup error for an invalid file so the server refuses to start and
// exits (architecture §8.3).
func Load(path string) (*Config, error) {
	cfg := newConfig()
	if err := parseYAMLFile(path, cfg); err != nil {
		return nil, err
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// HashSet reports whether the administrator password hash has been configured
// (i.e. is not the placeholder). Task 06 performs the real verification; this
// is the config-level gate used at startup to refuse an unconfigured secret.
func (c *Config) HashSet() bool {
	h := strings.TrimSpace(c.Auth.AdminPasswordHash)
	return h != "" && !strings.HasPrefix(h, "<")
}

// ExecutableAbs returns the resolved absolute cscli path. The config value is
// expected absolute; if it is relative it is made absolute against CWD (the
// deployment task 11 resolves the controlled service environment).
func (c *Config) ExecutableAbs() string {
	if c.Cscli.ExecutablePath == "" {
		return ""
	}
	if filepath.IsAbs(c.Cscli.ExecutablePath) {
		return c.Cscli.ExecutablePath
	}
	abs, err := filepath.Abs(c.Cscli.ExecutablePath)
	if err != nil {
		return c.Cscli.ExecutablePath
	}
	return abs
}

// ProfilesPath returns the server-side profiles.yaml path used only by the
// read-only profiles.inspect boundary (§8.3). It is never a request input.
func (c *Config) ProfilesPath() string {
	if c.Cscli.CrowdsecConfigDir == "" {
		return ""
	}
	return filepath.Join(c.Cscli.CrowdsecConfigDir, DefaultProfilesFile)
}

// validate applies the §8.1 field rules and returns a clear startup error.
func (c *Config) validate() error {
	if c.Server.Bind == "" {
		c.Server.Bind = DefaultBind
	}
	if strings.TrimSpace(c.Server.Bind) == "0.0.0.0" {
		return fmt.Errorf("config: server.bind must not be 0.0.0.0 (REQ-061); bind to a specific address such as 127.0.0.1")
	}
	if net.ParseIP(c.Server.Bind) == nil && !validHostname(c.Server.Bind) {
		return fmt.Errorf("config: server.bind %q is not a valid IP address or hostname", c.Server.Bind)
	}
	if c.Server.Port == 0 {
		c.Server.Port = DefaultPort
	}
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("config: server.port must be between 1 and 65535, got %d", c.Server.Port)
	}
	if c.Server.Port == 8080 {
		return fmt.Errorf("config: server.port 8080 collides with the CrowdSec LAPI default port on the same host; choose another port")
	}

	if strings.TrimSpace(c.Cscli.ExecutablePath) == "" {
		c.Cscli.ExecutablePath = DefaultExecPath
	}
	if !filepath.IsAbs(c.Cscli.ExecutablePath) {
		return fmt.Errorf("config: cscli.executable_path must be an absolute path, got %q", c.Cscli.ExecutablePath)
	}

	if c.Cscli.TimeoutRaw == "" {
		c.Cscli.Timeout = DefaultTimeout
	} else {
		d, err := parseServiceDuration(c.Cscli.TimeoutRaw)
		if err != nil {
			return fmt.Errorf("config: cscli.timeout: %w", err)
		}
		if d < minTimeout || d > maxTimeout {
			return fmt.Errorf("config: cscli.timeout must be between 1s and 120s, got %s", c.Cscli.TimeoutRaw)
		}
		c.Cscli.Timeout = d
	}
	if c.Cscli.CrowdsecConfigDir == "" {
		c.Cscli.CrowdsecConfigDir = DefaultConfigDir
	}
	if !filepath.IsAbs(c.Cscli.CrowdsecConfigDir) {
		return fmt.Errorf("config: cscli.crowdsec_config_dir must be an absolute path, got %q", c.Cscli.CrowdsecConfigDir)
	}

	// The password hash is required. The placeholder `<>` is never accepted
	// as a real secret.
	if !c.HashSet() {
		return fmt.Errorf("config: auth.admin_password_hash is not set; run the documented administrator setup procedure to set the administrator password (no default password is ever created)")
	}

	if c.Session.TTLRaw == "" {
		c.Session.TTL = DefaultSessionTTL
	} else {
		d, err := parseServiceDuration(c.Session.TTLRaw)
		if err != nil {
			return fmt.Errorf("config: session.ttl: %w", err)
		}
		if d < minSessionTTL || d > maxSessionTTL {
			return fmt.Errorf("config: session.ttl must be between 15m and 24h, got %s", c.Session.TTLRaw)
		}
		c.Session.TTL = d
	}
	if c.Session.CookieName == "" {
		c.Session.CookieName = DefaultCookieName
	}
	if !cookieNameRe.MatchString(c.Session.CookieName) {
		return fmt.Errorf("config: session.cookie_name must match ^[A-Za-z0-9_-]{1,64}$")
	}

	if c.Logging.Level == "" {
		c.Logging.Level = DefaultLogLevel
	}
	switch c.Logging.Level {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("config: logging.level must be one of debug|info|warn|error, got %q", c.Logging.Level)
	}
	if c.Logging.Format == "" {
		c.Logging.Format = DefaultLogFormat
	}
	switch c.Logging.Format {
	case "text", "json":
	default:
		return fmt.Errorf("config: logging.format must be one of text|json, got %q", c.Logging.Format)
	}
	if c.Logging.Output == "" {
		c.Logging.Output = DefaultLogOutput
	}
	if c.Logging.Output != "stderr" && !filepath.IsAbs(c.Logging.Output) {
		return fmt.Errorf("config: logging.output must be stderr or an absolute path, got %q", c.Logging.Output)
	}

	return nil
}

// validHostname reports whether s is a plausible hostname (letters, digits,
// hyphens, dots). It is intentionally lenient; DNS resolution is the
// operator's responsibility.
func validHostname(s string) bool {
	if len(s) == 0 || len(s) > 253 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r == '-', r == '.':
		default:
			return false
		}
	}
	return true
}
