import Link from "next/link";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/episodes", label: "Episodes" },
  { href: "/sleep-cycle", label: "Sleep Cycle" },
];

export function Sidebar() {
  return (
    <aside className="w-full border-r border-zinc-800 bg-zinc-950/40 p-4 md:w-64">
      <nav className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
