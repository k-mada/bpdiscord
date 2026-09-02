-- The pre-MFLFilms/MFLUserPicks roster and scoring tables. Nothing reads either.

-- Dropped here because its body is a string-literal SQL function, which Postgres
-- does not dependency-track: the table drop would leave it broken, not refuse.
DROP FUNCTION IF EXISTS "public"."get_mfl_movies"();

-- No CASCADE by design: neither table has a dependant today, so a bare DROP
-- fails loudly if that changes before this reaches production.
DROP TABLE IF EXISTS "public"."MFLUserMovies";
DROP TABLE IF EXISTS "public"."MFLMovieData";
