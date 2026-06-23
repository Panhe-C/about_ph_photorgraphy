import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

export const DISPLAY_WIDTH = 1600;
export const THUMB_WIDTH = 320;
export const HERO_WIDTH = 2400;

const IMAGE_PATTERN = /\.(jpg|jpeg|png|webp|avif)$/i;

export function isImageFile(fileName) {
  return IMAGE_PATTERN.test(fileName);
}

export function folderToTitle(folder) {
  return folder
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function publicImageUrl(basePath, folder, fileName) {
  return `${basePath}/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
}

export function optimizedVariantUrl(sourceUrl, width) {
  const lastSlash = sourceUrl.lastIndexOf('/');
  const directory = sourceUrl
    .slice(0, lastSlash)
    .replace(/^\/images(?=\/|$)/, '/images-optimized');
  const fileName = decodeURIComponent(sourceUrl.slice(lastSlash + 1));
  const extension = extname(fileName);
  const name = basename(fileName, extension);

  return `${directory}/${encodeURIComponent(`${name}-${width}.webp`)}`;
}

export function discoverWorks({
  imageDir = join('public', 'images'),
  optimizedDir = 'public/images-optimized',
  optimizedBasePath = '/images-optimized',
} = {}) {
  if (!existsSync(imageDir)) {
    return discoverOptimizedWorks({ optimizedDir, optimizedBasePath });
  }

  return readdirSync(imageDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
    .map((dirent) => dirent.name)
    .filter((folder) => folder !== 'photos' && !folder.startsWith('.'))
    .sort()
    .map((folder) => {
      const title = folderToTitle(folder);
      const folderPath = join(imageDir, folder);
      const photos = readdirSync(folderPath)
        .filter(isImageFile)
        .sort()
        .map((fileName) => {
          const optimizedOriginal = publicImageUrl(optimizedBasePath, folder, fileName);

          return {
            src: optimizedVariantUrl(optimizedOriginal, DISPLAY_WIDTH),
            thumb: optimizedVariantUrl(optimizedOriginal, THUMB_WIDTH),
            alt: title,
          };
        });

      return {
        title,
        folder,
        caption: '',
        year: '2023',
        ratio: '3:2',
        print: 'Pigment proof',
        photos,
      };
    })
    .filter((work) => work.photos.length > 0);
}

function displayVariantBaseName(fileName) {
  const suffix = `-${DISPLAY_WIDTH}.webp`;
  if (!fileName.endsWith(suffix)) return null;
  return fileName.slice(0, -suffix.length);
}

function optimizedVariantFileName(baseName, width) {
  return `${baseName}-${width}.webp`;
}

export function discoverOptimizedWorks({
  optimizedDir = 'public/images-optimized',
  optimizedBasePath = '/images-optimized',
} = {}) {
  if (!existsSync(optimizedDir)) return [];

  return readdirSync(optimizedDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
    .map((dirent) => dirent.name)
    .filter((folder) => !folder.startsWith('.'))
    .sort()
    .map((folder) => {
      const title = folderToTitle(folder);
      const folderPath = join(optimizedDir, folder);
      const files = readdirSync(folderPath).filter(isImageFile).sort();
      const fileSet = new Set(files);
      const photos = files
        .map((fileName) => displayVariantBaseName(fileName))
        .filter(Boolean)
        .filter((baseName) => fileSet.has(optimizedVariantFileName(baseName, THUMB_WIDTH)))
        .map((baseName) => {
          const displayName = optimizedVariantFileName(baseName, DISPLAY_WIDTH);
          const thumbName = optimizedVariantFileName(baseName, THUMB_WIDTH);

          return {
            src: publicImageUrl(optimizedBasePath, folder, displayName),
            thumb: publicImageUrl(optimizedBasePath, folder, thumbName),
            alt: title,
          };
        });

      return {
        title,
        folder,
        caption: '',
        year: '2023',
        ratio: '3:2',
        print: 'Pigment proof',
        photos,
      };
    })
    .filter((work) => work.photos.length > 0);
}
