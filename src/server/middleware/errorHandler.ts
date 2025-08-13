import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiResponse } from '../types';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: ApiResponse = {
      error: 'Validation failed',
      details: errors.array()
    };
    res.status(400).json(response);
    return;
  }
  next();
};

export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(err.stack);
  const response: ApiResponse = {
    error: 'Something went wrong!'
  };
  res.status(500).json(response);
};