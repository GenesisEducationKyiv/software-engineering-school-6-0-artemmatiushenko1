import z from 'zod';
import { InvalidReleaseTagError } from './errors.js';

export class ReleaseTag {
  private constructor(public readonly value: string) {
    this.value = value;
  }

  static fromString(value: string): ReleaseTag {
    const parsedValue = z.string().min(1).safeParse(value);

    if (!parsedValue.success) {
      throw new InvalidReleaseTagError(`Invalid release tag: ${value}`);
    }

    return new ReleaseTag(parsedValue.data);
  }

  equals(other: ReleaseTag): boolean {
    return this.value === other.value;
  }
}
