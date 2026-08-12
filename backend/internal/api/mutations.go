package api

import (
	"encoding/json"
	"net/http"

	"crowdsec-dashboard/backend/internal/adapter"
)

// This file implements the mutation confirmation flow (architecture §4.7,
// §6.2). Every mutation body is:
//
//	{ "operation": "<op>", "request": {<typed>}, "confirmation": "<token>" }
//
// The operation must equal the route's bound operation (else 400), the typed
// request is validated (else 400), the confirmation token must be present
// (else 400 confirmation_required) and valid+bound (else 409
// invalid_confirmation).

// decodeAndVerifyMutation decodes and validates a mutation request, enforces
// the CSRF token for the state-changing request, verifies the confirmation
// token, and returns the typed request. On any failure it returns a
// request-level error to be written by writeMutationError.
//
// The ordering encodes the contract in architecture §4.4/§4.7: request-level
// body decoding and validation run first (400 invalid_parameters /
// confirmation_required), then the CSRF token check (403 csrf_failed), then
// confirmation-token verification (409 invalid_confirmation).
func (s *Server) decodeAndVerifyMutation(w http.ResponseWriter, r *http.Request, op adapter.OperationID) (any, bool, error) {
	var body mutationRequest
	if err := readJSONBody(w, r, &body); err != nil {
		return nil, false, &validationError{msg: msgInvalidParameters}
	}
	if body.Operation != string(op) {
		return nil, false, &validationError{msg: msgInvalidParameters}
	}
	req, err := s.decodeMutationRequest(op, body.Request)
	if err != nil {
		return nil, false, &validationError{msg: msgInvalidParameters}
	}
	if body.Confirmation == "" {
		return nil, false, &confirmationRequiredError{}
	}
	// CSRF runs after body validation but before confirmation verification.
	if !requireCSRF(w, r) {
		return nil, false, &csrfError{}
	}
	sess, ok := sessionFromContext(r.Context())
	if !ok {
		return nil, false, &validationError{msg: msgInvalidParameters}
	}
	if err := s.confirm.Verify(body.Confirmation, string(op), req, sess.ID); err != nil {
		return nil, false, err // 409 invalid_confirmation
	}
	return req, true, nil
}

// csrfError is the sentinel for a 403 csrf_failed response.
type csrfError struct{}

func (e *csrfError) Error() string { return "csrf_failed" }

// decodeMutationRequest decodes the nested typed request for a mutation
// operation with unknown-field rejection and full validation.
func (s *Server) decodeMutationRequest(op adapter.OperationID, raw json.RawMessage) (any, error) {
	switch op {
	case adapter.OpDecisionsAdd:
		var req adapter.DecisionsAddRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validateIPOrRange("ip_or_range", req.IPOrRange); err != nil {
			return nil, err
		}
		if err := validateDuration("duration", req.Duration); err != nil {
			return nil, err
		}
		if err := validateText("reason", req.Reason); err != nil {
			return nil, err
		}
		return req, nil
	case adapter.OpDecisionsDelete:
		var req adapter.DecisionsDeleteRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validateIPOrRange("ip_or_range", req.IPOrRange); err != nil {
			return nil, err
		}
		return req, nil
	case adapter.OpMachinesPrune:
		var req adapter.MachinesPruneRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validatePrune(req.Duration, req.NotValidatedOnly); err != nil {
			return nil, err
		}
		return req, nil
	case adapter.OpBouncersDelete:
		var req adapter.BouncersDeleteRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validateIdentifier("name", req.Name); err != nil {
			return nil, err
		}
		return req, nil
	case adapter.OpAllowlistsCreate:
		var req adapter.AllowlistsCreateRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validateIdentifier("name", req.Name); err != nil {
			return nil, err
		}
		if err := validateText("description", req.Description); err != nil {
			return nil, err
		}
		return req, nil
	case adapter.OpAllowlistsAdd:
		var req adapter.AllowlistsAddRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validateIdentifier("name", req.Name); err != nil {
			return nil, err
		}
		if err := validateIPOrRange("ip_or_range", req.IPOrRange); err != nil {
			return nil, err
		}
		if req.Expiration != nil {
			if err := validateDuration("expiration", *req.Expiration); err != nil {
				return nil, err
			}
		}
		if req.Comment != nil {
			if err := validateText("comment", *req.Comment); err != nil {
				return nil, err
			}
		}
		return req, nil
	case adapter.OpAllowlistsRemove:
		var req adapter.AllowlistsRemoveRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validateIdentifier("name", req.Name); err != nil {
			return nil, err
		}
		if err := validateIPOrRange("ip_or_range", req.IPOrRange); err != nil {
			return nil, err
		}
		return req, nil
	case adapter.OpAllowlistsDelete:
		var req adapter.AllowlistsDeleteRequest
		if err := decodeRequestField(&req, raw); err != nil {
			return nil, err
		}
		if err := validateIdentifier("name", req.Name); err != nil {
			return nil, err
		}
		return req, nil
	default:
		return nil, &validationError{msg: msgInvalidParameters}
	}
}

// confirmationRequiredError is the sentinel for a 400 confirmation_required.
type confirmationRequiredError struct{}

func (e *confirmationRequiredError) Error() string { return "confirmation_required" }

// writeMutationError maps a mutation-flow error to the exact request-level
// response (§4.7/§4.4). A csrfError is a no-op: requireCSRF already wrote the
// 403 csrf_failed response before returning the error.
func (s *Server) writeMutationError(w http.ResponseWriter, err error) {
	switch err.(type) {
	case *csrfError:
		// Response already written by requireCSRF.
		return
	case *confirmationRequiredError:
		writeRequestError(w, http.StatusBadRequest, "confirmation_required", msgConfirmationRequired, false)
	case *validationError:
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
	default:
		if isInvalidConfirmation(err) {
			writeRequestError(w, http.StatusConflict, "invalid_confirmation", msgInvalidConfirmation, false)
			return
		}
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
	}
}
