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

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
          <span className="mr-4 font-semibold">CrowdSec</span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
