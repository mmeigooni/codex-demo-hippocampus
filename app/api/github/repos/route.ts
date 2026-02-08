import { NextResponse } from "next/server";

import { fetchUserRepos } from "@/lib/github/client";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const [userResult, sessionResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    const user = userResult.data.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = sessionResult.data.session;

    const providerToken = session?.provider_token;

    if (!providerToken) {
      return NextResponse.json(
        {
          error:
            "Missing GitHub provider token. Re-authenticate with GitHub to load public repositories.",
        },
        { status: 400 },
      );
    }

    const repos = await fetchUserRepos(providerToken);
    const publicRepos = repos.filter((repo) => !repo.private);

    return NextResponse.json({ repos: publicRepos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error fetching GitHub repos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
