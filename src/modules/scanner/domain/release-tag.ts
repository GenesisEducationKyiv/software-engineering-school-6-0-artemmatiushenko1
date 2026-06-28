import { InvalidReleaseTagError } from './errors.js';

export class ReleaseTag {
  private constructor(public readonly value: string) {
    this.value = value;
  }

  static fromString(value: string): ReleaseTag {
    if (value.length === 0) {
      throw new InvalidReleaseTagError(value);
    }

    return new ReleaseTag(value);
  }

  equals(other: ReleaseTag): boolean {
    return this.value === other.value;
  }
}
