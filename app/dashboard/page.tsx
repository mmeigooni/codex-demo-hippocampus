import { BrainPreview } from "@/components/brain/BrainPreview";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default function DashboardPage() {
  const demoRepo = process.env.DEMO_REPO ?? "mmeigooni/shopflow-platform";

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-zinc-100">Dashboard</h2>
        <p className="text-zinc-300">Connect a repository to start importing memory episodes.</p>
      </div>
      <OnboardingFlow demoRepoFullName={demoRepo} />

      <div className="space-y-1 pt-2">
        <h3 className="text-xl font-semibold text-zinc-100">Memory graph preview</h3>
        <p className="text-sm text-zinc-400">Wave 08 visualization scaffold with interaction and glow rendering.</p>
      </div>
      <BrainPreview />
    </section>
  );
}
