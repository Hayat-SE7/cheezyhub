'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryStore } from '@/store/deliveryStore';
import { deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { MapPin, Delete } from 'lucide-react';
import Cookies from 'js-cookie';

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function DeliveryLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useDeliveryStore();

  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [step, setStep]         = useState<'username' | 'pin'>('username');
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);
  const submittingRef           = useRef(false);

  useEffect(() => {
    // Only redirect if both the store AND the cookie are valid.
    // If the cookie is missing (expired/removed) the store is stale — don't redirect.
    const token = Cookies.get('ch_delivery_token');
    if (isAuthenticated && token) router.replace('/delivery');
  }, [isAuthenticated]);

  const handlePad = (val: string) => {
    if (val === '⌫') { setPin((p) => p.slice(0, -1)); return; }
    if (val === '')   return;
    if (pin.length >= 6) return;
    const next = pin + val;
    setPin(next);
    if (next.length >= 4) handleLogin(next);
  };

  const handleLogin = async (enteredPin: string) => {
    if (!username.trim()) { toast.error('Enter your username first'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const res  = await deliveryApi.login({ identifier: username.trim(), pin: enteredPin });
      const data = res.data.data;
      if (data.user.role !== 'delivery') {
        toast.error('Not a driver account');
        setPin('');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      login(data.token, data.user, data.refreshToken);
      toast.success(`Welcome back, ${data.user.fullName ?? data.user.username}!`);
      router.replace('/delivery');
    } catch (err: any) {
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="login-bg-delivery-map min-h-screen flex items-center justify-center px-5 py-12 relative">

      {/* Road lines overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[22%] left-0 right-0 h-px bg-lime-400/[0.08]" />
        <div className="absolute top-[55%] left-0 right-0 h-px bg-lime-400/[0.06]" />
        <div className="absolute top-[78%] left-0 right-0 h-px bg-lime-400/[0.05]" />
        <div className="absolute left-[20%] top-0 bottom-0 w-px bg-lime-400/[0.08]" />
        <div className="absolute left-[65%] top-0 bottom-0 w-px bg-lime-400/[0.06]" />
        {/* Intersection glow at center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-lime-400/[0.05] blur-3xl" />
      </div>

      {/* Glass card */}
      <div className="glass-card-lime relative z-10 w-full max-w-xs rounded-3xl p-8 animate-slide-up">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-lime-400/10 border border-lime-400/20
                          flex items-center justify-center mb-3">
            <MapPin size={26} className="text-lime-400" />
          </div>
          <h1 className="text-white font-display font-bold text-xl tracking-tight">Driver Portal</h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-mono tracking-wider">CheezyHub Delivery</p>
        </div>

        {/* Step 1 — username */}
        {step === 'username' && (
          <div className="space-y-4 animate-slide-up">
            <p className="text-zinc-400 text-sm text-center">Enter your driver username</p>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && username.trim()) setStep('pin'); }}
              placeholder="username"
              className="w-full bg-zinc-900/60 border border-lime-400/[0.15] rounded-xl
                         px-4 py-3.5 text-white text-center text-lg tracking-widest
                         placeholder:text-zinc-700 outline-none
                         focus:border-lime-400/50 focus:ring-1 focus:ring-lime-400/10 transition-all"
            />
            <button
              onClick={() => { if (username.trim()) setStep('pin'); }}
              disabled={!username.trim()}
              className="w-full py-3.5 rounded-xl bg-lime-400 text-black font-bold text-sm
                         disabled:opacity-40 disabled:cursor-not-allowed hover:bg-lime-300 transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 — numpad */}
        {step === 'pin' && (
          <div className="space-y-5 animate-slide-up">

            {/* Back + username */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStep('username'); setPin(''); }}
                className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors font-mono"
              >
                ← back
              </button>
              <span className="text-zinc-400 text-sm flex-1 text-center font-mono">{username}</span>
            </div>

            {/* PIN dots */}
            <div className={`flex justify-center gap-3 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                    i < pin.length
                      ? 'bg-lime-400 border-lime-400 scale-110 shadow-[0_0_8px_rgba(163,230,53,0.7)]'
                      : 'bg-transparent border-zinc-700'
                  }`}
                />
              ))}
            </div>

            <p className="text-zinc-500 text-xs text-center font-mono tracking-wider">Enter your PIN</p>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {PAD.map((key, i) => (
                <button
                  key={i}
                  onClick={() => handlePad(key)}
                  disabled={loading || key === ''}
                  className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                    key === ''
                      ? 'cursor-default'
                      : key === '⌫'
                      ? 'bg-zinc-900/50 text-zinc-500 hover:bg-zinc-800/60 hover:text-white border border-lime-400/[0.08]'
                      : 'bg-zinc-900/50 text-white border border-lime-400/[0.10] hover:border-lime-400/30 hover:bg-zinc-800/60'
                  } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {key === '⌫' ? <Delete size={18} className="mx-auto" /> : key}
                </button>
              ))}
            </div>

            {loading && (
              <div className="flex justify-center" role="status" aria-label="Logging in">
                <div className="w-5 h-5 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
