const TYPES_JA = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', grass: 'くさ',
  electric: 'でんき', ice: 'こおり', fighting: 'かくとう', poison: 'どく',
  ground: 'じめん', flying: 'ひこう', psychic: 'エスパー', bug: 'むし',
  rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン', dark: 'あく',
  steel: 'はがね', fairy: 'フェアリー',
};

const EGG_GROUPS_JA = {
  monster: 'かいじゅう', water1: 'すいちゅう1', bug: 'むし', flying: 'ひこう',
  ground: 'りくじょう', field: 'りくじょう', fairy: 'ようせい',
  plant: 'しょくぶつ', grass: 'しょくぶつ',
  humanshape: 'ひとがた', 'human-like': 'ひとがた',
  water3: 'すいちゅう3', mineral: 'こうぶつ',
  indeterminate: 'ふていけい', amorphous: 'ふていけい',
  water2: 'すいちゅう2', ditto: 'メタモン', dragon: 'ドラゴン',
  'no-eggs': 'タマゴみつからず', undiscovered: 'タマゴみつからず',
};

const GEN_GAMES = {
  1: '赤・緑', 2: '金・銀', 3: 'ルビー・サファイア', 4: 'ダイヤモンド・パール',
  5: 'ブラック・ホワイト', 6: 'X・Y', 7: 'サン・ムーン', 8: '剣・盾',
  9: 'スカーレット・バイオレット',
};

const ROMAN_MAP = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

function romanToNum(roman) {
  return ROMAN_MAP[roman.toLowerCase()] || 1;
}

function parseGeneration(genName) {
  const part = genName.replace('generation-', '');
  return romanToNum(part);
}

function formatGenderRatio(genderRate) {
  if (genderRate === -1) return '性別不明';
  if (genderRate === 0) return '♂:100% / ♀:0%';
  if (genderRate === 8) return '♂:0% / ♀:100%';
  const f = (genderRate / 8) * 100;
  const m = 100 - f;
  return `♂:${m}% / ♀:${f}%`;
}

module.exports = { TYPES_JA, EGG_GROUPS_JA, GEN_GAMES, parseGeneration, formatGenderRatio };
