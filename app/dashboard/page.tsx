import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default function DashboardPage() {
  const demoRepo = process.env.DEMO_REPO ?? "mmeigooni/shopflow-platform";

  return <OnboardingFlow demoRepoFullName={demoRepo} />;
}
