// Works data — to update with real titles and photos, edit the works array below.

export interface Work {
  title: string;
  series: string;
  caption: string;
  year: string;
  ratio: string;
  print: string;
  photo: string;
}

const works: Work[] = [
  {
    title: 'Interior 01',
    series: 'Threshold Rooms',
    caption: 'Late light held against a quiet wall.',
    year: '2023',
    ratio: '3:2',
    print: 'Pigment proof',
    photo: '/images/photos/_C001369.jpg',
  },
  {
    title: 'Perimeter 02',
    series: 'Perimeter Studies',
    caption: 'A temporary edge before the city starts again.',
    year: '2023',
    ratio: '3:2',
    print: 'Silver study',
    photo: '/images/photos/_C001498.jpg',
  },
  {
    title: 'Window 03',
    series: 'Window Index',
    caption: 'Reflection, condensation, and a room outside the frame.',
    year: '2023',
    ratio: '3:2',
    print: 'Pigment proof',
    photo: '/images/photos/_C001499.jpg',
  },
  {
    title: 'Stairwell 04',
    series: 'Vertical Rooms',
    caption: 'A passage held between public noise and private light.',
    year: '2023',
    ratio: '2:3',
    print: 'Contact sheet',
    photo: '/images/photos/_C001506.jpg',
  },
  {
    title: 'Greenhouse 05',
    series: 'Late Flora',
    caption: 'Leaves become a surface for time and moisture.',
    year: '2023',
    ratio: '3:2',
    print: 'Pigment proof',
    photo: '/images/photos/CPH01731.jpg',
  },
  {
    title: 'Night Wall 06',
    series: 'Perimeter Studies',
    caption: 'A dark wall interrupted by one small field of light.',
    year: '2023',
    ratio: '3:2',
    print: 'Silver study',
    photo: '/images/photos/_C002700.JPG',
  },
];

export function getWorks() {
  return works;
}

export function getWork(index: number): Work | undefined {
  return works[index];
}
