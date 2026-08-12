// Package api implements the net/http server for the dashboard API boundary
// (architecture §3, §5). It performs routing, middleware hooks, request
// decoding with unknown-field/unknown-parameter rejection, envelope writers,
// confirmation verification, and frontend asset delivery.
//
// It never constructs commands, never resolves executable paths, and never
// imports os/exec. All operations are dispatched to the adapter.Executor
// passed at construction. The api layer knows only operation identifiers and
// typed request/result structs.
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"crowdsec-dashboard/backend/internal/adapter"
	"crowdsec-dashboard/backend/internal/auth"
	"crowdsec-dashboard/backend/internal/config"
	"crowdsec-dashboard/backend/internal/logging"
)

// Server bundles the dependencies for the API layer.
type Server struct {
	cfg     *config.Config
	ex      adapter.Executor
	auth    Authenticator
	confirm *ConfirmationService
	logger  *logging.Logger
	assets  http.Handler
}

// Options configures the API server.
type Options struct {
	Config   *config.Config
	Executor adapter.Executor
	Auth     Authenticator
	Confirm  *ConfirmationService
	Logger   *logging.Logger
	// Assets is the frontend asset handler (§9). When nil, asset routes
	// return a clear "assets not bundled" placeholder (task 11 supplies the
	// production bundle).
	Assets http.Handler
}

// NewRouter builds the root http.Handler for the dashboard (architecture §3
// NewRouter signature). It wires the API routes plus the frontend asset
// boundary.
func NewRouter(cfg *config.Config, ex adapter.Executor, au Authenticator, confirm *ConfirmationService) http.Handler {
	return NewRouterOpts(Options{
		Config:   cfg,
		Executor: ex,
		Auth:     au,
		Confirm:  confirm,
	})
}

