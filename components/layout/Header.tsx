import { LogoutButton } from "@/components/layout/LogoutButton";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  githubUsername: string | null;
  avatarUrl: string | null;
}

export function Header({ githubUsername, avatarUrl }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/70 px-6 py-4 backdrop-blur">
      <div className="space-y-1">
        <p className="text-sm text-zinc-400">Team Memory</p>
        <h1 className="text-xl font-semibold text-zinc-100">Hippocampus</h1>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-100">
          {githubUsername ?? "Authenticated"}
        </Badge>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="GitHub avatar"
            className="h-9 w-9 rounded-full border border-zinc-700 object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
            GH
          </div>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
