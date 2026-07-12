import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SHARED_KERNEL_ROOT = 'src/shared-kernel';

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dependencyNames = Object.keys(
  (
    JSON.parse(
      readFileSync(
        join(fileURLToPath(new URL('../../package.json', import.meta.url))),
        'utf8',
      ),
    ) as { dependencies: Record<string, string> }
  ).dependencies,
).sort((a, b) => b.length - a.length);

const FORBIDDEN_IMPORT = new RegExp(
  `from ['"](?:${dependencyNames.map(escapeRegex).join('|')})(?:['"]|/)`,
);

type Violation = { file: string; line: number; text: string };

const listTypeScriptFiles = (dir: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...listTypeScriptFiles(path));
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

describe('architecture: shared-kernel purity', () => {
  it('shared-kernel does not import package.json dependencies', () => {
    const violations =
      listTypeScriptFiles(SHARED_KERNEL_ROOT).flatMap(findViolations);

    expect(violations.map((v) => `${v.file}:${v.line}  ${v.text}`)).toEqual([]);
  });
});
