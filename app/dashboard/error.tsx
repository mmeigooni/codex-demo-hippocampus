"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <section className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
      <h2 className="text-lg font-semibold">Dashboard failed to load</h2>
      <p className="text-sm">Retry to reload repository onboarding and activity state.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-rose-200/50 px-3 py-1 text-sm hover:bg-rose-500/20"
      >
        Retry
      </button>
    </section>
  );
}
