const fs = require('fs');
const path = require('path');

let pokemonList = null;

function loadData() {
  if (pokemonList !== null) return pokemonList;
  const dataPath = path.join(process.cwd(), 'data', 'pokemon.json');
  if (fs.existsSync(dataPath)) {
    pokemonList = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`Loaded ${pokemonList.length} Pokemon from data/pokemon.json`);
  } else {
    pokemonList = [];
    console.warn('No pokemon data found. Run: npm run fetch-data');
  }
  return pokemonList;
}

function getPokemonList(generations = null) {
  const list = loadData();
  if (!generations || generations.length === 0) return list;
  return list.filter(p => generations.includes(p.generation));
}

function getPokemonById(id) {
  return loadData().find(p => p.id === id) || null;
}

function getRandomPokemon(generations = null) {
  const list = getPokemonList(generations);
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function searchPokemon(query, generations = null, limit = 10) {
  const list = getPokemonList(generations);
  const q = query.toLowerCase();
  return list
    .filter(p => p.name.includes(query) || p.nameEn.toLowerCase().includes(q))
    .slice(0, limit);
}

function getAllPokemon() {
  return loadData(); // generation filter なし・全1025匹
}

module.exports = { loadData, getPokemonList, getAllPokemon, getPokemonById, getRandomPokemon, searchPokemon };
