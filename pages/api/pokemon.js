const { getPokemonList } = require('../../lib/pokemonData');

export default function handler(req, res) {
  const { generations } = req.query;
  const gens = generations
    ? generations.split(',').map(Number).filter(n => n >= 1 && n <= 9)
    : null;
  const list = getPokemonList(gens);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.json(list);
}
