-- ag_acted_in_clone was a dev artifact captured by the initial
-- `supabase db pull`. It has no FKs, no PK, and no callers in the codebase.
DROP TABLE IF EXISTS public.ag_acted_in_clone;