'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useKitchenStore } from '@/store/kitchenStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ChefHat, ArrowRight, Flame } from 'lucide-react';

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
      login(token, user); // sets ch_kitchen_token cookie + isAuthenticated = true
      router.replace('/kitchen');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark-ui login-bg-kitchen min-h-screen flex flex-col lg:flex-row overflow-hidden">

      {/* ── Left brand panel (desktop) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-16 relative">
        <div className="relative z-10 text-center">
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping scale-125" />
            <div className="absolute inset-0 rounded-full bg-amber-500/15 animate-ping scale-150" style={{ animationDelay: '0.4s' }} />
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-2xl shadow-orange-500/30">
              <ChefHat size={48} className="text-white" />
            </div>
          </div>
          <h1 className="font-display font-black text-white text-5xl xl:text-6xl leading-tight mb-4">
            Kitchen<br />
            <span style={{ background: 'linear-gradient(135deg,#fb923c,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Station
            </span>
          </h1>
          <p className="text-white/40 text-lg font-ui mb-8">Where the magic happens 🔥</p>
          <div className="flex flex-col gap-3">
            {['🎯 Live order queue', '⏱️ Real-time timers', '🔔 Instant notifications'].map((f) => (
              <div key={f} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-white/50 text-sm font-ui">
                <Flame size={14} className="text-orange-400 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-10 min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8 animate-slide-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-orange-500/30">
              <ChefHat size={28} className="text-white" />
            </div>
            <h1 className="font-display font-bold text-white text-2xl">Kitchen Panel</h1>
          </div>

          <div className="hidden lg:block mb-7 animate-slide-up">
            <h2 className="font-display font-bold text-white text-2xl">Staff Login</h2>
            <p className="text-white/30 text-sm font-ui mt-1">Enter your kitchen credentials</p>
          </div>

          <div className="glass-card-dark rounded-3xl p-7 animate-slide-up" style={{ animationDelay: '80ms' }}>
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-white/30 mb-1.5 uppercase tracking-widest font-ui">Username</label>
                <input
                  className="input-dark w-full px-4 py-3.5 rounded-xl text-sm font-ui"
                  placeholder="Kitchen username"
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
              className="btn-press mt-6 w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white rounded-2xl font-ui font-bold text-[15px] shadow-lg shadow-orange-500/25 transition-all"
            >
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</span>
                : <>Start Cooking <ArrowRight size={15} /></>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
