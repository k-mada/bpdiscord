


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_all_user_films"() RETURNS TABLE("title" character varying, "film_slug" character varying)
    LANGUAGE "sql"
    AS $$SELECT DISTINCT title, film_slug FROM "UserFilms"
  ORDER BY title ASC;$$;


ALTER FUNCTION "public"."get_all_user_films"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hater_rankings"() RETURNS TABLE("display_name" character varying, "lbusername" character varying, "films_rated" numeric, "differential" numeric, "normalized" numeric)
    LANGUAGE "sql"
    AS $$
SELECT u.display_name, uf.lbusername, count(distinct(uf.film_slug)) as films_rated, sum(uf.rating - f.lb_rating) as differential, ROUND((sum(uf.rating - f.lb_rating) / count(uf.film_slug) * 100)::NUMERIC, 2) as normalized
  FROM "UserFilms" as uf
  INNER JOIN "Films" as f ON f.film_slug = uf.film_slug
  INNER JOIN "Users" as u ON u.lbusername = uf.lbusername
  WHERE uf.rating > 0
  GROUP BY u.display_name, uf.lbusername
  ORDER BY normalized asc;
$$;


ALTER FUNCTION "public"."get_hater_rankings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mfl_movie_scores"("p_film_slug" "text") RETURNS TABLE("scoring_id" bigint, "metric_id" bigint, "film_slug" "text", "points_awarded" bigint, "metric" "text", "metric_name" "text", "category" "text", "scoring_condition" "text")
    LANGUAGE "sql"
    AS $$SELECT 
		st.scoring_id,
        st.metric_id,
        st.film_slug,
        st.points_awarded,
        sm.metric,
        sm.metric_name,
        sm.category,
        sm.scoring_condition
    FROM "MFLScoringTally" AS st
    JOIN "MFLScoringMetrics" AS sm ON sm.metric_id = st.metric_id
    WHERE st.film_slug = p_film_slug;$$;


ALTER FUNCTION "public"."get_mfl_movie_scores"("p_film_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mfl_movies"() RETURNS TABLE("title" character varying, "film_slug" character varying)
    LANGUAGE "sql"
    AS $$SELECT DISTINCT title, film_slug FROM "MFLUserMovies"
  ORDER BY title ASC;$$;


ALTER FUNCTION "public"."get_mfl_movies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_missing_films"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE 
	result text[];
BEGIN
 	SELECT array_agg(DISTINCT uf.film_slug)
 	INTO result
	FROM "UserFilms" uf
	WHERE NOT EXISTS(
  		SELECT f.film_slug from "Films" f
  		WHERE f.film_slug = uf.film_slug
	);
	RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;


ALTER FUNCTION "public"."get_missing_films"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_movie_swap"("user1" character varying, "user2" character varying) RETURNS TABLE("film_slug" character varying, "title" character varying)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT uf.film_slug, uf.title
  FROM "UserFilms" uf
  WHERE uf.lbusername = user1
    AND uf.film_slug NOT IN (
      SELECT uf2.film_slug
      FROM "UserFilms" uf2
      WHERE uf2.lbusername = user2
    )
  ORDER BY uf.film_slug ASC;
END;
$$;


ALTER FUNCTION "public"."get_movie_swap"("user1" character varying, "user2" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rankings"() RETURNS TABLE("lbusername" character varying, "differential" numeric)
    LANGUAGE "sql"
    AS $$
  SELECT uf.lbusername, sum(uf.rating - f.lb_rating) as differential 
  FROM "UserFilms" as uf
  INNER JOIN "Films" as f ON f.film_slug = uf.film_slug
  WHERE uf.rating > 0
  GROUP BY uf.lbusername
  ORDER BY differential asc;
$$;


ALTER FUNCTION "public"."get_rankings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rating_distribution_all"() RETURNS TABLE("rating" real, "count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    uf.rating,
    COUNT(uf.rating) as count
  FROM "UserFilms" uf
  INNER JOIN "Users" u on uf.lbusername = u.lbusername
  WHERE u.is_discord = true AND uf.rating != 0
  GROUP BY uf.rating
  ORDER BY uf.rating ASC;
END;
$$;


ALTER FUNCTION "public"."get_rating_distribution_all"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_films_count"() RETURNS integer
    LANGUAGE "sql"
    AS $$SELECT sum(A.ratedFilms)
  FROM (
    SELECT count(distinct title) as ratedFilms 
    FROM "UserFilms"
    INNER JOIN "Users" on "Users".lbusername = "UserFilms".lbusername
    where "Users".is_discord = true
  ) A$$;


ALTER FUNCTION "public"."get_user_films_count"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."AwardShows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "slug" character varying NOT NULL,
    "description" character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."AwardShows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EventCategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" character varying NOT NULL,
    "display_order" integer NOT NULL,
    "display_mode" character varying(20) DEFAULT 'movie_first'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."EventCategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EventNominees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "person_name" character varying,
    "movie_or_show_name" character varying NOT NULL,
    "is_winner" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."EventNominees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EventUserPicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "user_id" character varying NOT NULL,
    "nominee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."EventUserPicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "slug" character varying NOT NULL,
    "year" integer NOT NULL,
    "nominations_date" timestamp with time zone,
    "awards_date" timestamp with time zone,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "award_show_id" "uuid" NOT NULL,
    "edition_number" integer
);


ALTER TABLE "public"."Events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FilmRatings" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "film_slug" "text" NOT NULL,
    "rating" real NOT NULL,
    "rating_count" integer
);


ALTER TABLE "public"."FilmRatings" OWNER TO "postgres";


COMMENT ON TABLE "public"."FilmRatings" IS 'Breakdown of film ratings by rating and rating count';



CREATE TABLE IF NOT EXISTS "public"."Films" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "film_slug" character varying NOT NULL,
    "lb_rating" real,
    "url" character varying,
    "tmdb_link" character varying,
    "poster" character varying,
    "banner" character varying,
    "title" character varying
);


