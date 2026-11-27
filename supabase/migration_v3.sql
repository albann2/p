-- ============================================================
-- Migration v3 — « Prix — Candidats »
-- La table reprend EXACTEMENT les colonnes du CSV d'origine
-- (applications.csv) + le champ observation du jury.
--
-- À exécuter dans Supabase Studio : SQL Editor → New query → Run
-- Puis, dans l'app : Admin → « Importer un fichier CSV » pour recharger
-- les candidats (les colonnes de l'ancien format sont supprimées, donc
-- les lignes existantes perdent ces informations : c'est prévu, le
-- fichier CSV les remplace).
-- ============================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ------------------------------------------------------------
-- 1. Colonnes du CSV (ajout, sans toucher aux lignes existantes)
-- ------------------------------------------------------------
alter table public.candidates
  add column if not exists gender            text,
  add column if not exists country_of_study  text,
  add column if not exists nationality       text,
  add column if not exists city_village      text,
  add column if not exists level             text,
  add column if not exists school            text,
  add column if not exists school_category   text,
  add column if not exists school_section    text,
  add column if not exists study_field       text,
  add column if not exists grade             text,
  add column if not exists document_count    integer,
  add column if not exists submitted_at      timestamptz;

-- ------------------------------------------------------------
-- 2. Suppression des colonnes de l'ancien format
--    (elles ne sont plus utilisées par l'app ni par le CSV)
--    IMPORTANT : full_name était NOT NULL sans valeur par défaut ; s'il
--    reste, TOUT insert de l'app échoue (erreur 400 / code 23502).
-- ------------------------------------------------------------
alter table public.candidates
  drop column if exists full_name,
  drop column if exists birth_date,
  drop column if exists address,
  drop column if exists region,
  drop column if exists profession,
  drop column if exists motivation;

-- ------------------------------------------------------------
-- 3. Observation du jury : texte libre, vide par défaut
-- ------------------------------------------------------------
alter table public.candidates
  alter column observation set default '';

update public.candidates
set observation = ''
where observation is null;

alter table public.candidates
  alter column observation set not null;

-- ------------------------------------------------------------
-- 4. Statut : valeurs autorisées
-- ------------------------------------------------------------
alter table public.candidates
  drop constraint if exists candidates_status_check;

alter table public.candidates
  add constraint candidates_status_check
  check (status in ('pending', 'approved', 'rejected'));

-- ------------------------------------------------------------
-- 5. Noms : toujours renseignés (le CSV les fournit)
-- ------------------------------------------------------------
update public.candidates set first_name = '' where first_name is null;
update public.candidates set last_name  = '' where last_name  is null;

alter table public.candidates alter column first_name set default '';
alter table public.candidates alter column last_name  set default '';
alter table public.candidates alter column first_name set not null;
alter table public.candidates alter column last_name  set not null;

-- ------------------------------------------------------------
-- 6. Recherche sans accents sur « prénom nom » (trigger + index)
-- ------------------------------------------------------------
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

update public.candidates
set search_norm = lower(
  public.unaccent_immutable(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
);

create index if not exists idx_candidates_search_norm
  on public.candidates (search_norm);
create index if not exists idx_candidates_search_norm_trgm
  on public.candidates using gin (search_norm gin_trgm_ops);
create index if not exists idx_candidates_first_last
  on public.candidates (first_name, last_name);
create index if not exists idx_candidates_status
  on public.candidates (status);
create index if not exists idx_candidates_submitted_at
  on public.candidates (submitted_at desc);

-- ------------------------------------------------------------
-- 7. updated_at automatique
-- ------------------------------------------------------------
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
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 8. Accès (l'app protège l'accès par mot de passe côté client)
-- ------------------------------------------------------------
alter table public.candidates enable row level security;

drop policy if exists "anon full access" on public.candidates;
create policy "anon full access"
  on public.candidates
  for all
  to anon
  using (true)
  with check (true);

-- Vérification finale : liste des colonnes de la table
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'candidates'
order by ordinal_position;
