package api

import (
	"net/http"
	"strconv"

	"crowdsec-dashboard/backend/internal/adapter"
)

// This file implements the matrix operation handlers (architecture §5.1).
// Every handler validates request parameters, dispatches a typed request to
// the adapter, and writes the §4.3 envelope. None construct commands or
// resolve executable paths.

// capability reports whether the adapter supports the operation (from the
// startup probe cache). Reads that are `limit`-mode only when the -l flag is
// supported use this to gate limit acceptance.
func (s *Server) capability(op adapter.OperationID) adapter.Support {
	return s.ex.Capabilities()[op]
}

// limitSupported reports whether alerts.list/decisions.list accept -l
// (§4.8): page mode is limit only when the probe confirms the -l flag.
func (s *Server) limitSupported(op adapter.OperationID) bool {
	return s.capability(op) == adapter.Supported
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

func (s *Server) handleAlertsList(w http.ResponseWriter, r *http.Request) {
	req, err := decodeAlertsList(r, s.limitSupported(adapter.OpAlertsList))
	if err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	s.runOperation(w, r, adapter.OpAlertsList, "cscli alerts list", req, nil)
}

func (s *Server) handleAlertsInspect(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	req := adapter.AlertsInspectRequest{ID: id}
	s.runOperation(w, r, adapter.OpAlertsInspect, "cscli alerts inspect", req, nil)
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

func (s *Server) handleDecisionsList(w http.ResponseWriter, r *http.Request) {
	req, err := decodeDecisionsList(r, s.limitSupported(adapter.OpDecisionsList))
	if err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	s.runOperation(w, r, adapter.OpDecisionsList, "cscli decisions list", req, nil)
}

// handleDecisionsAdd is a mutation requiring confirmation.
func (s *Server) handleDecisionsAdd(w http.ResponseWriter, r *http.Request) {
	req, confirmed, err := s.decodeAndVerifyMutation(w, r, adapter.OpDecisionsAdd)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	_ = confirmed
	s.runOperation(w, r, adapter.OpDecisionsAdd, "cscli decisions add", req, nil)
}

// handleDecisionsDelete is a mutation requiring confirmation.
func (s *Server) handleDecisionsDelete(w http.ResponseWriter, r *http.Request) {
	req, _, err := s.decodeAndVerifyMutation(w, r, adapter.OpDecisionsDelete)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	s.runOperation(w, r, adapter.OpDecisionsDelete, "cscli decisions delete", req, nil)
}

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

func (s *Server) handleMachinesList(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpMachinesList, "cscli machines list", adapter.MachinesListRequest{}, nil)
}

func (s *Server) handleMachinesPrune(w http.ResponseWriter, r *http.Request) {
	req, _, err := s.decodeAndVerifyMutation(w, r, adapter.OpMachinesPrune)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	if s.capability(adapter.OpMachinesPrune) != adapter.Supported {
		writeMatrixError(w, string(adapter.OpMachinesPrune), adapterOpError{
			Class:     string(adapter.ErrUnsupported),
			Message:   msgNotSupportedOperation,
			Retryable: false,
		})
		return
	}
	s.runOperation(w, r, adapter.OpMachinesPrune, "cscli machines prune", req, nil)
}

// ---------------------------------------------------------------------------
// Bouncers
// ---------------------------------------------------------------------------

func (s *Server) handleBouncersList(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpBouncersList, "cscli bouncers list", adapter.BouncersListRequest{}, nil)
}

func (s *Server) handleBouncersDelete(w http.ResponseWriter, r *http.Request) {
	req, _, err := s.decodeAndVerifyMutation(w, r, adapter.OpBouncersDelete)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	if s.capability(adapter.OpBouncersDelete) != adapter.Supported {
		writeMatrixError(w, string(adapter.OpBouncersDelete), adapterOpError{
			Class:     string(adapter.ErrUnsupported),
			Message:   msgNotSupportedOperation,
			Retryable: false,
		})
		return
	}
	s.runOperation(w, r, adapter.OpBouncersDelete, "cscli bouncers delete", req, nil)
}

// ---------------------------------------------------------------------------
// Hub / scenarios / collections / profiles / simulation
// ---------------------------------------------------------------------------

