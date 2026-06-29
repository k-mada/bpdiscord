/**
 * Test fixtures for database tests
 * These provide deterministic test data for all test scenarios
 */

import type {
  NewUser,
  NewUserRating,
  NewUserFilm,
  NewFilm,
  NewAwardShow,
  NewEvent,
  NewEventCategory,
  NewEventNominee,
} from '../../db/schema';

// ===========================
// Users
// ===========================

export const testUsers: NewUser[] = [
  {
    lbusername: 'test_user_active',
    displayName: 'Active Test User',
    followers: 100,
    following: 50,
    numberOfLists: 5,
    isDiscord: true,
  },
  {
    lbusername: 'test_user_minimal',
    displayName: 'Minimal User',
    followers: 0,
    following: 0,
    numberOfLists: 0,
    isDiscord: true,
  },
  {
    lbusername: 'test_user_non_discord',
    displayName: 'Non-Discord User',
    followers: 25,
    following: 10,
    numberOfLists: 2,
    isDiscord: false,
  },
  {
    lbusername: 'test_user_no_films',
    displayName: 'User Without Films',
    followers: 5,
    following: 5,
    numberOfLists: 0,
    isDiscord: true,
  },
];

// ===========================
// User Ratings (rating distribution histogram)
// ===========================

export const testUserRatings: NewUserRating[] = [
  // Active user - varied distribution
  { username: 'test_user_active', rating: 0.5, count: 2 },
  { username: 'test_user_active', rating: 1.0, count: 5 },
  { username: 'test_user_active', rating: 1.5, count: 8 },
  { username: 'test_user_active', rating: 2.0, count: 15 },
  { username: 'test_user_active', rating: 2.5, count: 25 },
  { username: 'test_user_active', rating: 3.0, count: 40 },
  { username: 'test_user_active', rating: 3.5, count: 50 },
  { username: 'test_user_active', rating: 4.0, count: 35 },
  { username: 'test_user_active', rating: 4.5, count: 15 },
  { username: 'test_user_active', rating: 5.0, count: 5 },

  // Minimal user - only high ratings (a "lover")
  { username: 'test_user_minimal', rating: 4.0, count: 10 },
  { username: 'test_user_minimal', rating: 4.5, count: 15 },
  { username: 'test_user_minimal', rating: 5.0, count: 25 },

  // Non-discord user - low ratings (a "hater")
  { username: 'test_user_non_discord', rating: 1.0, count: 20 },
  { username: 'test_user_non_discord', rating: 1.5, count: 15 },
  { username: 'test_user_non_discord', rating: 2.0, count: 10 },
  { username: 'test_user_non_discord', rating: 2.5, count: 5 },
];

// ===========================
// Films (master film list)
// ===========================

export const testFilms: NewFilm[] = [
  {
    filmSlug: 'test-film-popular',
    title: 'Popular Test Film',
    lbRating: 4.2,
    url: 'https://letterboxd.com/film/test-film-popular',
    poster: 'https://example.com/poster1.jpg',
    releaseYear: 2020,
  },
  {
    filmSlug: 'test-film-classic',
    title: 'Classic Test Film',
    lbRating: 4.8,
    url: 'https://letterboxd.com/film/test-film-classic',
    poster: 'https://example.com/poster2.jpg',
    releaseYear: 2020,
  },
  {
    filmSlug: 'test-film-divisive',
    title: 'Divisive Test Film',
    lbRating: 2.5,
    url: 'https://letterboxd.com/film/test-film-divisive',
    poster: 'https://example.com/poster3.jpg',
    releaseYear: 2021,
  },
  {
    filmSlug: 'test-film-obscure',
    title: 'Obscure Test Film',
    lbRating: 3.5,
    url: 'https://letterboxd.com/film/test-film-obscure',
    poster: 'https://example.com/poster4.jpg',
    releaseYear: 2021,
  },
  {
    filmSlug: 'test-film-new',
    title: 'New Test Film',
    lbRating: 3.8,
    url: 'https://letterboxd.com/film/test-film-new',
    poster: 'https://example.com/poster5.jpg',
    releaseYear: 2022,
  },
  // releaseYear intentionally omitted (NULL) — must be excluded by any year filter
  {
    filmSlug: 'test-film-unlisted',
    title: 'Unlisted Test Film',
    lbRating: 3.0,
    url: 'https://letterboxd.com/film/test-film-unlisted',
    poster: 'https://example.com/poster6.jpg',
  },
  // Alphabetically-first title but watched-but-unrated below — exercises the
  // movie-swap NULLS LAST sort. Watched only by the non-discord user, so it
  // stays out of discord-only aggregates.
  {
    filmSlug: 'test-film-unrated',
    title: 'Aardvark Unrated Film',
    lbRating: 4.0,
    url: 'https://letterboxd.com/film/test-film-unrated',
    poster: 'https://example.com/poster7.jpg',
    releaseYear: 2023,
  },
];

// ===========================
// User Films (what users have watched/rated)
// ===========================

