import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { apiError } from './api-error';

/** Validates a request body against a Zod schema from libs/contracts. */
export class ZodBodyPipe<T extends z.ZodType> implements PipeTransform<
  unknown,
  z.infer<T>
> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'invalid_body',
        z.prettifyError(parsed.error),
      );
    }
    return parsed.data;
  }
}
