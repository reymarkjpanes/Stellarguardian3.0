export function HeroCard({
  eventName,
  currentPhase,
  countdownText,
  primaryActionLabel,
  onPrimaryAction,
  loading,
}: {
  eventName: string;
  currentPhase: string;
  countdownText: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-neutral-950 p-8 sm:p-10 animate-pulse">
        <div className="relative z-10 max-w-2xl">
          <div className="h-6 w-24 bg-neutral-800 rounded-full mb-4" />
          <div className="h-10 w-3/4 bg-neutral-800 rounded mb-8" />
          <div className="h-10 w-32 bg-neutral-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-neutral-950 text-white p-8 sm:p-10">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-[var(--accent)] opacity-20 blur-3xl"></div>
      
      <div className="relative z-10 max-w-2xl">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md border border-white/20">
            <span className="w-2 h-2 rounded-full bg-green-400 mr-2"></span>
            {currentPhase}
          </div>
          {countdownText && (
            <div className="inline-flex items-center rounded-full bg-orange-500/20 text-orange-200 px-3 py-1 text-xs font-medium border border-orange-500/30">
              {countdownText}
            </div>
          )}
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
          {eventName}
        </h1>
        
        {primaryActionLabel && onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            className="rounded-md bg-white text-black px-6 py-2.5 text-sm font-semibold hover:bg-neutral-200 transition-colors"
          >
            {primaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
