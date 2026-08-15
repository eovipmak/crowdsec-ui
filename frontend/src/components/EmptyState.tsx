type EmptyStateProps = {
  title: string;
  description?: string;
};

/**
 * Empty-state placeholder (plan §7.1): shown when a section has no data.
 */
export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
