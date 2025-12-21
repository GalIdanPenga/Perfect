import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Table } from 'lucide-react';

interface TableModalProps {
  taskName: string;
  table: Record<string, any>[];
  onClose: () => void;
}

export function TableModal({ taskName, table, onClose }: TableModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsOpening(false);
    });
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Recursively render a value (handles nested objects)
  const renderValue = (value: any, depth = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-slate-500 italic">null</span>;
    }

    if (typeof value === 'boolean') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
          value
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
          {value ? 'true' : 'false'}
        </span>
      );
    }

    if (typeof value === 'number') {
      return (
        <span className="text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded font-medium">
          {value.toLocaleString()}
        </span>
      );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className={`rounded-lg ${depth === 0 ? 'bg-slate-800/50 p-3 border border-slate-700/50' : 'pl-3 border-l-2 border-slate-600/50 ml-1'}`}>
          <div className="space-y-1.5">
            {Object.entries(value).map(([k, v], i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-slate-400 font-medium text-xs uppercase tracking-wide min-w-[80px] pt-0.5">{k}</span>
                <span className="text-slate-600">→</span>
                <div className="flex-1">{renderValue(v, depth + 1)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <div key={i} className="inline-flex items-center gap-1 bg-slate-700/50 rounded px-2 py-0.5">
              <span className="text-slate-500 text-xs">{i}:</span>
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-violet-300">{String(value)}</span>;
  };

  const columns = table.length > 0 ? Object.keys(table[0]) : [];

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-opacity duration-200 ${
        isClosing || isOpening ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/50 w-[95vw] max-w-[1400px] max-h-[90vh] flex flex-col transition-all duration-200 ${
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/80 bg-slate-800/30">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-sky-500/20 rounded-xl border border-sky-500/30">
              <Table className="text-sky-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Task Result</h2>
              <p className="text-sm text-slate-400 font-mono">{taskName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-slate-700/50 border border-transparent hover:border-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          <div className="rounded-xl border border-slate-700/60 overflow-hidden">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="bg-slate-800/80">
                  {columns.map((key, i) => (
                    <th key={key} className={`text-left px-5 py-3.5 text-slate-300 font-semibold uppercase tracking-wider text-xs ${
                      i === 0 ? 'rounded-tl-lg' : ''
                    } ${i === columns.length - 1 ? 'rounded-tr-lg' : ''}`}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr
                    key={i}
                    className={`transition-colors hover:bg-sky-500/10 border-b-2 border-slate-700/80 last:border-b-0 ${
                      i % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-800/30'
                    }`}
                  >
                    {columns.map((key, j) => (
                      <td key={j} className="px-5 py-5 text-slate-200 align-top">
                        {renderValue(row[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700/80 bg-slate-800/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/50">
                <span className="text-slate-500">Rows</span>
                <span className="text-sky-400 font-medium">{table.length}</span>
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/50">
                <span className="text-slate-500">Columns</span>
                <span className="text-violet-400 font-medium">{columns.length}</span>
              </span>
            </div>
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium border border-slate-600 hover:border-slate-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
