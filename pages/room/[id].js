import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { io } from 'socket.io-client';
import PokemonSearch from '../../components/PokemonSearch';
import GuessRow from '../../components/GuessRow';

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

export default function RoomPage() {
  const router = useRouter();
  const { id: queryId, name } = router.query;

  // ── State ──────────────────────────────────────────────────────
  const [myId, setMyId] = useState('');
  const [roomId, setRoomId] = useState('');          // confirmed room ID
  const [players, setPlayers] = useState([]);
  const [pokemonList, setPokemonList] = useState([]);
  const [phase, setPhase] = useState('connecting');   // connecting | waiting | playing | finished | error | left
  const [allGuesses, setAllGuesses] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('');
  const [revealedHints, setRevealedHints] = useState([]);
  const [startResult, setStartResult] = useState(null);
  const [winner, setWinner] = useState(null);
  const [targetPokemon, setTargetPokemon] = useState(null);
  const [rematchWanted, setRematchWanted] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [showHintPanel, setShowHintPanel] = useState(false);

  const socketRef = useRef(null);
  const myIdRef = useRef('');
  const roomIdRef = useRef('');

  // Pokemon list for search
  useEffect(() => {
    fetch('/api/pokemon').then(r => r.json()).then(setPokemonList).catch(() => {});
  }, []);

  // Socket setup — runs once when queryId/name are ready
  useEffect(() => {
    if (!queryId || !name) return;

    const sock = io({
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      // iOS Safari バックグラウンド復帰対応
      transports: ['websocket', 'polling'],
    });
    socketRef.current = sock;

    sock.on('connect', () => {
      myIdRef.current = sock.id;
      setMyId(sock.id);

      if (queryId === 'new') {
        const gens = (() => { try { return JSON.parse(localStorage.getItem('selectedGenerations') || 'null'); } catch { return null; } })();
        sock.emit('create-room', { playerName: name, generations: gens || [] });
      } else {
        sock.emit('join-room', { roomId: queryId, playerName: name });
      }
    });

    // ── ルーム作成完了 (ホスト) ──
    sock.on('room-created', ({ roomId: newId, room }) => {
      roomIdRef.current = newId;
      setRoomId(newId);
      setPlayers(room.players);
      setPhase('waiting');
      // URL を更新（Next.js ルーターを使わず history API で = useEffect 再発火しない）
      window.history.replaceState(null, '', `/room/${newId}?name=${encodeURIComponent(name)}`);
    });

    // ── ゲームスタート (全員) ──
    sock.on('game-started', ({ room }) => {
      roomIdRef.current = room.id;
      setRoomId(room.id);
      setPlayers(room.players);
      setAllGuesses(room.allGuesses || []);
      setCurrentTurn(room.currentTurn);
      setRevealedHints(room.revealedHints || []);
      setStartResult(room.startPokemonResult || null);
      setWinner(null);
      setTargetPokemon(null);
      setRematchWanted([]);
      setRematchRequested(false);
      setShowHintPanel(false);
      setPhase('playing');
    });

    // ── 回答後の更新 ──
    sock.on('turn-update', ({ allGuesses, currentTurn, players }) => {
      setAllGuesses(allGuesses);
      setCurrentTurn(currentTurn);
      setPlayers(players);
    });

    // ── ヒント解禁 ──
    sock.on('hint-revealed', ({ hints }) => {
      setRevealedHints(hints);
    });

    // ── ゲーム終了 ──
    sock.on('game-ended', ({ allGuesses, winner, targetPokemon }) => {
      setAllGuesses(allGuesses || []);
      setWinner(winner);
      setTargetPokemon(targetPokemon);
      setPhase('finished');
    });

    // ── 再戦状況 ──
    sock.on('rematch-status', ({ wantedBy }) => {
      setRematchWanted(wantedBy);
    });

    // ── 相手が退出 ──
    sock.on('opponent-left', () => {
      setPhase('left');
    });

    // ── 参加エラー ──
    sock.on('join-error', ({ message }) => {
      setError(message);
      setPhase('error');
    });

    return () => { sock.disconnect(); };
  }, [queryId, name]); // queryId は 'new' か '6桁コード' のままで変わらない

  // ── Actions ────────────────────────────────────────────────────
  const handleGuess = useCallback((pokemon) => {
    if (phase !== 'playing') return;
    if (currentTurn !== myIdRef.current) return;
    socketRef.current?.emit('submit-guess', { roomId: roomIdRef.current, pokemonId: pokemon.id });
  }, [phase, currentTurn]);

  function requestHint(attr) {
    socketRef.current?.emit('request-hint', { roomId: roomIdRef.current, attr });
  }

  function requestRematch() {
    if (rematchRequested) return;
    setRematchRequested(true);
    socketRef.current?.emit('request-rematch', { roomId: roomIdRef.current });
  }

  function copyCode() {
    navigator.clipboard.writeText(roomId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  // ── Derived ───────────────────────────────────────────────────
  const isMyTurn = currentTurn === myId;
  const me = players.find(p => p.id === myId);
  const opponent = players.find(p => p.id !== myId);
  const guessedIds = new Set(allGuesses.filter(g => g.playerId === myId).map(g => g.pokemon.id));
  const hintsLeft = MAX_HINTS - revealedHints.length;
  const opponentWantsRematch = opponent && rematchWanted.includes(opponent.id);

  // ── Render helpers ─────────────────────────────────────────────
  if (phase === 'connecting') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-3 animate-spin">⚙️</div><p className="text-gray-400">接続中...</p></div>
    </div>
  );

  if (phase === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-red-900 border border-red-700 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-200 text-lg mb-6">{error}</p>
        <button onClick={() => router.push('/')} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-bold w-full">ホームへ</button>
      </div>
    </div>
  );

  if (phase === 'left') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">👋</div>
        <p className="text-gray-200 text-lg mb-6">相手がゲームを退出しました</p>
        <button onClick={() => router.push('/')} className="bg-blue-700 hover:bg-blue-600 px-6 py-3 rounded-xl font-bold w-full">ホームへ</button>
      </div>
    </div>
  );

  return (
    <>
      <Head><title>ルーム {roomId} - ポケモン当てゲーム</title></Head>
      <div className="min-h-screen p-3">
        <div className="max-w-5xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-3 mt-1">
            <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-sm">← ホーム</button>
            <h1 className="text-xl font-bold text-yellow-400">🎮 対戦ルーム</h1>
            {roomId && (
              <button onClick={copyCode} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg font-mono">
                {copied ? '✓ コピー済' : `🔑 ${roomId}`}
              </button>
            )}
          </div>

          {/* ── WAITING (ホストが相手を待っている) ── */}
          {phase === 'waiting' && (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center max-w-sm w-full">
                <div className="text-4xl mb-4">⏳</div>
                <h2 className="text-xl font-bold mb-2 text-gray-200">対戦相手を待っています</h2>
                <p className="text-gray-400 text-sm mb-6">以下のルームコードを相手に教えてください</p>
                <div
                  onClick={copyCode}
                  className="bg-gray-900 border-2 border-yellow-500 rounded-xl py-4 px-6 cursor-pointer hover:border-yellow-400 transition-colors mb-2"
                  title="クリックでコピー"
                >
                  <div className="text-4xl font-bold text-yellow-400 tracking-widest font-mono">{roomId}</div>
                </div>
                <p className="text-xs text-gray-500 mb-6">{copied ? '✓ コピーしました！' : 'クリックでコピー'}</p>
                <div className="flex items-center gap-2 justify-center text-gray-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  待機中... ({players.length}/2人)
                </div>
              </div>
            </div>
          )}

          {/* ── PLAYING ── */}
          {phase === 'playing' && (
            <>
              {/* Players status */}
              <div className="flex gap-3 mb-3">
                {players.map(p => {
                  const isMe = p.id === myId;
                  const isTurn = p.id === currentTurn;
                  return (
                    <div key={p.id} className={`flex-1 rounded-xl px-3 py-2 border transition-all ${
                      isTurn ? 'border-yellow-500 bg-yellow-900/30' : 'border-gray-600 bg-gray-800'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isTurn && <span className="text-yellow-400 text-sm">▶</span>}
                        <span className={`font-bold text-sm ${isMe ? 'text-blue-300' : 'text-orange-300'}`}>
                          {p.name}{isMe && ' (あなた)'}
                        </span>
                        {p.solved && <span className="text-green-400 text-xs ml-auto">✓ 正解！</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        残り {p.guessesLeft ?? 10} 回
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Turn banner */}
              <div className={`rounded-xl py-2 px-4 mb-3 text-center text-sm font-bold ${
                isMyTurn ? 'bg-blue-900 border border-blue-600 text-blue-200' : 'bg-gray-800 border border-gray-600 text-gray-400'
              }`}>
                {isMyTurn ? '🎯 あなたのターンです！' : `⏳ ${opponent?.name || '相手'}のターンを待っています...`}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 justify-center mb-3 text-xs text-gray-400">
                <span><span className="inline-block w-3 h-3 bg-green-700 rounded mr-1"></span>完全一致</span>
                <span><span className="inline-block w-3 h-3 bg-yellow-600 rounded mr-1"></span>部分一致</span>
                <span><span className="inline-block w-3 h-3 bg-gray-600 rounded mr-1"></span>不一致</span>
                <span><span className="hint-arrow-up">▲</span>正解は高い</span>
                <span><span className="hint-arrow-down">▼</span>正解は低い</span>
              </div>

              {/* Hints panel (toggle) */}
              {showHintPanel && (
                <div className="bg-gray-800 border border-purple-700 rounded-xl p-3 mb-3">
                  <div className="text-xs text-purple-300 mb-2 font-bold">
                    💡 解禁するヒントを選んでください（全員に公開されます）
                  </div>
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
                          onClick={() => requestHint(attr)}
                          className="bg-gray-700 hover:bg-purple-800 border border-gray-500 hover:border-purple-500 rounded-lg px-3 py-1.5 text-sm transition-colors"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search input + Hint toggle */}
              {isMyTurn && (me?.guessesLeft ?? 0) > 0 && (
                <div className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <PokemonSearch
                      pokemonList={pokemonList}
                      excludeIds={guessedIds}
                      onSelect={handleGuess}
                    />
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

              {/* Shared guess board */}
              <div className="overflow-x-auto">
                {allGuesses.map((g, i) => (
                  <GuessRow
                    key={i}
                    guess={g}
                    playerName={g.playerName}
                    isMe={g.playerId === myId}
                  />
                ))}

                {/* Start hint row */}
                {startResult && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1 text-center border-t border-gray-700 pt-2">
                      スタートヒント（回数にカウントしません）
                    </div>
                    <div className="opacity-70 border border-dashed border-gray-600 rounded-xl p-1">
                      <GuessRow guess={startResult} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── FINISHED ── */}
          {phase === 'finished' && (
            <>
              <div className={`rounded-2xl p-6 mb-4 text-center border ${
                !winner ? 'bg-gray-800 border-gray-600'
                : winner.id === myId ? 'bg-yellow-900 border-yellow-500'
                : 'bg-gray-800 border-red-700'
              }`}>
                {!winner ? (
                  <>
                    <div className="text-4xl mb-3">🤝</div>
                    <div className="text-2xl font-bold text-gray-200">引き分け</div>
                    <div className="text-gray-400 text-sm mt-1">両者10ターン以内に正解できませんでした</div>
                  </>
                ) : winner.id === myId ? (
                  <>
                    <div className="text-5xl mb-3">🏆</div>
                    <div className="text-2xl font-bold text-yellow-300">あなたの勝ち！</div>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3">😢</div>
                    <div className="text-2xl font-bold text-red-300">{winner.name} の勝ち</div>
                    <div className="text-gray-400 text-sm mt-1">残念でした...</div>
                  </>
                )}

                {/* Target Pokemon reveal */}
                {targetPokemon && (
                  <div className="mt-4 bg-gray-900 rounded-xl p-4">
                    <div className="text-sm text-gray-400 mb-2">答えのポケモン</div>
                    <div className="flex items-center justify-center gap-3">
                      {targetPokemon.sprite && (
                        <img src={targetPokemon.sprite} alt={targetPokemon.name} className="w-20 h-20" style={{ imageRendering: 'pixelated' }} />
                      )}
                      <span className="text-3xl font-bold text-white">{targetPokemon.name}</span>
                    </div>
                  </div>
                )}

                {/* Rematch status */}
                {opponentWantsRematch && !rematchRequested && (
                  <div className="mt-4 text-sm text-yellow-300 animate-pulse">
                    {opponent?.name} が再戦を希望しています！
                  </div>
                )}
                {rematchRequested && !opponentWantsRematch && (
                  <div className="mt-4 text-sm text-gray-400">
                    再戦リクエスト送信済み... {opponent?.name} の承認を待っています
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 mt-5 justify-center">
                  <button onClick={() => router.push('/')} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-bold">
                    🏠 ホームへ
                  </button>
                  <button
                    onClick={requestRematch}
                    disabled={rematchRequested}
                    className={`px-6 py-3 rounded-xl font-bold transition-colors ${
                      rematchRequested
                        ? 'bg-green-800 border border-green-600 text-green-300 cursor-default'
                        : opponentWantsRematch
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-white animate-pulse'
                        : 'bg-blue-700 hover:bg-blue-600'
                    }`}
                  >
                    {rematchRequested ? '✓ 再戦リクエスト済み' : opponentWantsRematch ? '⚡ 再戦する！' : '🔄 再戦'}
                  </button>
                </div>
              </div>

              {/* Full guess history */}
              <div className="overflow-x-auto">
                {allGuesses.map((g, i) => (
                  <GuessRow key={i} guess={g} playerName={g.playerName} isMe={g.playerId === myId} />
                ))}
                {startResult && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1 text-center border-t border-gray-700 pt-2">
                      スタートヒント
                    </div>
                    <div className="opacity-70 border border-dashed border-gray-600 rounded-xl p-1">
                      <GuessRow guess={startResult} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
