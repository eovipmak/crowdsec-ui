import { useBouncers } from '@/hooks/useBouncers';
import DataTable, { type Column } from '@/components/DataTable';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import type { Bouncer } from '@/hooks/useBouncers';

export default function Bouncers() {
  const { data, isLoading, error, refetch } = useBouncers();

  const columns: Column<Bouncer>[] = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'version', header: 'Version' },
    { key: 'ip_address', header: 'IP Address' },
    { key: 'last_pull', header: 'Last Pull' },
  ];

  if (isLoading) return <><CapabilityBadge op="bouncers.list" /><LoadingSkeleton rows={8} /></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bouncers</h1>
      <CapabilityBadge op="bouncers.list" />
      {!data || data.length === 0 ? (
        <EmptyState title="No bouncers" description="No bouncers registered." />
      ) : (
        <DataTable data={data} columns={columns} rowKey={(row) => row.name} />
      )}
    </div>
  );
}