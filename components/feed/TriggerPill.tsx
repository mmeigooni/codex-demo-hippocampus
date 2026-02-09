"use client";

interface TriggerPillProps {
  trigger: string;
  accentColor?: string;
}

export function TriggerPill({ trigger, accentColor }: TriggerPillProps) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs ${accentColor ? "" : "bg-zinc-800 text-zinc-200"}`}
      style={accentColor ? { backgroundColor: accentColor, color: "#ffffff" } : undefined}
    >
      #{trigger}
    </span>
  );
}
