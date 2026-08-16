import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/decisions', label: 'Decisions' },
  { to: '/machines', label: 'Machines' },
  { to: '/bouncers', label: 'Bouncers' },
  { to: '/allowlists', label: 'Allowlists' },
];

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] tracking-wide text-zinc-500">
      <span
        className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-zinc-600')}
      />
      <span className="mono uppercase">{label}</span>
      <span className={cn('mono font-medium', ok ? 'text-emerald-400' : 'text-zinc-500')}>
        {ok ? 'live' : '—'}
      </span>
    </span>
  );
}

export default function Layout() {
  return (
    <div className="min-h-full bg-[#09090f] text-zinc-200">
      <div className="sticky top-0 z-30 border-b border-[#232334] bg-[#09090f]/80 backdrop-blur supports-[backdrop-filter]:bg-[#09090f]/60">
        <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-5 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-white text-[11px] font-bold tracking-tight text-black">
              CS
            </div>
            <span className="text-[13px] font-semibold tracking-tight text-white">CrowdSec</span>
            <span className="hidden rounded bg-[#1c1c26] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-400 md:inline-flex">
              Console
            </span>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'mono whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium tracking-wide transition-colors',
                    isActive
                      ? 'bg-[#1c1c26] text-white'
                      : 'text-zinc-500 hover:bg-[#12121a] hover:text-zinc-200',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-4 md:flex">
            <StatusDot ok label="lapi" />
            <span className="h-3 w-px bg-[#232334]" />
            <span className="mono text-[11px] uppercase tracking-wide text-zinc-600">cscli · direct</span>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1280px] px-5 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-[1280px] border-t border-[#181825] px-5 py-4 md:px-6">
        <p className="mono text-[11px] leading-5 text-zinc-600">
          CrowdSec console · single-admin · direct cscli execution. No Docker required.
        </p>
      </footer>
    </div>
  );
}
