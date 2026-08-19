/**
 * Content library: colours, shapes, letters, words and themed object sets.
 *
 * Every visual in the game is either an emoji or a generated SVG, so the whole
 * app ships with zero binary assets and works fully offline.
 */

/* -------------------------------------------------------------------------- */
/* Colours                                                                     */
/* -------------------------------------------------------------------------- */

export const COLORS = [
  { id: 'red', name: 'Red', hex: '#f2333d', ink: '#fff' },
  { id: 'orange', name: 'Orange', hex: '#ff8a1e', ink: '#40210a' },
  { id: 'yellow', name: 'Yellow', hex: '#ffd21f', ink: '#4a3a00' },
  { id: 'green', name: 'Green', hex: '#2fbf59', ink: '#fff' },
  { id: 'blue', name: 'Blue', hex: '#2f7ded', ink: '#fff' },
  { id: 'purple', name: 'Purple', hex: '#8a4fe0', ink: '#fff' },
  { id: 'pink', name: 'Pink', hex: '#ff6fa8', ink: '#4a0f28' },
  { id: 'brown', name: 'Brown', hex: '#96613a', ink: '#fff' },
  { id: 'black', name: 'Black', hex: '#2b2b35', ink: '#fff' },
  { id: 'white', name: 'White', hex: '#fdfdfd', ink: '#2a2350' },
  { id: 'grey', name: 'Grey', hex: '#9aa0ae', ink: '#22252c' },
  { id: 'cyan', name: 'Light blue', hex: '#37d3ea', ink: '#04333a' },
];

export const colorById = (id) => COLORS.find((c) => c.id === id);

/** The six colours a 2–4 year old meets first. */
export const BASIC_COLOR_IDS = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];

/** Paint mixing facts used by the colour-mixing game. */
export const COLOR_MIXES = [
  { a: 'red', b: 'yellow', result: 'orange' },
  { a: 'blue', b: 'yellow', result: 'green' },
  { a: 'red', b: 'blue', result: 'purple' },
  { a: 'red', b: 'white', result: 'pink' },
  { a: 'black', b: 'white', result: 'grey' },
  { a: 'blue', b: 'white', result: 'cyan' },
  { a: 'red', b: 'green', result: 'brown' },
];

/** Real-world things that are strongly associated with one colour. */
export const COLOR_OBJECTS = {
  red: ['🍎', '🍓', '🌹', '🚒', '🍅'],
  orange: ['🍊', '🥕', '🎃', '🦊', '🏀'],
  yellow: ['🍌', '🌻', '🧀', '⭐', '🐤'],
  green: ['🥦', '🐢', '🌲', '🥝', '🐸'],
  blue: ['🫐', '🐳', '💙', '🧊', '🌊'],
  purple: ['🍇', '🍆', '💜', '🔮', '🪻'],
  pink: ['🌸', '🐷', '🩰', '💗', '🦩'],
  brown: ['🐻', '🍫', '🥔', '🪵', '🐴'],
  black: ['🐈‍⬛', '🖤', '🎩', '🐜', '🕷️'],
  white: ['🥚', '☁️', '🦢', '🐑', '🤍'],
  grey: ['🐘', '🐺', '🌫️', '🪨', '🦈'],
  cyan: ['💎', '🐬', '🩵', '🧴', '🌀'],
};

/* -------------------------------------------------------------------------- */
/* Shapes — drawn as SVG polygons/paths in a 100×100 box                       */
/* -------------------------------------------------------------------------- */

function regularPolygon(sides, rotation = -90, radius = 46, cx = 50, cy = 50) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = ((rotation + (360 / sides) * i) * Math.PI) / 180;
    points.push(`${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`);
  }
  return points.join(' ');
}

