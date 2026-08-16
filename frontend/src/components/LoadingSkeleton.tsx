import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  rows?: number;
}

export default function LoadingSkeleton({ rows = 5 }: LoadingSkeletonProps) {
  return (
    <div className="rounded-md border border-[#232334] bg-[#12121a] p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full bg-[#1c1c26]" />
        ))}
      </div>
      <p className="mono mt-3 text-xs text-zinc-600">Loading from LAPI…</p>
    </div>
  );
}
