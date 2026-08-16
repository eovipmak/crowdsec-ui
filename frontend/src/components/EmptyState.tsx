interface EmptyStateProps {
  title: string;
  description?: string;
  action?: string;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-[#232334] bg-[#0f0f17]/60 px-6 py-12 text-center">
      <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md mono text-xs leading-5 text-zinc-500">{description}</p>}
      {action && <p className="mt-3 mono text-xs text-zinc-600">{action}</p>}
    </div>
  );
}