func (s *Server) handleHubList(w http.ResponseWriter, r *http.Request) {
	req, err := decodeHubList(r)
	if err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	s.runOperation(w, r, adapter.OpHubList, "cscli hub list", req, nil)
}

func (s *Server) handleScenariosList(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpScenariosList, "cscli scenarios list", adapter.ScenariosListRequest{}, nil)
}

func (s *Server) handleScenariosInspect(w http.ResponseWriter, r *http.Request) {
	scenario := r.PathValue("scenario")
	if err := validateIdentifier("scenario", scenario); err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	req := adapter.ScenariosInspectRequest{Scenario: scenario}
	s.runOperation(w, r, adapter.OpScenariosInspect, "cscli scenarios inspect", req, nil)
}

func (s *Server) handleCollectionsList(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpCollectionsList, "cscli collections list", adapter.CollectionsListRequest{}, nil)
}

func (s *Server) handleProfilesInspect(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpProfilesInspect, "cscli profiles", adapter.ProfilesInspectRequest{}, nil)
}

func (s *Server) handleSimulationStatus(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpSimulationStatus, "cscli simulation status", adapter.SimulationStatusRequest{}, nil)
}

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

func (s *Server) handleAllowlistsList(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpAllowlistsList, "cscli allowlists list", adapter.AllowlistsListRequest{}, nil)
}

func (s *Server) handleAllowlistsCheck(w http.ResponseWriter, r *http.Request) {
	req, err := decodeAllowlistsCheck(r)
	if err != nil {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	s.runOperation(w, r, adapter.OpAllowlistsCheck, "cscli allowlists check", req, nil)
}

func (s *Server) handleAllowlistsCreate(w http.ResponseWriter, r *http.Request) {
	req, _, err := s.decodeAndVerifyMutation(w, r, adapter.OpAllowlistsCreate)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	s.runOperation(w, r, adapter.OpAllowlistsCreate, "cscli allowlists create", req, nil)
}

func (s *Server) handleAllowlistsAdd(w http.ResponseWriter, r *http.Request) {
	req, _, err := s.decodeAndVerifyMutation(w, r, adapter.OpAllowlistsAdd)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	s.runOperation(w, r, adapter.OpAllowlistsAdd, "cscli allowlists add", req, nil)
}

func (s *Server) handleAllowlistsRemove(w http.ResponseWriter, r *http.Request) {
	req, _, err := s.decodeAndVerifyMutation(w, r, adapter.OpAllowlistsRemove)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	s.runOperation(w, r, adapter.OpAllowlistsRemove, "cscli allowlists remove", req, nil)
}

func (s *Server) handleAllowlistsDelete(w http.ResponseWriter, r *http.Request) {
	req, _, err := s.decodeAndVerifyMutation(w, r, adapter.OpAllowlistsDelete)
	if err != nil {
		s.writeMutationError(w, err)
		return
	}
	s.runOperation(w, r, adapter.OpAllowlistsDelete, "cscli allowlists delete", req, nil)
}

// ---------------------------------------------------------------------------
// Metrics / status
// ---------------------------------------------------------------------------

func (s *Server) handleMetricsShow(w http.ResponseWriter, r *http.Request) {
	comp := adapter.MetricComponent(r.PathValue("component"))
	if !adapter.ValidMetricComponent(comp) {
		writeRequestError(w, http.StatusBadRequest, "invalid_parameters", msgInvalidParameters, false)
		return
	}
	if s.capability(adapter.OpMetricsShow) != adapter.Supported {
		writeMatrixError(w, string(adapter.OpMetricsShow), adapterOpError{
			Class:     string(adapter.ErrUnsupported),
			Message:   msgNotSupportedOperation,
			Retryable: false,
		})
		return
	}
	req := adapter.MetricsShowRequest{Component: comp}
	s.runOperation(w, r, adapter.OpMetricsShow, "cscli metrics show", req, nil)
}

func (s *Server) handleLapiStatus(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpLapiStatus, "cscli lapi status", adapter.LapiStatusRequest{}, nil)
}

func (s *Server) handleCAPIStatus(w http.ResponseWriter, r *http.Request) {
	s.runOperation(w, r, adapter.OpCAPIStatus, "cscli capi status", adapter.CAPIStatusRequest{}, nil)
}
