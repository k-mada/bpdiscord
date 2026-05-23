import { body, param, ValidationChain } from 'express-validator';

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