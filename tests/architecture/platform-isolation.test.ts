import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PLATFORM_ROOT = 'src/platform';

const FORBIDDEN_IMPORT = /from ['"][^'"]*\/modules\//;

type Violation = { file: string; line: number; text: string };

const listSourceFiles = (dir: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if (path.endsWith('.ts') && !path.endsWith('.test.ts')) {
      files.push(path);
    }
  }

  return files;
};

const findViolations = (file: string): Violation[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((text, index) =>
      FORBIDDEN_IMPORT.test(text)
        ? [{ file, line: index + 1, text: text.trim() }]
        : [],
    );

describe('architecture: platform isolation', () => {
  it('platform does not import from feature modules', () => {
    const violations = listSourceFiles(PLATFORM_ROOT).flatMap(findViolations);

    expect(violations.map((v) => `${v.file}:${v.line}  ${v.text}`)).toEqual([]);
  });
});
