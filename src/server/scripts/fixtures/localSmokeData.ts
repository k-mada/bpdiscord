/**
 * Fixture data for `yarn setup:local`. Seeded into local Supabase so the
 * homepage / stats / comparison pages actually render content instead of
 * an empty-table smoke environment.
 *
 * Sized for 5 fake Discord users + 20 films. Enough to populate:
 *   - "Movies watched by this Discord" counter
 *   - "How we rated our movies" rating-distribution histogram
 *   - "Most watched movies" carousel (no minimum threshold)
 *   - /compare and /hater-rankings pages
 *
 * NOT enough to populate the "Highest rated movies (20+ ratings)" section
 * — that needs ≥20 ratings per film, which would require ≥20 users. Left
 * empty by design; documented in CLAUDE.md.
 *
 * All Films use a placeholder poster URL pattern that points back at this
 * domain so missing-image fallbacks are exercised too.
 */

export const FIXTURE_USERS: Array<{
  lbusername: string;
  display_name: string;
  followers: number;
  following: number;
  number_of_lists: number;
}> = [
  { lbusername: "smoke-alice", display_name: "Alice (smoke)", followers: 42, following: 50, number_of_lists: 3 },
  { lbusername: "smoke-bob", display_name: "Bob (smoke)", followers: 120, following: 80, number_of_lists: 7 },
  { lbusername: "smoke-carol", display_name: "Carol (smoke)", followers: 15, following: 25, number_of_lists: 1 },
  { lbusername: "smoke-dave", display_name: "Dave (smoke)", followers: 220, following: 130, number_of_lists: 12 },
  { lbusername: "smoke-eve", display_name: "Eve (smoke)", followers: 8, following: 12, number_of_lists: 0 },
];

export const FIXTURE_FILMS: Array<{
  film_slug: string;
  title: string;
  lb_rating: number;
  poster: string;
}> = [
  { film_slug: "smoke-inception", title: "Inception", lb_rating: 4.2, poster: "https://placehold.co/230x345?text=Inception" },
  { film_slug: "smoke-parasite", title: "Parasite", lb_rating: 4.5, poster: "https://placehold.co/230x345?text=Parasite" },
  { film_slug: "smoke-whiplash", title: "Whiplash", lb_rating: 4.4, poster: "https://placehold.co/230x345?text=Whiplash" },
  { film_slug: "smoke-dune", title: "Dune", lb_rating: 4.0, poster: "https://placehold.co/230x345?text=Dune" },
  { film_slug: "smoke-arrival", title: "Arrival", lb_rating: 4.1, poster: "https://placehold.co/230x345?text=Arrival" },
  { film_slug: "smoke-anora", title: "Anora", lb_rating: 4.0, poster: "https://placehold.co/230x345?text=Anora" },
  { film_slug: "smoke-poor-things", title: "Poor Things", lb_rating: 3.9, poster: "https://placehold.co/230x345?text=Poor+Things" },
  { film_slug: "smoke-substance", title: "The Substance", lb_rating: 3.8, poster: "https://placehold.co/230x345?text=Substance" },
  { film_slug: "smoke-zone-of-interest", title: "The Zone of Interest", lb_rating: 4.0, poster: "https://placehold.co/230x345?text=Zone" },
  { film_slug: "smoke-past-lives", title: "Past Lives", lb_rating: 4.1, poster: "https://placehold.co/230x345?text=Past+Lives" },
  { film_slug: "smoke-tar", title: "TÁR", lb_rating: 3.9, poster: "https://placehold.co/230x345?text=TAR" },
  { film_slug: "smoke-everything", title: "Everything Everywhere All at Once", lb_rating: 4.3, poster: "https://placehold.co/230x345?text=EEAAO" },
  { film_slug: "smoke-banshees", title: "The Banshees of Inisherin", lb_rating: 4.1, poster: "https://placehold.co/230x345?text=Banshees" },
  { film_slug: "smoke-killers", title: "Killers of the Flower Moon", lb_rating: 4.0, poster: "https://placehold.co/230x345?text=Killers" },
  { film_slug: "smoke-oppenheimer", title: "Oppenheimer", lb_rating: 4.4, poster: "https://placehold.co/230x345?text=Oppenheimer" },
  { film_slug: "smoke-holdovers", title: "The Holdovers", lb_rating: 4.0, poster: "https://placehold.co/230x345?text=Holdovers" },
  { film_slug: "smoke-may-december", title: "May December", lb_rating: 3.6, poster: "https://placehold.co/230x345?text=May+December" },
  { film_slug: "smoke-conclave", title: "Conclave", lb_rating: 3.8, poster: "https://placehold.co/230x345?text=Conclave" },
  { film_slug: "smoke-brutalist", title: "The Brutalist", lb_rating: 4.2, poster: "https://placehold.co/230x345?text=Brutalist" },
  { film_slug: "smoke-challengers", title: "Challengers", lb_rating: 3.9, poster: "https://placehold.co/230x345?text=Challengers" },
];

