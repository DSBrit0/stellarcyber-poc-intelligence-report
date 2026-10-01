import type { z } from 'zod'

/** An error with an HTTP status and a stable machine-readable code the web app translates. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code)
  }
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new HttpError(400, 'validation', 'Invalid request', result.error.issues.map((i) => ({ path: i.path, message: i.message })))
  }
  return result.data
}

export const notFound = () => new HttpError(404, 'not_found')
export const forbidden = () => new HttpError(403, 'forbidden')
