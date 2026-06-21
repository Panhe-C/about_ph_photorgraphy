import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('optimizer reuses committed variants when source files are Git LFS pointers', () => {
  const root = mkdtempSync(join(tmpdir(), 'ph-optimize-'));
  const inputRoot = join(root, 'source-images');
  const outputRoot = join(root, 'public', 'images-optimized');
  const sourceDir = join(inputRoot, 'Bangkok 2024');
  const outputDir = join(outputRoot, 'Bangkok 2024');
  const sourcePath = join(sourceDir, 'photo.jpg');
  const oldDate = new Date('2020-01-01T00:00:00Z');

  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    sourcePath,
    [
      'version https://git-lfs.github.com/spec/v1',
      'oid sha256:1234567890abcdef',
      'size 12345678',
      '',
    ].join('\n'),
  );
  writeFileSync(join(outputDir, 'photo-320.webp'), 'committed thumbnail');
  writeFileSync(join(outputDir, 'photo-1600.webp'), 'committed display image');
  utimesSync(join(outputDir, 'photo-320.webp'), oldDate, oldDate);
  utimesSync(join(outputDir, 'photo-1600.webp'), oldDate, oldDate);

  try {
    const result = spawnSync(
      process.execPath,
      ['scripts/optimize-images.mjs', inputRoot, outputRoot],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /reused 2 committed variant/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
