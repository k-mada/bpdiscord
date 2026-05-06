-- pg_trgm powers fast ILIKE '%q%' for /api/actor-graph/search.
-- Supabase typically installs extensions into the "extensions" schema.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Reverse-direction edge index: the path-finder's recursive CTE joins
-- ag_acted_in on movie_tmdb_id to find co-stars. Without this, every
-- recursion step seq-scans the edge table.
CREATE INDEX IF NOT EXISTS idx_ag_acted_in_movie_actor
  ON public.ag_acted_in (movie_tmdb_id, actor_tmdb_id);

-- Trigram GIN indexes for substring search on actor/movie name.
CREATE INDEX IF NOT EXISTS idx_ag_actors_name_trgm
  ON public.ag_actors USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ag_films_title_trgm
  ON public.ag_films USING gin (title extensions.gin_trgm_ops);