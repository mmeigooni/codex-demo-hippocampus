# Wave 06 Handoff Validation (2026-02-07)

## Targeted checks
- Demo repository exists and is public.
- PR corpus covers high, medium, and low salience incidents.
- Contradiction pair is present (#1 and #18).

## Critical regression checks (app repo)
- Wave 05 routes/components remain in place (`/api/github/repos`, `/api/github/import`, onboarding flow).
- `DEMO_REPO` points to `mmeigooni/shopflow-platform`.

## Validation commands
- `gh repo view mmeigooni/shopflow-platform --json visibility,url,defaultBranchRef` ✅
- `gh pr list --repo mmeigooni/shopflow-platform --state merged --limit 30` ✅ (18)
- `gh pr list --repo mmeigooni/shopflow-platform --state merged --json reviews` ✅ (2 reviews each)

## Chrome DevTools gate
- Still pending in this session due MCP namespace not available until desktop session reload.
