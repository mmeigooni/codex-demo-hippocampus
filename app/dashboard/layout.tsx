import type { ReactNode } from "react";

import { Header } from "@/components/layout/Header";
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
      <main className="min-h-[calc(100vh-73px)] p-6">{children}</main>
    </div>
  );
}
