"use client";

interface TriggerPillProps {
  trigger: string;
}

export function TriggerPill({ trigger }: TriggerPillProps) {
  return <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-200">#{trigger}</span>;
}
