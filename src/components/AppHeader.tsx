import { Activity } from 'lucide-react';
import { APP_VERSION } from '../constants';
import { WorkerConfig } from '../types';
import { PerfectLogo } from './PerfectLogo';

interface AppHeaderProps {
  themeColor: string;
  activeWorker: WorkerConfig | null;
}

/** Top navigation bar: logo, title, version badge, and system/worker status. */
export function AppHeader({ themeColor, activeWorker }: AppHeaderProps) {
  return (
    <header
      className="backdrop-blur-md border-b h-14 flex-none px-5 flex items-center justify-between shadow-sm z-20 relative transition-all duration-700"
      style={{
        backgroundColor: `${themeColor}12`,
        borderBottomColor: `${themeColor}50`,
        boxShadow: `0 4px 20px ${themeColor}25`
      }}
    >
      <div className="flex items-center gap-3">
        <PerfectLogo />
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Perfect</h1>
        <span
          className="text-xs px-2 py-0.5 rounded-full border font-mono tracking-wide transition-all duration-700"
          style={{
            backgroundColor: `${themeColor}18`,
            color: themeColor,
            borderColor: `${themeColor}50`
          }}
        >{APP_VERSION}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span
            className="w-2 h-2 rounded-full animate-pulse transition-colors duration-700"
            style={{ backgroundColor: themeColor }}
          ></span>
          <span
            className="transition-colors duration-700"
            style={{ color: activeWorker ? themeColor : '#64748b' }}
          >
            {activeWorker ? 'Worker Active' : 'System Online'}
          </span>
        </div>
        <button
          className="p-2 rounded-lg transition-all text-slate-400 hover:text-white duration-300"
          style={{
            background: 'transparent',
            ['--hover-bg' as any]: `${themeColor}20`
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = `${themeColor}20`}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Activity size={18} />
        </button>
      </div>
    </header>
  );
}
