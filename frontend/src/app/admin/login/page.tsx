'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAdminStore } from '@/store/adminStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const login  = useAdminStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [pin,      setPin]      = useState('');
  const [showPin,  setShowPin]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!username || !pin) { toast.error('Enter username and PIN'); return; }
    setLoading(true);
    try {
      const res = await authApi.login({ identifier: username, pin, role: 'staff' });
      const { token, user } = res.data.data;
      if (user.role !== 'admin') { toast.error('Admin access required'); return; }
      login(token, user);
      router.replace('/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg-admin-exec dark-ui min-h-screen flex items-center justify-center px-5 py-12 relative overflow-hidden">

      {/* Concentric rotating rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-[640px] h-[640px] rounded-full border border-amber-500/[0.05] animate-spin-slow" />
        <div
          className="absolute w-[460px] h-[460px] rounded-full border border-amber-500/[0.07] animate-spin-reverse"
          style={{ borderStyle: 'dashed' }}
        />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-amber-500/[0.11] animate-pulse-ring" />
        <div className="absolute w-48 h-48 rounded-full bg-amber-500/[0.04] blur-3xl" />
      </div>

      {/* Vertical accent lines */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/20 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/10 to-transparent pointer-events-none" />

      {/* Form */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-5">
            <div className="absolute inset-0 rounded-2xl bg-amber-500/15 animate-pulse-ring" />
            <div className="relative w-14 h-14 rounded-2xl glass-amber flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield size={22} className="text-amber-400" />
            </div>
          </div>
          <h1 className="font-display font-bold text-white text-3xl mb-1 tracking-tight">
            Admin Panel
          </h1>
          <p className="text-white/25 text-[11px] font-mono tracking-[0.25em] uppercase">
            Authorized Personnel Only
          </p>
        </div>

        {/* Card */}
        <div className="glass-card-exec rounded-3xl p-7">

          {/* Top accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent mb-6" />

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-white/25 mb-1.5 uppercase tracking-widest font-mono">
                Username
              </label>
              <input
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-amber-500/[0.12]
                           text-white text-sm font-mono placeholder:text-white/15
                           outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/10
                           transition-all"
                placeholder="Admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white/25 mb-1.5 uppercase tracking-widest font-mono">
                PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-amber-500/[0.12]
                             text-white text-sm pr-12 font-mono tracking-widest placeholder:text-white/15
                             outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/10
                             transition-all"
                  placeholder="••••"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                  onClick={() => setShowPin(!showPin)}
                  type="button"
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-press mt-6 w-full flex items-center justify-center gap-2.5 py-4
                       bg-gradient-to-r from-amber-600 to-amber-800
                       hover:from-amber-700 hover:to-amber-900
                       disabled:opacity-50 text-white rounded-2xl font-bold text-[15px]
                       shadow-lg shadow-amber-500/15 transition-all"
          >
            {loading
              ? <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </span>
              : <>Access System <ArrowRight size={15} /></>
            }
          </button>
        </div>

        <p className="text-center text-white/10 text-[10px] font-mono mt-5 tracking-widest uppercase">
          CheezyHub © {new Date().getFullYear()} · Secure Access
        </p>
      </div>
    </div>
  );
}
