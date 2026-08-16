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
  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      {filters.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <Label htmlFor={`filter-${f.key}`}>{f.label}</Label>
          <Input
            id={`filter-${f.key}`}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={f.placeholder}
            className="w-48"
          />
        </div>
      ))}
      {limit !== undefined && onLimitChange && (
        <div className="flex flex-col gap-1.5">
          <Label>Limit</Label>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}
      {onClear && (
        <Button variant="outline" size="sm" onClick={onClear} className="mb-0.5">
          Clear
        </Button>
      )}
      {children}
    </div>
  );
}
