import { useState } from 'react';
import { useMachines } from '@/hooks/useMachines';
import DataTable, { type Column } from '@/components/DataTable';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import { Badge } from '@/components/ui/badge';
import type { Machine } from '@/hooks/useMachines';
import MachineInspectDialog from '@/pages/MachineInspectDialog';

export default function Machines() {
  const { data, isLoading, error, refetch } = useMachines();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const columns: Column<Machine>[] = [
    { key: 'machine_id', header: 'Machine ID', className: 'mono text-xs' },
    { key: 'ip_address', header: 'IP Address', className: 'mono tabular' },
    { key: 'validated', header: 'Validated', render: (row) => row.validated ? <Badge variant="success">validated</Badge> : <Badge variant="muted">pending</Badge> },
    { key: 'version', header: 'Version', className: 'mono text-xs' },
    { key: 'last_heartbeat', header: 'Last Heartbeat', className: 'mono text-xs tabular whitespace-nowrap' },
    { key: 'last_push', header: 'Last Push', className: 'mono text-xs tabular whitespace-nowrap' },
  ];

  if (isLoading) return <><CapabilityBadge op="machines.list" /><div className="mt-3"><LoadingSkeleton rows={8} /></div></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Machines</h1>
          <p className="mono mt-1 text-xs text-zinc-500">Agents registered to this LAPI. Heartbeat shows liveness.</p>
        </div>
        <CapabilityBadge op="machines.list" />
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          title="No machines"
          description="No agents have registered yet. Install crowdsec on a host and enroll it with cscli machines add."
          action="Validated machines can push alerts and pull decisions."
        />
      ) : (
        <>
          <div className="mono text-xs text-zinc-500">{data.length} machine{data.length !== 1 ? 's' : ''} registered</div>
          <DataTable data={data} columns={columns} rowKey={(row) => row.machine_id} onRowClick={(row) => setSelectedId(row.machine_id)} />
        </>
      )}
      <MachineInspectDialog machineId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
