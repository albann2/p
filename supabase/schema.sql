-- ============================================================
-- Schéma Supabase — App « Prix — Candidats » (v2 complet)
-- À exécuter dans Supabase Studio : SQL Editor → New query → Run
-- (Si la table existe déjà avec l'ancienne structure, exécutez plutôt
--  supabase/migration_v2.sql qui fait la mise à jour + backfill.)
-- ============================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  birth_date text,
  address text,
  region text,
  profession text,
  motivation text,
  observation text not null default '',
  search_norm text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- updated_at automatique
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_updated_at on public.candidates;
create trigger trg_touch_updated_at
  before update on public.candidates
  for each row
  execute function public.touch_updated_at();

-- ============================================================
-- search_norm : nom normalisé SANS accents (dï -> di, é -> e …)
-- pour une recherche insensible aux accents sur TOUTES les lignes
-- ============================================================
create or replace function public.unaccent_immutable(str text)
returns text language sql immutable as $$
  select extensions.unaccent(str);
$$;

create or replace function public.set_search_norm()
returns trigger as $$
begin
  new.search_norm := lower(
    public.unaccent_immutable(
      coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')
    )
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_search_norm on public.candidates;
create trigger trg_search_norm
  before insert or update on public.candidates
  for each row execute function public.set_search_norm();

-- Index de recherche
create index if not exists idx_candidates_search_norm on public.candidates (search_norm);
create index if not exists idx_candidates_search_norm_trgm
  on public.candidates using gin (search_norm gin_trgm_ops);
create index if not exists idx_candidates_first_last
  on public.candidates (first_name, last_name);

-- ============================================================
-- Row Level Security : accès public (anon) en lecture/écriture
-- (l'app protège elle-même l'accès par mot de passe côté client)
-- ============================================================
alter table public.candidates enable row level security;

drop policy if exists "anon full access" on public.candidates;
create policy "anon full access"
  on public.candidates
  for all
  to anon
  using (true)
  with check (true);
