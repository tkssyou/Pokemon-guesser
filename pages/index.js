import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  function goSolo() { router.push('/play'); }

  function goCreateRoom() {
    if (!playerName.trim()) return;
    router.push(`/room/new?name=${encodeURIComponent(playerName.trim())}`);
  }

  function goJoinRoom() {
    if (!playerName.trim() || !roomCode.trim()) return;
    router.push(`/room/${roomCode.trim().toUpperCase()}?name=${encodeURIComponent(playerName.trim())}`);
  }

  return (
    <>
      <Head>
        <title>ポケモン当てゲーム</title>
        <meta name="description" content="ヒントを使ってポケモンを当てよう！" />
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-2">🎮</div>
            <h1 className="text-3xl font-bold text-yellow-400 mb-1">ポケモン当てゲーム</h1>
            <p className="text-gray-400 text-sm">ヒントを使ってポケモンを当てよう！</p>
          </div>

          {mode === 'home' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={goSolo}
                className="bg-green-700 hover:bg-green-600 active:bg-green-800 px-6 py-4 rounded-xl text-lg font-bold transition-colors"
              >
                🧩 ひとりで遊ぶ
              </button>
              <button
                onClick={() => setMode('create')}
                className="bg-blue-700 hover:bg-blue-600 active:bg-blue-800 px-6 py-4 rounded-xl text-lg font-bold transition-colors"
              >
                🏠 ルームを作る
              </button>
              <button
                onClick={() => setMode('join')}
                className="bg-purple-700 hover:bg-purple-600 active:bg-purple-800 px-6 py-4 rounded-xl text-lg font-bold transition-colors"
              >
                🚪 ルームに参加
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                ⚙️ 設定（出題範囲）
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold text-center text-blue-300">ルームを作る</h2>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && goCreateRoom()}
                placeholder="あなたの名前"
                maxLength={16}
                className="bg-gray-800 border-2 border-gray-600 rounded-xl px-4 py-3 text-base"
                autoFocus
              />
              <button
                onClick={goCreateRoom}
                disabled={!playerName.trim()}
                className="bg-blue-700 hover:bg-blue-600 disabled:opacity-40 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                ルームを作成する
              </button>
              <button onClick={() => setMode('home')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            </div>
          )}

          {mode === 'join' && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold text-center text-purple-300">ルームに参加</h2>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="あなたの名前"
                maxLength={16}
                className="bg-gray-800 border-2 border-gray-600 rounded-xl px-4 py-3 text-base"
                autoFocus
              />
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && goJoinRoom()}
                placeholder="ルームコード（例: ABC123）"
                maxLength={6}
                className="bg-gray-800 border-2 border-gray-600 rounded-xl px-4 py-3 text-base font-mono tracking-widest"
              />
              <button
                onClick={goJoinRoom}
                disabled={!playerName.trim() || roomCode.length < 6}
                className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                参加する
              </button>
              <button onClick={() => setMode('home')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-gray-600">
            <p>ヒント: 🟩完全一致 / 🟨部分一致 / ⬜不一致</p>
            <p className="mt-1">数値は ▲高い / ▼低い で方向を示します</p>
          </div>
        </div>
      </div>
    </>
  );
}