// 5 "popular" films watched by all users (drives "Most watched" rankings)
// and 15 "long-tail" films distributed across users. Tuple is
// [lbusername, film_slug, rating]. liked=true when rating >= 4.
const RAW_USER_FILMS: Array<[string, string, number]> = [
  // smoke-alice — picky (avg ~3.2), 12 films
  ["smoke-alice", "smoke-inception", 3.5],
  ["smoke-alice", "smoke-parasite", 4.5],
  ["smoke-alice", "smoke-whiplash", 4.0],
  ["smoke-alice", "smoke-dune", 2.5],
  ["smoke-alice", "smoke-arrival", 3.5],
  ["smoke-alice", "smoke-anora", 4.5],
  ["smoke-alice", "smoke-poor-things", 3.0],
  ["smoke-alice", "smoke-substance", 2.0],
  ["smoke-alice", "smoke-zone-of-interest", 3.5],
  ["smoke-alice", "smoke-past-lives", 4.0],
  ["smoke-alice", "smoke-tar", 2.5],
  ["smoke-alice", "smoke-everything", 3.0],

  // smoke-bob — generous (avg ~4.0), 18 films
  ["smoke-bob", "smoke-inception", 4.5],
  ["smoke-bob", "smoke-parasite", 5.0],
  ["smoke-bob", "smoke-whiplash", 4.5],
  ["smoke-bob", "smoke-dune", 4.5],
  ["smoke-bob", "smoke-arrival", 4.0],
  ["smoke-bob", "smoke-anora", 4.0],
  ["smoke-bob", "smoke-poor-things", 4.0],
  ["smoke-bob", "smoke-substance", 3.5],
  ["smoke-bob", "smoke-zone-of-interest", 4.5],
  ["smoke-bob", "smoke-past-lives", 4.5],
  ["smoke-bob", "smoke-tar", 4.0],
  ["smoke-bob", "smoke-everything", 4.5],
  ["smoke-bob", "smoke-banshees", 4.5],
  ["smoke-bob", "smoke-killers", 4.0],
  ["smoke-bob", "smoke-oppenheimer", 5.0],
  ["smoke-bob", "smoke-holdovers", 4.0],
  ["smoke-bob", "smoke-may-december", 3.5],
  ["smoke-bob", "smoke-conclave", 4.0],

  // smoke-carol — moderate (avg ~3.5), 14 films
  ["smoke-carol", "smoke-inception", 4.0],
  ["smoke-carol", "smoke-parasite", 4.5],
  ["smoke-carol", "smoke-whiplash", 4.0],
  ["smoke-carol", "smoke-dune", 3.0],
  ["smoke-carol", "smoke-arrival", 3.5],
  ["smoke-carol", "smoke-anora", 3.0],
  ["smoke-carol", "smoke-poor-things", 4.5],
  ["smoke-carol", "smoke-substance", 2.5],
  ["smoke-carol", "smoke-zone-of-interest", 4.0],
  ["smoke-carol", "smoke-past-lives", 4.5],
  ["smoke-carol", "smoke-everything", 3.5],
  ["smoke-carol", "smoke-banshees", 3.5],
  ["smoke-carol", "smoke-oppenheimer", 3.5],
  ["smoke-carol", "smoke-conclave", 2.5],

  // smoke-dave — prolific (25 films, full range of ratings)
  ["smoke-dave", "smoke-inception", 5.0],
  ["smoke-dave", "smoke-parasite", 4.5],
  ["smoke-dave", "smoke-whiplash", 4.5],
  ["smoke-dave", "smoke-dune", 4.0],
  ["smoke-dave", "smoke-arrival", 4.5],
  ["smoke-dave", "smoke-anora", 3.5],
  ["smoke-dave", "smoke-poor-things", 3.5],
  ["smoke-dave", "smoke-substance", 3.0],
  ["smoke-dave", "smoke-zone-of-interest", 4.5],
  ["smoke-dave", "smoke-past-lives", 5.0],
  ["smoke-dave", "smoke-tar", 4.5],
  ["smoke-dave", "smoke-everything", 4.5],
  ["smoke-dave", "smoke-banshees", 4.5],
  ["smoke-dave", "smoke-killers", 4.0],
  ["smoke-dave", "smoke-oppenheimer", 5.0],
  ["smoke-dave", "smoke-holdovers", 4.0],
  ["smoke-dave", "smoke-may-december", 3.0],
  ["smoke-dave", "smoke-conclave", 4.0],
  ["smoke-dave", "smoke-brutalist", 4.5],
  ["smoke-dave", "smoke-challengers", 3.5],

  // smoke-eve — light user (10 films), low avg (~2.5)
  ["smoke-eve", "smoke-inception", 2.0],
  ["smoke-eve", "smoke-parasite", 3.5],
  ["smoke-eve", "smoke-whiplash", 3.0],
  ["smoke-eve", "smoke-dune", 1.5],
  ["smoke-eve", "smoke-arrival", 2.5],
  ["smoke-eve", "smoke-substance", 1.0],
  ["smoke-eve", "smoke-poor-things", 2.5],
  ["smoke-eve", "smoke-may-december", 0.5],
  ["smoke-eve", "smoke-brutalist", 3.0],
  ["smoke-eve", "smoke-challengers", 2.5],
];

export const FIXTURE_USER_FILMS: Array<{
  lbusername: string;
  film_slug: string;
  title: string;
  rating: number;
  liked: boolean;
}> = RAW_USER_FILMS.map(([lbusername, film_slug, rating]) => {
  const film = FIXTURE_FILMS.find((f) => f.film_slug === film_slug);
  if (!film) {
    throw new Error(`Fixture references unknown film: ${film_slug}`);
  }
  return {
    lbusername,
    film_slug,
    title: film.title,
    rating,
    liked: rating >= 4,
  };
});
