#!/usr/bin/env node
/**
 * Fetch form variant Pokemon from Zukan API and PokeAPI
 * Adds Mega Evolutions, regional forms, Gigantamax, etc. to data/pokemon.json
 * Usage: node scripts/fetch-forms.js
 */

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../data/pokemon.json');
const ZUKAN_API = 'https://zukan.pokemon.co.jp/zukan-api/api';
const POKE_API = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 4;

const ZUKAN_TYPES = {
  0: null, 1: 'ノーマル', 2: 'ほのお', 3: 'みず', 4: 'くさ', 5: 'でんき',
  6: 'こおり', 7: 'かくとう', 8: 'どく', 9: 'じめん', 10: 'ひこう',
  11: 'エスパー', 12: 'むし', 13: 'いわ', 14: 'ゴースト', 15: 'ドラゴン',
  16: 'あく', 17: 'はがね', 18: 'フェアリー',
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
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) { console.error('  FETCH FAIL:', url, e.message); return null; }
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Cache
const abilityCache = new Map();
const speciesCache = new Map();
const evoChainCache = new Map();

async function getAbilityJA(abilityName) {
  if (abilityCache.has(abilityName)) return abilityCache.get(abilityName);
  const data = await fetchJSON(`${POKE_API}/ability/${abilityName}/`);
  if (!data) { abilityCache.set(abilityName, abilityName); return abilityName; }
  const ja = data.names.find(n => n.language.name === 'ja' || n.language.name === 'ja-Hrkt')?.name || abilityName;
  abilityCache.set(abilityName, ja);
  return ja;
}

async function getSpecies(dexId) {
  if (speciesCache.has(dexId)) return speciesCache.get(dexId);
  const data = await fetchJSON(`${POKE_API}/pokemon-species/${dexId}/`);
  speciesCache.set(dexId, data);
  return data;
}

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
      const r = findDepth(next, name, depth + 1);
      if (r !== -1) return r;
    }
    return -1;
  }
  function countChain(node) {
    if (!node.evolves_to || node.evolves_to.length === 0) return 1;
    return 1 + Math.max(...node.evolves_to.map(countChain));
  }
  const depth = findDepth(chain, pokemonName, 0);
  const total = countChain(chain);
  if (depth === -1) return total;
  return total - depth;
}

function getFormGeneration(zukanPokemon) {
  const sub_name = zukanPokemon.sub_name || '';
  if (zukanPokemon.mega_flg) return 6;
  if (zukanPokemon.genshi_flg) return 6; // Primal Reversion (ORAS = Gen 6)
  if (zukanPokemon.kyodai_flg || sub_name.includes('キョダイマックス')) return 8;
  if (sub_name.includes('アローラ')) return 7;
  if (sub_name.includes('ガラル')) return 8;
  if (sub_name.includes('ヒスイ') || sub_name.includes('500ねんまえ')) return 8;
  if (sub_name.includes('パルデア')) return 9;
  return null; // Unknown, will use base Pokemon generation
}

async function runInBatches(items, fn, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`\r  Progress: ${Math.min(i + concurrency, items.length)}/${items.length}`);
  }
  console.log();
  return results;
}

async function processForm(zukanEntry, baseSpecies, pokemonFormData, syntheticName) {
  const no = parseInt(zukanEntry.no);
  const sub = zukanEntry.sub;

  // Get Zukan detail for this form
  const zukanNo = zukanEntry.zukan_no;
  const zukanDetail = await fetchJSON(`${ZUKAN_API}/detail/${zukanNo}`);
  if (!zukanDetail) return null;

  const zp = zukanDetail.pokemon;

  // Types from Zukan type IDs
  const types = [ZUKAN_TYPES[zp.type_1], ZUKAN_TYPES[zp.type_2]].filter(Boolean);

  // Abilities from Zukan detail (already in Japanese)
  const abilities = (zukanDetail.abilities || []).map(a => a.name).filter(Boolean);

  // Height and weight from Zukan
  const height = parseFloat(zp.takasa);
  const weight = parseFloat(zp.omosa);

  // Generation
  let generation = getFormGeneration(zp);
  if (generation === null && baseSpecies) {
    const genStr = baseSpecies.generation?.name || 'generation-i';
    const part = genStr.replace('generation-', '');
    generation = romanToNum(part);
  }

  // Species data (same as base Pokemon)
  const genderRate = baseSpecies?.gender_rate ?? -1;
  const eggGroups = (baseSpecies?.egg_groups || [])
    .map(g => EGG_GROUPS_JA[g.name] || g.name)
    .filter(Boolean);

  // Base stat total from PokeAPI form data
  let baseStatTotal = 0;
  if (pokemonFormData) {
    baseStatTotal = pokemonFormData.stats.reduce((s, st) => s + st.base_stat, 0);
  }

  // Evolution count - forms share evolution chain with base
  let evolutionCount = 1;
  if (baseSpecies?.evolution_chain?.url) {
    // For Mega/Gigantamax, get base Pokemon English name
    const baseName = pokemonFormData ?
      (pokemonFormData.name.split('-')[0]) : baseSpecies.name;
    evolutionCount = await getEvolutionCount(baseSpecies.evolution_chain.url, baseSpecies.name);
  }

  // Sprite: use Zukan image or PokeAPI sprite
  const sprite = zp.image_m || (pokemonFormData?.sprites?.front_default) || null;

  // Name
  const name = zp.name;
  const nameEn = syntheticName || pokemonFormData?.name || '';

  // Unique ID: use PokeAPI ID if available, otherwise generate from dex+sub
  const id = (!syntheticName && pokemonFormData?.id) ? pokemonFormData.id : (90000 + no * 10 + sub);

  const subName = zp.sub_name || '';
  // For display: regional forms keep base name + sub_name, Mega forms have full name
  const displayName = subName ? `${name}（${subName}）` : name;

  return {
    id,
    name: displayName,
    nameEn,
    generation,
    gameTitle: GEN_GAMES[generation] || '',
    types,
    abilities,
    height,
    weight,
    genderRate,
    evolutionCount,
    eggGroups,
    baseStatTotal,
    sprite,
    isForm: true,
    baseDexNo: no,
    formIndex: sub,
  };
}

