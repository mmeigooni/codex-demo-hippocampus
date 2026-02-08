# Wave 12 Demo Runbook

Date: 2026-02-08

## Goal
Walk through the full Hippocampus memory lifecycle in one session.

## Preconditions
- App running on `http://localhost:3000`
- Valid Supabase auth session
- OpenAI and GitHub env vars configured in `.env.local`

## Demo path
1. Open `/` and show login entry.
2. Navigate to `/dashboard` and show repo onboarding panel.
3. Import demo repo (`mmeigooni/shopflow-platform`) or loaded public repo.
4. Watch neural activity feed + brain graph update.
5. Open `/sleep-cycle` and run consolidation.
6. Observe dream-state transitions and live event stream.
7. Show pack output sections (rules, contradictions, salience deltas).
8. Open `/episodes` and inspect episode detail fields.

## Artifacts
- `/Users/frequency/Desktop/dev/codex-demo-hippocampus/docs/waves/artifacts/w12-dashboard.png`
- `/Users/frequency/Desktop/dev/codex-demo-hippocampus/docs/waves/artifacts/w12-episodes.png`
- `/Users/frequency/Desktop/dev/codex-demo-hippocampus/docs/waves/artifacts/w12-sleep-cycle.png`

## Known risks
- If no episodes are present for selected repo, consolidation path shows empty-state instead of full event lifecycle.
- External API rate limits may affect import timing during live demos.

## Mitigations
- Pre-import at least one repo before live demo start.
- Keep fallback demo account with existing imported episodes.
- Keep this runbook open for deterministic route order.
