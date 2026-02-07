import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader>
        <CardTitle className="text-zinc-100">Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-zinc-300">Connect a repo to build your brain.</p>
      </CardContent>
    </Card>
  );
}
