import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional actions rendered on the right (refresh buttons, etc.). */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface RefreshButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function RefreshButton({ onClick, disabled, label = "Refresh" }: RefreshButtonProps) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={disabled}>
      <span aria-hidden="true">↻</span>
      {label}
    </Button>
  );
}
