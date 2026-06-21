import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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

function isFresh(sourcePath, outputPath) {
  if (!existsSync(outputPath)) return false;
  return statSync(outputPath).mtimeMs >= statSync(sourcePath).mtimeMs;
}

async function writeVariant(sourcePath, outputPath, width) {
  if (isFresh(sourcePath, outputPath)) return false;

  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: width <= THUMB_WIDTH ? 72 : 84, effort: 5 })
    .toFile(outputPath);

  return true;
}

async function optimizeFile(sourcePath, outputDir, widths) {
  let written = 0;

  for (const width of widths) {
    const outputPath = variantPath(outputDir, sourcePath, width);
    if (await writeVariant(sourcePath, outputPath, width)) written += 1;
  }

  return written;
}

async function optimizeSeriesFolder(folderName) {
  const sourceDir = join(inputRoot, folderName);
  const outputDir = join(outputRoot, folderName);
  const files = readdirSync(sourceDir).filter(isImageFile).sort();
  let written = 0;

  for (const file of files) {
    written += await optimizeFile(join(sourceDir, file), outputDir, seriesWidths);
  }

  return { files: files.length, written };
}

async function main() {
  if (!existsSync(inputRoot)) {
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

  for (const folder of folders) {
    const result = await optimizeSeriesFolder(folder);
    sourceFiles += result.files;
    written += result.written;
  }

  for (const file of standaloneImages) {
    sourceFiles += 1;
    written += await optimizeFile(join(inputRoot, file), outputRoot, standaloneWidths);
  }

  console.log(
    `Optimized ${sourceFiles} source image(s); wrote ${written} new/updated variant(s) to ${outputRoot}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