ALTER TABLE "public"."Films" OWNER TO "postgres";


COMMENT ON TABLE "public"."Films" IS 'Films on Letterboxd with rating counts for each rating.';



CREATE TABLE IF NOT EXISTS "public"."MFLMovieData" (
    "title" "text" NOT NULL,
    "price" real,
    "rosters" bigint,
    "box_office_points" "text",
    "awards_points" bigint,
    "critical_perf_points" "text",
    "total_points" bigint,
    "points_per_dollar" double precision,
    "film_slug" "text"
);


ALTER TABLE "public"."MFLMovieData" OWNER TO "postgres";


COMMENT ON TABLE "public"."MFLMovieData" IS 'Current point totals for movies';



CREATE TABLE IF NOT EXISTS "public"."MFLScoringMetrics" (
    "metric_id" bigint NOT NULL,
    "metric" "text",
    "metric_name" "text",
    "category" "text",
    "scoring_condition" "text",
    "point_value" bigint
);


ALTER TABLE "public"."MFLScoringMetrics" OWNER TO "postgres";


ALTER TABLE "public"."MFLScoringMetrics" ALTER COLUMN "metric_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."MFLScoringMetrics_metric_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."MFLScoringTally" (
    "film_slug" "text",
    "metric_id" bigint,
    "points_awarded" bigint,
    "scoring_id" bigint NOT NULL
);


ALTER TABLE "public"."MFLScoringTally" OWNER TO "postgres";


ALTER TABLE "public"."MFLScoringTally" ALTER COLUMN "scoring_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."MFLScoringTally_scoring_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."MFLUserMovies" (
    "username" character varying NOT NULL,
    "title" character varying NOT NULL,
    "film_slug" "text"
);


ALTER TABLE "public"."MFLUserMovies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."MFLUserMovies"."film_slug" IS 'LB slug of movie';



CREATE TABLE IF NOT EXISTS "public"."UserFilms" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "film_slug" character varying NOT NULL,
    "rating" real,
    "lbusername" character varying NOT NULL,
    "watched" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "liked" boolean,
    "title" character varying
);


ALTER TABLE "public"."UserFilms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserRatings" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "username" character varying NOT NULL,
    "rating" real NOT NULL,
    "count" integer,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."UserRatings" OWNER TO "postgres";


COMMENT ON TABLE "public"."UserRatings" IS 'Data for how many movies a user rated a given rating';



COMMENT ON COLUMN "public"."UserRatings"."updated_at" IS 'Timestamp of most recent updating of ratings count';



CREATE TABLE IF NOT EXISTS "public"."Users" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lbusername" character varying NOT NULL,
    "following" integer,
    "followers" integer,
    "number_of_lists" integer,
    "is_discord" boolean DEFAULT true,
    "display_name" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Users"."display_name" IS 'Display name of Letterboxd user';



