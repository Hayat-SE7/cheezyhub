'use client';

import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'default', loading = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmCls = variant === 'danger'
    ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
    : variant === 'warning'
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
    : 'bg-amber-500 text-black hover:bg-amber-400 border-transparent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm bg-[#0f0f12] border border-[#1e1e22] rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', variant === 'danger' ? 'bg-red-500/10' : 'bg-amber-500/10')}>
            <AlertTriangle size={20} className={variant === 'danger' ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <h3 className="text-[#f2f2f5] font-bold text-base">{title}</h3>
        </div>
        <p className="text-[#4a4a58] text-sm mb-5 leading-relaxed">{description}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1e1e22] text-[#9898a5] hover:bg-[#2a2a32] transition-colors disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading} className={clsx('flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors disabled:opacity-50', confirmCls)}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
