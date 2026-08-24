import { z } from 'zod';

export const SpaceIdSchema = z.string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_\-]+$/, 'Invalid space ID format');

export const ObjectNameSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_]+$/, 'Invalid object name format');

export const SQLQuerySchema = z.string()
  .max(10000)
  .refine(
    (val) => /^\s*SELECT\s/i.test(val),
    'Only SELECT queries are allowed'
  )
  .refine(
    (val) => !/\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE)\b/i.test(val),
    'Dangerous SQL keywords are not allowed'
  );

export const ABAPContentSchema = z.string()
  .min(10)
  .max(100000);

export const FileTypeSchema = z.enum([
  'CDS_VIEW',
  'ABAP_REPORT',
  'BW_TRANSFORMATION',
  'FUNCTION_MODULE',
]);

export const ConversionConfigSchema = z.object({
  abapContent: ABAPContentSchema,
  fileType: FileTypeSchema,
  targetName: ObjectNameSchema,
  spaceId: SpaceIdSchema,
  includeFields: z.array(ObjectNameSchema).optional(),
  excludeFields: z.array(ObjectNameSchema).optional(),
});

export const DeployConfigSchema = z.object({
  spaceId: SpaceIdSchema,
  objectName: ObjectNameSchema,
  objectType: z.enum(['local-table', 'view', 'analytic-model', 'data-flow']),
  definition: z.record(z.unknown()),
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}
