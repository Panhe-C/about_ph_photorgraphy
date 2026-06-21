// Works data — add a folder under src/assets/images/ with the series name,
// drop photos in, and add a matching import.meta.glob call below.
// Photos are auto-discovered from the filesystem at build time.

const photosGlob = (modules: Record<string, unknown>) =>
  Object.values(modules)
    .map((m: any) => m?.default?.src || '')
    .filter(Boolean)
    .sort();

const thresholdPhotos  = photosGlob(import.meta.glob('/src/assets/images/threshold-rooms/*.{jpg,jpeg,JPG,JPEG}',  { eager: true }));
const perimeterPhotos  = photosGlob(import.meta.glob('/src/assets/images/perimeter-studies/*.{jpg,jpeg,JPG,JPEG}', { eager: true }));
const windowPhotos     = photosGlob(import.meta.glob('/src/assets/images/window-index/*.{jpg,jpeg,JPG,JPEG}',     { eager: true }));
const verticalPhotos   = photosGlob(import.meta.glob('/src/assets/images/vertical-rooms/*.{jpg,jpeg,JPG,JPEG}',  { eager: true }));
const floraPhotos      = photosGlob(import.meta.glob('/src/assets/images/late-flora/*.{jpg,jpeg,JPG,JPEG}',      { eager: true }));

export interface Work {
  title: string;
  series: string;
  caption: string;
  year: string;
  ratio: string;
  print: string;
  photos: string[];
}

const works: Work[] = [
  {
    title: 'Interior',
    series: 'Threshold Rooms',
    caption: 'Late light held against a quiet wall.',
    year: '2023', ratio: '3:2', print: 'Pigment proof',
    photos: thresholdPhotos,
  },
  {
    title: 'Perimeter',
    series: 'Perimeter Studies',
    caption: 'A temporary edge before the city starts again.',
    year: '2023', ratio: '3:2', print: 'Silver study',
    photos: perimeterPhotos,
  },
  {
    title: 'Window',
    series: 'Window Index',
    caption: 'Reflection, condensation, and a room outside the frame.',
    year: '2023', ratio: '3:2', print: 'Pigment proof',
    photos: windowPhotos,
  },
  {
    title: 'Stairwell',
    series: 'Vertical Rooms',
    caption: 'A passage held between public noise and private light.',
    year: '2023', ratio: '2:3', print: 'Contact sheet',
    photos: verticalPhotos,
  },
  {
    title: 'Greenhouse',
    series: 'Late Flora',
    caption: 'Leaves become a surface for time and moisture.',
    year: '2023', ratio: '3:2', print: 'Pigment proof',
    photos: floraPhotos,
  },
  {
    title: 'Night Wall',
    series: 'Perimeter Studies',
    caption: 'A dark wall interrupted by one small field of light.',
    year: '2023', ratio: '3:2', print: 'Silver study',
    photos: perimeterPhotos,
  },
];

export function getWorks() {
  return works;
}

export function getWork(index: number): Work | undefined {
  return works[index];
}
