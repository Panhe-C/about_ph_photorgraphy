import { discoverWorks } from '../lib/image-assets.mjs';

export interface WorkPhoto {
  src: string;
  thumb: string;
  alt: string;
}

export interface Work {
  title: string;
  folder: string;
  caption: string;
  year: string;
  ratio: string;
  print: string;
  photos: WorkPhoto[];
}

const works = discoverWorks({
  imageDir: 'source-images',
  optimizedBasePath: '/images-optimized',
}) as Work[];

export function getWorks(): Work[] {
  return works;
}

export function getWork(index: number): Work | undefined {
  return works[index];
}
