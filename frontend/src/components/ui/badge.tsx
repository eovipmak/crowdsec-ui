import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none tracking-wide mono transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-white text-black',
        secondary: 'border-[#2a2a3a] bg-[#1c1c26] text-zinc-400',
        destructive: 'border-red-900/50 bg-red-950/60 text-red-300',
        outline: 'border-[#2a2a3a] bg-transparent text-zinc-400',
        signal: 'border-amber-900/40 bg-amber-950/60 text-amber-300',
        success: 'border-emerald-900/40 bg-emerald-950/50 text-emerald-300',
        muted: 'border-[#232334] bg-[#181825] text-zinc-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
