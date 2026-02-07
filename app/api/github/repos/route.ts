import { NextResponse } from "next/server";

import { fetchUserRepos } from "@/lib/github/client";
import { createServerClient } from "@/lib/supabase/server";

function getFallbackGitHubToken() {
  return process.env.GITHUB_TOKEN ?? null;
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const providerToken = session?.provider_token ?? getFallbackGitHubToken();

    if (!providerToken) {
      return NextResponse.json(
        {
          error:
            "Missing GitHub provider token. Re-authenticate with GitHub or set GITHUB_TOKEN for local development.",
        },
        { status: 400 },
      );
    }

    const repos = await fetchUserRepos(providerToken);

    return NextResponse.json({ repos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error fetching GitHub repos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
