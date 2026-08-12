package api

import (
	"encoding/json"
	"net/http"
)

// This file implements the fixed response envelopes (architecture §4.3, §4.6)
// and the request-level error writer. It never logs secrets, tokens, raw
// stderr, or command lines.

// SourceInfo is the fixed source block in a matrix envelope.
type SourceInfo struct {
	System  string `json:"system"`
	Command string `json:"command"`
	Version string `json:"version"`
}

// matrixEnvelope is the success envelope (§4.3): operation, request (the
// validated/normalized request), result, source.
type matrixEnvelope struct {
	Operation string     `json:"operation"`
	Request   any        `json:"request"`
	Result    any        `json:"result"`
	Source    SourceInfo `json:"source"`
}

// matrixErrorEnvelope is the operation-level failure envelope (§4.3): an
// adapter failure carried with HTTP 200.
type matrixErrorEnvelope struct {
	Operation string    `json:"operation"`
	Error     errorBody `json:"error"`
}

// errorBody is the request-level or operation-level error body.
type errorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

// fixedSource returns the fixed source block for a matrix operation. The
// command label is a fixed operation label from the matrix, never the
// executed argument vector.
func fixedSource(command string) SourceInfo {
	return SourceInfo{System: "crowdsec", Command: command, Version: "1.7.8"}
}

// writeJSON writes v as a JSON response with the given status and content
// type. Protected data responses are served with Cache-Control: no-store
// (§4.1); setting it on every JSON response is safe and conservative.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeMatrixSuccess writes a §4.3 success envelope with HTTP 200.
func writeMatrixSuccess(w http.ResponseWriter, operation, command string, request, result any) {
	writeJSON(w, http.StatusOK, matrixEnvelope{
		Operation: operation,
		Request:   request,
		Result:    result,
		Source:    fixedSource(command),
	})
}

// writeMatrixError writes a §4.3 operation-level failure envelope with
// HTTP 200 (the request was valid and reached the adapter).
func writeMatrixError(w http.ResponseWriter, operation string, opErr adapterOpError) {
	writeJSON(w, http.StatusOK, matrixErrorEnvelope{
		Operation: operation,
		Error: errorBody{
			Code:      string(opErr.Class),
			Message:   opErr.Message,
			Retryable: opErr.Retryable,
		},
	})
}

// writeRequestError writes a request-level error envelope with the given HTTP
// status and code (§4.4). The message is always a safe fixed phrase.
func writeRequestError(w http.ResponseWriter, status int, code, message string, retryable bool) {
	writeJSON(w, status, map[string]any{
		"error": errorBody{Code: code, Message: message, Retryable: retryable},
	})
}

// Safe request-level messages (architecture §4.4/§4.5). These are fixed
// phrases; they never contain secrets, tokens, or raw input.
const (
	msgInvalidParameters     = "The request parameters are invalid."
	msgConfirmationRequired  = "This action requires confirmation."
	msgUnauthenticated       = "Authentication is required."
	msgInvalidCredentials    = "Invalid username or password."
	msgCSRFFailed            = "The security token for this action is invalid."
	msgNotFound              = "The requested resource was not found."
	msgMethodNotAllowed      = "This request method is not allowed."
	msgInvalidConfirmation   = "The confirmation does not match this request."
	msgInternal              = "An unexpected server error occurred."
	msgUnavailable           = "The server is not ready."
	msgNotSupportedOperation = "This CrowdSec installation does not support the requested operation."
)

// adapterOpError is the api-local view of an adapter OpError. It is filled
// from the executor result so the api layer never imports the adapter's
// error type directly in the envelope writer hot path while still mapping
// the stable classes.
type adapterOpError struct {
	Class     string
	Message   string
	Retryable bool
}
