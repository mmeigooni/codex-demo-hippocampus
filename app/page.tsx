import Image from "next/image";

import { LoginWithGitHubButton } from "@/components/auth/LoginWithGitHubButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6 py-10">
      <div className="landing-gradient pointer-events-none absolute inset-0" />
      <div className="landing-particles pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0">
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-orb landing-orb-3" />
        <div className="landing-orb landing-orb-4" />
      </div>

      <Card className="landing-card relative z-10 w-full max-w-xl border-cyan-900/70 bg-zinc-950/75 backdrop-blur-xl">
        <CardHeader className="space-y-5 text-center">
          <Badge className="mx-auto w-fit border-cyan-500/50 bg-cyan-500/15 text-cyan-100">
            Wave 25 Visual System
          </Badge>

          <div className="landing-logo-wrap mx-auto">
            <Image
              src="/hippocampus-logo.png"
              alt="Hippocampus logo"
              width={112}
              height={112}
              priority
              className="landing-logo mx-auto h-24 w-24 rounded-full"
            />
          </div>

          <CardTitle className="landing-title-shimmer bg-gradient-to-r from-cyan-100 via-sky-200 to-teal-200 bg-[length:220%_100%] bg-clip-text text-5xl tracking-tight text-transparent sm:text-6xl">
            Hippocampus
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-zinc-200">Shared episodic memory for Codex teams.</p>
          <LoginWithGitHubButton />
        </CardContent>
      </Card>

      <style jsx global>{`
        @keyframes landing-gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes landing-pulse {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(0.84);
            opacity: 0.2;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.22);
            opacity: 0.5;
          }
        }

        @keyframes landing-glow {
          0%,
          100% {
            box-shadow:
              0 0 0 1px rgba(34, 211, 238, 0.16),
              0 0 60px rgba(8, 145, 178, 0.2),
              0 30px 80px rgba(2, 6, 23, 0.8);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(103, 232, 249, 0.34),
              0 0 90px rgba(6, 182, 212, 0.3),
              0 38px 100px rgba(2, 6, 23, 0.88);
          }
        }

        @keyframes landing-float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes landing-shimmer {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }

        @keyframes landing-drift {
          0% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(-2%, -3%, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }

        .landing-gradient {
          background:
            radial-gradient(circle at 18% 18%, rgba(6, 182, 212, 0.24), transparent 42%),
            radial-gradient(circle at 82% 26%, rgba(14, 116, 144, 0.28), transparent 45%),
            radial-gradient(circle at 52% 84%, rgba(30, 64, 175, 0.33), transparent 52%),
            linear-gradient(120deg, #020617, #041827, #052e35, #0f172a, #042f2e, #082f49);
          background-size: 180% 180%;
          animation: landing-gradient-shift 15s ease-in-out infinite;
        }

        .landing-particles {
          opacity: 0.35;
          background-image:
            radial-gradient(circle at 20% 22%, rgba(103, 232, 249, 0.4) 0 2px, transparent 2px),
            radial-gradient(circle at 71% 38%, rgba(125, 211, 252, 0.28) 0 1.8px, transparent 1.8px),
            radial-gradient(circle at 37% 74%, rgba(45, 212, 191, 0.34) 0 2.1px, transparent 2.1px),
            radial-gradient(circle at 84% 82%, rgba(186, 230, 253, 0.24) 0 1.5px, transparent 1.5px);
          animation: landing-drift 18s ease-in-out infinite;
        }

        .landing-orb {
          position: absolute;
          border-radius: 9999px;
          transform: translate(-50%, -50%);
          filter: blur(1px);
          animation: landing-pulse 6s ease-in-out infinite;
        }

        .landing-orb-1 {
          left: 22%;
          top: 26%;
          width: 210px;
          height: 210px;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.48), rgba(14, 116, 144, 0.06));
          animation-delay: 0s;
        }

        .landing-orb-2 {
          left: 81%;
          top: 20%;
          width: 280px;
          height: 280px;
          background: radial-gradient(circle, rgba(34, 211, 238, 0.42), rgba(14, 116, 144, 0.03));
          animation-delay: 1.35s;
        }

        .landing-orb-3 {
          left: 70%;
          top: 84%;
          width: 240px;
          height: 240px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.33), rgba(15, 23, 42, 0.03));
          animation-delay: 2.3s;
        }

        .landing-orb-4 {
          left: 18%;
          top: 78%;
          width: 180px;
          height: 180px;
          background: radial-gradient(circle, rgba(20, 184, 166, 0.3), rgba(15, 23, 42, 0.02));
          animation-delay: 3.2s;
        }

        .landing-card {
          animation: landing-glow 5.8s ease-in-out infinite;
        }

        .landing-logo {
          animation: landing-float 4.2s ease-in-out infinite;
          filter: drop-shadow(0 0 22px rgba(34, 211, 238, 0.44));
        }

        .landing-title-shimmer {
          animation: landing-shimmer 5.2s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-gradient,
          .landing-particles,
          .landing-orb,
          .landing-card,
          .landing-logo,
          .landing-title-shimmer {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
