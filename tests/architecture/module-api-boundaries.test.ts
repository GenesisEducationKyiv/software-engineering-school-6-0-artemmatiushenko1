import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULES_ROOT = 'src/modules';

const IMPORT_FROM = /from ['"]([^'"]+)['"]/;

type Violation = { file: string; line: number; text: string };

const listModuleSourceFiles = (dir: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'generated') continue;
      files.push(...listModuleSourceFiles(path));
      continue;
    }
    if (path.endsWith('.ts') && !path.endsWith('.test.ts')) {
      files.push(path);
    }
  }

  return files;
};

const collectModuleSourceFiles = (): string[] =>
  readdirSync(MODULES_ROOT).flatMap((module) =>
    listModuleSourceFiles(join(MODULES_ROOT, module)),
  );

const importerModule = (file: string): string | null => {
  const match = file.match(/src\/modules\/([^/]+)\//);
  return match?.[1] ?? null;
};

const targetModule = (
  importPath: string,
  moduleNames: readonly string[],
): string | null =>
  moduleNames.find((name) => importPath.includes(`/${name}/`)) ?? null;

const crossesViaApi = (importPath: string, module: string): boolean =>
  importPath.includes(`/${module}/api/`);

const findViolations = (
  file: string,
  moduleNames: readonly string[],
): Violation[] => {
  const from = importerModule(file);
  if (!from) return [];

  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((text, index) => {
      const match = IMPORT_FROM.exec(text);
      if (!match?.[1]) return [];

      const importPath = match[1];
      const to = targetModule(importPath, moduleNames);
      if (!to || to === from || crossesViaApi(importPath, to)) return [];

      return [{ file, line: index + 1, text: text.trim() }];
    });
};

describe('architecture: module api boundaries', () => {
  it('modules import other modules only through their api folder', () => {
    const moduleNames = readdirSync(MODULES_ROOT);
    const violations = collectModuleSourceFiles().flatMap((file) =>
      findViolations(file, moduleNames),
    );

    expect(violations.map((v) => `${v.file}:${v.line}  ${v.text}`)).toEqual([]);
  });
});
