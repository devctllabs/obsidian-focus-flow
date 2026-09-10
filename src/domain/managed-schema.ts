import { validate as validateUuid, version as uuidVersion } from 'uuid';
import { z } from 'zod';

export const uuidV7Schema = z.string().refine(
  (value) => validateUuid(value) && uuidVersion(value) === 7,
  'Expected a UUIDv7 value.',
);

export const timestampSchema = z.string().refine(
  (value) =>
    !Number.isNaN(Date.parse(value)) && /(Z|[+-]\d{2}:\d{2})$/.test(value),
  'Expected an RFC 3339 timestamp with an offset.',
);
