package api

import (
	"context"
	"sync"

	"crowdsec-dashboard/backend/internal/adapter"
)

// fakeAdapter is a test Executor implementing the adapter.Executor interface.
// It records operations run and returns scripted results or errors so tests
// exercise the API boundary without a real cscli.
type fakeAdapter struct {
	mu       sync.Mutex
	caps     map[adapter.OperationID]adapter.Support
	scripted map[adapter.OperationID]scriptedOp
	ran      []adapter.OperationID
}

type scriptedOp struct {
	result  any
	opErr   *adapter.OpError
	version string
}

// newFakeAdapter returns a fake adapter with every supported operation
// marked supported and no scripted results (returns empty success).
func newFakeAdapter() *fakeAdapter {
	f := &fakeAdapter{
		caps:     map[adapter.OperationID]adapter.Support{},
		scripted: map[adapter.OperationID]scriptedOp{},
	}
	for _, op := range adapter.AllOperationIDs() {
		if op.IsUnsupported() {
			f.caps[op] = adapter.Unsupported
		} else {
			f.caps[op] = adapter.Supported
		}
	}
	return f
}

// script sets the result/error for an operation.
func (f *fakeAdapter) script(op adapter.OperationID, result any, opErr *adapter.OpError) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.scripted[op] = scriptedOp{result: result, opErr: opErr}
}

// setCapability overrides an operation's support.
func (f *fakeAdapter) setCapability(op adapter.OperationID, s adapter.Support) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.caps[op] = s
}

// calls returns the operations run, in order.
func (f *fakeAdapter) calls() []adapter.OperationID {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]adapter.OperationID, len(f.ran))
	copy(out, f.ran)
	return out
}

func (f *fakeAdapter) Capabilities() map[adapter.OperationID]adapter.Support {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := map[adapter.OperationID]adapter.Support{}
	for k, v := range f.caps {
		out[k] = v
	}
	return out
}

func (f *fakeAdapter) Run(_ context.Context, op adapter.OperationID, _ adapter.TypedRequest) (adapter.TypedResult, *adapter.OpError) {
	f.mu.Lock()
	f.ran = append(f.ran, op)
	s, ok := f.scripted[op]
	f.mu.Unlock()
	if ok {
		return s.result, s.opErr
	}
	// Default: an empty collection result for reads, a success mutation.
	switch op {
	case adapter.OpAlertsList:
		return adapter.AlertsListResult{Items: []adapter.AlertItem{}, Page: adapter.PageInfo{Mode: "limit", Limit: 50, Offset: 0, HasMore: false}}, nil
	case adapter.OpDecisionsList:
		return adapter.DecisionsListResult{Items: []adapter.DecisionItem{}, Page: adapter.PageInfo{Mode: "limit", Limit: 100, Offset: 0, HasMore: false}}, nil
	default:
		if op.IsUnsupported() {
			return nil, &adapter.OpError{Class: adapter.ErrUnsupported, Message: "unsupported", Retryable: false}
		}
		return adapter.CollectionResult{Items: []any{}, Page: adapter.PageInfo{Mode: "none"}}, nil
	}
}
