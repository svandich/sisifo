import { BadRequestException, HttpException } from '@nestjs/common';

/** Re-throws service-layer errors as 4xx responses, preserving Nest HttpExceptions as-is. */
export function toHttpError(err: unknown): never {
  if (err instanceof HttpException) throw err;
  throw new BadRequestException(err instanceof Error ? err.message : 'Error inesperado.');
}