async function main() {
  console.log('Loading existing pokemon.json...');
  const existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  const existingIds = new Set(existing.map(p => p.id));
  const existingNames = new Set(existing.map(p => p.nameEn));
  console.log(`  Loaded ${existing.length} Pokemon`);

  console.log('Fetching Zukan index (all 1302 entries)...');
  const zukanData = await fetchJSON(`${ZUKAN_API}/search/?limit=2000&page=1`);
  if (!zukanData) { console.error('Failed to fetch Zukan data'); process.exit(1); }

  const allEntries = zukanData.results;
  const formEntries = allEntries.filter(e => e.sub > 0);
  console.log(`  Found ${formEntries.length} form variants`);

  console.log('Fetching PokeAPI species and form data...');
  const formsToProcess = [];

  await runInBatches(formEntries, async (entry) => {
    const no = parseInt(entry.no);

    // Get species data
    const species = await getSpecies(no);
    if (!species) return;

    // Get the PokeAPI form name from varieties
    const varieties = species.varieties || [];
    const variety = varieties[entry.sub];

    if (!variety) {
      // Fallback: no PokeAPI variety - use base Pokemon data
      const baseName = species.name;
      if (existingNames.has(`${baseName}-${entry.no}-${entry.sub}`)) return;
      const basePokemonData = await fetchJSON(`${POKE_API}/pokemon/${baseName}/`);
      // Use synthetic name to avoid de-dup with base
      formsToProcess.push({ entry, species, pokemonData: basePokemonData, syntheticName: `${baseName}-form-${entry.sub}` });
      return;
    }

    const formName = variety.pokemon.name;

    // Skip if already in our data
    if (existingNames.has(formName)) return;

    // Fetch the form's Pokemon data from PokeAPI
    const pokemonData = await fetchJSON(`${POKE_API}/pokemon/${formName}/`);

    formsToProcess.push({ entry, species, pokemonData });
  }, CONCURRENCY);

  console.log(`\nProcessing ${formsToProcess.length} new forms...`);
  const newPokemon = [];

  await runInBatches(formsToProcess, async ({ entry, species, pokemonData, syntheticName }) => {
    const result = await processForm(entry, species, pokemonData, syntheticName);
    if (result) newPokemon.push(result);
  }, CONCURRENCY);

  console.log(`\nAdded ${newPokemon.length} form variants`);

  // Combine and sort: base Pokemon first (by id 1-1025), then forms (10001+)
  const combined = [...existing, ...newPokemon];
  combined.sort((a, b) => a.id - b.id);

  // Remove duplicates by id
  const seen = new Set();
  const deduped = combined.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(deduped, null, 2), 'utf8');
  console.log(`Saved ${deduped.length} Pokemon to ${OUTPUT}`);

  // Summary
  const cats = {
    mega: newPokemon.filter(p => p.nameEn.includes('-mega') || p.nameEn.includes('-primal')).length,
    alolan: newPokemon.filter(p => p.nameEn.includes('-alola')).length,
    galarian: newPokemon.filter(p => p.nameEn.includes('-galar')).length,
    hisuian: newPokemon.filter(p => p.nameEn.includes('-hisui')).length,
    paldean: newPokemon.filter(p => p.nameEn.includes('-paldea')).length,
    gmax: newPokemon.filter(p => p.nameEn.includes('-gmax')).length,
    other: newPokemon.filter(p => !p.nameEn.match(/(mega|primal|alola|galar|hisui|paldea|gmax)/)).length,
  };
  console.log('Summary:', cats);
}

main().catch(e => { console.error(e); process.exit(1); });