// NewRouterOpts builds the root handler with explicit options (used by tests
// and by the entry point to attach a logger and assets).
func NewRouterOpts(opts Options) http.Handler {
	if opts.Config == nil {
		opts.Config = &config.Config{}
	}
	if opts.Auth == nil {
		// No authenticator supplied: fall back to a real authenticator with
		// an unconfigured hash so every login fails as invalid credentials.
		// This is deliberately NOT a test-only stub; there is no default
		// discoverable password (architecture §8.3). The entry point always
		// supplies a configured hash.
		opts.Auth = auth.NewBcrypt("", opts.Config.Session.TTL)
	}
	if opts.Confirm == nil {
		opts.Confirm = NewConfirmationService()
	}
	if opts.Logger == nil {
		opts.Logger = logging.New(nil, logging.Info, "text", nil)
	}

	s := &Server{
		cfg:     opts.Config,
		ex:      opts.Executor,
		auth:    opts.Auth,
		confirm: opts.Confirm,
		logger:  opts.Logger,
		assets:  opts.Assets,
	}

	mux := http.NewServeMux()

	// Application routes (§5.2).
	mux.HandleFunc("GET /api/v1/health", s.handleHealth)
	mux.HandleFunc("POST /api/v1/session", s.handleLogin)
	mux.HandleFunc("GET /api/v1/session", s.requireSession(s.handleSessionStatus))
	mux.HandleFunc("DELETE /api/v1/session", s.requireSession(s.handleLogout))
	mux.HandleFunc("GET /api/v1/capabilities", s.requireSession(s.handleCapabilities))
	mux.HandleFunc("POST /api/v1/confirmations", s.requireSession(s.handleConfirmationIssue))

	// Matrix read + mutation routes (§5.1).
	mux.HandleFunc("GET /api/v1/alerts", s.requireSession(s.handleAlertsList))
	mux.HandleFunc("GET /api/v1/alerts/{id}", s.requireSession(s.handleAlertsInspect))

	mux.HandleFunc("GET /api/v1/decisions", s.requireSession(s.handleDecisionsList))
	mux.HandleFunc("POST /api/v1/decisions", s.requireSession(s.handleDecisionsAdd))
	mux.HandleFunc("DELETE /api/v1/decisions", s.requireSession(s.handleDecisionsDelete))

	mux.HandleFunc("GET /api/v1/machines", s.requireSession(s.handleMachinesList))
	mux.HandleFunc("POST /api/v1/machines/prune", s.requireSession(s.handleMachinesPrune))

	mux.HandleFunc("GET /api/v1/bouncers", s.requireSession(s.handleBouncersList))
	mux.HandleFunc("DELETE /api/v1/bouncers", s.requireSession(s.handleBouncersDelete))

	mux.HandleFunc("GET /api/v1/hub", s.requireSession(s.handleHubList))

	mux.HandleFunc("GET /api/v1/scenarios", s.requireSession(s.handleScenariosList))
	mux.HandleFunc("GET /api/v1/scenarios/{scenario}", s.requireSession(s.handleScenariosInspect))

	mux.HandleFunc("GET /api/v1/collections", s.requireSession(s.handleCollectionsList))

	mux.HandleFunc("GET /api/v1/profiles", s.requireSession(s.handleProfilesInspect))

	mux.HandleFunc("GET /api/v1/simulation", s.requireSession(s.handleSimulationStatus))

	mux.HandleFunc("GET /api/v1/allowlists", s.requireSession(s.handleAllowlistsList))
	mux.HandleFunc("POST /api/v1/allowlists", s.requireSession(s.handleAllowlistsCreate))
	mux.HandleFunc("DELETE /api/v1/allowlists", s.requireSession(s.handleAllowlistsDelete))
	mux.HandleFunc("GET /api/v1/allowlists/check", s.requireSession(s.handleAllowlistsCheck))
	mux.HandleFunc("POST /api/v1/allowlists/entries", s.requireSession(s.handleAllowlistsAdd))
	mux.HandleFunc("DELETE /api/v1/allowlists/entries", s.requireSession(s.handleAllowlistsRemove))

	mux.HandleFunc("GET /api/v1/metrics/{component}", s.requireSession(s.handleMetricsShow))

	mux.HandleFunc("GET /api/v1/status/lapi", s.requireSession(s.handleLapiStatus))
	mux.HandleFunc("GET /api/v1/status/capi", s.requireSession(s.handleCAPIStatus))

	// Frontend asset boundary (§9). /api/* unknowns -> 404 JSON (handled by
	// the catch-all below); all other GET paths -> SPA fallback.
	root := s.assetHandler()

	// /api/* catch-all: unknown API paths return 404 JSON, never index.html
	// (§9). More specific method+path patterns take precedence over this
	// catch-all, so method mismatches still yield 405 and known routes still
	// route normally.
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeRequestError(w, http.StatusNotFound, "not_found", msgNotFound, false)
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			// API routing only; never shadowed by assets.
			mux.ServeHTTP(w, r)
			return
		}
		root.ServeHTTP(w, r)
	})
}

// assetHandler returns the frontend asset handler for non-API paths, or a
// placeholder when assets are not yet wired (task 11 supplies the bundle).
func (s *Server) assetHandler() http.Handler {
	if s.assets != nil {
		return s.assets
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// Placeholder until task 11 wires the production bundle.
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("frontend assets not bundled (task 11)\n"))
	})
}

// runOperation executes a typed operation and writes either the success
// envelope or the operation-level failure envelope (HTTP 200).
func (s *Server) runOperation(w http.ResponseWriter, r *http.Request, op adapter.OperationID, command string, req any, result *any) {
	typed, opErr := s.ex.Run(r.Context(), op, req)
	if opErr != nil {
		if opErr.Class == adapter.ErrUnavailable || opErr.Class == adapter.ErrMalformedOutput {
			s.logger.Debug("adapter operation failed", "operation", op, "class", opErr.Class)
		} else {
			s.logger.Info("adapter operation failed", "operation", op, "class", opErr.Class)
		}
		writeMatrixError(w, string(op), adapterOpError{
			Class:     string(opErr.Class),
			Message:   opErr.Message,
			Retryable: opErr.Retryable,
		})
		return
	}
	if result != nil {
		*result = typed
	}
	writeMatrixSuccess(w, string(op), command, req, typed)
}

