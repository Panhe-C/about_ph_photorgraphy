import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Work {
  title: string;
  folder: string;
  caption: string;
  year: string;
  ratio: string;
  print: string;
  photos: string[];
}

function scanFolder(folder: string): string[] {
  const dir = join('public', 'images', folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f))
    .sort()
    .map(f => `/images/${folder}/${f}`);
}

function folderToTitle(folder: string): string {
  return folder
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Auto-discover all subfolders in public/images/ (skip special dirs)
const imageDir = join('public', 'images');
const folders = existsSync(imageDir)
  ? readdirSync(imageDir, { withFileTypes: true })
      .filter(d => d.isDirectory() || d.isSymbolicLink())
      .map(d => d.name)
      .filter(n => n !== 'photos' && !n.startsWith('.'))
      .sort()
  : [];

const works: Work[] = folders.map(folder => ({
  title: folderToTitle(folder),
  folder,
  caption: '',
  year: '2023',
  ratio: '3:2',
  print: 'Pigment proof',
  photos: scanFolder(folder),
}));

export function getWorks(): Work[] {
  return works;
}

export function getWork(index: number): Work | undefined {
  return works[index];
}
