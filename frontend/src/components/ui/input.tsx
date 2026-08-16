import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-8 w-full rounded border border-[#232334] bg-[#0f0f17] px-3 py-1 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6366f1] focus-visible:border-[#6366f1] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-900/60 aria-[invalid=true]:bg-red-950/20',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
