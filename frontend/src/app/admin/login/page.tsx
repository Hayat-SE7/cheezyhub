'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAdminStore } from '@/store/adminStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';

const DOTS = Array.from({ length: 30 }, (_, i) => i);

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
    <div className="dark-ui login-bg-admin min-h-screen flex items-center justify-center px-5 relative overflow-hidden">
      {/* Animated grid dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {DOTS.map((i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-amber-500/20"
            style={{
              top:  `${(i * 11 + 5) % 95}%`,
              left: `${(i * 17 + 3) % 95}%`,
              animationDelay:   `${i * 0.22}s`,
              animationDuration:`${4 + (i % 5)}s`,
              animation: `pulseDot ${4 + (i % 5)}s ease-in-out ${i * 0.22}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Vertical amber line accent */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-amber-500/40 to-transparent" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="relative inline-flex w-18 h-18 mb-5">
            <div className="absolute inset-0 rounded-2xl bg-amber-500/15 animate-ping opacity-40" />
            <div className="relative w-16 h-16 mx-auto rounded-2xl glass-amber flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield size={26} className="text-amber-400" />
            </div>
          </div>
          <h1 className="font-display font-bold text-white text-3xl mb-1">Admin Panel</h1>
          <p className="text-white/30 text-sm font-ui">Authorized personnel only</p>
        </div>

        {/* Glass card */}
        <div className="glass-card-dark rounded-3xl p-7 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[10px] font-bold text-white/30 mb-1.5 uppercase tracking-widest font-ui">Username</label>
              <input
                className="input-dark w-full px-4 py-3.5 rounded-xl text-sm font-ui"
                placeholder="Admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/30 mb-1.5 uppercase tracking-widest font-ui">PIN</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  className="input-dark w-full px-4 py-3.5 rounded-xl text-sm pr-12 font-mono tracking-widest"
                  placeholder="••••"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
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
            className="btn-press mt-6 w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white rounded-2xl font-ui font-bold text-[15px] shadow-lg shadow-amber-500/25 transition-all"
          >
            {loading
              ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying...</span>
              : <>Enter Admin Panel <ArrowRight size={15} /></>
            }
          </button>
        </div>

        <p className="text-center text-white/15 text-xs mt-6 font-ui">
          CheezyHub © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
