import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const GENERATIONS = [
  { num: 1, label: '第1世代', game: '赤・緑', range: '(#001–151)' },
  { num: 2, label: '第2世代', game: '金・銀', range: '(#152–251)' },
  { num: 3, label: '第3世代', game: 'ルビー・サファイア', range: '(#252–386)' },
  { num: 4, label: '第4世代', game: 'ダイヤモンド・パール', range: '(#387–493)' },
  { num: 5, label: '第5世代', game: 'ブラック・ホワイト', range: '(#494–649)' },
  { num: 6, label: '第6世代', game: 'X・Y', range: '(#650–721)' },
  { num: 7, label: '第7世代', game: 'サン・ムーン', range: '(#722–809)' },
  { num: 8, label: '第8世代', game: '剣・盾', range: '(#810–905)' },
  { num: 9, label: '第9世代', game: 'スカーレット・バイオレット', range: '(#906–1025)' },
];

export default function Settings() {
  const router = useRouter();
  const [selected, setSelected] = useState(new Set([1,2,3,4,5,6,7,8,9]));

  useEffect(() => {
    const saved = localStorage.getItem('selectedGenerations');
    if (saved) {
      try { setSelected(new Set(JSON.parse(saved))); } catch {}
    }
  }, []);

  function toggle(num) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(num)) { if (next.size > 1) next.delete(num); }
      else next.add(num);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(GENERATIONS.map(g => g.num))); }
  function clearAll() { setSelected(new Set([1])); }

  function save() {
    localStorage.setItem('selectedGenerations', JSON.stringify([...selected].sort()));
    router.push('/');
  }

  return (
    <>
      <Head><title>設定 - ポケモン当てゲーム</title></Head>
      <div className="min-h-screen p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6 mt-2">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">←</button>
          <h1 className="text-2xl font-bold text-yellow-400">⚙️ 設定</h1>
        </div>

        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-lg mb-3 text-gray-200">出題範囲の設定</h2>
          <p className="text-sm text-gray-400 mb-4">含める世代を選択してください（1つ以上必要）</p>
          <div className="flex gap-2 mb-4">
            <button onClick={selectAll} className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-sm font-bold">すべて選択</button>
            <button onClick={clearAll} className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm font-bold">リセット</button>
          </div>
          <div className="flex flex-col gap-2">
            {GENERATIONS.map(g => (
              <label
                key={g.num}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border-2 ${
                  selected.has(g.num)
                    ? 'bg-blue-900 border-blue-500'
                    : 'bg-gray-700 border-transparent hover:border-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(g.num)}
                  onChange={() => toggle(g.num)}
                  className="w-4 h-4 accent-blue-500"
                />
                <div className="flex-1">
                  <div className="font-bold">{g.label} <span className="text-gray-400 text-sm">{g.range}</span></div>
                  <div className="text-sm text-gray-400">{g.game}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          className="w-full bg-green-700 hover:bg-green-600 py-4 rounded-xl text-lg font-bold transition-colors"
        >
          保存してホームへ
        </button>
      </div>
    </>
  );
}
