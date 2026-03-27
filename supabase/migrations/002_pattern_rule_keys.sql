-- Deterministic pattern/rule keys for stable promotion and graphing

alter table if exists public.episodes
  add column if not exists pattern_key text not null default 'review-hygiene';

alter table if exists public.rules
  add column if not exists rule_key text not null default 'review-hygiene';

create unique index if not exists idx_rules_repo_id_rule_key
  on public.rules(repo_id, rule_key);
