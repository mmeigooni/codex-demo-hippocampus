import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const redirectPath = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
