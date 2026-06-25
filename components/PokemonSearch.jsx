import { useState, useEffect, useRef } from 'react';

export default function PokemonSearch({ pokemonList, excludeIds, onSelect, disabled }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); setOpen(false); return; }
    const q = query.toLowerCase();
    // ひらがな → カタカナ変換（例: "ぴかちゅう" → "ピカチュウ"）
    const qKata = query.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
    const filtered = pokemonList
      .filter(p => !(excludeIds instanceof Set ? excludeIds.has(p.id) : false))
      .filter(p => p.name.includes(query) || p.name.includes(qKata) || p.nameEn.toLowerCase().includes(q))
      .slice(0, 10);
    setSuggestions(filtered);
    setOpen(filtered.length > 0);
    setFocused(0);
  }, [query, pokemonList, excludeIds]);

  function handleSelect(p) {
    onSelect(p);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (suggestions[focused]) handleSelect(suggestions[focused]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        disabled={disabled}
        placeholder="ポケモン名を入力してください..."
        className="w-full bg-gray-800 border-2 border-gray-600 rounded-xl px-4 py-3 text-base placeholder-gray-500 disabled:opacity-50"
        autoComplete="off"
      />
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded-xl mt-1 overflow-hidden shadow-2xl"
        >
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-colors ${i === focused ? 'bg-purple-800' : 'hover:bg-gray-700'}`}
            >
              {p.sprite && (
                <img src={p.sprite} alt="" className="w-8 h-8 object-contain flex-shrink-0" style={{ imageRendering: 'pixelated' }} />
              )}
              <span className="font-medium">{p.name}</span>
              <span className="text-gray-400 text-sm ml-auto">{p.nameEn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
