import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090f] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-white text-black hover:bg-zinc-200 active:bg-zinc-300',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
        outline: 'border border-[#2a2a3a] bg-transparent text-zinc-300 hover:bg-[#12121a] hover:text-white active:bg-[#1c1c26]',
        secondary: 'bg-[#1c1c26] text-zinc-200 hover:bg-[#232334] border border-[#232334] active:bg-[#2a2a3a]',
        ghost: 'text-zinc-400 hover:bg-[#12121a] hover:text-zinc-200 active:bg-[#1c1c26]',
        link: 'text-zinc-300 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 py-1.5 text-xs font-semibold tracking-wide',
        sm: 'h-7 rounded px-2.5 text-xs',
        lg: 'h-9 rounded px-6 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
