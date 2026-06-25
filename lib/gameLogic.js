const { formatGenderRatio } = require('./translations');

function compareGeneration(guess, target) {
  const value = `${guess.gameTitle}（${guess.generation}世代）`;
  if (guess.gameTitle === target.gameTitle) return { result: 'green', value };
  if (guess.generation === target.generation) return { result: 'yellow', value };
  return { result: 'gray', value, direction: guess.generation < target.generation ? 'higher' : 'lower' };
}

function compareNumeric(guessVal, targetVal) {
  if (guessVal === targetVal) return { result: 'green', value: guessVal };
  return { result: 'gray', value: guessVal, direction: guessVal < targetVal ? 'higher' : 'lower' };
}

function compareArray(guessArr, targetArr) {
  const guessSet = new Set(guessArr);
  const targetSet = new Set(targetArr);
  const isExact = guessArr.length === targetArr.length && targetArr.every(v => guessSet.has(v));
  if (isExact) return { result: 'green', value: guessArr };
  const partial = targetArr.some(v => guessSet.has(v));
  return { result: partial ? 'yellow' : 'gray', value: guessArr };
}

function compareExact(guessVal, targetVal, display) {
  return { result: guessVal === targetVal ? 'green' : 'gray', value: display };
}

function evaluateGuess(guess, target) {
  return {
    pokemon: guess,
    generation: compareGeneration(guess, target),
    baseStatTotal: compareNumeric(guess.baseStatTotal, target.baseStatTotal),
    types: compareArray(guess.types, target.types),
    abilities: compareArray(guess.abilities, target.abilities),
    height: compareNumeric(guess.height, target.height),
    weight: compareNumeric(guess.weight, target.weight),
    genderRatio: compareExact(guess.genderRate, target.genderRate, formatGenderRatio(guess.genderRate)),
    evolutionCount: compareExact(guess.evolutionCount, target.evolutionCount, String(guess.evolutionCount)),
    eggGroups: compareArray(guess.eggGroups, target.eggGroups),
    solved: guess.id === target.id,
  };
}

module.exports = { evaluateGuess };
