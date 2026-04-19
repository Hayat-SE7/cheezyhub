'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useKitchenStore } from '@/store/kitchenStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ChefHat } from 'lucide-react';

export default function KitchenLoginPage() {
  const router = useRouter();
  const login  = useKitchenStore((s) => s.login);
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
      if (user.role !== 'kitchen' && user.role !== 'admin') {
        toast.error('Kitchen access required');
        return;
      }
      login(token, user);
      router.replace('/kitchen');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg-kitchen-flame min-h-screen flex items-center justify-center px-5 py-12 relative overflow-hidden">

      {/* Flame blobs */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around pointer-events-none">
        {[0,1,2,3,4].map((i) => (
          <div
            key={i}
            className="w-24 h-52 animate-flicker opacity-25"
            style={{
              background: 'radial-gradient(ellipse at bottom, #f97316 0%, #dc2626 55%, transparent 100%)',
              filter: 'blur(18px)',
              animationDelay: `${i * 0.45}s`,
              animationDuration: `${2 + i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Ambient top glow */}
      <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(251,191,36,0.08) 0%, transparent 70%)' }} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full bg-orange-500/30 blur-2xl scale-150 animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-b from-amber-400 to-red-600
                            flex items-center justify-center shadow-2xl shadow-orange-600/50">
              <ChefHat size={38} className="text-white drop-shadow-lg" />
            </div>
          </div>
          <h1 className="font-display font-black text-white text-5xl leading-none mb-2 tracking-tight">
            KITCHEN
          </h1>
          <p className="text-orange-300/60 font-mono text-xs tracking-[0.3em] uppercase">
            Staff Access
          </p>
        </div>

        {/* Form */}
        <div className="glass-card-flame rounded-3xl p-7 space-y-4">

          <div>
            <label className="block text-[10px] font-bold text-orange-300/40 mb-1.5 uppercase tracking-widest font-mono">
              Username
            </label>
            <input
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-orange-500/20
                         text-white text-sm font-mono placeholder:text-white/20
                         outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/15
                         transition-all"
              placeholder="Kitchen username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-orange-300/40 mb-1.5 uppercase tracking-widest font-mono">
              PIN
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-orange-500/20
                           text-white text-sm pr-12 font-mono tracking-widest placeholder:text-white/20
                           outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/15
                           transition-all"
                placeholder="••••"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-300/30 hover:text-orange-300/70 transition-colors"
                onClick={() => setShowPin(!showPin)}
                type="button"
              >
                {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-press w-full flex items-center justify-center gap-2 py-4 mt-2
                       bg-gradient-to-r from-red-600 via-orange-500 to-amber-400
                       hover:from-red-700 hover:via-orange-600 hover:to-amber-500
                       disabled:opacity-50 text-white rounded-2xl font-bold text-[15px]
                       shadow-xl shadow-orange-600/30 transition-all"
          >
            {loading
              ? <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              : <>Fire It Up 🔥</>
            }
          </button>
        </div>

        <p className="text-center text-orange-300/20 text-[10px] font-mono mt-5 tracking-widest uppercase">
          CheezyHub · Kitchen Terminal
        </p>
      </div>
    </div>
  );
}
