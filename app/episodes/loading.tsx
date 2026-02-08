export default function EpisodesLoading() {
  return (
    <section className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-6 w-36 animate-pulse rounded bg-zinc-800" />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
        <div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
      </div>
    </section>
  );
}
