-- Pearson-based taste-compatibility queries.
--
-- Two SQL functions sharing the same join + filter + aggregate:
--   taste_compatibility(a, b)              -> one row for the pair
--   taste_compatibility_extremes(target)   -> top 3 + bottom 3 other users
--
-- The math (corr + AVG(ABS) over the both-rated set with rating > 0) mirrors
-- the client-side computeCompatibility in src/client/lib/ratingsCompatibility.ts.
-- Once a pinning test confirms parity, the TS implementation can be removed.

-- The extremes function joins UserFilms to itself on film_slug only. The PK
-- (lbusername, film_slug) can't serve that lookup. Without this index the join
-- degrades to a hash/seq scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_user_films_film_slug
  ON "UserFilms" (film_slug);

CREATE OR REPLACE FUNCTION taste_compatibility(user_a text, user_b text)
RETURNS TABLE (
  pearson      double precision,
  mad          double precision,
  sample_size  integer
)
LANGUAGE sql STABLE AS $$
  WITH pairs AS (
    SELECT a.rating AS r1, b.rating AS r2
    FROM "UserFilms" a
    JOIN "UserFilms" b ON a.film_slug = b.film_slug
    WHERE a.lbusername = user_a
      AND b.lbusername = user_b
      AND a.rating IS NOT NULL AND a.rating > 0
      AND b.rating IS NOT NULL AND b.rating > 0
  )
  SELECT corr(r1, r2)::double precision,
         AVG(ABS(r1 - r2))::double precision,
         COUNT(*)::integer
  FROM pairs;
$$;

CREATE OR REPLACE FUNCTION taste_compatibility_extremes(target_user text)
RETURNS TABLE (
  bucket        text,
  username      text,
  display_name  text,
  pearson       double precision,
  sample_size   integer,
  mad           double precision
)
LANGUAGE sql STABLE AS $$
  WITH me AS (
    SELECT film_slug, rating
    FROM "UserFilms"
    WHERE lbusername = target_user
      AND rating IS NOT NULL AND rating > 0
  ),
  scored AS (
    SELECT
      uf.lbusername                    AS username,
      COUNT(*)::int                    AS sample_size,
      corr(me.rating, uf.rating)       AS pearson,
      AVG(ABS(me.rating - uf.rating))  AS mad
    FROM "UserFilms" uf
    JOIN me ON me.film_slug = uf.film_slug
    WHERE uf.lbusername <> target_user
      AND uf.rating IS NOT NULL AND uf.rating > 0
    GROUP BY uf.lbusername
    HAVING COUNT(*) >= 10
       AND corr(me.rating, uf.rating) IS NOT NULL
  ),
  ranked AS (
    SELECT
      s.*,
      u.display_name,
      ROW_NUMBER() OVER (
        ORDER BY pearson DESC, sample_size DESC, s.username ASC
      ) AS r_desc,
      ROW_NUMBER() OVER (
        ORDER BY pearson ASC,  sample_size DESC, s.username ASC
      ) AS r_asc
    FROM scored s
    LEFT JOIN "Users" u ON u.lbusername = s.username
  )
  -- Disjoint buckets: a user can't appear in both lists. With < 6 qualifying
  -- matches, the middle ranks simply don't surface.
  SELECT 'most_compatible'::text  AS bucket,
         username, display_name, pearson, sample_size, mad
  FROM ranked WHERE r_desc <= 3
  UNION ALL
  SELECT 'least_compatible'::text AS bucket,
         username, display_name, pearson, sample_size, mad
  FROM ranked WHERE r_asc <= 3 AND r_desc > 3;
$$;
