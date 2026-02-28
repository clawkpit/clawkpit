import type { Response } from "express";

export const ApiErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ApiErrorCodeType = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCodeType;
    message: string;
    details: Record<string, unknown>;
  };
}

/**
 * Send a standardized API error response.
 * Response shape: { error: { code, message, details } }
 */
export function sendApiError(
  res: Response,
  status: number,
  code: ApiErrorCodeType,
  message: string,
  details: Record<string, unknown> = {}
): Response {
  return res.status(status).json({
    error: {
      code,
      message,
      details,
    },
  });
}
