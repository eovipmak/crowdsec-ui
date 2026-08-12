package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// This file implements a narrow, strict YAML-subset parser for the fixed
// configuration schema (architecture §8). The project intentionally has no
// third-party dependencies (go.mod is stdlib-only), so config parsing is
// implemented here for the exact flat/structure schema the dashboard uses:
//
//	server: { bind, port }
//	cscli:  { executable_path, timeout, crowdsec_config_dir }
//	auth:   { admin_password_hash }
//	session:{ ttl, cookie_name }
//	logging:{ level, format, output }
//
// It rejects unknown top-level sections and unknown keys so a typo is a clear
// startup error rather than a silently ignored setting. It does NOT support
// arbitrary YAML (anchors, multi-document, block scalars, etc.) — out of scope
// for the fixed operator file.

// parseYAMLFile reads path into cfg, applying defaults for absent keys and
// validating the fixed schema. Unknown keys/sections are errors.
func parseYAMLFile(path string, cfg *Config) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("config: cannot read %s: %w", path, err)
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)

	// section -> key -> optional value (empty when the value is nested map-only).
	type section struct {
		seen   map[string]bool
		values map[string]string
	}
	sections := map[string]*section{}
	order := []string{}
	current := ""
	lineNo := 0

	// allowed keys per section; empty means the section has no scalar keys.
	allowed := map[string]map[string]bool{
		"server":  {"bind": true, "port": true},
		"cscli":   {"executable_path": true, "timeout": true, "crowdsec_config_dir": true},
		"auth":    {"admin_password_hash": true},
		"session": {"ttl": true, "cookie_name": true},
		"logging": {"level": true, "format": true, "output": true},
	}

	for sc.Scan() {
		lineNo++
		line := sc.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		indent := len(line) - len(strings.TrimLeft(line, " "))

		if indent == 0 {
			// Top-level section: `server:` or `server: {}`.
			idx := strings.Index(line, ":")
			if idx < 0 {
				return fmt.Errorf("config: line %d: expected a top-level section such as 'server:'", lineNo)
			}
			name := strings.TrimSpace(line[:idx])
			if _, ok := allowed[name]; !ok {
				return fmt.Errorf("config: line %d: unknown top-level section %q", lineNo, name)
			}
			if _, exists := sections[name]; exists {
				return fmt.Errorf("config: line %d: duplicate section %q", lineNo, name)
			}
			sections[name] = &section{seen: map[string]bool{}, values: map[string]string{}}
			order = append(order, name)
			current = name
			rest := strings.TrimSpace(line[idx+1:])
			if rest != "" && rest != "{" && rest != "}" {
				return fmt.Errorf("config: line %d: section %q must not have an inline value", lineNo, name)
			}
			continue
		}

		if indent != 2 {
			return fmt.Errorf("config: line %d: unsupported indentation (expected 2 spaces under a section)", lineNo)
		}
		if current == "" {
			return fmt.Errorf("config: line %d: key appears before any section", lineNo)
		}
		idx := strings.Index(line, ":")
		if idx < 0 {
			return fmt.Errorf("config: line %d: expected 'key: value'", lineNo)
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		if !allowed[current][key] {
			return fmt.Errorf("config: line %d: unknown key %q in section %q", lineNo, key, current)
		}
		if sections[current].seen[key] {
			return fmt.Errorf("config: line %d: duplicate key %q in section %q", lineNo, key, current)
		}
		sections[current].seen[key] = true
		sections[current].values[key] = val
	}
	if err := sc.Err(); err != nil {
		return fmt.Errorf("config: reading %s: %w", path, err)
	}

	if len(order) == 0 {
		return fmt.Errorf("config: %s is empty; expected the dashboard configuration sections", path)
	}

	// Apply parsed values into cfg.
	for _, name := range order {
		s := sections[name]
		switch name {
		case "server":
			if v, ok := s.values["bind"]; ok {
				cfg.Server.Bind = unquote(v)
			}
			if v, ok := s.values["port"]; ok {
				n, err := strconv.Atoi(unquote(v))
				if err != nil {
					return fmt.Errorf("config: server.port must be an integer, got %q", v)
				}
				cfg.Server.Port = n
			}
		case "cscli":
			if v, ok := s.values["executable_path"]; ok {
				cfg.Cscli.ExecutablePath = unquote(v)
			}
			if v, ok := s.values["timeout"]; ok {
				cfg.Cscli.TimeoutRaw = unquote(v)
			}
			if v, ok := s.values["crowdsec_config_dir"]; ok {
				cfg.Cscli.CrowdsecConfigDir = unquote(v)
			}
		case "auth":
			if v, ok := s.values["admin_password_hash"]; ok {
				cfg.Auth.AdminPasswordHash = unquote(v)
			}
		case "session":
			if v, ok := s.values["ttl"]; ok {
				cfg.Session.TTLRaw = unquote(v)
			}
			if v, ok := s.values["cookie_name"]; ok {
				cfg.Session.CookieName = unquote(v)
			}
		case "logging":
			if v, ok := s.values["level"]; ok {
				cfg.Logging.Level = unquote(v)
			}
			if v, ok := s.values["format"]; ok {
				cfg.Logging.Format = unquote(v)
			}
			if v, ok := s.values["output"]; ok {
				cfg.Logging.Output = unquote(v)
			}
		}
	}

	return nil
}

// unquote strips surrounding single or double quotes from a YAML scalar.
func unquote(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

// parseServiceDuration parses a config duration string using Go's duration
// format (e.g. "30s", "8h", "15m"). This is the operator-facing format in
// §8.1 (distinct from the adapter's `^[0-9]+(s|m|h|d)$` request grammar).
func parseServiceDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(unquote(s))
	if s == "" {
		return 0, fmt.Errorf("empty duration")
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid duration %q (expected e.g. 30s, 15m, 8h)", s)
	}
	return d, nil
}