// handleHealth is a pure liveness endpoint; it never probes cscli (§5.2).
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": config.ServiceName,
		"version": config.AppVersion,
		"time":    timeNowUTC(),
	})
}

// handleLogin is the public login route (§4.6).
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := readJSONBody(w, r, &body); err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	sess, err := s.auth.Authenticate(r.Context(), body.Password)
	if err != nil {
		if code, ok := isAuthError(err); ok && code == "invalid_credentials" {
			writeRequestError(w, http.StatusUnauthorized, "invalid_credentials", msgInvalidCredentials, true)
			return
		}
		writeRequestError(w, http.StatusInternalServerError, "internal", msgInternal, false)
		return
	}
	s.setSessionCookie(w, r, sess)
	writeJSON(w, http.StatusOK, map[string]any{
		"session": map[string]any{
			"authenticated": true,
			"expires_at":    sess.ExpiresAt.UTC().Format(timeFormat),
			"csrf_token":    sess.CSRF,
		},
	})
}

// requireSession is the auth middleware hook (architecture §3). It reads the
// session cookie, resolves it via the Authenticator, and requires a valid
// session on protected routes. Task 06 replaces the stub authenticator; the
// middleware stays here.
//
// The CSRF check is deliberately NOT part of this middleware. Per
// architecture §4.4/§4.7, request-level body decoding and validation run
// BEFORE security-token checks, so malformed/unknown-field/operation-mismatch
// requests return 400 (invalid_parameters / confirmation_required), not a CSRF
// 403. State-changing handlers call requireCSRF themselves after decoding and
// validating the body, then verify the confirmation token (409).
func (s *Server) requireSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(s.cfg.Session.CookieName)
		if err != nil {
			writeRequestError(w, http.StatusUnauthorized, "unauthenticated", msgUnauthenticated, false)
			return
		}
		sess, err := s.auth.Validate(r.Context(), cookie.Value)
		if err != nil || !sess.Authenticated {
			writeRequestError(w, http.StatusUnauthorized, "unauthenticated", msgUnauthenticated, false)
			return
		}
		ctx := context.WithValue(r.Context(), sessionKey{}, sess)
		next(w, r.WithContext(ctx))
	}
}

// requireCSRF enforces the session-bound CSRF token on a state-changing
// request (architecture §4.2). It must run after the request body has been
// decoded and validated (so malformed requests get 400 first) and before any
// confirmation-token verification (which yields 409). On failure it writes an
// HTTP 403 csrf_failed response and returns false so the caller stops.
func requireCSRF(w http.ResponseWriter, r *http.Request) bool {
	sess, ok := sessionFromContext(r.Context())
	if !ok {
		writeRequestError(w, http.StatusUnauthorized, "unauthenticated", msgUnauthenticated, false)
		return false
	}
	if h := r.Header.Get("X-CSRF-Token"); h == "" || h != sess.CSRF {
		writeRequestError(w, http.StatusForbidden, "csrf_failed", msgCSRFFailed, false)
		return false
	}
	return true
}

// sessionFromContext extracts the authenticated session attached by the
// middleware.
func sessionFromContext(ctx context.Context) (Session, bool) {
	s, ok := ctx.Value(sessionKey{}).(Session)
	return s, ok
}

type sessionKey struct{}

// setSessionCookie writes the HttpOnly session cookie (§4.2).
func (s *Server) setSessionCookie(w http.ResponseWriter, r *http.Request, sess Session) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.Session.CookieName,
		Value:    sesssToken(r, sess),
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(sess.ExpiresAt.Sub(timeNow()).Seconds()),
	})
}

