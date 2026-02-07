import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginWithGitHubButton } from "@/components/auth/LoginWithGitHubButton";

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#0f172a_0%,_#020617_55%)] px-6">
      <Card className="w-full max-w-xl border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <CardHeader className="space-y-4">
          <Badge className="w-fit border-cyan-600/40 bg-cyan-500/10 text-cyan-200">
            Wave 03 Foundation
          </Badge>
          <CardTitle className="text-4xl tracking-tight text-zinc-50">
            Hippocampus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-zinc-300">
            Shared episodic memory for Codex teams.
          </p>
          <LoginWithGitHubButton />
        </CardContent>
      </Card>
    </div>
  );
}
