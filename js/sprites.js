(() => {
/* Tiny pixel-art sprites rendered as crisp SVG. One char = one pixel. */
const PAL = {
  B: '#1a73ff', L: '#6aaeff', D: '#0b2f9e', N: '#061235',
  W: '#ffffff', Y: '#ffc83d', G: '#b8860b', K: '#030814',
};

const MAPS = {
  coin: [
    '..GGGG..',
    '.GYYYYG.',
    'GYWYYYYG',
    'GYWYGYYG',
    'GYYYGYYG',
    'GYYYGYYG',
    '.GYYYYG.',
    '..GGGG..',
  ],
  chip: [
    '...W.W.W.W...',
    '.............',
    '..LLLLLLLLL..',
    'W.LBBBBBBBL.W',
    '..LBDDDDDBL..',
    'W.LBDYYYDBL.W',
    '..LBDYWYDBL..',
    'W.LBDYYYDBL.W',
    '..LBDDDDDBL..',
    'W.LBBBBBBBL.W',
    '..LLLLLLLLL..',
    '.............',
    '...W.W.W.W...',
  ],
  controller: [
    '..BBBBBBBBB..',
    '.BBBBBBBBBBB.',
    'BBBWBBBBBYBBB',
    'BBWWWBBBYBYBB',
    'BBBWBBBBBYBBB',
    'BBBBBBBBBBBBB',
    'BBBBB...BBBBB',
    '.BBB.....BBB.',
  ],
  briefcase: [
    '....BBBBB....',
    '....B...B....',
    'BBBBBBBBBBBBB',
    'BLLLLLLLLLLLB',
    'BBBBBBYBBBBBB',
    'BBBBBBYBBBBBB',
    'BBBBBBBBBBBBB',
    'BBBBBBBBBBBBB',
  ],
  book: [
    'BBBBB...BBBBB',
    'BWWWWB.BWWWWB',
    'BWLLWWBWWLLWB',
    'BWWWWWBWWWWWB',
    'BWLLLWBWLLLWB',
    'BWWWWWBWWWWWB',
    'BBBBBBBBBBBBB',
    '.....BBB.....',
  ],
  check: [
    '.......Y',
    '......YY',
    'Y....YY.',
    'YY..YY..',
    '.YYYY...',
    '..YY....',
  ],
  star: [
    '..L..',
    '..L..',
    'LLWLL',
    '..L..',
    '..L..',
  ],
  bolt: [
    '...YY',
    '..YY.',
    '.YYYY',
    '..YY.',
    '.YY..',
    'YY...',
  ],
  fullscreen: [
    'WWW...WWW',
    'W.......W',
    'W.......W',
    '.........',
    '.........',
    'W.......W',
    'W.......W',
    'WWW...WWW',
  ],
};

function sprite(name) {
  const map = MAPS[name];
  if (!map) return '';
  const h = map.length, w = map[0].length;
  let rects = '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = PAL[map[y][x]];
      if (c) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${rects}</svg>`;
}

/* Fill every [data-sprite] element inside root. */
function hydrateSprites(root = document) {
  root.querySelectorAll('[data-sprite]').forEach(el => {
    if (!el.dataset.spriteDone) {
      el.innerHTML = sprite(el.dataset.sprite);
      el.dataset.spriteDone = '1';
    }
  });
}

window.Sprites = { sprite, hydrateSprites };
})();
