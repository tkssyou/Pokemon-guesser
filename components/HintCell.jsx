export default function HintCell({ label, value, result, direction }) {
  const cls = result === 'green' ? 'cell-green' : result === 'yellow' ? 'cell-yellow' : 'cell-gray';
  const display = Array.isArray(value) ? value.join(' / ') : String(value ?? '');
  const arrow = direction === 'higher' ? '▲' : direction === 'lower' ? '▼' : null;

  return (
    <div className={`${cls} border rounded px-2 py-1.5 text-center flex flex-col justify-between min-w-[80px] max-w-[120px] flex-1`}>
      <div className="text-[10px] text-gray-300 leading-tight mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{label}</div>
      <div className="text-xs font-bold leading-tight break-words">
        {display}
        {arrow && (
          <span className={`ml-0.5 text-sm ${direction === 'higher' ? 'hint-arrow-up' : 'hint-arrow-down'}`}>
            {arrow}
          </span>
        )}
      </div>
    </div>
  );
}
