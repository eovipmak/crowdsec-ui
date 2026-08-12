// CrowdSec dashboard backend.
//
// This module is the Go implementation of the strict `cscli` execution
// adapter and (in later tasks) the net/http server. It intentionally has no
// third-party dependencies: all integration is through os/exec with fixed
// allowlisted argument vectors and the standard library.
module crowdsec-dashboard/backend

go 1.22