import Image from "next/image";

import { LoginWithGitHubButton } from "@/components/auth/LoginWithGitHubButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import styles from "./page.module.css";

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6 py-10">
      <div className={cn(styles.landingGradient, "pointer-events-none absolute inset-0")} />
      <div className={cn(styles.landingParticles, "pointer-events-none absolute inset-0")} />
      <div className="pointer-events-none absolute inset-0">
        <div className={cn(styles.landingOrb, styles.landingOrb1)} />
        <div className={cn(styles.landingOrb, styles.landingOrb2)} />
        <div className={cn(styles.landingOrb, styles.landingOrb3)} />
        <div className={cn(styles.landingOrb, styles.landingOrb4)} />
      </div>

      <Card className={cn(styles.landingCard, "relative z-10 w-full max-w-xl border-cyan-900/70 bg-zinc-950/75 backdrop-blur-xl")}>
        <CardHeader className="space-y-5 text-center">
          <Badge className="mx-auto w-fit border-cyan-500/50 bg-cyan-500/15 text-cyan-100">
            Wave 25 Visual System
          </Badge>

          <div className="mx-auto">
            <Image
              src="/hippocampus-logo.png"
              alt="Hippocampus logo"
              width={112}
              height={112}
              priority
              className={cn(styles.landingLogo, "mx-auto h-24 w-24 rounded-full")}
            />
          </div>

          <CardTitle
            className={cn(
              styles.landingTitleShimmer,
              "bg-gradient-to-r from-cyan-100 via-sky-200 to-teal-200 bg-[length:220%_100%] bg-clip-text text-5xl tracking-tight text-transparent sm:text-6xl",
            )}
          >
            Hippocampus
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-zinc-200">Shared episodic memory for Codex teams.</p>
          <LoginWithGitHubButton />
        </CardContent>
      </Card>
    </div>
  );
}
