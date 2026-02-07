"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/client";

export function LoginWithGitHubButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserClient();
      const callbackUrl = `${window.location.origin}/api/auth/callback?next=/dashboard`;

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          scopes: "repo",
          redirectTo: callbackUrl,
        },
      });

      if (signInError) {
        setError(signInError.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected login error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button className="w-full" size="lg" onClick={onLogin} disabled={loading}>
        {loading ? "Redirecting..." : "Login with GitHub"}
      </Button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