export const testUserFilms: NewUserFilm[] = [
  // Active user - watched all films
  { lbusername: 'test_user_active', filmSlug: 'test-film-popular', title: 'Popular Test Film', rating: 4.0, liked: true },
  { lbusername: 'test_user_active', filmSlug: 'test-film-classic', title: 'Classic Test Film', rating: 5.0, liked: true },
  { lbusername: 'test_user_active', filmSlug: 'test-film-divisive', title: 'Divisive Test Film', rating: 1.5, liked: false },
  { lbusername: 'test_user_active', filmSlug: 'test-film-obscure', title: 'Obscure Test Film', rating: 3.5, liked: false },
  { lbusername: 'test_user_active', filmSlug: 'test-film-new', title: 'New Test Film', rating: 4.0, liked: true },

  // Minimal user - only watched popular films
  { lbusername: 'test_user_minimal', filmSlug: 'test-film-popular', title: 'Popular Test Film', rating: 4.5, liked: true },
  { lbusername: 'test_user_minimal', filmSlug: 'test-film-classic', title: 'Classic Test Film', rating: 5.0, liked: true },

  // Non-discord user - different taste
  { lbusername: 'test_user_non_discord', filmSlug: 'test-film-popular', title: 'Popular Test Film', rating: 2.0, liked: false },
  { lbusername: 'test_user_non_discord', filmSlug: 'test-film-divisive', title: 'Divisive Test Film', rating: 4.5, liked: true },
  { lbusername: 'test_user_non_discord', filmSlug: 'test-film-obscure', title: 'Obscure Test Film', rating: 1.0, liked: false },

  // Active user has watched the unlisted film too.
  { lbusername: 'test_user_active', filmSlug: 'test-film-unlisted', title: 'Unlisted Test Film', rating: 3.0, liked: false },

  // Attached to the non-discord user so it doesn't affect any discord-only
  // count assertions. Used to exercise dbGetMissingFilms.
  { lbusername: 'test_user_non_discord', filmSlug: 'test-film-no-data', title: 'No Data Film', rating: 2.5, liked: false },

  // Watched but NOT rated (rating null), non-discord user — drives the
  // movie-swap NULLS LAST assertion. Title sorts first alphabetically, so it
  // appearing last proves unrated films sink below rated ones.
  { lbusername: 'test_user_non_discord', filmSlug: 'test-film-unrated', title: 'Aardvark Unrated Film', rating: null, liked: false },
];

// ===========================
// Award Shows
// ===========================

export const testAwardShows: Omit<NewAwardShow, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Academy Awards',
    slug: 'academy-awards',
    description: 'The Oscars',
  },
  {
    name: 'Golden Globes',
    slug: 'golden-globes',
    description: 'Hollywood Foreign Press',
  },
];

// Note: events, categories, and nominees require FK IDs that are
// generated at insert time, so they are created dynamically in tests.
// These templates provide the shape for convenience.

export const testEventTemplate = {
  name: '97th Academy Awards',
  slug: '97th-academy-awards',
  year: 2025,
  editionNumber: 97,
  status: 'active',
} satisfies Omit<NewEvent, 'id' | 'awardShowId' | 'createdAt' | 'updatedAt'>;

export const testCategoryTemplates: Omit<NewEventCategory, 'id' | 'eventId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Best Picture', displayOrder: 1, displayMode: 'movie_first' },
  { name: 'Best Director', displayOrder: 2, displayMode: 'person_first' },
  { name: 'Best Actor', displayOrder: 3, displayMode: 'person_first' },
];

export const testNomineeTemplates: Omit<NewEventNominee, 'id' | 'categoryId' | 'createdAt' | 'updatedAt'>[] = [
  { personName: null, movieOrShowName: 'Anora', isWinner: false },
  { personName: null, movieOrShowName: 'The Brutalist', isWinner: false },
  { personName: null, movieOrShowName: 'A Complete Unknown', isWinner: false },
  { personName: 'Sean Baker', movieOrShowName: 'Anora', isWinner: false },
  { personName: 'Brady Corbet', movieOrShowName: 'The Brutalist', isWinner: false },
  { personName: 'Timothée Chalamet', movieOrShowName: 'A Complete Unknown', isWinner: false },
  { personName: 'Adrien Brody', movieOrShowName: 'The Brutalist', isWinner: false },
];

// ===========================
// Expected Test Results (for assertions)
// ===========================

export const expectedResults = {
  // Total films watched by discord users (distinct titles)
  discordUserFilmsCount: 6, // 5 films from active + 2 from minimal (1 overlap) + 1 unlisted = 6 distinct

  // Movies in common between active and minimal users
  moviesInCommonActiveMinimal: ['Classic Test Film', 'Popular Test Film'],

  // Movie swap (bidirectional). Lists are rating-DESC, then title-ASC, with
  // unrated films last. Order is significant — do not sort before asserting.
  movieSwap: {
    // swap(active, minimal): active has seen everything minimal has, so A's
    // recs are empty; minimal gets active's extras, highest-rated first.
    activeMinimalRecsForA: [] as string[],
    activeMinimalRecsForB: [
      'New Test Film', // 4.0
      'Obscure Test Film', // 3.5
      'Unlisted Test Film', // 3.0
      'Divisive Test Film', // 1.5
    ],
    // swap(minimal, non_discord): A's recs prove NULLS LAST — the unrated
    // 'Aardvark' sorts last despite its alphabetically-first title.
    minimalNonDiscordRecsForA: [
      'Divisive Test Film', // 4.5
      'No Data Film', // 2.5
      'Obscure Test Film', // 1.0
      'Aardvark Unrated Film', // null → last
    ],
    minimalNonDiscordRecsForB: ['Classic Test Film'], // 5.0
  },

  // Missing films (in UserFilms but not in Films)
  missingFilms: ['test-film-no-data'],

  // Hater rankings order (by average rating, ascending)
  // Non-discord excluded from discord-only queries
  haterRankingsOrder: ['test_user_active', 'test_user_minimal'], // active avg ~3.1, minimal avg ~4.7
};
