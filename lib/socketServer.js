const { getPokemonList, getAllPokemon, getPokemonById, searchPokemon } = require('./pokemonData');
const { evaluateGuess } = require('./gameLogic');
const { formatGenderRatio } = require('./translations');

const rooms = new Map();

function generateRoomId() {
  let id;
  do { id = Math.random().toString(36).substring(2, 8).toUpperCase(); } while (rooms.has(id));
  return id;
}

const HINT_ATTRS = ['eggGroups', 'genderRatio', 'evolutionCount', 'types', 'abilities', 'height', 'weight', 'baseStatTotal', 'generation'];

const RESULT_KEYS = ['generation', 'baseStatTotal', 'types', 'abilities', 'height', 'weight', 'genderRatio', 'evolutionCount', 'eggGroups'];

function countMatches(result) {
  return RESULT_KEYS.filter(k => result[k]?.result === 'green' || result[k]?.result === 'yellow').length;
}

// 全ポケモンからスタートポケモンを選出（一致要素 ≤ 2）
function pickStartPokemon(target) {
  const all = getAllPokemon();
  // シャッフルして一致数 ≤ 2 のものを探す
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  for (const p of shuffled) {
    if (p.id === target.id) continue;
    const result = evaluateGuess(p, target);
    if (countMatches(result) <= 2) return { pokemon: p, result };
  }
  // フォールバック：最も一致の少ないもの
  let best = null, bestResult = null, bestCount = Infinity;
  for (const p of shuffled) {
    if (p.id === target.id) continue;
    const result = evaluateGuess(p, target);
    const c = countMatches(result);
    if (c < bestCount) { bestCount = c; best = p; bestResult = result; }
  }
  return { pokemon: best, result: bestResult };
}

function getHintValue(target, attr) {
  switch (attr) {
    case 'eggGroups': return { label: 'タマゴグループ', value: target.eggGroups.join(' / ') };
    case 'genderRatio': return { label: '性別比', value: formatGenderRatio(target.genderRate) };
    case 'evolutionCount': return { label: '進化数', value: String(target.evolutionCount) };
    case 'types': return { label: 'タイプ', value: target.types.join(' / ') };
    case 'abilities': return { label: '特性', value: target.abilities.join(' / ') };
    case 'height': return { label: '高さ', value: `${target.height}m` };
    case 'weight': return { label: '重さ', value: `${target.weight}kg` };
    case 'baseStatTotal': return { label: '合計種族値', value: String(target.baseStatTotal) };
    case 'generation': return { label: '初登場作品（世代）', value: `${target.gameTitle}（${target.generation}世代）` };
    default: return null;
  }
}

function startGame(room) {
  const list = getPokemonList(room.generations);
  if (!list.length) return false;

  const target = list[Math.floor(Math.random() * list.length)];
  const { result: startResult } = pickStartPokemon(target);

  room.targetPokemon = target;
  room.status = 'playing';
  room.allGuesses = [];
  room.startPokemonResult = startResult;
  room.revealedHints = [];
  room.rematchWanted = new Set();
  room.currentTurn = room.host; // host goes first
  room.players.forEach(p => { p.guesses = []; p.solved = false; });
  room.winner = null;
  return true;
}

function sanitizeRoom(room) {
  return {
    id: room.id,
    host: room.host,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      guessCount: p.guesses.length,
      guessesLeft: (room.maxGuesses || 10) - p.guesses.length,
      solved: p.solved,
    })),
    status: room.status,
    generations: room.generations,
    winner: room.winner ? { id: room.winner.id, name: room.winner.name } : null,
    targetPokemon: room.status === 'finished' ? room.targetPokemon : null,
    maxGuesses: room.maxGuesses,
    startPokemonResult: room.startPokemonResult || null,
    revealedHints: room.revealedHints || [],
    allGuesses: room.allGuesses || [],
    currentTurn: room.currentTurn || null,
    rematchWanted: room.rematchWanted ? [...room.rematchWanted] : [],
  };
}

