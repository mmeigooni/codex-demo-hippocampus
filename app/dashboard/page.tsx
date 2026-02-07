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
    </section>
  );
}
