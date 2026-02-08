-- Import idempotency for PR-backed episodes
-- Keep newest episode per (repo_id, source_pr_number), then enforce uniqueness.

with ranked as (
  select
    id,
    row_number() over (
      partition by repo_id, source_pr_number
      order by created_at desc, id desc
    ) as rn
  from public.episodes
  where source_pr_number is not null
), duplicates as (
  select id
  from ranked
  where rn > 1
)
delete from public.episodes
where id in (select id from duplicates);

create unique index if not exists idx_episodes_repo_pr
  on public.episodes(repo_id, source_pr_number)
  where source_pr_number is not null;
