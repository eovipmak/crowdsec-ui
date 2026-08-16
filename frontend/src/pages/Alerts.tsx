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
import type { Alert } from '@/hooks/useAlerts';

export default function Alerts() {
  const [limit, setLimit] = useState(50);
  const [scenario, setScenario] = useState('');
  const [ip, setIp] = useState('');
  const [inspecting, setInspecting] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useAlerts({
    limit,
    scenario: scenario || undefined,
    ip: ip || undefined,
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
          { key: 'scenario', label: 'Scenario', value: scenario, onChange: setScenario, placeholder: 'crowdsecurity/…' },
          { key: 'ip', label: 'Source IP', value: ip, onChange: setIp, placeholder: '1.2.3.4' },
        ]}
        limit={limit}
        onLimitChange={setLimit}
        onClear={() => { setScenario(''); setIp(''); }}
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
      <AlertInspectDialog id={inspecting} onClose={() => setInspecting(null)} />
    </div>
  );
}
