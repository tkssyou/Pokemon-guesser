import HintCell from './HintCell';

export default function GuessRow({ guess, playerName, isMe }) {
  const { pokemon, generation, baseStatTotal, types, abilities, height, weight, genderRatio, evolutionCount, eggGroups } = guess;

  return (
    <div className="mb-2">
      {playerName && (
        <div className={`text-xs font-bold mb-0.5 px-1 ${isMe ? 'text-blue-400' : 'text-orange-400'}`}>
          {isMe ? '▶ あなた' : `▶ ${playerName}`}
        </div>
      )}
      <div className="flex items-stretch gap-1">
        {/* Pokemon sprite + name */}
        <div className="flex flex-col items-center justify-center bg-gray-800 rounded px-2 py-1 min-w-[70px] border border-gray-700">
          {pokemon.sprite && (
            <img src={pokemon.sprite} alt={pokemon.name} className="w-10 h-10 object-contain" style={{ imageRendering: 'pixelated' }} />
          )}
          <div className="text-[10px] text-center leading-tight mt-0.5 font-medium">{pokemon.name}</div>
        </div>
        {/* Hint cells */}
        <div className="flex gap-1 flex-1 overflow-x-auto">
          <HintCell label="初登場作品（世代）" value={generation.value} result={generation.result} direction={generation.direction} />
          <HintCell label="合計種族値" value={baseStatTotal.value} result={baseStatTotal.result} direction={baseStatTotal.direction} />
          <HintCell label="タイプ" value={types.value} result={types.result} />
          <HintCell label="特性" value={abilities.value} result={abilities.result} />
          <HintCell label="高さ" value={`${height.value}m`} result={height.result} direction={height.direction} />
          <HintCell label="重さ" value={`${weight.value}kg`} result={weight.result} direction={weight.direction} />
          <HintCell label="性別比" value={genderRatio.value} result={genderRatio.result} />
          <HintCell label="進化数" value={evolutionCount.value} result={evolutionCount.result} />
          <HintCell label="タマゴグループ" value={eggGroups.value} result={eggGroups.result} />
        </div>
      </div>
    </div>
  );
}
