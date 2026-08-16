import { useMachines } from '@/hooks/useMachines';
import DataTable, { type Column } from '@/components/DataTable';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import { Badge } from '@/components/ui/badge';
import type { Machine } from '@/hooks/useMachines';

export default function Machines() {
  const { data, isLoading, error, refetch } = useMachines();

  const columns: Column<Machine>[] = [
    { key: 'machine_id', header: 'Machine ID' },
    { key: 'ip_address', header: 'IP Address' },
    { key: 'validated', header: 'Validated', render: (row) => row.validated ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge> },
    { key: 'version', header: 'Version' },
    { key: 'last_heartbeat', header: 'Last Heartbeat' },
    { key: 'last_push', header: 'Last Push' },
  ];

  if (isLoading) return <><CapabilityBadge op="machines.list" /><LoadingSkeleton rows={8} /></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Machines</h1>
      <CapabilityBadge op="machines.list" />
      {!data || data.length === 0 ? (
        <EmptyState title="No machines" description="No registered machines found." />
      ) : (
        <DataTable data={data} columns={columns} rowKey={(row) => row.machine_id} />
      )}
    </div>
  );
}