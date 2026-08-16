import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-8 w-full rounded border border-[#232334] bg-[#0f0f17] px-3 py-1 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3f3f5a] focus-visible:border-[#3f3f5a] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
