# Wave 16 Handoff Validation (2026-02-08)

## Targeted checks
- Re-import does not create duplicate Supabase episodes for the same PR.
- SSE stream includes `episode_skipped` and `complete.skipped` contract.
- Onboarding status text and feed clearly distinguish created vs already-imported PRs.
- Graph preload behavior remains, with explicit snapshot labeling while import runs.

## Validation commands
- `npx next typegen` ✅
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅

## SQL verification snippets
```sql
-- Detect remaining duplicates after migration (expect zero rows)
select repo_id, source_pr_number, count(*)
from episodes
where source_pr_number is not null
group by repo_id, source_pr_number
having count(*) > 1;

-- Inspect import totals for a repo after re-import
select r.full_name,
       count(*) as episodes,
       count(distinct e.source_pr_number) as distinct_prs
from repos r
join episodes e on e.repo_id = r.id
where r.full_name = 'mmeigooni/shopflow-platform'
group by r.full_name;
```

## Manual UX verification
- First import: created > 0, skipped = 0.
- Re-import same repo: created = 0, skipped > 0, feed cards show `episode_skipped`.
- Status message example: `Import complete. 18 episodes already imported.`
