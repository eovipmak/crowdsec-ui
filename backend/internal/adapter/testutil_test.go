package adapter

import "os"

// writeFileImpl is a thin wrapper kept separate from the test file so the
// test file stays focused on behavior.
func writeFileImpl(path, content string) error {
	return os.WriteFile(path, []byte(content), 0o600)
}
