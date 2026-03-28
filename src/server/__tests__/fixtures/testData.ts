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
  },
  {
    filmSlug: 'test-film-classic',
    title: 'Classic Test Film',
    lbRating: 4.8,
    url: 'https://letterboxd.com/film/test-film-classic',
    poster: 'https://example.com/poster2.jpg',
  },
  {
    filmSlug: 'test-film-divisive',
    title: 'Divisive Test Film',
    lbRating: 2.5,
    url: 'https://letterboxd.com/film/test-film-divisive',
    poster: 'https://example.com/poster3.jpg',
  },
  {
    filmSlug: 'test-film-obscure',
    title: 'Obscure Test Film',
    lbRating: 3.5,
    url: 'https://letterboxd.com/film/test-film-obscure',
    poster: 'https://example.com/poster4.jpg',
  },
  {
    filmSlug: 'test-film-new',
    title: 'New Test Film',
    lbRating: 3.8,
    url: 'https://letterboxd.com/film/test-film-new',
    poster: 'https://example.com/poster5.jpg',
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

  // User with film not in Films table (for testing missing films)
  { lbusername: 'test_user_active', filmSlug: 'test-film-unlisted', title: 'Unlisted Test Film', rating: 3.0, liked: false },
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

  // Movies active has but minimal doesn't
  movieSwapActiveToMinimal: ['Divisive Test Film', 'New Test Film', 'Obscure Test Film', 'Unlisted Test Film'],

  // Missing films (in UserFilms but not in Films)
  missingFilms: ['test-film-unlisted'],

  // Hater rankings order (by average rating, ascending)
  // Non-discord excluded from discord-only queries
  haterRankingsOrder: ['test_user_active', 'test_user_minimal'], // active avg ~3.1, minimal avg ~4.7
};
