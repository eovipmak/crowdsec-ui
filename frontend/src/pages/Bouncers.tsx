import { useState } from 'react';
import { useBouncers } from '@/hooks/useBouncers';
import DataTable, { type Column } from '@/components/DataTable';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';
import type { Bouncer } from '@/hooks/useBouncers';
import BouncerInspectDialog from '@/pages/BouncerInspectDialog';

export default function Bouncers() {
  const { data, isLoading, error, refetch } = useBouncers();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const columns: Column<Bouncer>[] = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type', className: 'mono text-xs' },
    { key: 'version', header: 'Version', className: 'mono text-xs' },
    { key: 'ip_address', header: 'IP Address', className: 'mono tabular' },
    { key: 'last_pull', header: 'Last Pull', className: 'mono text-xs tabular whitespace-nowrap' },
  ];

  if (isLoading) return <><CapabilityBadge op="bouncers.list" /><div className="mt-3"><LoadingSkeleton rows={8} /></div></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Bouncers</h1>
          <p className="mono mt-1 text-xs text-zinc-500">Enforcement points that pull decisions from LAPI — firewall, nginx, traefik.</p>
        </div>
        <CapabilityBadge op="bouncers.list" />
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          title="No bouncers"
          description="No bouncers are registered. Add one with cscli bouncers add and configure it on the target."
          action="Bouncers poll LAPI for decisions; check last_pull to confirm they are live."
        />
      ) : (
        <>
          <div className="mono text-xs text-zinc-500">{data.length} bouncer{data.length !== 1 ? 's' : ''} · sorted by last pull</div>
          <DataTable data={data} columns={columns} rowKey={(row) => row.name} onRowClick={(row) => setSelectedName(row.name)} />
        </>
      )}
      <BouncerInspectDialog name={selectedName} onClose={() => setSelectedName(null)} />
    </div>
  );
}
