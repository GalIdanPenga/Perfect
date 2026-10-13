import { ChevronRight, XCircle } from 'lucide-react';

interface SessionActionButtonProps {
  allFlowsFinished: boolean;
  themeColor: string;
  onReturn: () => void;
  onStop: () => void;
}

/**
 * The primary session action below the run cards: "Return to Worker Selection"
 * once every flow has finished, otherwise a "Stop" button.
 */
export function SessionActionButton({ allFlowsFinished, themeColor, onReturn, onStop }: SessionActionButtonProps) {
  return (
    <div className="flex justify-center mt-4 mb-6">
      {allFlowsFinished ? (
        // Show "Return to Worker Selection" when all flows are finished
        <button
          onClick={onReturn}
          className="group relative px-8 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            borderColor: themeColor,
            background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
            boxShadow: `0 8px 32px ${themeColor}30`
          }}
        >
          <div className="flex items-center gap-3">
            <ChevronRight
              size={20}
              className="transform group-hover:-translate-x-1 transition-transform"
              style={{ color: themeColor }}
            />
            <span
              className="text-sm font-bold tracking-wide"
              style={{ color: themeColor }}
            >
              Return to Worker Selection
            </span>
            <ChevronRight
              size={20}
              className="transform group-hover:translate-x-1 transition-transform"
              style={{ color: themeColor }}
            />
          </div>

          {/* Animated border glow */}
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300 -z-10"
            style={{ background: themeColor }}
          ></div>
        </button>
      ) : (
        // Show "Stop" button when flows are running
        <button
          onClick={onStop}
          className="group relative px-8 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            borderColor: '#ef4444',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.3)'
          }}
        >
          <div className="flex items-center gap-3">
            <XCircle
              size={20}
              className="transition-transform group-hover:rotate-90"
              style={{ color: '#ef4444' }}
            />
            <span
              className="text-sm font-bold tracking-wide"
              style={{ color: '#ef4444' }}
            >
              Stop
            </span>
          </div>

          {/* Animated border glow */}
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300 -z-10"
            style={{ background: '#ef4444' }}
          ></div>
        </button>
      )}
    </div>
  );
}
