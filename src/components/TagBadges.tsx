import { Tag } from 'lucide-react';

interface TagBadgesProps {
  tags?: Record<string, string>;
}

export const TagBadges = ({ tags }: TagBadgesProps) => {
  if (!tags || Object.keys(tags).length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(tags).map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/50 rounded-md text-xs font-mono shadow-sm"
        >
          <Tag size={12} className="text-sky-400" />
          <span className="text-sky-400 font-semibold">{key}:</span>
          <span className="text-white font-medium">{value}</span>
        </span>
      ))}
    </div>
  );
};
