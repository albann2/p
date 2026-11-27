-- ============================================================
-- Correctif du 400 Bad Request à l'import CSV
--   POST /rest/v1/candidates → 23502
--   « null value in column "full_name" ... violates not-null constraint »
--
-- Cause : la colonne full_name de l'ancien schéma est restée NOT NULL
-- alors que l'app envoie désormais first_name / last_name.
--
-- À exécuter dans Supabase Studio → SQL Editor → Run.
-- (Idempotent : on peut le relancer sans risque.)
-- ============================================================

alter table public.candidates drop column if exists full_name;

-- Vérification : doit renvoyer 0 ligne
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'candidates'
  and column_name = 'full_name';

-- Colonnes finales attendues (18 colonnes CSV + technique)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'candidates'
order by ordinal_position;
