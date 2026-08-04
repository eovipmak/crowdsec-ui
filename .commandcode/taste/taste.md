# General Preferences

- Prefers lean, minimal project scope over enterprise-grade infrastructure. Repeatedly strips out Docker, Kubernetes, CI/CD, monitoring platforms (Grafana/Prometheus), complex identity systems (LDAP/OIDC/RBAC), and separate application databases when building internal tools. Confidence: 0.9
- Prefers English for documentation and planning artifacts. Asked for explicit translation when content was in Vietnamese. Confidence: 0.75
- Prefers practical, single-admin security over multi-user enterprise auth. Chose local password hash + session/token over LDAP, OIDC, RBAC, and user management. Confidence: 0.9
- Values fast iterative development workflow. Explicitly switched from React+Vite to Next.js because Vite static builds were too slow for real-time development. Confidence: 0.95
- Prefers native deployment (binary + systemd) over containerized deployment for internal/host-level tools. Confidence: 0.9
