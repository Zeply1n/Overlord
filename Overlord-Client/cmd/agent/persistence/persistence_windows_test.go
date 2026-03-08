//go:build windows
// +build windows

package persistence

import "testing"

func TestFormatRunRegistryCommand_QuotesUnquotedPath(t *testing.T) {
	in := `C:\Users\Test User\AppData\Roaming\Overlord\agent.exe`
	got := formatRunRegistryCommand(in)
	want := `"C:\Users\Test User\AppData\Roaming\Overlord\agent.exe"`
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestFormatRunRegistryCommand_LeavesQuotedPath(t *testing.T) {
	in := `"C:\Users\Test User\AppData\Roaming\Overlord\agent.exe"`
	got := formatRunRegistryCommand(in)
	if got != in {
		t.Fatalf("expected %q, got %q", in, got)
	}
}