function setupSocketServer(io) {
  io.on('connection', (socket) => {

    socket.on('search-pokemon', ({ query, generations }) => {
      const results = searchPokemon(query, generations?.length ? generations : null, 10);
      socket.emit('search-results', results);
    });

    // ── ルーム作成 ──────────────────────────────────────────────
    socket.on('create-room', ({ playerName, generations }) => {
      const roomId = generateRoomId();
      const room = {
        id: roomId,
        host: socket.id,
        players: [{ id: socket.id, name: playerName || 'プレイヤー1', guesses: [], solved: false }],
        targetPokemon: null,
        status: 'waiting',
        generations: generations?.length ? generations : [1,2,3,4,5,6,7,8,9],
        maxGuesses: 10,
        allGuesses: [],
        startPokemonResult: null,
        revealedHints: [],
        rematchWanted: new Set(),
        currentTurn: null,
        winner: null,
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room-created', { roomId, room: sanitizeRoom(room) });
    });

    // ── ルーム参加 ──────────────────────────────────────────────
    socket.on('join-room', ({ roomId, playerName }) => {
      const id = (roomId || '').toUpperCase().trim();
      const room = rooms.get(id);

      if (!room) { socket.emit('join-error', { message: 'ルームが見つかりません' }); return; }
      if (room.status !== 'waiting') { socket.emit('join-error', { message: 'このルームはすでにゲームが進行中です' }); return; }
      if (room.players.length >= 2) { socket.emit('join-error', { message: 'このルームは満員です' }); return; }

      room.players.push({ id: socket.id, name: playerName || 'プレイヤー2', guesses: [], solved: false });
      socket.join(id);

      // 2人揃ったら自動スタート
      if (startGame(room)) {
        io.to(id).emit('game-started', { room: sanitizeRoom(room) });
      } else {
        socket.emit('join-error', { message: 'ポケモンデータが読み込まれていません' });
        room.players.pop();
      }
    });

    // ── 回答送信 ──────────────────────────────────────────────
    socket.on('submit-guess', ({ roomId, pokemonId }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'playing') return;
      if (room.currentTurn !== socket.id) return; // 自分のターンでない

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.solved || player.guesses.length >= room.maxGuesses) return;
      if (player.guesses.find(g => g.pokemon.id === pokemonId)) return;

      const guessPokemon = getPokemonById(pokemonId);
      if (!guessPokemon) return;

      const result = evaluateGuess(guessPokemon, room.targetPokemon);
      player.guesses.push(result);

      // 共有タイムラインに追加
      const entry = { playerId: player.id, playerName: player.name, ...result };
      room.allGuesses.push(entry);

      if (result.solved) {
        player.solved = true;
        room.winner = player;
        room.status = 'finished';
        io.to(roomId).emit('game-ended', {
          allGuesses: room.allGuesses,
          winner: { id: player.id, name: player.name },
          targetPokemon: room.targetPokemon,
        });
        return;
      }

      // ターン交代
      const other = room.players.find(p => p.id !== socket.id);
      const myLeft = room.maxGuesses - player.guesses.length;
      const otherLeft = other ? room.maxGuesses - other.guesses.length : 0;

      if (myLeft === 0 && otherLeft === 0) {
        // 両者10ターン終了
        room.status = 'finished';
        io.to(roomId).emit('game-ended', {
          allGuesses: room.allGuesses,
          winner: null,
          targetPokemon: room.targetPokemon,
        });
        return;
      }

      // 相手にターンを渡す（相手に残りターンがあれば）
      room.currentTurn = (other && otherLeft > 0) ? other.id : socket.id;

      io.to(roomId).emit('turn-update', {
        allGuesses: room.allGuesses,
        currentTurn: room.currentTurn,
        players: sanitizeRoom(room).players,
      });
    });

    // ── ヒント要求（属性を指定して解禁） ───────────────────────
    socket.on('request-hint', ({ roomId, attr }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'playing' || !room.targetPokemon) return;
      if (!HINT_ATTRS.includes(attr)) return;
      if (room.revealedHints.find(h => h.attr === attr)) return; // 既に解禁済み
      const hint = getHintValue(room.targetPokemon, attr);
      if (!hint) return;
      room.revealedHints.push({ attr, ...hint });
      io.to(roomId).emit('hint-revealed', { hints: room.revealedHints });
    });

    // ── 再戦 ──────────────────────────────────────────────────
    socket.on('request-rematch', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'finished') return;
      if (!room.rematchWanted) room.rematchWanted = new Set();
      room.rematchWanted.add(socket.id);

      io.to(roomId).emit('rematch-status', { wantedBy: [...room.rematchWanted] });

      // 全員が再戦を希望したらゲームスタート
      if (room.players.every(p => room.rematchWanted.has(p.id))) {
        if (startGame(room)) {
          io.to(roomId).emit('game-started', { room: sanitizeRoom(room) });
        }
      }
    });

    // ── 切断 ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      rooms.forEach((room, roomId) => {
        const idx = room.players.findIndex(p => p.id === socket.id);
        if (idx === -1) return;
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          if (room.host === socket.id) room.host = room.players[0].id;
          if (room.status === 'playing') {
            room.status = 'finished';
            io.to(roomId).emit('opponent-left', { room: sanitizeRoom(room) });
          } else {
            io.to(roomId).emit('room-updated', { room: sanitizeRoom(room) });
          }
        }
      });
    });
  });
}

module.exports = { setupSocketServer };
