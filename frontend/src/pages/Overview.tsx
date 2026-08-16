import { useAlerts } from '@/hooks/useAlerts';
import { useDecisions } from '@/hooks/useDecisions';
import { useMachines } from '@/hooks/useMachines';
import { useStatusLapi, useStatusCapi } from '@/hooks/useStatus';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import ErrorPanel from '@/components/ErrorPanel';
import LoadingSkeleton from '@/components/LoadingSkeleton';

function StatRow({
  label,
  value,
  hint,
  tone,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'signal' | 'danger' | 'ok';
  to?: string;
}) {
  const content = (
    <div className="flex items-baseline justify-between gap-3 rounded border border-[#232334] bg-[#0f0f17] px-3 py-2.5">
      <span className="mono text-[11px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={
            tone === 'danger'
              ? 'tabular text-lg font-semibold tracking-tight text-red-400'
              : tone === 'signal'
                ? 'tabular text-lg font-semibold tracking-tight text-amber-300'
                : tone === 'ok'
                  ? 'tabular text-lg font-semibold tracking-tight text-emerald-300'
                  : 'tabular text-lg font-semibold tracking-tight text-white'
          }
        >
          {value}
        </span>
        {hint ? <span className="mono text-xs text-zinc-600">{hint}</span> : null}
      </span>
    </div>
  );
  if (to) return <Link to={to} className="block hover:opacity-90">{content}</Link>;
  return content;
}

export default function Overview() {
  const alerts = useAlerts({ limit: 50 });
  const decisions = useDecisions({ limit: 50 });
  const machines = useMachines();
  const lapi = useStatusLapi();
  const capi = useStatusCapi();

  const loading = alerts.isLoading || decisions.isLoading || machines.isLoading;
  const error = alerts.error || decisions.error || machines.error;

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error)
    return (
      <ErrorPanel
        error={error}
        onRetry={() => {
          alerts.refetch();
          decisions.refetch();
          machines.refetch();
        }}
      />
    );

  const alertCount = alerts.data?.length ?? 0;
  const decisionCount = decisions.data?.length ?? 0;
  const machineCount = machines.data?.length ?? 0;
  const lapiOk = !!lapi.data;
  const capiOk = !!capi.data;

  const hasPressure = alertCount > 0 || decisionCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="mono mt-1 text-xs text-zinc-500">
            Live view of blocks, alerts and fleet health. Direct from cscli.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[11px] uppercase tracking-widest text-zinc-600">LAPI</span>
          <span className={lapiOk ? 'h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'h-2 w-2 rounded-full bg-zinc-700'} />
          <span className={lapiOk ? 'mono text-xs font-medium text-emerald-300' : 'mono text-xs text-zinc-500'}>
            {lapiOk ? 'Healthy' : 'Down'}
          </span>
          <span className="mx-2 h-4 w-px bg-[#232334]" />
          <span className="mono text-[11px] uppercase tracking-widest text-zinc-600">CAPI</span>
          <Badge variant={capiOk ? 'success' : 'muted'}>{capiOk ? 'Enabled' : 'Disabled'}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#232334] bg-[#0f0f17] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={hasPressure ? 'h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'h-2 w-2 rounded-full bg-zinc-600'} />
              <span className="mono text-xs font-medium uppercase tracking-widest text-zinc-300">
                {hasPressure ? 'Attention' : 'Clear'}
              </span>
            </div>
            <span className="mono text-[11px] text-zinc-600">
              {alertCount} alerts · {decisionCount} active blocks
            </span>
          </div>

          <div className="grid gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatRow label="Active alerts" value={alertCount} tone={alertCount > 0 ? 'signal' : undefined} to="/alerts" />
              <StatRow label="Active decisions" value={decisionCount} tone={decisionCount > 0 ? 'danger' : undefined} to="/decisions" />
            </div>

            <div className="rounded border border-[#232334] bg-[#09090f] p-3">
              <div className="mono mb-2 text-[11px] uppercase tracking-widest text-zinc-500">Recent signals</div>
              {!alerts.data || alerts.data.length === 0 ? (
                <p className="mono text-xs text-zinc-600">No recent alerts. The wire is quiet.</p>
              ) : (
                <div className="space-y-1.5">
                  {alerts.data.slice(0, 4).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 border-b border-[#181825] py-1.5 last:border-0">
                      <span className="truncate text-xs text-zinc-300">{a.scenario ?? '—'}</span>
                      <span className="mono shrink-0 text-xs tabular text-zinc-500">{a.source_ip ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/alerts" className="mono inline-flex h-7 items-center rounded border border-[#2a2a3a] bg-white px-3 text-xs font-semibold tracking-wide text-black hover:bg-zinc-200">
                View alerts
              </Link>
              <Link to="/decisions" className="mono inline-flex h-7 items-center rounded border border-[#2a2a3a] bg-transparent px-3 text-xs font-medium text-zinc-300 hover:bg-[#12121a] hover:text-white">
                View decisions
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <div className="border-b border-[#232334] bg-[#0f0f17] px-4 py-3">
              <div className="mono text-[11px] uppercase tracking-widest text-zinc-500">Fleet & enforcement</div>
            </div>
            <div className="grid gap-3 p-4">
              <StatRow label="Machines" value={machineCount} hint="registered" to="/machines" />
              <div className="grid grid-cols-2 gap-3">
                <Link to="/bouncers" className="rounded border border-[#232334] bg-[#0f0f17] px-3 py-3 hover:bg-[#12121a]">
                  <div className="mono text-[11px] uppercase tracking-widest text-zinc-500">Bouncers</div>
                  <div className="mt-1 mono text-xs text-zinc-400">Enforcement</div>
                  <div className="mt-1 text-xs font-medium text-zinc-200">View →</div>
                </Link>
                <Link to="/allowlists" className="rounded border border-[#232334] bg-[#0f0f17] px-3 py-3 hover:bg-[#12121a]">
                  <div className="mono text-[11px] uppercase tracking-widest text-zinc-500">Allowlists</div>
                  <div className="mt-1 mono text-xs text-zinc-400">Exceptions</div>
                  <div className="mt-1 text-xs font-medium text-zinc-200">Check IP →</div>
                </Link>
              </div>
              <p className="mono text-xs leading-5 text-zinc-600">
                LAPI is {lapiOk ? 'reachable' : 'unreachable'}. CAPI is {capiOk ? 'enabled' : 'disabled'}.
              </p>
            </div>
          </Card>

          <div className="rounded border border-[#232334] bg-[#0f0f17] px-4 py-3">
            <div className="mono text-[11px] uppercase tracking-widest text-zinc-500">Runbook</div>
            <ul className="mt-2 space-y-1 mono text-xs leading-5 text-zinc-500">
              <li>• Alerts are grouped by scenario and source IP.</li>
              <li>• Decisions are the active blocks pushed to bouncers.</li>
              <li>• Allowlists exempt IPs from blocking.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
