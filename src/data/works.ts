// Works data — edit this array to manage your portfolio.

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
    title: 'Interior 01',
    series: 'Threshold Rooms',
    caption: 'Late light held against a quiet wall.',
    year: '2023',
    ratio: '3:2',
    print: 'Pigment proof',
    photos: [
      '/images/threshold-rooms/_C001369.jpg',
      '/images/threshold-rooms/_C001498.jpg',
      '/images/threshold-rooms/_C001499.jpg',
      '/images/threshold-rooms/_C001506.jpg',
    ],
  },
  {
    title: 'Perimeter 02',
    series: 'Perimeter Studies',
    caption: 'A temporary edge before the city starts again.',
    year: '2023',
    ratio: '3:2',
    print: 'Silver study',
    photos: [
      '/images/perimeter-studies/CPH01731.jpg',
      '/images/perimeter-studies/_C002700.JPG',
      '/images/perimeter-studies/_C002701.JPG',
      '/images/perimeter-studies/_C002704.JPG',
      '/images/perimeter-studies/_C002727.JPG',
    ],
  },
  {
    title: 'Window 03',
    series: 'Window Index',
    caption: 'Reflection, condensation, and a room outside the frame.',
    year: '2023',
    ratio: '3:2',
    print: 'Pigment proof',
    photos: [
      '/images/window-index/_CPH2033.jpeg',
      '/images/window-index/_CPH2057.jpeg',
      '/images/window-index/_CPH2077.jpeg',
      '/images/window-index/_CPH2169.jpeg',
      '/images/window-index/_CPH2181.jpeg',
    ],
  },
  {
    title: 'Stairwell 04',
    series: 'Vertical Rooms',
    caption: 'A passage held between public noise and private light.',
    year: '2023',
    ratio: '2:3',
    print: 'Contact sheet',
    photos: [
      '/images/vertical-rooms/_CPH2198.jpeg',
      '/images/vertical-rooms/_CPH2317.jpeg',
      '/images/vertical-rooms/_CPH2342.jpeg',
      '/images/vertical-rooms/_CPH2382.jpeg',
    ],
  },
  {
    title: 'Greenhouse 05',
    series: 'Late Flora',
    caption: 'Leaves become a surface for time and moisture.',
    year: '2023',
    ratio: '3:2',
    print: 'Pigment proof',
    photos: [
      '/images/late-flora/_CPH2386.jpeg',
      '/images/late-flora/_CPH2517.jpeg',
      '/images/late-flora/_CPH2620.jpeg',
      '/images/late-flora/_CPH2633.jpeg',
      '/images/late-flora/_CPH2642.jpeg',
    ],
  },
  {
    title: 'Night Wall 06',
    series: 'Perimeter Studies',
    caption: 'A dark wall interrupted by one small field of light.',
    year: '2023',
    ratio: '3:2',
    print: 'Silver study',
    photos: [
      '/images/perimeter-studies/CPH01731.jpg',
      '/images/perimeter-studies/_C002700.JPG',
      '/images/perimeter-studies/_C002701.JPG',
      '/images/perimeter-studies/_C002704.JPG',
    ],
  },
];

export function getWorks() {
  return works;
}

export function getWork(index: number): Work | undefined {
  return works[index];
}
