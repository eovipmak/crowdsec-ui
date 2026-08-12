// Package assets embeds the production frontend bundle into the dashboard
// binary (architecture §9, task 11). The bundle is a static export produced
// by `next build` from the frontend/ directory and copied here by
// backend/build.sh before the Go build. Embedding a single source of truth
// means the binary alone serves the UI with no sidecar files on disk.
//
// The bundle is static and closed: only the files produced by `next build`
// are reachable, and the api package's asset handler serves them with SPA
// fallback. No filesystem path outside the embedded tree is ever addressable.
//
// When the bundle is absent (e.g. the binary was built without running
// build.sh), Forward points at an empty FS and the api layer's asset handler
// falls back to its "assets not bundled" placeholder.
package assets

import (
	"embed"
	"io/fs"
)

//go:embed bundle
var bundleFS embed.FS

// Forward is the embedded frontend bundle as an fs.FS, passed to
// api.NewAssetHandler. bundle foreground is the static export root; the
// embedded path prefix is stripped so the handler sees files at their serving
// path (index.html, _next/..., etc.).
var Forward fs.FS = subFS(bundleFS, "bundle")

// subFS returns the named subdirectory of f as an fs.FS, or an empty FS when
// the directory is absent (e.g. assets were not copied into the package).
func subFS(f fs.FS, dir string) fs.FS {
	sub, err := fs.Sub(f, dir)
	if err != nil {
		return emptyFS{}
	}
	return sub
}

// emptyFS is a minimal empty fs.FS so Forward is never nil.
type emptyFS struct{}

func (emptyFS) Open(name string) (fs.File, error) { return nil, fs.ErrNotExist }
