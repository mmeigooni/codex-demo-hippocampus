export default function SleepCycleLoading() {
  return (
    <section className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-6 w-44 animate-pulse rounded bg-zinc-800" />
      <div className="h-4 w-80 animate-pulse rounded bg-zinc-800/80" />
      <div className="h-72 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
    </section>
  );
}
