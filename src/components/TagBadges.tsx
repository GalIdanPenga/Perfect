import { Tag } from 'lucide-react';

interface TagBadgesProps {
  tags?: Record<string, string>;
}

export const TagBadges = ({ tags }: TagBadgesProps) => {
  if (!tags || Object.keys(tags).length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {Object.entries(tags).map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/40 border border-slate-600/50 rounded text-[10px] font-mono text-slate-400"
        >
          <Tag size={10} className="text-slate-500" />
          <span className="text-slate-500">{key}:</span>
          <span className="text-slate-300">{value}</span>
        </span>
      ))}
    </div>
  );
};
