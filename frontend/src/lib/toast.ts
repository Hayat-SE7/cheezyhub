import toast from 'react-hot-toast';

export const showToast = {
  success: (msg: string, opts?: { duration?: number }) =>
    toast.success(msg, { duration: opts?.duration ?? 3000 }),

  error: (msg: string, opts?: { duration?: number }) =>
    toast.error(msg, { duration: opts?.duration ?? 4000 }),

  info: (msg: string, opts?: { icon?: string; duration?: number }) =>
    toast(msg, { icon: opts?.icon ?? 'ℹ️', duration: opts?.duration ?? 3000 }),

  warning: (msg: string, opts?: { duration?: number }) =>
    toast(msg, { icon: '⚠️', duration: opts?.duration ?? 4000 }),
};
