import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { discoverWorks, optimizedVariantUrl } from '../src/lib/image-assets.mjs';

test('discovers work folders and exposes original, display, and thumbnail URLs', () => {
  const root = mkdtempSync(join(tmpdir(), 'ph-images-'));
  const imageDir = join(root, 'images');

  mkdirSync(join(imageDir, 'Baikal 2024'), { recursive: true });
  mkdirSync(join(imageDir, 'Tokyo 2024'), { recursive: true });
  mkdirSync(join(imageDir, 'photos'), { recursive: true });
  mkdirSync(join(imageDir, '.hidden'), { recursive: true });
  writeFileSync(join(imageDir, 'Baikal 2024', 'photo 01.jpg'), 'fake');
  writeFileSync(join(imageDir, 'Baikal 2024', 'notes.txt'), 'skip');
  writeFileSync(join(imageDir, 'loose.jpg'), 'not-a-series');

  try {
    const works = discoverWorks({
      imageDir,
      optimizedBasePath: '/images-optimized',
    });

    assert.equal(works.length, 1);
    assert.equal(works[0].title, 'Baikal 2024');
    assert.deepEqual(works[0].photos, [
      {
        src: '/images-optimized/Baikal%202024/photo%2001-1600.webp',
        thumb: '/images-optimized/Baikal%202024/photo%2001-320.webp',
        alt: 'Baikal 2024',
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('builds optimized variant URLs for standalone images', () => {
  assert.equal(
    optimizedVariantUrl('/images/mqm6vcct-DJI_20221008120715_0011_D.jpg', 2400),
    '/images-optimized/mqm6vcct-DJI_20221008120715_0011_D-2400.webp',
  );
});

test('discovers works from committed optimized images when source images are unavailable', () => {
  const root = mkdtempSync(join(tmpdir(), 'ph-optimized-'));
  const optimizedDir = join(root, 'public', 'images-optimized');

  mkdirSync(join(optimizedDir, 'Tokyo 2024'), { recursive: true });
  mkdirSync(join(optimizedDir, '.hidden'), { recursive: true });
  writeFileSync(join(optimizedDir, 'Tokyo 2024', 'photo 01-320.webp'), 'thumb');
  writeFileSync(join(optimizedDir, 'Tokyo 2024', 'photo 01-1600.webp'), 'display');
  writeFileSync(join(optimizedDir, 'Tokyo 2024', 'photo 02-320.webp'), 'thumb without display');

  try {
    const works = discoverWorks({
      imageDir: join(root, 'source-images'),
      optimizedDir,
      optimizedBasePath: '/images-optimized',
    });

    assert.equal(works.length, 1);
    assert.equal(works[0].title, 'Tokyo 2024');
    assert.deepEqual(works[0].photos, [
      {
        src: '/images-optimized/Tokyo%202024/photo%2001-1600.webp',
        thumb: '/images-optimized/Tokyo%202024/photo%2001-320.webp',
        alt: 'Tokyo 2024',
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
