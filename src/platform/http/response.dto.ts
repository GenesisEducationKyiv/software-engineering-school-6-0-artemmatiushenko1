import z from 'zod';

export const CommonSuccessResponseDtoSchema = z.object({
  message: z.string(),
});

export type CommonSuccessResponseDto = z.infer<
  typeof CommonSuccessResponseDtoSchema
>;

export const CommonErrorResponseDtoSchema = z.object({
  code: z.string(),
  error: z.string(),
});

export type CommonErrorResponseDto = z.infer<
  typeof CommonErrorResponseDtoSchema
>;
