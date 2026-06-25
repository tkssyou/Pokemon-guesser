#!/usr/bin/env node
/**
 * Fetch Pokemon data from PokeAPI and save to data/pokemon.json
 * Usage: node scripts/fetch-pokemon.js [--limit N]
 * Default: fetches all 1025 Pokemon (Gen 1-9)
 */

const fs = require('fs');
const path = require('path');

const POKE_API = 'https://pokeapi.co/api/v2';
const OUTPUT = path.join(__dirname, '../data/pokemon.json');
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const TOTAL = limitArg ? parseInt(limitArg.split('=')[1]) : 1025;

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
function romanToNum(r) { return ROMAN_MAP[r.toLowerCase()] || 1; }

async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function getJaName(names) {
  return (names.find(n => n.language.name === 'ja') ||
          names.find(n => n.language.name === 'ja-Hrkt'))?.name || null;
}

// Cache for evolution chains
const evoChainCache = new Map();

async function getEvolutionCount(chainUrl, pokemonName) {
  if (!chainUrl) return 0;
  let chain = evoChainCache.get(chainUrl);
  if (!chain) {
    const data = await fetchJSON(chainUrl);
    if (!data) return 0;
    chain = data.chain;
    evoChainCache.set(chainUrl, chain);
  }
  function findDepth(node, name, depth) {
    if (node.species.name === name) return depth;
    for (const next of (node.evolves_to || [])) {
      const d = findDepth(next, name, depth + 1);
      if (d !== null) return d;
    }
    return null;
  }
  return findDepth(chain, pokemonName, 0) ?? 0;
}

// Cache for ability Japanese names
const abilityCache = new Map();
async function getAbilityJaName(abilityName) {
  if (abilityCache.has(abilityName)) return abilityCache.get(abilityName);
  try {
    const data = await fetchJSON(`${POKE_API}/ability/${abilityName}`);
    const jaName = data ? getJaName(data.names) || abilityName : abilityName;
    abilityCache.set(abilityName, jaName);
    return jaName;
  } catch {
    return abilityName;
  }
}

async function fetchPokemon(id) {
  const [pokemon, species] = await Promise.all([
    fetchJSON(`${POKE_API}/pokemon/${id}`),
    fetchJSON(`${POKE_API}/pokemon-species/${id}`),
  ]);
  if (!pokemon || !species) return null;

  const jaName = getJaName(species.names) || pokemon.name;
  const genNum = romanToNum(species.generation.name.replace('generation-', ''));
  const evolutionCount = await getEvolutionCount(species.evolution_chain?.url, pokemon.name);

  const abilities = await Promise.all(
    pokemon.abilities.map(a => getAbilityJaName(a.ability.name))
  );

  return {
    id: pokemon.id,
    name: jaName,
    nameEn: pokemon.name,
    generation: genNum,
    gameTitle: GEN_GAMES[genNum] || `${genNum}世代`,
    types: pokemon.types.map(t => TYPES_JA[t.type.name] || t.type.name),
    abilities,
    height: Math.round(pokemon.height * 10) / 100, // decimetres → metres
    weight: Math.round(pokemon.weight * 10) / 100,  // hectograms → kg
    genderRate: species.gender_rate,
    evolutionCount,
    eggGroups: species.egg_groups.map(e => EGG_GROUPS_JA[e.name] || e.name),
    baseStatTotal: pokemon.stats.reduce((s, st) => s + st.base_stat, 0),
    sprite: pokemon.sprites.front_default ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
  };
}

async function runBatch(ids, results, existingIds) {
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(id => fetchPokemon(id)));
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
    results.sort((a, b) => a.id - b.id);
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
    const done = results.length;
    process.stdout.write(`\rProgress: ${done}/${TOTAL}   `);
    await new Promise(r => setTimeout(r, 150));
  }
}

async function main() {
  console.log(`Fetching ${TOTAL} Pokemon from PokeAPI...`);
  if (!fs.existsSync(path.dirname(OUTPUT))) fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  let results = [];
  if (fs.existsSync(OUTPUT)) {
    results = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
    console.log(`Resuming from ${results.length} cached entries`);
  }
  const existingIds = new Set(results.map(p => p.id));
  const ids = Array.from({ length: TOTAL }, (_, i) => i + 1).filter(id => !existingIds.has(id));

  await runBatch(ids, results, existingIds);
  console.log(`\nDone! Saved ${results.length} Pokemon to ${OUTPUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
