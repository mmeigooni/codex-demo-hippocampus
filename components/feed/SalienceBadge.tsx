"use client";

interface SalienceBadgeProps {
  salience: number;
}

export function toneForSalience(salience: number) {
  if (salience >= 8) return "bg-red-500/20 text-red-100 border-red-500/40";
  if (salience >= 5) return "bg-amber-500/20 text-amber-100 border-amber-500/40";
  return "bg-cyan-500/20 text-cyan-100 border-cyan-500/40";
}

function labelForSalience(salience: number) {
  if (salience >= 8) return "High priority";
  if (salience >= 5) return "Notable";
  return null;
}

export function SalienceBadge({ salience }: SalienceBadgeProps) {
  const label = labelForSalience(salience);
  if (!label) {
    return null;
  }

  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${toneForSalience(salience)}`}>
      {label}
    </span>
  );
}
