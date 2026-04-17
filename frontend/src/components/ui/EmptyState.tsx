import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: LucideIcon | string;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
  dark?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, className, dark = false }: EmptyStateProps) {
  return (
    <div className={clsx('text-center py-12', className)}>
      {Icon && (
        typeof Icon === 'string'
          ? <div className="text-4xl mb-3 opacity-40">{Icon}</div>
          : <Icon size={40} className={clsx('mx-auto mb-3', dark ? 'text-[#2a2a35]' : 'text-[#d5c8bc]')} />
      )}
      <p className={clsx('text-sm font-semibold', dark ? 'text-[#4a4a58]' : 'text-[#1c1714]')}>{title}</p>
      {description && <p className={clsx('text-xs mt-1', dark ? 'text-[#3a3a48]' : 'text-[#a39083]')}>{description}</p>}
      {action && (
        action.href
          ? <Link href={action.href} className={clsx('mt-5 inline-block px-6 py-3 rounded-xl font-semibold text-sm transition-colors', dark ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-amber-500 text-white hover:bg-amber-600')}>{action.label}</Link>
          : <button onClick={action.onClick} className={clsx('mt-5 px-6 py-3 rounded-xl font-semibold text-sm transition-colors', dark ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-amber-500 text-white hover:bg-amber-600')}>{action.label}</button>
      )}
    </div>
  );
}
