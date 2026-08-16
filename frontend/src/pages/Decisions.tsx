import { useState } from 'react';
import { useDecisions } from '@/hooks/useDecisions';
import DataTable, { type Column } from '@/components/DataTable';
import FiltersBar from '@/components/FiltersBar';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import { Badge } from '@/components/ui/badge';
import type { Decision } from '@/hooks/useDecisions';

export default function Decisions() {
  const [limit, setLimit] = useState(50);
  const [type, setType] = useState('');
  const [ip, setIp] = useState('');

  const { data, isLoading, error, refetch } = useDecisions({
    limit,
    type: type || undefined,
    ip: ip || undefined,
  });

  const columns: Column<Decision>[] = [
    { key: 'id', header: 'ID', className: 'w-16' },
    { key: 'scenario', header: 'Scenario' },
    { key: 'source_ip', header: 'Source IP' },
    { key: 'country', header: 'Country' },
    { key: 'type', header: 'Type', render: (row) => <Badge variant="outline">{row.type}</Badge> },
    { key: 'value', header: 'Value' },
    { key: 'scope', header: 'Scope' },
    { key: 'duration', header: 'Duration' },
    { key: 'origin', header: 'Origin' },
    { key: 'created_at', header: 'Created' },
  ];

  if (isLoading) return <><CapabilityBadge op="decisions.list" /><LoadingSkeleton rows={8} /></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Decisions</h1>
      <CapabilityBadge op="decisions.list" />
      <FiltersBar
        filters={[
          { key: 'type', label: 'Type', value: type, onChange: setType, placeholder: 'Filter by type...' },
          { key: 'ip', label: 'IP', value: ip, onChange: setIp, placeholder: 'Filter by IP...' },
        ]}
        limit={limit}
        onLimitChange={setLimit}
        onClear={() => { setType(''); setIp(''); }}
      />
      {!data || data.length === 0 ? (
        <EmptyState title="No decisions" description="No active decisions found." />
      ) : (
        <DataTable data={data} columns={columns} rowKey={(row) => row.id} />
      )}
    </div>
  );
}