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

	// Serve the file if it exists in the bundle.
	if data, err := fs.ReadFile(a.bundle, clean); err == nil {
		ct := mime.TypeByExtension(path.Ext(clean))
		if ct == "" {
			ct = "application/octet-stream"
		}
		w.Header().Set("Content-Type", ct)
		// Content-hashed production assets may be cached; index.html must not.
		if clean == "index.html" {
			w.Header().Set("Cache-Control", "no-store")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
		return
	}

	// SPA fallback to index.html for non-API GET paths (client routing).
	if data, err := fs.ReadFile(a.bundle, "index.html"); err == nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
		return
	}

	// No bundle (task 11 not wired yet).
	http.Error(w, "frontend assets not bundled (task 11)", http.StatusNotFound)
}
