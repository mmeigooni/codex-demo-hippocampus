import Link from "next/link";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/episodes", label: "Episodes" },
];

export function Sidebar() {
  return (
    <aside className="w-full border-r border-zinc-800 bg-zinc-950/40 p-4 md:w-64">
      <nav className="space-y-2" aria-label="Primary">
        {primaryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="px-3 text-[10px] uppercase tracking-widest text-zinc-600">Advanced</p>
        <nav className="mt-1" aria-label="Advanced">
          <Link
            href="/sleep-cycle"
            className="block rounded-md px-3 py-2 text-xs text-zinc-500 transition hover:bg-zinc-900/70 hover:text-zinc-300"
          >
            Sleep Cycle
          </Link>
        </nav>
      </div>
    </aside>
  );
}
