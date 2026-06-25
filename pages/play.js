import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import PokemonSearch from '../components/PokemonSearch';
import GuessRow from '../components/GuessRow';

const MAX_GUESSES = 10;

const HINT_ATTRS = [
  { attr: 'eggGroups',     label: 'タマゴグループ' },
  { attr: 'genderRatio',   label: '性別比' },
  { attr: 'evolutionCount',label: '進化数' },
  { attr: 'types',         label: 'タイプ' },
  { attr: 'abilities',     label: '特性' },
  { attr: 'height',        label: '高さ' },
  { attr: 'weight',        label: '重さ' },
  { attr: 'baseStatTotal', label: '合計種族値' },
  { attr: 'generation',    label: '初登場作品（世代）' },
];

const RESULT_KEYS = ['generation', 'baseStatTotal', 'types', 'abilities', 'height', 'weight', 'genderRatio', 'evolutionCount', 'eggGroups'];

function fmtGender(r) {
  if (r === -1) return '性別不明';
  if (r === 0) return '♂:100% / ♀:0%';
  if (r === 8) return '♂:0% / ♀:100%';
  const f = (r / 8) * 100;
  return `♂:${100 - f}% / ♀:${f}%`;
}

function evaluateGuess(guess, target) {
  function cmpGen(g, t) {
    const val = `${g.gameTitle}（${g.generation}世代）`;
    if (g.gameTitle === t.gameTitle) return { result: 'green', value: val };
    if (g.generation === t.generation) return { result: 'yellow', value: val };
    return { result: 'gray', value: val, direction: g.generation < t.generation ? 'higher' : 'lower' };
  }
  function cmpNum(a, b) {
    if (a === b) return { result: 'green', value: a };
    return { result: 'gray', value: a, direction: a < b ? 'higher' : 'lower' };
  }
  function cmpArr(ga, ta) {
    const gs = new Set(ga);
    if (ga.length === ta.length && ta.every(v => gs.has(v))) return { result: 'green', value: ga };
    return { result: ta.some(v => gs.has(v)) ? 'yellow' : 'gray', value: ga };
  }
  function cmpExact(a, b, display) {
    return { result: a === b ? 'green' : 'gray', value: display };
  }
  return {
    pokemon: guess,
    generation: cmpGen(guess, target),
    baseStatTotal: cmpNum(guess.baseStatTotal, target.baseStatTotal),
    types: cmpArr(guess.types, target.types),
    abilities: cmpArr(guess.abilities, target.abilities),
    height: cmpNum(guess.height, target.height),
    weight: cmpNum(guess.weight, target.weight),
    genderRatio: cmpExact(guess.genderRate, target.genderRate, fmtGender(guess.genderRate)),
    evolutionCount: cmpExact(guess.evolutionCount, target.evolutionCount, String(guess.evolutionCount)),
    eggGroups: cmpArr(guess.eggGroups, target.eggGroups),
    solved: guess.id === target.id,
  };
}

function countMatches(result) {
  return RESULT_KEYS.filter(k => result[k]?.result === 'green' || result[k]?.result === 'yellow').length;
}

function getHintValue(target, attr) {
  switch (attr) {
    case 'eggGroups':      return target.eggGroups.join(' / ');
    case 'genderRatio':    return fmtGender(target.genderRate);
    case 'evolutionCount': return String(target.evolutionCount);
    case 'types':          return target.types.join(' / ');
    case 'abilities':      return target.abilities.join(' / ');
    case 'height':         return `${target.height}m`;
    case 'weight':         return `${target.weight}kg`;
    case 'baseStatTotal':  return String(target.baseStatTotal);
    case 'generation':     return `${target.gameTitle}（${target.generation}世代）`;
    default: return '';
  }
}

// 全ポケモンから一致要素 ≤ 2 のポケモンを選出
function pickStartPokemon(target, allPokemon) {
  const shuffled = [...allPokemon].sort(() => Math.random() - 0.5);
  for (const p of shuffled) {
    if (p.id === target.id) continue;
    const result = evaluateGuess(p, target);
    if (countMatches(result) <= 2) return result;
  }
  // フォールバック：最も一致の少ないもの
  let best = null, bestCount = Infinity;
  for (const p of shuffled) {
    if (p.id === target.id) continue;
    const result = evaluateGuess(p, target);
    const c = countMatches(result);
    if (c < bestCount) { bestCount = c; best = result; }
  }
  return best;
}

