package api

import (
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
)

// This file implements the frontend asset serving boundary (architecture §9).
//
// The production frontend bundle is a static build produced by `next build`
// (task 11). Task 11 wires the `go:embed` bundle via NewAssetHandler with an
// embed.FS. Until then, NewRouterOpts serves a clear placeholder and the
// package is structured so task 11 supplies the real bundle.
//
// Delivery rules (§9):
//   - `/` and `/assets/*` serve the embedded bundle (content-hashed files with
//     cache headers).
//   - Any non-API GET path falls back to `index.html` (SPA client routing).
//   - `/api/*` is exclusively API routing (handled by the router) and is NEVER
//     shadowed or served as index.html; unknowns return 404 JSON.
//   - Never served: config files, profiles.yaml, executable paths, raw command
//     lines/output, or any file outside the bundle. Only embedded addresses are
//     reachable, so no directory traversal is possible.

// NewAssetHandler returns an http.Handler serving the provided embedded FS
// (the production bundle) with SPA fallback. Task 11 supplies the FS.
func NewAssetHandler(bundle fs.FS) http.Handler {
	return &assetServer{bundle: bundle}
}

type assetServer struct {
	bundle fs.FS
}

func (a *assetServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeRequestError(w, http.StatusMethodNotAllowed, "method_not_allowed", msgMethodNotAllowed, false)
		return
	}

	// Only embedded files are addressable; never the filesystem.
	clean := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if clean == "" {
		clean = "index.html"
	}

	// serveFile attempts to serve a single candidate path from the bundle. It
	// returns true on a hit so the caller can short-circuit. Index HTML is
	// always served with no-store because it references content-hashed assets
	// that change between builds; serving a stale index can pull old chunks.
	serveFile := func(name string) bool {
		data, err := fs.ReadFile(a.bundle, name)
		if err != nil {
			return false
		}
		ct := mime.TypeByExtension(path.Ext(name))
		if ct == "" {
			ct = "application/octet-stream"
		}
		w.Header().Set("Content-Type", ct)
		if name == "index.html" {
			w.Header().Set("Cache-Control", "no-store")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
		return true
	}

	// 1. Exact embedded file at the cleaned path (e.g. /_next/static/...
	//    chunks, /icon.svg). This is the common case for hashed asset URLs.
	if serveFile(clean) {
		return
	}

	// 2. Prerendered route HTML produced by `next build` with
	//    `output: "export"` (e.g. /login -> login.html, /overview ->
	//    overview.html). Trailing slash variants map to the same file.
	trimmed := strings.TrimSuffix(clean, "/")
	if trimmed != "" && trimmed != "index" && serveFile(trimmed+".html") {
		return
	}

	// 3. SPA fallback to index.html for client-side routing of unknown
	//    non-API GET paths (handled by Next.js Router on the client).
	if serveFile("index.html") {
		return
	}

	// No bundle wired (task 11 not yet complete).
	http.Error(w, "frontend assets not bundled (task 11)", http.StatusNotFound)
}
