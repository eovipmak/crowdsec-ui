import { useState } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import DataTable, { type Column } from '@/components/DataTable';
import FiltersBar from '@/components/FiltersBar';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import AlertInspectDialog from './AlertInspectDialog';
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
    { key: 'id', header: 'ID', className: 'w-16' },
    { key: 'source_ip', header: 'Source IP' },
    { key: 'scenario', header: 'Scenario' },
    { key: 'country', header: 'Country' },
    { key: 'as_name', header: 'AS Name' },
    { key: 'created_at', header: 'Created' },
    {
      key: 'decisions',
      header: 'Decision',
      render: (row) => row.decisions?.[0]?.type ?? '—',
    },
  ];

  if (isLoading) return <><CapabilityBadge op="alerts.list" /><LoadingSkeleton rows={8} /></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <CapabilityBadge op="alerts.list" />
      <FiltersBar
        filters={[
          { key: 'scenario', label: 'Scenario', value: scenario, onChange: setScenario, placeholder: 'Filter by scenario...' },
          { key: 'ip', label: 'IP', value: ip, onChange: setIp, placeholder: 'Filter by IP...' },
        ]}
        limit={limit}
        onLimitChange={setLimit}
        onClear={() => { setScenario(''); setIp(''); }}
      />
      {!data || data.length === 0 ? (
        <EmptyState title="No alerts" description="No alerts match the current filters." />
      ) : (
        <DataTable
          data={data}
          columns={columns}
          onRowClick={(row) => setInspecting(row.id)}
          rowKey={(row) => row.id}
        />
      )}
      <AlertInspectDialog id={inspecting} onClose={() => setInspecting(null)} />
    </div>
  );
}