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
        <span className={value ? 'text-emerald-400' : 'text-rose-400'}>
          {value ? '✓ true' : '✗ false'}
        </span>
      );
    }

    if (typeof value === 'number') {
      return <span className="text-sky-400">{value.toLocaleString()}</span>;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className={`${depth > 0 ? 'pl-3 border-l-2 border-slate-700' : ''}`}>
          <table className="w-full">
            <tbody>
              {Object.entries(value).map(([k, v], i) => (
                <tr key={i} className="border-b border-slate-800/50 last:border-0">
                  <td className="text-slate-400 pr-3 py-1 font-medium whitespace-nowrap align-top">{k}:</td>
                  <td className="py-1">{renderValue(v, depth + 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="flex flex-col gap-1">
          {value.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-slate-600 text-xs">[{i}]</span>
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-violet-400">{String(value)}</span>;
  };

  const columns = table.length > 0 ? Object.keys(table[0]) : [];

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        isClosing || isOpening ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-[95vw] max-w-[1200px] max-h-[90vh] flex flex-col transition-all duration-200 ${
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Table className="text-sky-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">Task Result Table</h2>
              <p className="text-sm text-slate-400 font-mono mt-1">{taskName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b-2 border-slate-600">
                {columns.map((key) => (
                  <th key={key} className="text-left px-4 py-3 text-slate-200 font-bold uppercase tracking-wider bg-slate-800/50">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={i} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                  {columns.map((key, j) => (
                    <td key={j} className="px-4 py-3 text-slate-200 align-top">
                      {renderValue(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>{table.length} row{table.length !== 1 ? 's' : ''} × {columns.length} column{columns.length !== 1 ? 's' : ''}</span>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
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
