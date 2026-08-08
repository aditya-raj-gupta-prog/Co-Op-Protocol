export function ProgressBar({value, max, className = ""}: {value: number; max: number; className?: string}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const complete = max > 0 && value >= max;

  return (
    <div className={className}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${complete ? "bg-emerald-400" : "bg-cyan-400"}`}
          style={{width: `${pct}%`}}
        />
      </div>
    </div>
  );
}
