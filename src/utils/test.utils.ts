import z from 'zod';

export const parseResponse = <T extends z.ZodTypeAny>(
  response: string,
  schema: T,
): z.infer<T> => {
  return schema.parse(JSON.parse(response));
};
