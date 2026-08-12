package config

// Redacted returns a logging-safe view of the config. The only secret is
// auth.admin_password_hash, which is never logged (architecture §3 "Secrets
// never cross a boundary"; REQ-063). Command vectors are never logged here
// either — the config only carries the resolved executable path, which is an
// operator setting, not a command vector.
func (c *Config) Redacted() map[string]any {
	return map[string]any{
		"server": map[string]any{
			"bind": c.Server.Bind,
			"port": c.Server.Port,
		},
		"cscli": map[string]any{
			"timeout":             c.Cscli.Timeout.String(),
			"crowdsec_config_dir": c.Cscli.CrowdsecConfigDir,
			// executable_path is an operator setting, not a secret; it is a
			// path, not a command vector. It is safe to log.
			"executable_path": c.Cscli.ExecutablePath,
			// The profiles path is derived from crowdsec_config_dir; it is
			// never a request input and is safe to log as a startup fact.
			"profiles_path": c.ProfilesPath(),
		},
		"auth": map[string]any{
			// The hash is ALWAYS redacted.
			"admin_password_hash": "<redacted>",
		},
		"session": map[string]any{
			"ttl":         c.Session.TTL.String(),
			"cookie_name": c.Session.CookieName,
		},
		"logging": map[string]any{
			"level":  c.Logging.Level,
			"format": c.Logging.Format,
			"output": c.Logging.Output,
		},
	}
}
