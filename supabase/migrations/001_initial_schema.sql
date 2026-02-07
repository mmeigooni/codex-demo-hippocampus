-- Initial Hippocampus schema

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  github_username text unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repos (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  name text not null,
  full_name text not null unique,
  source text not null default 'github',
  connected_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repos(id) on delete cascade,
  source_pr_number integer,
  title text not null,
  who text,
  what_happened text,
  the_pattern text,
  the_fix text,
  why_it_matters text,
  salience_score integer not null default 0,
  triggers jsonb not null default '[]'::jsonb,
  source_url text,
  happened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repos(id) on delete cascade,
  title text not null,
  description text not null,
  triggers jsonb not null default '[]'::jsonb,
  source_episode_ids jsonb not null default '[]'::jsonb,
  confidence numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.index_entries (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repos(id) on delete cascade,
  entry_type text not null check (entry_type in ('episode', 'rule')),
  entry_id uuid not null,
  terms jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consolidation_runs (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repos(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_episodes_repo_id on public.episodes(repo_id);
create index if not exists idx_rules_repo_id on public.rules(repo_id);
create index if not exists idx_index_entries_repo_id on public.index_entries(repo_id);
create index if not exists idx_consolidation_runs_repo_id on public.consolidation_runs(repo_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_repos_updated_at on public.repos;
create trigger set_repos_updated_at
before update on public.repos
for each row execute function public.set_updated_at();

drop trigger if exists set_episodes_updated_at on public.episodes;
create trigger set_episodes_updated_at
before update on public.episodes
for each row execute function public.set_updated_at();

drop trigger if exists set_rules_updated_at on public.rules;
create trigger set_rules_updated_at
before update on public.rules
for each row execute function public.set_updated_at();

drop trigger if exists set_index_entries_updated_at on public.index_entries;
create trigger set_index_entries_updated_at
before update on public.index_entries
for each row execute function public.set_updated_at();
