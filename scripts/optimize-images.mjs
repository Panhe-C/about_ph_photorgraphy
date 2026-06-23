import { closeSync, existsSync, mkdirSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import sharp from 'sharp';

import { DISPLAY_WIDTH, HERO_WIDTH, THUMB_WIDTH, isImageFile } from '../src/lib/image-assets.mjs';

const inputRoot = process.argv[2] || (existsSync('source-images') ? 'source-images' : 'public/images');
const outputRoot = process.argv[3] || 'public/images-optimized';
const seriesWidths = [THUMB_WIDTH, DISPLAY_WIDTH];
const standaloneWidths = [HERO_WIDTH];

function variantPath(outputDir, sourceFile, width) {
  const extension = extname(sourceFile);
  const name = basename(sourceFile, extension);
  return join(outputDir, `${name}-${width}.webp`);
}

function isGitLfsPointer(sourcePath) {
  const fd = openSync(sourcePath, 'r');
  const buffer = Buffer.alloc(128);

  try {
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer
      .subarray(0, bytesRead)
      .toString('utf8')
      .startsWith('version https://git-lfs.github.com/spec/v1');
  } finally {
    closeSync(fd);
  }
}

function isFresh(sourcePath, outputPath) {
  if (!existsSync(outputPath)) return false;
  return statSync(outputPath).mtimeMs >= statSync(sourcePath).mtimeMs;
}

async function writeVariant(sourcePath, outputPath, width) {
  if (isGitLfsPointer(sourcePath)) {
    if (existsSync(outputPath)) return 'reused';

    throw new Error(
      [
        `Source file is a Git LFS pointer, not an image: ${sourcePath}`,
        `Missing committed optimized variant: ${outputPath}`,
        'Run `pnpm optimize:images` locally with Git LFS images available, then commit public/images-optimized.',
      ].join('\n'),
    );
  }

  if (isFresh(sourcePath, outputPath)) return false;

  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: width <= THUMB_WIDTH ? 72 : 84, effort: 5 })
    .toFile(outputPath);

  return 'written';
}

async function optimizeFile(sourcePath, outputDir, widths) {
  const result = { written: 0, reused: 0 };

  for (const width of widths) {
    const outputPath = variantPath(outputDir, sourcePath, width);
    const status = await writeVariant(sourcePath, outputPath, width);
    if (status === 'written') result.written += 1;
    if (status === 'reused') result.reused += 1;
  }

  return result;
}

async function optimizeSeriesFolder(folderName) {
  const sourceDir = join(inputRoot, folderName);
  const outputDir = join(outputRoot, folderName);
  const files = readdirSync(sourceDir).filter(isImageFile).sort();
  const totals = { files: files.length, written: 0, reused: 0 };

  for (const file of files) {
    const result = await optimizeFile(join(sourceDir, file), outputDir, seriesWidths);
    totals.written += result.written;
    totals.reused += result.reused;
  }

  return totals;
}

async function main() {
  if (!existsSync(inputRoot)) {
    if (existsSync(outputRoot)) {
      console.log(
        `Skipping image optimization because ${inputRoot} is unavailable; using committed variants in ${outputRoot}.`,
      );
      return;
    }

    throw new Error(`Image source folder not found: ${inputRoot}`);
  }

  mkdirSync(outputRoot, { recursive: true });

  const entries = readdirSync(inputRoot, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((name) => name !== 'photos' && !name.startsWith('.'))
    .sort();
  const standaloneImages = entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => entry.name)
    .sort();

  let sourceFiles = 0;
  let written = 0;
  let reused = 0;

  for (const folder of folders) {
    const result = await optimizeSeriesFolder(folder);
    sourceFiles += result.files;
    written += result.written;
    reused += result.reused;
  }

  for (const file of standaloneImages) {
    sourceFiles += 1;
    const result = await optimizeFile(join(inputRoot, file), outputRoot, standaloneWidths);
    written += result.written;
    reused += result.reused;
  }

  console.log(
    `Optimized ${sourceFiles} source image(s); wrote ${written} new/updated variant(s), reused ${reused} committed variant(s) in ${outputRoot}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
