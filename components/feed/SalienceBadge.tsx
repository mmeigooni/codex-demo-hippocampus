"use client";

interface SalienceBadgeProps {
  salience: number;
}

function toneForSalience(salience: number) {
  if (salience >= 8) return "bg-red-500/20 text-red-100 border-red-500/40";
  if (salience >= 5) return "bg-amber-500/20 text-amber-100 border-amber-500/40";
  return "bg-cyan-500/20 text-cyan-100 border-cyan-500/40";
}

export function SalienceBadge({ salience }: SalienceBadgeProps) {
  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${toneForSalience(salience)}`}>
      salience {salience}
    </span>
  );
}
