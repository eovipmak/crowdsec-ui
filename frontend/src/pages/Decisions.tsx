import { useState } from 'react';
import { useDecisions } from '@/hooks/useDecisions';
import { useSimulation } from '@/hooks/useSimulation';
import DataTable, { type Column } from '@/components/DataTable';
import FiltersBar from '@/components/FiltersBar';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Decision } from '@/hooks/useDecisions';

function toIsoZ(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function typeVariant(v: string) {
  if (v === 'ban') return 'destructive' as const;
  if (v === 'captcha') return 'signal' as const;
  return 'outline' as const;
}

export default function Decisions() {
  const [limit, setLimit] = useState(50);
  const [type, setType] = useState('');
  const [ip, setIp] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [scenarioContains, setScenarioContains] = useState('');
  const [offset, setOffset] = useState(0);

  const simulation = useSimulation();
  const simActive = !!simulation.data && (simulation.data.global || simulation.data.scenarios.length > 0);
  const simScenarios = simulation.data?.scenarios ?? [];
  const simGlobal = !!simulation.data?.global;

  const { data, isLoading, error, refetch } = useDecisions({
    limit,
    type: type || undefined,
    ip: ip || undefined,
    since: toIsoZ(since),
    until: toIsoZ(until),
    scenario_contains: scenarioContains || undefined,
    offset: offset || undefined,
  });

  const columns: Column<Decision>[] = [
    { key: 'id', header: 'ID', className: 'w-[72px] tabular' },
    { key: 'scenario', header: 'Scenario' },
    { key: 'source_ip', header: 'Source IP', className: 'mono' },
    { key: 'country', header: 'Country', className: 'mono text-xs' },
    { key: 'type', header: 'Type', render: (row) => <Badge variant={typeVariant(row.type)}>{row.type}</Badge> },
    { key: 'value', header: 'Value', className: 'mono' },
    { key: 'scope', header: 'Scope', className: 'mono text-xs' },
    { key: 'duration', header: 'Duration', className: 'mono tabular text-xs whitespace-nowrap' },
    { key: 'origin', header: 'Origin', className: 'mono text-xs' },
    { key: 'created_at', header: 'Created', className: 'mono text-xs tabular whitespace-nowrap' },
  ];

  if (isLoading) return <><CapabilityBadge op="decisions.list" /><div className="mt-3"><LoadingSkeleton rows={8} /></div></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Decisions</h1>
          <p className="mono mt-1 text-xs text-zinc-500">Active blocks enforced by bouncers. Filter by type or source IP.</p>
        </div>
        <CapabilityBadge op="decisions.list" />
      </div>

      {simActive && (
        <div role="status" aria-live="polite" className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <span className="mono text-xs uppercase tracking-widest text-amber-300">Simulation active</span>
          <span className="ml-2 text-sm text-amber-200">Decisions are suppressed{simGlobal ? ' (global)' : ` — ${simScenarios.length} scenario(s) in simulation`}.</span>
          <span className="mono ml-2 break-words text-xs text-amber-200/70">{simScenarios.slice(0,6).join(', ')}</span>
        </div>
      )}

      <FiltersBar
        filters={[
          { key: 'type', label: 'Type', value: type, onChange: (v) => { setType(v); setOffset(0); }, placeholder: 'ban \u00b7 captcha' },
          { key: 'ip', label: 'IP', value: ip, onChange: (v) => { setIp(v); setOffset(0); }, placeholder: '1.2.3.4' },
          { key: 'scenario_contains', label: 'Scenario contains', value: scenarioContains, onChange: (v) => { setScenarioContains(v); setOffset(0); }, placeholder: 'ssh \u00b7 http \u00b7 bf', maxLength: 64 },
          { key: 'since', label: 'Since', value: since, onChange: (v) => { setSince(v); setOffset(0); }, type: 'datetime-local' },
          { key: 'until', label: 'Until', value: until, onChange: (v) => { setUntil(v); setOffset(0); }, type: 'datetime-local' },
        ]}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setOffset(0); }}
        onClear={() => { setType(''); setIp(''); setScenarioContains(''); setSince(''); setUntil(''); setOffset(0); }}
      />

      {!data || data.length === 0 ? (
        <EmptyState
          title="No active decisions"
          description="Nothing is currently blocked. When CrowdSec triggers a scenario, the decision appears here and is pushed to bouncers."
          action="Decisions expire automatically when their duration elapses."
        />
      ) : (
        <>
          <div className="mono flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {data.length} active · bouncers enforce within seconds
          </div>
          <DataTable data={data} columns={columns} rowKey={(row) => row.id} />
        </>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-xs text-zinc-500">
          {!data || data.length === 0 ? 'No results' : `Showing ${offset + 1}\u2013${offset + (data?.length ?? 0)}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            aria-label="Previous page"
            className="mono min-h-[32px] text-xs"
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || data.length < limit}
            onClick={() => setOffset((o) => o + limit)}
            aria-label="Next page"
            className="mono min-h-[32px] text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
