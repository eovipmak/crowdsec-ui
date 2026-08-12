package adapter

import (
	"bufio"
	"os"
	"strings"
)

// ProfilesReader is the read-only profiles-file boundary (matrix §4
// profiles.inspect, architecture §8.3). It reads `<crowdsec_config_dir>/`
// profiles.yaml only; it is NOT a cscli operation and never edits anything.
// The path is server-side configuration and is never browser-controlled.
type ProfilesReader struct {
	path string
}

// NewProfilesReader returns a reader for the given profiles.yaml path. An
// empty path yields a reader that reports unavailable.
func NewProfilesReader(path string) *ProfilesReader {
	return &ProfilesReader{path: path}
}

// Read parses profile summaries from profiles.yaml. It returns a stable typed
// list of ProfileItem. Malformed YAML or an unreadable file returns an error
// (reported as crowdsec_failure by the caller). The file is never edited.
//
// The parser handles the common profiles.yaml structure:
//
//	profiles:
//	  - name: default
//	    filters:
//	      - 'Alert.Remediation == true && Alert.GetScope() == "Ip"'
//	    decisions:
//	      - type: ban
//	        duration: 4h
//
// It is intentionally a narrow, read-only summary reader, not a full YAML
// implementation.
func (r *ProfilesReader) Read() ([]ProfileItem, error) {
	if r.path == "" {
		return nil, os.ErrNotExist
	}
	f, err := os.Open(r.path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var profiles []ProfileItem
	var current *ProfileItem
	section := "" // "", "filters", "decisions"
	pendingDecision := ""

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// A profile list item starts a new profile.
		if strings.HasPrefix(trimmed, "- name:") {
			if current != nil {
				profiles = append(profiles, *current)
			}
			name := strings.TrimSpace(strings.TrimPrefix(trimmed, "- name:"))
			current = &ProfileItem{Name: strings.Trim(name, `"'`)}
			section = ""
			continue
		}

		// Section headers within a profile.
		if strings.HasPrefix(trimmed, "filters:") && current != nil {
			section = "filters"
			continue
		}
		if strings.HasPrefix(trimmed, "decisions:") && current != nil {
			section = "decisions"
			continue
		}

		if current == nil {
			// Top-level keys (e.g. "profiles:") are not profile content.
			continue
		}

		// List items within a section.
		if strings.HasPrefix(trimmed, "- ") {
			val := strings.TrimSpace(strings.TrimPrefix(trimmed, "- "))
			switch section {
			case "filters":
				current.Filters = append(current.Filters, strings.Trim(val, `"'`))
			case "decisions":
				// A decision may be a scalar expression or a map with
				// type/duration. We summarize the type.
				if strings.HasPrefix(val, "type:") {
					decisionType := strings.TrimSpace(strings.TrimPrefix(val, "type:"))
					decisionType = strings.Trim(decisionType, `"'`)
					pendingDecision = decisionType
					current.Decisions = append(current.Decisions, decisionType)
				}
			}
			continue
		}

		// key: value lines. Capture duration continuation for a decision.
		if idx := strings.Index(trimmed, ":"); idx > 0 {
			key := strings.TrimSpace(trimmed[:idx])
			val := strings.TrimSpace(strings.Trim(trimmed[idx+1:], `"'`))
			if key == "duration" && pendingDecision != "" {
				// Summarize as "type for duration".
				current.Decisions[len(current.Decisions)-1] =
					pendingDecision + " for " + val
			}
		}
	}
	if current != nil {
		profiles = append(profiles, *current)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if profiles == nil {
		profiles = []ProfileItem{}
	}
	return profiles, nil
}