export const SHAPES = [
  { id: 'circle', name: 'Circle', sides: 0, kind: 'circle', r: 46 },
  { id: 'square', name: 'Square', sides: 4, kind: 'poly', points: '8,8 92,8 92,92 8,92' },
  { id: 'triangle', name: 'Triangle', sides: 3, kind: 'poly', points: regularPolygon(3) },
  { id: 'rectangle', name: 'Rectangle', sides: 4, kind: 'poly', points: '5,22 95,22 95,78 5,78' },
  { id: 'oval', name: 'Oval', sides: 0, kind: 'ellipse', rx: 47, ry: 32 },
  { id: 'diamond', name: 'Diamond', sides: 4, kind: 'poly', points: '50,4 96,50 50,96 4,50' },
  { id: 'star', name: 'Star', sides: 10, kind: 'poly', points: star5() },
  { id: 'heart', name: 'Heart', sides: 0, kind: 'path', d: heartPath() },
  { id: 'pentagon', name: 'Pentagon', sides: 5, kind: 'poly', points: regularPolygon(5) },
  { id: 'hexagon', name: 'Hexagon', sides: 6, kind: 'poly', points: regularPolygon(6, 0) },
  { id: 'octagon', name: 'Octagon', sides: 8, kind: 'poly', points: regularPolygon(8, 22.5) },
  { id: 'trapezoid', name: 'Trapezoid', sides: 4, kind: 'poly', points: '24,20 76,20 96,82 4,82' },
  { id: 'cross', name: 'Cross', sides: 12, kind: 'poly', points: crossPoints() },
  { id: 'arrow', name: 'Arrow', sides: 7, kind: 'poly', points: '4,36 58,36 58,10 96,50 58,90 58,64 4,64' },
  { id: 'crescent', name: 'Crescent', sides: 0, kind: 'path', d: crescentPath() },
  { id: 'semicircle', name: 'Half circle', sides: 1, kind: 'path', d: 'M4,70 A46,46 0 0 1 96,70 Z' },
];

function star5() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 48 : 20;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function heartPath() {
  return 'M50,90 C18,68 4,50 4,33 A25,25 0 0 1 50,20 A25,25 0 0 1 96,33 C96,50 82,68 50,90 Z';
}

function crescentPath() {
  return 'M62,6 A46,46 0 1 0 62,94 A36,36 0 1 1 62,6 Z';
}

function crossPoints() {
  return '36,6 64,6 64,36 94,36 94,64 64,64 64,94 36,94 36,64 6,64 6,36 36,36';
}

export const shapeById = (id) => SHAPES.find((s) => s.id === id);

/** Shapes a 3-year-old should meet first. */
export const BASIC_SHAPE_IDS = ['circle', 'square', 'triangle', 'star', 'heart', 'rectangle'];

/* -------------------------------------------------------------------------- */
/* Letters & words                                                             */
/* -------------------------------------------------------------------------- */

