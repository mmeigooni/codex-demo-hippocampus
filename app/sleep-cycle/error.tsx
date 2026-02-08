"use client";

export default function SleepCycleError({ reset }: { reset: () => void }) {
  return (
    <section className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
      <h2 className="text-lg font-semibold">Sleep cycle failed to load</h2>
      <p className="text-sm">Retry to reconnect consolidation state and pack output metadata.</p>
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
