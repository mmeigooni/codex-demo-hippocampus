import type { ReactNode } from "react";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { createServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const githubUsername = user?.user_metadata?.user_name ?? user?.user_metadata?.preferred_username ?? null;
  const avatarUrl = user?.user_metadata?.avatar_url ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header githubUsername={githubUsername} avatarUrl={avatarUrl} />
      <div className="flex min-h-[calc(100vh-73px)] flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