CREATE TABLE IF NOT EXISTS "public"."WatchList" (
    "id" bigint NOT NULL,
    "date_added" "date" NOT NULL,
    "name" character varying(500) NOT NULL,
    "year" integer,
    "letterboxd_uri" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."WatchList" OWNER TO "postgres";


COMMENT ON TABLE "public"."WatchList" IS 'Stores Letterboxd watchlist data';



COMMENT ON COLUMN "public"."WatchList"."date_added" IS 'Date when the movie was added to watchlist';



COMMENT ON COLUMN "public"."WatchList"."name" IS 'Movie title';



COMMENT ON COLUMN "public"."WatchList"."year" IS 'Movie release year';



COMMENT ON COLUMN "public"."WatchList"."letterboxd_uri" IS 'Unique Letterboxd URL for the movie';



CREATE TABLE IF NOT EXISTS "public"."ag_acted_in" (
    "actor_tmdb_id" integer NOT NULL,
    "movie_tmdb_id" integer NOT NULL,
    "character" "text",
    "billing_order" integer
);


ALTER TABLE "public"."ag_acted_in" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."ag_actors" (
    "tmdb_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "profile_path" "text",
    "popularity" real,
    "birthday" "text",
    "biography" "text",
    "place_of_birth" "text",
    "fully_fetched" boolean DEFAULT false,
    "fetched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ag_actors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_films" (
    "tmdb_id" integer NOT NULL,
    "title" "text" NOT NULL,
    "release_date" "text",
    "release_year" integer,
    "poster_path" "text",
    "poster_url" "text",
    "overview" "text",
    "popularity" real,
    "vote_average" real,
    "genres" "text"[] DEFAULT '{}'::"text"[],
    "cast_fully_fetched" boolean DEFAULT false,
    "fetched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ag_films" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."watchlist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."watchlist_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."watchlist_id_seq" OWNED BY "public"."WatchList"."id";



ALTER TABLE ONLY "public"."WatchList" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."watchlist_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."AwardShows"
    ADD CONSTRAINT "AwardShows_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."AwardShows"
    ADD CONSTRAINT "AwardShows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AwardShows"
    ADD CONSTRAINT "AwardShows_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."EventCategories"
    ADD CONSTRAINT "EventCategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EventNominees"
    ADD CONSTRAINT "EventNominees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EventUserPicks"
    ADD CONSTRAINT "EventUserPicks_category_id_user_id_key" UNIQUE ("category_id", "user_id");



ALTER TABLE ONLY "public"."EventUserPicks"
    ADD CONSTRAINT "EventUserPicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Events"
    ADD CONSTRAINT "Events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Events"
    ADD CONSTRAINT "Events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."FilmRatings"
    ADD CONSTRAINT "FilmRatings_pkey" PRIMARY KEY ("film_slug", "rating");



ALTER TABLE ONLY "public"."Films"
    ADD CONSTRAINT "Films_pkey" PRIMARY KEY ("film_slug");



ALTER TABLE ONLY "public"."MFLScoringMetrics"
    ADD CONSTRAINT "MFLScoringMetrics_metric_id_key" UNIQUE ("metric_id");



ALTER TABLE ONLY "public"."MFLScoringMetrics"
    ADD CONSTRAINT "MFLScoringMetrics_pkey" PRIMARY KEY ("metric_id");



ALTER TABLE ONLY "public"."MFLScoringTally"
    ADD CONSTRAINT "MFLScoringTally_pkey" PRIMARY KEY ("scoring_id");



ALTER TABLE ONLY "public"."MFLScoringTally"
    ADD CONSTRAINT "MFLScoringTally_scoring_id_key" UNIQUE ("scoring_id");



ALTER TABLE ONLY "public"."UserFilms"
    ADD CONSTRAINT "UserFilms_pkey" PRIMARY KEY ("film_slug", "lbusername");



ALTER TABLE ONLY "public"."UserRatings"
    ADD CONSTRAINT "UserRatings_pkey" PRIMARY KEY ("username", "rating");



ALTER TABLE ONLY "public"."Users"
    ADD CONSTRAINT "Users_pkey" PRIMARY KEY ("lbusername");



ALTER TABLE ONLY "public"."ag_acted_in"
    ADD CONSTRAINT "ag_acted_in_pkey" PRIMARY KEY ("actor_tmdb_id", "movie_tmdb_id");



ALTER TABLE ONLY "public"."ag_actors"
    ADD CONSTRAINT "ag_actors_pkey" PRIMARY KEY ("tmdb_id");



ALTER TABLE ONLY "public"."ag_films"
    ADD CONSTRAINT "ag_films_pkey" PRIMARY KEY ("tmdb_id");



ALTER TABLE ONLY "public"."MFLMovieData"
    ADD CONSTRAINT "mfl_movie_data_pkey" PRIMARY KEY ("title");



ALTER TABLE ONLY "public"."MFLUserMovies"
    ADD CONSTRAINT "mfl_user_movies_pkey" PRIMARY KEY ("username", "title");



ALTER TABLE ONLY "public"."WatchList"
    ADD CONSTRAINT "watchlist_letterboxd_uri_key" UNIQUE ("letterboxd_uri");



ALTER TABLE ONLY "public"."WatchList"
    ADD CONSTRAINT "watchlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_event_categories_event_id" ON "public"."EventCategories" USING "btree" ("event_id");



CREATE INDEX "idx_event_nominees_category_id" ON "public"."EventNominees" USING "btree" ("category_id");



CREATE INDEX "idx_event_user_picks_category_id" ON "public"."EventUserPicks" USING "btree" ("category_id");



CREATE INDEX "idx_event_user_picks_user_id" ON "public"."EventUserPicks" USING "btree" ("user_id");



CREATE INDEX "idx_events_award_show_id" ON "public"."Events" USING "btree" ("award_show_id");



CREATE INDEX "idx_events_slug" ON "public"."Events" USING "btree" ("slug");



CREATE INDEX "idx_watchlist_date_added" ON "public"."WatchList" USING "btree" ("date_added");



CREATE INDEX "idx_watchlist_letterboxd_uri" ON "public"."WatchList" USING "btree" ("letterboxd_uri");



CREATE INDEX "idx_watchlist_name" ON "public"."WatchList" USING "btree" ("name");



CREATE INDEX "idx_watchlist_year" ON "public"."WatchList" USING "btree" ("year");



ALTER TABLE ONLY "public"."EventCategories"
    ADD CONSTRAINT "EventCategories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EventNominees"
    ADD CONSTRAINT "EventNominees_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."EventCategories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EventUserPicks"
    ADD CONSTRAINT "EventUserPicks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."EventCategories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EventUserPicks"
    ADD CONSTRAINT "EventUserPicks_nominee_id_fkey" FOREIGN KEY ("nominee_id") REFERENCES "public"."EventNominees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Events"
    ADD CONSTRAINT "Events_award_show_id_fkey" FOREIGN KEY ("award_show_id") REFERENCES "public"."AwardShows"("id");



ALTER TABLE ONLY "public"."ag_acted_in"
    ADD CONSTRAINT "ag_acted_in_actor_tmdb_id_fkey" FOREIGN KEY ("actor_tmdb_id") REFERENCES "public"."ag_actors"("tmdb_id");



ALTER TABLE ONLY "public"."ag_acted_in"
    ADD CONSTRAINT "ag_acted_in_movie_tmdb_id_fkey" FOREIGN KEY ("movie_tmdb_id") REFERENCES "public"."ag_films"("tmdb_id");



ALTER TABLE ONLY "public"."MFLScoringTally"
    ADD CONSTRAINT "fk_metric_id" FOREIGN KEY ("metric_id") REFERENCES "public"."MFLScoringMetrics"("metric_id");



CREATE POLICY "Allow authenticated users to delete watchlist items" ON "public"."WatchList" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to insert watchlist items" ON "public"."WatchList" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to update watchlist items" ON "public"."WatchList" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view watchlist" ON "public"."WatchList" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."AwardShows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EventCategories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EventNominees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EventUserPicks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FilmRatings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Films" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MFLMovieData" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MFLScoringMetrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MFLScoringTally" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MFLUserMovies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserFilms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserRatings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."WatchList" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_acted_in" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_actors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_films" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."get_all_user_films"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_user_films"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_user_films"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hater_rankings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_hater_rankings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hater_rankings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mfl_movie_scores"("p_film_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_mfl_movie_scores"("p_film_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mfl_movie_scores"("p_film_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mfl_movies"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_mfl_movies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mfl_movies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_missing_films"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_missing_films"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_missing_films"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_movie_swap"("user1" character varying, "user2" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_movie_swap"("user1" character varying, "user2" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_movie_swap"("user1" character varying, "user2" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rankings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rankings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rankings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rating_distribution_all"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rating_distribution_all"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rating_distribution_all"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_films_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_films_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_films_count"() TO "service_role";


















GRANT ALL ON TABLE "public"."AwardShows" TO "anon";
GRANT ALL ON TABLE "public"."AwardShows" TO "authenticated";
GRANT ALL ON TABLE "public"."AwardShows" TO "service_role";



GRANT ALL ON TABLE "public"."EventCategories" TO "anon";
GRANT ALL ON TABLE "public"."EventCategories" TO "authenticated";
GRANT ALL ON TABLE "public"."EventCategories" TO "service_role";



GRANT ALL ON TABLE "public"."EventNominees" TO "anon";
GRANT ALL ON TABLE "public"."EventNominees" TO "authenticated";
GRANT ALL ON TABLE "public"."EventNominees" TO "service_role";



GRANT ALL ON TABLE "public"."EventUserPicks" TO "anon";
GRANT ALL ON TABLE "public"."EventUserPicks" TO "authenticated";
GRANT ALL ON TABLE "public"."EventUserPicks" TO "service_role";



GRANT ALL ON TABLE "public"."Events" TO "anon";
GRANT ALL ON TABLE "public"."Events" TO "authenticated";
GRANT ALL ON TABLE "public"."Events" TO "service_role";



GRANT ALL ON TABLE "public"."FilmRatings" TO "anon";
GRANT ALL ON TABLE "public"."FilmRatings" TO "authenticated";
GRANT ALL ON TABLE "public"."FilmRatings" TO "service_role";



GRANT ALL ON TABLE "public"."Films" TO "anon";
GRANT ALL ON TABLE "public"."Films" TO "authenticated";
GRANT ALL ON TABLE "public"."Films" TO "service_role";



GRANT ALL ON TABLE "public"."MFLMovieData" TO "anon";
GRANT ALL ON TABLE "public"."MFLMovieData" TO "authenticated";
GRANT ALL ON TABLE "public"."MFLMovieData" TO "service_role";



GRANT ALL ON TABLE "public"."MFLScoringMetrics" TO "anon";
GRANT ALL ON TABLE "public"."MFLScoringMetrics" TO "authenticated";
GRANT ALL ON TABLE "public"."MFLScoringMetrics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."MFLScoringMetrics_metric_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."MFLScoringMetrics_metric_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."MFLScoringMetrics_metric_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."MFLScoringTally" TO "anon";
GRANT ALL ON TABLE "public"."MFLScoringTally" TO "authenticated";
GRANT ALL ON TABLE "public"."MFLScoringTally" TO "service_role";



GRANT ALL ON SEQUENCE "public"."MFLScoringTally_scoring_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."MFLScoringTally_scoring_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."MFLScoringTally_scoring_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."MFLUserMovies" TO "anon";
GRANT ALL ON TABLE "public"."MFLUserMovies" TO "authenticated";
GRANT ALL ON TABLE "public"."MFLUserMovies" TO "service_role";



GRANT ALL ON TABLE "public"."UserFilms" TO "anon";
GRANT ALL ON TABLE "public"."UserFilms" TO "authenticated";
GRANT ALL ON TABLE "public"."UserFilms" TO "service_role";



GRANT ALL ON TABLE "public"."UserRatings" TO "anon";
GRANT ALL ON TABLE "public"."UserRatings" TO "authenticated";
GRANT ALL ON TABLE "public"."UserRatings" TO "service_role";



GRANT ALL ON TABLE "public"."Users" TO "anon";
GRANT ALL ON TABLE "public"."Users" TO "authenticated";
GRANT ALL ON TABLE "public"."Users" TO "service_role";



GRANT ALL ON TABLE "public"."WatchList" TO "anon";
GRANT ALL ON TABLE "public"."WatchList" TO "authenticated";
GRANT ALL ON TABLE "public"."WatchList" TO "service_role";



GRANT ALL ON TABLE "public"."ag_acted_in" TO "anon";
GRANT ALL ON TABLE "public"."ag_acted_in" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_acted_in" TO "service_role";



GRANT ALL ON TABLE "public"."ag_actors" TO "anon";
GRANT ALL ON TABLE "public"."ag_actors" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_actors" TO "service_role";



GRANT ALL ON TABLE "public"."ag_films" TO "anon";
GRANT ALL ON TABLE "public"."ag_films" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_films" TO "service_role";



GRANT ALL ON SEQUENCE "public"."watchlist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."watchlist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."watchlist_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


