-- ============================================================
-- Migration v2 — « Prix — Candidats »
-- À exécuter dans Supabase Studio : SQL Editor → New query → Run
-- 1. Décompose full_name en first_name / last_name (backfill inclus)
-- 2. Ajoute le champ observation
-- 3. search_norm : nom normalisé SANS accents (ï -> i, é -> e …)
--    pour une recherche insensible aux accents, sur TOUTES les lignes
-- 4. Index trigram pour la recherche "contient" rapide sur 1000+ lignes
-- 5. Le verrou serveur du statut est retiré : l'app autorise désormais
--    l'admin à remettre un candidat en attente (les utilisateurs lambda,
--    eux, ne peuvent toujours pas changer un statut validé, côté app).
-- ============================================================

-- Extensions (Supabase les expose dans le schéma « extensions »)
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- 1 & 2 : nouvelles colonnes
alter table public.candidates add column if not exists first_name text;
alter table public.candidates add column if not exists last_name text;
alter table public.candidates add column if not exists observation text not null default '';
alter table public.candidates add column if not exists search_norm text;

-- 3 : unaccent rendu immutable (exigé pour le calcul déterministe)
create or replace function public.unaccent_immutable(str text)
returns text language sql immutable as $$
  select extensions.unaccent(str);
$$;

create or replace function public.set_search_norm()
returns trigger as $$
begin
  new.search_norm := lower(
    public.unaccent_immutable(
      coalesce(new.first_name, '')
      || ' '
      || coalesce(new.last_name, '')
    )
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_search_norm on public.candidates;
create trigger trg_search_norm
  before insert or update on public.candidates
  for each row execute function public.set_search_norm();

-- 1 : backfill — découpe full_name (1er mot → prénom, reste → nom)
update public.candidates
set first_name = btrim(split_part(trim(full_name), ' ', 1)),
    last_name  = btrim(
      case
        when position(' ' in trim(full_name)) = 0 then ''
        else substr(trim(full_name), position(' ' in trim(full_name)) + 1)
      end
    )
where (first_name is null or first_name = '')
   or (last_name is null or last_name = '');

-- recalcule search_norm pour les lignes existantes
update public.candidates
set search_norm = lower(public.unaccent_immutable(coalesce(first_name,'') || ' ' || coalesce(last_name,'')))
where search_norm is null;

-- 4 : index de recherche
create index if not exists idx_candidates_search_norm on public.candidates (search_norm);
create index if not exists idx_candidates_search_norm_trgm
  on public.candidates using gin (search_norm gin_trgm_ops);
create index if not exists idx_candidates_first_last
  on public.candidates (first_name, last_name);

-- 5 : retire la serrure serveur (l'admin doit pouvoir remettre en attente)
drop trigger if exists trg_lock_status on public.candidates;
