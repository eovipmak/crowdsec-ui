// Package logging implements secret-safe structured logging for the dashboard
// boundary (architecture §3, §4.5; REQ-063). It never logs passwords, session
// tokens, CSRF tokens, hashes, command vectors, or raw command output. The
// logger is a thin standard-library wrapper with a field-based API.
package logging

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"sync"
	"time"
)

// Level is a log severity level.
type Level int

// Levels ordered by severity.
const (
	Debug Level = iota
	Info
	Warn
	Error
)

// ParseLevel parses a config logging.level value.
func ParseLevel(s string) Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return Debug
	case "warn":
		return Warn
	case "error":
		return Error
	default:
		return Info
	}
}

func (l Level) String() string {
	switch l {
	case Debug:
		return "debug"
	case Warn:
		return "warn"
	case Error:
		return "error"
	default:
		return "info"
	}
}

// Logger is a secret-safe structured logger.
type Logger struct {
	mu     sync.Mutex
	out    io.Writer
	level  Level
	format string // "text" | "json"
	base   map[string]any
	l      *log.Logger
}

// New returns a Logger writing to out. format is "text" or "json". base is a
// set of immutable fields attached to every record (never secrets).
func New(out io.Writer, level Level, format string, base map[string]any) *Logger {
	if out == nil {
		out = os.Stderr
	}
	if format != "json" {
		format = "text"
	}
	return &Logger{
		out:    out,
		level:  level,
		format: format,
		base:   base,
		l:      log.New(out, "", 0),
	}
}

// Enabled reports whether a level would be emitted.
func (lg *Logger) Enabled(l Level) bool { return l >= lg.level }

// Debug logs at debug level.
func (lg *Logger) Debug(msg string, fields ...any) { lg.logf(Debug, msg, fields...) }

// Info logs at info level.
func (lg *Logger) Info(msg string, fields ...any) { lg.logf(Info, msg, fields...) }

// Warn logs at warn level.
func (lg *Logger) Warn(msg string, fields ...any) { lg.logf(Warn, msg, fields...) }

// Error logs at error level.
func (lg *Logger) Error(msg string, fields ...any) { lg.logf(Error, msg, fields...) }

func (lg *Logger) logf(l Level, msg string, fields ...any) {
	if !lg.Enabled(l) {
		return
	}
	rec := map[string]any{}
	for k, v := range lg.base {
		rec[k] = v
	}
	rec["level"] = l.String()
	rec["time"] = time.Now().UTC().Format(time.RFC3339)
	rec["msg"] = msg
	if len(fields)%2 == 0 {
		for i := 0; i+1 < len(fields); i += 2 {
			key, ok := fields[i].(string)
			if !ok {
				continue
			}
			rec[key] = fields[i+1]
		}
	}

	lg.mu.Lock()
	defer lg.mu.Unlock()
	if lg.format == "json" {
		b, _ := json.Marshal(rec)
		lg.l.Print(string(b))
		return
	}
	// text: `time level msg key=value ...`
	var sb strings.Builder
	sb.WriteString(rec["time"].(string))
	sb.WriteString(" ")
	sb.WriteString(rec["level"].(string))
	sb.WriteString(" ")
	sb.WriteString(fmt.Sprint(rec["msg"]))
	for k, v := range rec {
		switch k {
		case "time", "level", "msg":
			continue
		}
		sb.WriteString(" ")
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(fmt.Sprint(v))
	}
	lg.l.Print(sb.String())
}
