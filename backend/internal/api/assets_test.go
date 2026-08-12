package api

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

// fakeBundle is a minimal embedded frontend bundle for asset tests.
func fakeBundle() fs.FS {
	return fstest.MapFS{
		"index.html":    {Data: []byte("<html>dashboard</html>")},
		"assets/app.js": {Data: []byte("window.app={}")},
	}
}

func TestAssetHandlerServesIndex(t *testing.T) {
	h := NewAssetHandler(fakeBundle())
	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status: %d", rr.Code)
	}
	if rr.Body.String() != "<html>dashboard</html>" {
		t.Fatalf("body: %s", rr.Body.String())
	}
}

func TestAssetHandlerSPAFallback(t *testing.T) {
	h := NewAssetHandler(fakeBundle())
	req := httptest.NewRequest("GET", "/decisions", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status for SPA route: %d", rr.Code)
	}
	if rr.Body.String() != "<html>dashboard</html>" {
		t.Fatalf("SPA fallback should serve index.html: %s", rr.Body.String())
	}
	if rr.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("index.html should be no-store")
	}
}

func TestAssetHandlerServesAssetWithCacheHeader(t *testing.T) {
	h := NewAssetHandler(fakeBundle())
	req := httptest.NewRequest("GET", "/assets/app.js", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status: %d", rr.Code)
	}
	if rr.Body.String() != "window.app={}" {
		t.Fatalf("asset body: %s", rr.Body.String())
	}
	if rr.Header().Get("Cache-Control") == "" {
		t.Fatal("content-hashed asset should have a cache header")
	}
}

func TestAssetsNeverServeConfig(t *testing.T) {
	// The bundle only contains index.html and assets; a request for a config
	// path must not resolve to any file.
	h := NewAssetHandler(fakeBundle())
	req := httptest.NewRequest("GET", "/etc/crowdsec/profiles.yaml", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	// It falls back to SPA index.html (non-API path), never to a config file.
	if rr.Code != http.StatusOK {
		t.Fatalf("status: %d", rr.Code)
	}
	if rr.Body.String() != "<html>dashboard</html>" {
		t.Fatalf("must fall back to index.html, got: %s", rr.Body.String())
	}
}