/** Each letter maps to picture words that start with its sound. */
export const ALPHABET = [
  { letter: 'A', words: [['apple', '🍎'], ['ant', '🐜'], ['avocado', '🥑']] },
  { letter: 'B', words: [['ball', '⚽'], ['banana', '🍌'], ['bear', '🐻']] },
  { letter: 'C', words: [['cat', '🐱'], ['car', '🚗'], ['cake', '🍰']] },
  { letter: 'D', words: [['dog', '🐶'], ['duck', '🦆'], ['drum', '🥁']] },
  { letter: 'E', words: [['egg', '🥚'], ['elephant', '🐘'], ['eye', '👁️']] },
  { letter: 'F', words: [['fish', '🐟'], ['frog', '🐸'], ['flower', '🌸']] },
  { letter: 'G', words: [['goat', '🐐'], ['grapes', '🍇'], ['guitar', '🎸']] },
  { letter: 'H', words: [['hat', '👒'], ['horse', '🐴'], ['house', '🏠']] },
  { letter: 'I', words: [['ice cream', '🍦'], ['igloo', '🛖'], ['insect', '🐞']] },
  { letter: 'J', words: [['juice', '🧃'], ['jellyfish', '🪼'], ['jacket', '🧥']] },
  { letter: 'K', words: [['key', '🔑'], ['kite', '🪁'], ['kangaroo', '🦘']] },
  { letter: 'L', words: [['lion', '🦁'], ['leaf', '🍃'], ['lemon', '🍋']] },
  { letter: 'M', words: [['moon', '🌙'], ['monkey', '🐵'], ['mouse', '🐭']] },
  { letter: 'N', words: [['nose', '👃'], ['nut', '🥜'], ['nest', '🪹']] },
  { letter: 'O', words: [['octopus', '🐙'], ['orange', '🍊'], ['owl', '🦉']] },
  { letter: 'P', words: [['pig', '🐷'], ['pizza', '🍕'], ['pencil', '✏️']] },
  { letter: 'Q', words: [['queen', '👑'], ['question', '❓'], ['quilt', '🛏️']] },
  { letter: 'R', words: [['rabbit', '🐰'], ['rainbow', '🌈'], ['robot', '🤖']] },
  { letter: 'S', words: [['sun', '☀️'], ['snake', '🐍'], ['star', '⭐']] },
  { letter: 'T', words: [['tiger', '🐯'], ['tree', '🌳'], ['train', '🚂']] },
  { letter: 'U', words: [['umbrella', '☂️'], ['unicorn', '🦄'], ['ufo', '🛸']] },
  { letter: 'V', words: [['violin', '🎻'], ['van', '🚐'], ['volcano', '🌋']] },
  { letter: 'W', words: [['watch', '⌚'], ['whale', '🐳'], ['watermelon', '🍉']] },
  { letter: 'X', words: [['xylophone', '🎼'], ['x-ray', '🩻'], ['box', '📦']] },
  { letter: 'Y', words: [['yarn', '🧶'], ['yacht', '🛥️'], ['yo-yo', '🪀']] },
  { letter: 'Z', words: [['zebra', '🦓'], ['zipper', '🤐'], ['zero', '0️⃣']] },
];

export const LETTERS = ALPHABET.map((a) => a.letter);
export const alphaFor = (letter) => ALPHABET.find((a) => a.letter === letter);

export const VOWELS = ['A', 'E', 'I', 'O', 'U'];

