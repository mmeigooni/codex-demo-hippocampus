export default function DashboardLoading() {
  return (
    <section className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-6 w-40 animate-pulse rounded bg-zinc-800" />
      <div className="h-4 w-72 animate-pulse rounded bg-zinc-800/80" />
      <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
    </section>
  );
}
