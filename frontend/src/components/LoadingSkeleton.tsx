import { Skeleton } from '@/components/ui/skeleton';

type LoadingSkeletonProps = {
  rows: number;
};

/**
 * Table-shaped loading placeholder (plan §7.1).
 */
export default function LoadingSkeleton({ rows }: LoadingSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
