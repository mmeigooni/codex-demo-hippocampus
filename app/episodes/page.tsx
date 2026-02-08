import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EpisodesPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-zinc-100">Episodes</h2>
        <p className="text-zinc-300">
          Episode exploration ships in Wave 11. This placeholder keeps navigation stable.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Coming in Wave 11</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-300">
          <p>
            You can continue importing and reviewing activity from the dashboard while episode panels are being built.
          </p>
          <p>
            Continue on the <Link className="text-cyan-300 hover:text-cyan-200" href="/dashboard">dashboard</Link>.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
