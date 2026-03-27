import { createServerClient } from "@/lib/supabase/server";

export interface ProfileUserContext {
  id: string;
  githubUsername: string | null;
  avatarUrl: string | null;
}

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

export async function ensureProfileId(user: ProfileUserContext, supabase: ServerClient) {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingProfile?.id) {
    return existingProfile.id;
  }

  const { data: createdProfile, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      github_username: user.githubUsername,
      avatar_url: user.avatarUrl,
    })
    .select("id")
    .single();

  if (error || !createdProfile?.id) {
    throw new Error(error?.message ?? "Failed to create profile");
  }

  return createdProfile.id;
}
