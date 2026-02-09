import Image from "next/image";
import Link from "next/link";

import { LogoutButton } from "@/components/layout/LogoutButton";

interface HeaderProps {
  githubUsername: string | null;
  avatarUrl: string | null;
}

export function Header({ githubUsername, avatarUrl }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Image
          src="/hippocampus-logo.png"
          alt="Hippocampus"
          width={32}
          height={32}
          className="h-8 w-8 rounded-full [filter:brightness(1.25)] drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]"
        />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-zinc-100">Hippocampus</h1>
          <p className="text-sm text-zinc-400">Team Memory</p>
        </div>
      </div>

      <nav className="flex items-center gap-4">
        <Link
          href="/sleep-cycle"
          className="text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          Sleep Cycle
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="GitHub avatar"
              width={28}
              height={28}
              className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
              GH
            </div>
          )}
          <span className="text-sm text-zinc-300">{githubUsername ?? "Authenticated"}</span>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
