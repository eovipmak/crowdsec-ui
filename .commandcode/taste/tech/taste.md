# Technology Preferences

- Prefers Next.js + TypeScript for frontend development over plain React + Vite. Values Next.js's hot reload and faster iteration for real-time development. Confidence: 0.95
- Prefers Tailwind CSS for styling. Used consistently across dashboard UI decisions. Confidence: 0.85
- Prefers no application database for simple internal tools — uses local config files with restricted permissions instead. Confidence: 0.85
- Prefers CLI integration boundaries (like `cscli`) with strict allowlist adapters over direct database access for tool integrations. Uses `os/exec` with parameter validation and structured output parsing. Confidence: 0.9
- Prefers single-binary or single-process native Linux deployment with systemd over Docker, Kubernetes, or Podman. Confidence: 0.9