/** Short three-letter words used by the spelling game. */
export const CVC_WORDS = [
  ['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['hat', '👒'], ['bus', '🚌'],
  ['cup', '☕'], ['pig', '🐷'], ['bed', '🛏️'], ['box', '📦'], ['fan', '🪭'],
  ['jam', '🍯'], ['map', '🗺️'], ['net', '🥅'], ['pen', '🖊️'], ['van', '🚐'],
  ['web', '🕸️'], ['bat', '🦇'], ['bag', '👜'], ['cow', '🐮'], ['egg', '🥚'],
  ['fox', '🦊'], ['hen', '🐔'], ['log', '🪵'], ['nut', '🥜'], ['owl', '🦉'],
  ['pot', '🍲'], ['bee', '🐝'], ['car', '🚗'], ['key', '🔑'], ['leg', '🦵'],
  ['pie', '🥧'], ['toe', '🦶'], ['ant', '🐜'], ['axe', '🪓'], ['cap', '🧢'],
  ['jet', '✈️'], ['mug', '🍺'], ['saw', '🪚'], ['tap', '🚰'], ['zip', '🤐'],
];

/** Word pairs that rhyme, for the rhyming game. */
export const RHYMES = [
  [['cat', '🐱'], ['hat', '👒'], ['bat', '🦇']],
  [['dog', '🐶'], ['log', '🪵'], ['frog', '🐸']],
  [['star', '⭐'], ['car', '🚗'], ['jar', '🫙']],
  [['bee', '🐝'], ['tree', '🌳'], ['key', '🔑']],
  [['sun', '☀️'], ['bun', '🥖'], ['run', '🏃']],
  [['moon', '🌙'], ['spoon', '🥄'], ['balloon', '🎈']],
  [['cake', '🍰'], ['snake', '🐍'], ['rake', '🍂']],
  [['house', '🏠'], ['mouse', '🐭'], ['blouse', '👚']],
  [['boat', '⛵'], ['coat', '🧥'], ['goat', '🐐']],
  [['fish', '🐟'], ['dish', '🍽️'], ['wish', '🌠']],
];

/* -------------------------------------------------------------------------- */
/* Themed object sets — used for counting, sorting, odd-one-out, memory        */
/* -------------------------------------------------------------------------- */

export const THEMES = {
  fruit: { name: 'Fruit', items: ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍐', '🍒', '🥝', '🍍'] },
  animals: { name: 'Animals', items: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁'] },
  vehicles: { name: 'Vehicles', items: ['🚗', '🚌', '🚕', '🚓', '🚑', '🚒', '🚚', '🚲', '🛵', '🚂'] },
  food: { name: 'Food', items: ['🍕', '🍔', '🌭', '🍟', '🥪', '🍞', '🧀', '🍰', '🍩', '🍪'] },
  clothes: { name: 'Clothes', items: ['👕', '👖', '👗', '🧥', '🧦', '👟', '👒', '🧢', '🧤', '🩳'] },
  toys: { name: 'Toys', items: ['🧸', '🪀', '🎈', '🪁', '🎲', '🧩', '🎯', '🚀', '🎨', '🪆'] },
  nature: { name: 'Nature', items: ['🌳', '🌸', '🌻', '🍄', '🌵', '🌊', '⛰️', '🌈', '☀️', '🌙'] },
  sea: { name: 'Sea life', items: ['🐟', '🐠', '🐬', '🐳', '🦈', '🐙', '🦀', '🐚', '🦐', '🐢'] },
  birds: { name: 'Birds', items: ['🐦', '🦅', '🦉', '🦜', '🦢', '🐧', '🕊️', '🦆', '🦩', '🐓'] },
  bugs: { name: 'Bugs', items: ['🐝', '🐛', '🦋', '🐞', '🐜', '🕷️', '🦗', '🪲'] },
  music: { name: 'Music', items: ['🎸', '🥁', '🎺', '🎻', '🎹', '🪗', '🎷', '🪘'] },
  sports: { name: 'Sports', items: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🥏'] },
  space: { name: 'Space', items: ['🚀', '🛸', '🪐', '🌟', '☄️', '🌕', '👨‍🚀', '🔭'] },
  weather: { name: 'Weather', items: ['☀️', '🌧️', '⛈️', '❄️', '🌪️', '🌤️', '🌫️', '🌈'] },
};

export const THEME_IDS = Object.keys(THEMES);

/** Flat pool of every distinct object emoji. */
export const ALL_OBJECTS = Array.from(new Set(THEME_IDS.flatMap((id) => THEMES[id].items)));

/** Categories that can be told apart at a glance — good for odd-one-out. */
export const CONTRAST_THEMES = ['fruit', 'animals', 'vehicles', 'clothes', 'toys', 'sports', 'music'];

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

export const numberWord = (n) => NUMBER_WORDS[n] ?? String(n);

/** Praise lines shown/spoken after a correct answer. */
export const PRAISE = [
  'Great job!', 'Well done!', 'You got it!', 'Awesome!', 'Perfect!',
  'Nice work!', 'Brilliant!', 'Super!', 'Fantastic!', 'Way to go!',
];

/** Gentle nudges after a wrong answer — never negative. */
export const NUDGE = [
  'Try again!', 'Almost!', 'Have another look!', 'Not quite — you can do it!',
  'Give it one more go!',
];

/** Things the mascot says on the home screen. */
export const MASCOT_LINES = [
  'What shall we play today?',
  'Ready for a puzzle?',
  'Let’s learn something new!',
  'I love playing with you!',
  'Pick a game and let’s go!',
];