// sesssToken returns the opaque session token to store in the cookie. The
// real authenticator generates an unguessable token per session; the cookie
// never carries the session ID or CSRF value directly.
func sesssToken(r *http.Request, sess Session) string {
	if sess.Token == "" {
		return ""
	}
	return sess.Token
}

// clearSessionCookie removes the session cookie (logout).
func (s *Server) clearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.Session.CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}

// handleSessionStatus returns the current session (§4.6).
func (s *Server) handleSessionStatus(w http.ResponseWriter, r *http.Request) {
	sess, ok := sessionFromContext(r.Context())
	if !ok {
		writeRequestError(w, http.StatusUnauthorized, "unauthenticated", msgUnauthenticated, false)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"session": map[string]any{
			"authenticated": true,
			"expires_at":    sess.ExpiresAt.UTC().Format(timeFormat),
			"csrf_token":    sess.CSRF,
		},
	})
}

// handleLogout invalidates the session server-side (§4.6). Logout is a
// state-changing request, so it requires the CSRF token (§4.2).
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if !requireCSRF(w, r) {
		return
	}
	if cookie, err := r.Cookie(s.cfg.Session.CookieName); err == nil {
		_ = s.auth.Invalidate(r.Context(), cookie.Value)
	}
	s.clearSessionCookie(w, r)
	writeJSON(w, http.StatusOK, map[string]any{
		"session": map[string]any{"authenticated": false},
	})
}

// handleCapabilities returns the per-operation support map from the startup
// probe cache (§5.2). It executes no command at request time.
func (s *Server) handleCapabilities(w http.ResponseWriter, r *http.Request) {
	caps := s.ex.Capabilities()
	out := map[string]string{}
	for _, op := range adapter.AllOperationIDs() {
		out[string(op)] = string(caps[op])
	}
	writeJSON(w, http.StatusOK, map[string]any{"capabilities": out})
}

// handleConfirmationIssue issues a confirmation token for a mutation (§4.6).
func (s *Server) handleConfirmationIssue(w http.ResponseWriter, r *http.Request) {
	sess, ok := sessionFromContext(r.Context())
	if !ok {
		writeRequestError(w, http.StatusUnauthorized, "unauthenticated", msgUnauthenticated, false)
		return
	}
	var body struct {
		Operation string          `json:"operation"`
		Request   json.RawMessage `json:"request"`
	}
	if err := readJSONBody(w, r, &body); err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	op := adapter.OperationID(body.Operation)
	if !isMutation(op) {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	// Validate the typed request before issuing a token (§4.6).
	req, err := s.decodeMutationRequest(op, body.Request)
	if err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	// State-changing issuance requires the CSRF token (§4.2). This runs after
	// body validation so malformed requests return 400 first.
	if !requireCSRF(w, r) {
		return
	}
	token, expiresAt, err := s.confirm.Issue(body.Operation, req, sess.ID)
	if err != nil {
		writeRequestError(w, http.StatusInternalServerError, "internal", msgInternal, false)
		return
	}
	writeJSON(w, http.StatusOK, ConfirmationIssuanceResponse{
		Confirmation: confirmationBody{
			Operation:    body.Operation,
			Token:        token,
			ExpiresAt:    expiresAt.UTC().Format(timeFormat),
			Action:       mutationAction[body.Operation],
			CommandLabel: mutationCommand[body.Operation],
		},
	})
}

// isMutation reports whether op is a supported mutation (has a functional
// endpoint and requires confirmation).
func isMutation(op adapter.OperationID) bool {
	_, ok := mutationCommand[string(op)]
	return ok
}

// timeNow and timeNowUTC are injectable for tests.
var (
	timeNow    = func() time.Time { return time.Now() }
	timeNowUTC = func() string { return time.Now().UTC().Format(timeFormat) }
)

// timeFormat is the RFC3339 format used across the API.
const timeFormat = time.RFC3339
