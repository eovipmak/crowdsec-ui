import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FilterField {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface FiltersBarProps {
  filters: FilterField[];
  limit?: number;
  onLimitChange?: (limit: number) => void;
  onClear?: () => void;
  children?: ReactNode;
}

export default function FiltersBar({ filters, limit, onLimitChange, onClear, children }: FiltersBarProps) {
  const hasActive = filters.some((f) => f.value.trim() !== '');

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[#232334] bg-[#0f0f17] p-3">
      <div className="flex flex-wrap items-end gap-3">
        {filters.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`filter-${f.key}`} className="mono text-[11px] uppercase tracking-widest text-zinc-500">
              {f.label}
            </Label>
            <Input
              id={`filter-${f.key}`}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              aria-label={f.label}
              className="h-8 w-full min-w-0 sm:w-44 md:w-48"
            />
          </div>
        ))}
        {limit !== undefined && onLimitChange && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-limit" className="mono text-[11px] uppercase tracking-widest text-zinc-500">Limit</Label>
            <select
              id="filter-limit"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Result limit"
              className="h-8 min-h-[32px] rounded border border-[#232334] bg-[#09090f] px-2.5 text-xs text-zinc-300 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={!hasActive}
            aria-label="Clear all filters"
            className="mono min-h-[32px] text-xs"
          >
            Clear filters
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
