import { body, param, query, ValidationChain } from 'express-validator';

export const validateUser: ValidationChain[] = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .escape(),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
];

export const validateUserUpdate: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .escape(),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
];

export const validateUserId: ValidationChain[] = [
  param('id')
    .isUUID()
    .withMessage('Invalid user ID format')
];

export const validateUUIDParam: ValidationChain[] = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format — expected a UUID')
];

// Deliberately permissive — a stricter charset would 400 on legitimate
// Letterboxd slugs, and a real miss is better served by the 404.
export const validateFilmSlug: ValidationChain[] = [
  param('filmSlug')
    .matches(/^[A-Za-z0-9._-]{1,200}$/)
    .withMessage('Invalid film slug format'),
  query('includeNonDiscord')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('includeNonDiscord must be "true" or "false"'),
];

export const validateAuth: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

export const validateSignup: ValidationChain[] = [
  ...validateUser,
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];