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
        caption: '',
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reads per-photo captions from _captions.txt', () => {
  const root = mkdtempSync(join(tmpdir(), 'ph-captions-'));
  const imageDir = join(root, 'images');

  mkdirSync(join(imageDir, 'Baikal 2024'), { recursive: true });
  writeFileSync(join(imageDir, 'Baikal 2024', 'photo 01.jpg'), 'fake');
  writeFileSync(join(imageDir, 'Baikal 2024', 'photo 02.jpg'), 'fake');
  writeFileSync(
    join(imageDir, 'Baikal 2024', '_captions.txt'),
    '# comment\nphoto 01.jpg = 湖边的木屋\nphoto 02.jpg = Wooden hut = by the lake\nignored line\n',
  );

  try {
    const works = discoverWorks({
      imageDir,
      optimizedBasePath: '/images-optimized',
    });

    assert.equal(works[0].photos[0].caption, '湖边的木屋');
    assert.equal(works[0].photos[1].caption, 'Wooden hut = by the lake');
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

test('reads sidecar CN/ENG description files from the work folder', () => {
  const root = mkdtempSync(join(tmpdir(), 'ph-desc-'));
  const imageDir = join(root, 'images');

  mkdirSync(join(imageDir, 'Baikal 2024'), { recursive: true });
  mkdirSync(join(imageDir, 'Tokyo 2024'), { recursive: true });
  writeFileSync(join(imageDir, 'Baikal 2024', 'photo 01.jpg'), 'fake');
  writeFileSync(join(imageDir, 'Baikal 2024', '_description_cn.txt'), '  湖水很蓝\n');
  writeFileSync(join(imageDir, 'Baikal 2024', '_description_eng.txt'), 'Blue lake\n');
  writeFileSync(join(imageDir, 'Tokyo 2024', 'photo 01.jpg'), 'fake');

  try {
    const works = discoverWorks({
      imageDir,
      optimizedBasePath: '/images-optimized',
    });

    assert.equal(works[0].descriptionCn, '湖水很蓝');
    assert.equal(works[0].descriptionEng, 'Blue lake');
    assert.equal(works[1].descriptionCn, '');
    assert.equal(works[1].descriptionEng, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
        caption: '',
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
