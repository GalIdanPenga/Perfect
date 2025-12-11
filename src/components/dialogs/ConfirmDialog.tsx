import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ConfirmDialogProps {
  /**
   * Whether the dialog is visible
   */
  isOpen: boolean;

  /**
   * Dialog title
   */
  title: string;

  /**
   * Icon to display in the header
   */
  icon: LucideIcon;

  /**
   * Message to display in the dialog body
   */
  message: string | React.ReactNode;

  /**
   * Text to highlight within the message (e.g., client name)
   */
  highlightText?: string;

  /**
   * Theme color for the dialog (hex color)
   */
  themeColor: string;

  /**
   * Label for the confirm button
   */
  confirmLabel?: string;

  /**
   * Label for the cancel button
   */
  cancelLabel?: string;

  /**
   * Callback when confirm is clicked
   */
  onConfirm: () => void;

  /**
   * Callback when cancel is clicked
   */
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog component
 *
 * Displays a modal dialog with customizable title, message, icon, and theme color.
 * Used for confirming destructive or important actions.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showDialog}
 *   title="Confirm Action"
 *   icon={AlertCircle}
 *   message="Are you sure you want to proceed?"
 *   themeColor="#ef4444"
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  icon: Icon,
  message,
  highlightText,
  themeColor,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-slate-800 rounded-xl border-2 shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-selectPulse"
        style={{
          borderColor: themeColor,
          boxShadow: `0 20px 60px ${themeColor}40`
        }}
      >
        {/* Header */}
        <div
          className="p-4 border-b"
          style={{
            borderBottomColor: `${themeColor}30`,
            background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`
          }}
        >
          <h3
            className="text-lg font-bold flex items-center gap-2"
            style={{ color: themeColor }}
          >
            <Icon size={20} />
            {title}
          </h3>
        </div>

        {/* Body */}
        <div className="p-6">
          {typeof message === 'string' ? (
            <p className="text-slate-300 text-sm">
              {message}
              {highlightText && (
                <span
                  className="font-bold mx-1.5 px-2 py-0.5 rounded"
                  style={{
                    color: themeColor,
                    backgroundColor: `${themeColor}20`
                  }}
                >
                  {highlightText}
                </span>
              )}
              {highlightText && '?'}
            </p>
          ) : (
            message
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 bg-slate-900/50 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-white rounded-lg font-medium text-sm transition-all shadow-lg"
            style={{
              backgroundColor: themeColor,
              boxShadow: `0 4px 12px ${themeColor}40`
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              const r = parseInt(themeColor.slice(1, 3), 16);
              const g = parseInt(themeColor.slice(3, 5), 16);
              const b = parseInt(themeColor.slice(5, 7), 16);
              e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`;
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = themeColor;
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