export default function Play() {
  const router = useRouter();
  const [allPokemon, setAllPokemon] = useState([]);     // 全1025匹（スタートポケモン選出用）
  const [filteredList, setFilteredList] = useState([]); // 出題範囲のみ（検索・出題用）
  const [target, setTarget] = useState(null);
  const [startResult, setStartResult] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [revealedHints, setRevealedHints] = useState([]);
  const [showHintPanel, setShowHintPanel] = useState(false);
  const [status, setStatus] = useState('playing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const gens = (() => { try { return JSON.parse(localStorage.getItem('selectedGenerations') || 'null'); } catch { return null; } })();
    const filteredUrl = gens?.length ? `/api/pokemon?generations=${gens.join(',')}` : '/api/pokemon';

    Promise.all([
      fetch('/api/pokemon').then(r => r.json()),          // 全ポケモン
      fetch(filteredUrl).then(r => r.json()),             // 出題範囲
    ]).then(([all, filtered]) => {
      if (!filtered.length) {
        setError('ポケモンデータが見つかりません。npm run fetch-data を実行してください。');
        setLoading(false);
        return;
      }
      setAllPokemon(all);
      setFilteredList(filtered);
      initGame(filtered, all);
      setLoading(false);
    }).catch(() => { setError('データの取得に失敗しました。'); setLoading(false); });
  }, []);

  function initGame(filtered, all) {
    const t = filtered[Math.floor(Math.random() * filtered.length)];
    setTarget(t);
    setStartResult(pickStartPokemon(t, all || allPokemon));
    setGuesses([]);
    setRevealedHints([]);
    setShowHintPanel(false);
    setStatus('playing');
  }

  const handleGuess = useCallback((pokemon) => {
    if (status !== 'playing' || !target) return;
    if (guesses.some(g => g.pokemon.id === pokemon.id)) return;
    const result = evaluateGuess(pokemon, target);
    const next = [result, ...guesses];
    setGuesses(next);
    if (result.solved) setStatus('won');
    else if (next.length >= MAX_GUESSES) setStatus('lost');
  }, [status, target, guesses]);

  function revealHint(attr) {
    if (!target || revealedHints.find(h => h.attr === attr)) return;
    setRevealedHints(prev => [...prev, { attr, value: getHintValue(target, attr) }]);
  }

  const guessedIds = new Set(guesses.map(g => g.pokemon.id));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-3">⏳</div><div className="text-gray-400">読み込み中...</div></div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-red-900 border border-red-700 rounded-2xl p-6 max-w-md text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-red-200 mb-4">{error}</p>
        <code className="block bg-gray-900 rounded px-3 py-2 text-sm text-green-400 mb-4">npm run fetch-data</code>
        <button onClick={() => router.push('/')} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">ホームへ</button>
      </div>
    </div>
  );

  return (
    <>
      <Head><title>ポケモン当てゲーム</title></Head>
      <div className="min-h-screen p-3">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 mt-1">
            <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-sm">← ホーム</button>
            <h1 className="text-xl font-bold text-yellow-400">🎮 ポケモン当てゲーム</h1>
            <div className="text-sm text-gray-400">{guesses.length} / {MAX_GUESSES}</div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 justify-center mb-3 text-xs text-gray-400">
            <span><span className="inline-block w-3 h-3 bg-green-700 rounded mr-1"></span>完全一致</span>
            <span><span className="inline-block w-3 h-3 bg-yellow-600 rounded mr-1"></span>部分一致</span>
            <span><span className="inline-block w-3 h-3 bg-gray-600 rounded mr-1"></span>不一致</span>
            <span><span className="hint-arrow-up">▲</span>正解は高い</span>
            <span><span className="hint-arrow-down">▼</span>正解は低い</span>
          </div>

          {/* Hint panel */}
          {showHintPanel && (
            <div className="bg-gray-800 border border-purple-700 rounded-xl p-3 mb-3">
              <div className="text-xs text-purple-300 mb-2 font-bold">💡 解禁するヒントを選んでください</div>
              <div className="flex flex-wrap gap-2">
                {HINT_ATTRS.map(({ attr, label }) => {
                  const revealed = revealedHints.find(h => h.attr === attr);
                  return revealed ? (
                    <div key={attr} className="bg-purple-900 border border-purple-600 rounded-lg px-3 py-1.5 text-sm">
                      <span className="text-purple-300 text-xs">{label}: </span>
                      <span className="font-bold text-white">{revealed.value}</span>
                    </div>
                  ) : (
                    <button
                      key={attr}
                      onClick={() => revealHint(attr)}
                      className="bg-gray-700 hover:bg-purple-800 border border-gray-500 hover:border-purple-500 rounded-lg px-3 py-1.5 text-sm transition-colors"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search + Hint toggle */}
          {status === 'playing' && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <PokemonSearch pokemonList={filteredList} excludeIds={guessedIds} onSelect={handleGuess} />
              </div>
              <button
                onClick={() => setShowHintPanel(v => !v)}
                className={`px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
                  showHintPanel
                    ? 'bg-purple-600 border border-purple-400'
                    : 'bg-purple-800 hover:bg-purple-700 border border-transparent'
                }`}
              >
                💡 ヒント
                {revealedHints.length > 0 && (
                  <span className="ml-1 bg-purple-400 text-purple-900 text-xs font-bold rounded-full px-1.5 py-0.5">
                    {revealedHints.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Game over */}
          {status !== 'playing' && (
            <div className={`rounded-2xl p-5 mb-4 text-center border ${status === 'won' ? 'bg-green-900 border-green-600' : 'bg-gray-800 border-gray-600'}`}>
              {status === 'won' ? (
                <>
                  <div className="text-4xl mb-2">🎉</div>
                  <div className="text-xl font-bold text-green-300">正解！おめでとう！</div>
                  <div className="text-gray-400 text-sm mt-1">
                    {guesses.length}回で当てました！
                    {revealedHints.length > 0 && ` (ヒント ${revealedHints.length}個使用)`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">😢</div>
                  <div className="text-xl font-bold text-red-400">残念！</div>
                  <div className="text-gray-400 text-sm mt-1">答えは <span className="text-white font-bold">{target?.name}</span> でした</div>
                  {target?.sprite && <img src={target.sprite} alt={target.name} className="w-20 h-20 mx-auto mt-2" style={{ imageRendering: 'pixelated' }} />}
                </>
              )}
              <button onClick={() => initGame(filteredList)} className="mt-4 bg-blue-700 hover:bg-blue-600 px-8 py-2 rounded-xl font-bold">
                もう一度
              </button>
            </div>
          )}

          {/* Guess history */}
          <div className="overflow-x-auto">
            {guesses.map(g => <GuessRow key={g.pokemon.id} guess={g} />)}

            {/* Start hint row */}
            {startResult && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1 text-center border-t border-gray-700 pt-2">
                  スタートヒント（回数にカウントしません・全ポケモンから一致要素2以下で選出）
                </div>
                <div className="opacity-70 border border-dashed border-gray-600 rounded-xl p-1">
                  <GuessRow guess={startResult} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
