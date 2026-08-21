import { useState } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import DataTable, { type Column } from '@/components/DataTable';
import FiltersBar from '@/components/FiltersBar';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import AlertInspectDialog from './AlertInspectDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Alert } from '@/hooks/useAlerts';

function toIsoZ(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export default function Alerts() {
  const [limit, setLimit] = useState(50);
  const [scenario, setScenario] = useState('');
  const [ip, setIp] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [scenarioContains, setScenarioContains] = useState('');
  const [offset, setOffset] = useState(0);
  const [inspecting, setInspecting] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useAlerts({
    limit,
    scenario: scenario || undefined,
    ip: ip || undefined,
    since: toIsoZ(since),
    until: toIsoZ(until),
    scenario_contains: scenarioContains || undefined,
    offset: offset || undefined,
  });

  const columns: Column<Alert>[] = [
    { key: 'id', header: 'ID', className: 'w-[72px] tabular' },
    { key: 'source_ip', header: 'Source IP', className: 'mono' },
    { key: 'scenario', header: 'Scenario' },
    { key: 'country', header: 'Country', className: 'mono text-xs' },
    { key: 'as_name', header: 'AS', className: 'hidden lg:table-cell max-w-[180px] truncate' },
    { key: 'created_at', header: 'Created', className: 'mono text-xs tabular whitespace-nowrap' },
    {
      key: 'decisions',
      header: 'Decision',
      render: (row) =>
        row.decisions?.[0]?.type ? (
          <Badge variant="signal">{row.decisions[0].type}</Badge>
        ) : (
          <span className="mono text-xs text-zinc-600">—</span>
        ),
    },
  ];

  if (isLoading) return <><CapabilityBadge op="alerts.list" /><div className="mt-3"><LoadingSkeleton rows={8} /></div></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Alerts</h1>
          <p className="mono mt-1 text-xs text-zinc-500">Signals ingested by the local API. Click a row to inspect.</p>
        </div>
        <CapabilityBadge op="alerts.list" />
      </div>

      <FiltersBar
        filters={[
          { key: 'scenario', label: 'Scenario', value: scenario, onChange: (v) => { setScenario(v); setOffset(0); }, placeholder: 'crowdsecurity/…' },
          { key: 'ip', label: 'Source IP', value: ip, onChange: (v) => { setIp(v); setOffset(0); }, placeholder: '1.2.3.4' },
          { key: 'scenario_contains', label: 'Scenario contains', value: scenarioContains, onChange: (v) => { setScenarioContains(v); setOffset(0); }, placeholder: 'ssh \u00b7 http \u00b7 bf', maxLength: 64 },
          { key: 'since', label: 'Since', value: since, onChange: (v) => { setSince(v); setOffset(0); }, type: 'datetime-local' },
          { key: 'until', label: 'Until', value: until, onChange: (v) => { setUntil(v); setOffset(0); }, type: 'datetime-local' },
        ]}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setOffset(0); }}
        onClear={() => { setScenario(''); setIp(''); setScenarioContains(''); setSince(''); setUntil(''); setOffset(0); }}
      />

      {!data || data.length === 0 ? (
        <EmptyState
          title="No alerts"
          description="No alerts match the current filters. Try broadening the scenario or IP filter, or lower the ingestion window."
          action="Tip: crowdsecurity/http-bf and ssh-bf are the most common scenarios."
        />
      ) : (
        <>
          <div className="mono flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {data.length} alert{data.length !== 1 ? 's' : ''} · newest first
          </div>
          <DataTable
            data={data}
            columns={columns}
            onRowClick={(row) => setInspecting(row.id)}
            rowKey={(row) => row.id}
          />
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
      <AlertInspectDialog id={inspecting} onClose={() => setInspecting(null)} />
    </div>
  );
}
