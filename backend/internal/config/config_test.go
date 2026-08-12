package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const validYAML = `
server:
  bind: "127.0.0.1"
  port: 8090

cscli:
  executable_path: "/usr/bin/cscli"
  timeout: "45s"
  crowdsec_config_dir: "/etc/crowdsec"

auth:
  admin_password_hash: "$argon2id$v=19$m=65536,t=3,p=2$c2FsdHNhbHQ$hashdata"

session:
  ttl: "4h"
  cookie_name: "crowdsec_dashboard_session"

logging:
  level: "info"
  format: "text"
  output: "stderr"
`

func writeCfg(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	return path
}

func TestLoadValid(t *testing.T) {
	cfg, err := Load(writeCfg(t, validYAML))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Bind != "127.0.0.1" || cfg.Server.Port != 8090 {
		t.Fatalf("server: %+v", cfg.Server)
	}
	if cfg.Cscli.ExecutablePath != "/usr/bin/cscli" {
		t.Fatalf("exec: %s", cfg.Cscli.ExecutablePath)
	}
	if cfg.Cscli.Timeout != 45*time.Second {
		t.Fatalf("timeout: %s", cfg.Cscli.Timeout)
	}
	if cfg.Cscli.CrowdsecConfigDir != "/etc/crowdsec" {
		t.Fatalf("config dir: %s", cfg.Cscli.CrowdsecConfigDir)
	}
	if !cfg.HashSet() {
		t.Fatal("expected hash to be set")
	}
	if cfg.Session.TTL != 4*time.Hour {
		t.Fatalf("ttl: %s", cfg.Session.TTL)
	}
	if cfg.Session.CookieName != "crowdsec_dashboard_session" {
		t.Fatalf("cookie: %s", cfg.Session.CookieName)
	}
	if cfg.ProfilesPath() != "/etc/crowdsec/profiles.yaml" {
		t.Fatalf("profiles path: %s", cfg.ProfilesPath())
	}
}

func TestLoadDefaults(t *testing.T) {
	minimal := `
auth:
  admin_password_hash: "$argon2id$hashdata"
`
	cfg, err := Load(writeCfg(t, minimal))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Bind != DefaultBind || cfg.Server.Port != DefaultPort {
		t.Fatalf("server defaults: %+v", cfg.Server)
	}
	if cfg.Cscli.ExecutablePath != DefaultExecPath || cfg.Cscli.Timeout != DefaultTimeout {
		t.Fatalf("cscli defaults: %q %s", cfg.Cscli.ExecutablePath, cfg.Cscli.Timeout)
	}
	if cfg.Session.TTL != DefaultSessionTTL || cfg.Session.CookieName != DefaultCookieName {
		t.Fatalf("session defaults: %s %s", cfg.Session.TTL, cfg.Session.CookieName)
	}
	if cfg.Logging.Level != "info" || cfg.Logging.Format != "text" || cfg.Logging.Output != "stderr" {
		t.Fatalf("logging defaults: %+v", cfg.Logging)
	}
}

func TestLoadMissingHashFails(t *testing.T) {
	_, err := Load(writeCfg(t, "server:\n  bind: 127.0.0.1\n"))
	if err == nil {
		t.Fatal("expected error for missing admin_password_hash")
	}
	if !strings.Contains(err.Error(), "admin_password_hash") {
		t.Fatalf("error should mention the hash: %v", err)
	}
}

func TestLoadPlaceholderHashFails(t *testing.T) {
	_, err := Load(writeCfg(t, "auth:\n  admin_password_hash: \"<set-by-crowdsec-dashboard-setup-admin>\"\n"))
	if err == nil {
		t.Fatal("expected error for placeholder hash")
	}
}

func TestLoadRejectsWildcardBind(t *testing.T) {
	cfg := "auth:\n  admin_password_hash: hash\nserver:\n  bind: 0.0.0.0\n"
	_, err := Load(writeCfg(t, cfg))
	if err == nil {
		t.Fatal("expected error for 0.0.0.0 bind")
	}
	if !strings.Contains(err.Error(), "0.0.0.0") {
		t.Fatalf("message should mention bind: %v", err)
	}
}

func TestLoadRejectsLAPIPort(t *testing.T) {
	cfg := "auth:\n  admin_password_hash: hash\nserver:\n  port: 8080\n"
	_, err := Load(writeCfg(t, cfg))
	if err == nil {
		t.Fatal("expected error for port 8080")
	}
}

func TestLoadRejectsBadTimeout(t *testing.T) {
	cfg := "auth:\n  admin_password_hash: hash\ncscli:\n  timeout: 500s\n"
	if _, err := Load(writeCfg(t, cfg)); err == nil {
		t.Fatal("expected error for out-of-range timeout")
	}
}

func TestLoadRejectsUnknownSection(t *testing.T) {
	cfg := "auth:\n  admin_password_hash: hash\nbogus:\n  x: 1\n"
	_, err := Load(writeCfg(t, cfg))
	if err == nil {
		t.Fatal("expected error for unknown section")
	}
	if !strings.Contains(err.Error(), "unknown top-level section") {
		t.Fatalf("message: %v", err)
	}
}

func TestLoadRejectsUnknownKey(t *testing.T) {
	cfg := "auth:\n  admin_password_hash: hash\n  token: secret\n"
	_, err := Load(writeCfg(t, cfg))
	if err == nil {
		t.Fatal("expected error for unknown key")
	}
	if !strings.Contains(err.Error(), "unknown key") {
		t.Fatalf("message: %v", err)
	}
}

func TestLoadMissingFile(t *testing.T) {
	_, err := Load(filepath.Join(t.TempDir(), "nope.yaml"))
	if err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestLoadRejectsRelativeExecPath(t *testing.T) {
	cfg := "auth:\n  admin_password_hash: hash\ncscli:\n  executable_path: cscli\n"
	_, err := Load(writeCfg(t, cfg))
	if err == nil {
		t.Fatal("expected error for relative executable_path")
	}
}

func TestRedactedHidesHash(t *testing.T) {
	cfg, err := Load(writeCfg(t, validYAML))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	red := cfg.Redacted()
	s := sPrint(red)
	if strings.Contains(s, cfg.Auth.AdminPasswordHash) {
		t.Fatal("redacted config leaked the password hash")
	}
	if !strings.Contains(s, "<redacted>") {
		t.Fatal("redacted config should mark the hash as redacted")
	}
}

func TestExecutableAbs(t *testing.T) {
	cfg := &Config{Cscli: Cscli{ExecutablePath: "/usr/bin/cscli"}}
	if got := cfg.ExecutableAbs(); got != "/usr/bin/cscli" {
		t.Fatalf("abs: %s", got)
	}
}

func sPrint(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
