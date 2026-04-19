'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useCounterStore } from '@/store/counterStore';
import { Delete, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function CounterLoginPage() {
  const router       = useRouter();
  const loginCounter = useCounterStore((s) => s.loginCounter);

  const [username, setUsername] = useState('');
  const [pin,      setPin]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState<'username' | 'pin'>('username');
  const [shake,    setShake]    = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleUsernameSubmit = () => {
    if (!username.trim()) { triggerShake(); toast.error('Enter your username'); return; }
    setStep('pin');
  };

  const appendDigit = (d: string) => {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  const handleLogin = useCallback(async (finalPin: string) => {
    if (finalPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    if (!username.trim()) { toast.error('Username missing'); return; }

    setLoading(true);
    try {
      const res  = await authApi.login({ identifier: username.trim(), pin: finalPin, role: 'staff' });
      const data = res.data.data;

      if (data.user.role !== 'cashier' && data.user.role !== 'admin') {
        toast.error('Access denied — cashier account required');
        setPin('');
        setLoading(false);
        return;
      }

      loginCounter(data.token, data.user);
      toast.success(`Welcome, ${data.user.username ?? data.user.name ?? 'Cashier'}!`);
      router.push('/counter');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
      triggerShake();
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [username, loginCounter, router]);

  useEffect(() => {
    if (pin.length === 6) handleLogin(pin);
  }, [pin, handleLogin]);

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="login-bg-counter-grid dark-ui h-screen flex lg:flex-row overflow-hidden">

      {/* ── LEFT COLUMN — desktop branding + step indicator ── */}
      <div className="hidden lg:flex lg:w-[38%] flex-col items-center justify-center p-12 border-r border-white/[0.04] relative">

        {/* Amber ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Brand */}
          <div className="flex flex-col items-center mb-12">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 rounded-xl bg-amber-400/20 blur-lg scale-150" />
              <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl shadow-xl shadow-amber-500/25">
                🧀
              </div>
            </div>
            <div className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
              CheezyHub
            </div>
            <div className="text-[#3a3a48] font-mono text-[11px] tracking-[0.25em] uppercase mt-1.5">
              Counter Terminal
            </div>
          </div>

          {/* Vertical step indicator */}
          <div className="flex flex-col gap-0">
            {/* Step 1 */}
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={clsx(
                  'w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black transition-all duration-300',
                  step === 'username' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/40' : 'bg-amber-500/20 text-amber-500'
                )}>1</div>
                <div className={clsx('w-px h-10 transition-all duration-500 mt-1', step === 'pin' ? 'bg-amber-500/30' : 'bg-[#1a1a22]')} />
              </div>
              <div className="pt-1.5">
                <p className={clsx('text-sm font-bold transition-colors', step === 'username' ? 'text-white' : 'text-[#3a3a48]')}>
                  Identify
                </p>
                <p className="text-[11px] text-[#2a2a32] font-mono mt-0.5">Enter staff username</p>
              </div>
            </div>
            {/* Step 2 */}
            <div className="flex items-start gap-4">
              <div className={clsx(
                'w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black transition-all duration-300 flex-shrink-0',
                step === 'pin' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/40' : 'bg-[#111118] text-[#2a2a35] border border-[#1a1a22]'
              )}>2</div>
              <div className="pt-1.5">
                <p className={clsx('text-sm font-bold transition-colors', step === 'pin' ? 'text-white' : 'text-[#3a3a48]')}>
                  Authenticate
                </p>
                <p className="text-[11px] text-[#2a2a32] font-mono mt-0.5">Enter your PIN</p>
              </div>
            </div>
          </div>

          <p className="text-[#1e1e28] font-mono text-[10px] tracking-widest uppercase mt-12">
            Authorized Staff Only
          </p>
        </div>
      </div>

      {/* ── RIGHT COLUMN — form area ── */}
      <div className="flex-1 h-full flex items-center justify-center p-6 lg:p-12 relative">

        {/* Mobile: step indicator (horizontal) */}
        <div className="absolute top-6 left-0 right-0 flex justify-center lg:hidden">
          <div className="flex items-center gap-2">
            <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all',
              step === 'username' ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-500'
            )}>1</div>
            <div className={clsx('w-12 h-px transition-all', step === 'pin' ? 'bg-amber-500/40' : 'bg-[#1c1c22]')} />
            <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all',
              step === 'pin' ? 'bg-amber-500 text-black' : 'bg-[#1c1c22] text-[#3a3a48]'
            )}>2</div>
          </div>
        </div>

        {/* ── STEP 1: USERNAME ── */}
        {step === 'username' && (
          <div className={clsx('w-full max-w-xs animate-slide-up', shake && '[animation:shake_0.4s_ease]')}>
            <h2 className="font-display font-bold text-white text-2xl mb-1">Who&apos;s clocking in?</h2>
            <p className="text-[#3a3a48] font-mono text-xs mb-8 tracking-wide">Enter your staff username</p>

            <input
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl bg-[#0a0a0c] border border-[#1e1e28]
                         text-[#f0f0f3] text-sm outline-none
                         focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
                         transition-all placeholder:text-[#2a2a38] font-mono tracking-wide mb-4"
              placeholder="e.g. cashier1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUsernameSubmit()}
            />
            <button
              onClick={handleUsernameSubmit}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98]
                         text-black rounded-xl font-black text-sm tracking-wide transition-all
                         shadow-lg shadow-amber-500/20"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: NUMPAD ── */}
        {step === 'pin' && (
          <div className="w-full max-w-[300px] animate-slide-up">

            {/* Back + username chip */}
            <button
              onClick={() => { setStep('username'); setPin(''); }}
              className="flex items-center gap-1.5 text-[11px] text-[#3a3a48] hover:text-amber-500 transition-colors mb-6 font-mono"
            >
              ← <span className="text-[#4a4a58] bg-[#0d0d12] border border-[#1a1a22] px-2 py-0.5 rounded-md">{username}</span>
            </button>

            {/* PIN dots */}
            <div className={clsx('flex justify-center gap-3.5 mb-7', shake && '[animation:shake_0.4s_ease]')}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={clsx(
                    'w-3.5 h-3.5 rounded-full transition-all duration-150',
                    i < pin.length
                      ? 'bg-amber-400 scale-110 shadow-[0_0_10px_rgba(251,191,36,0.7)]'
                      : 'bg-[#1e1e28] border border-[#2a2a38]'
                  )}
                />
              ))}
            </div>

            <p className="text-center text-[10px] text-[#3a3a48] font-mono tracking-[0.2em] uppercase mb-5">
              Enter PIN
            </p>

            {/* Numpad grid */}
            <div className="grid grid-cols-3 gap-3">
              {KEYS.map((key, i) => {
                if (key === '') return <div key={i} />;
                const isBack = key === '⌫';
                return (
                  <button
                    key={key + i}
                    onClick={() => isBack ? backspace() : appendDigit(key)}
                    disabled={loading}
                    className={clsx(
                      'h-16 rounded-2xl font-bold text-xl transition-all duration-100 active:scale-90 disabled:opacity-30',
                      isBack
                        ? 'bg-transparent text-[#3a3a48] hover:text-red-400 hover:bg-red-500/10'
                        : 'bg-[#0d0d10] border border-[#1a1a22] text-[#d0d0d8] hover:border-amber-500/40 hover:bg-[#161620] hover:text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                    )}
                  >
                    {isBack ? <Delete size={18} className="mx-auto" /> : key}
                  </button>
                );
              })}
            </div>

            {/* Login button when 4–5 digits */}
            {pin.length >= 4 && pin.length < 6 && (
              <button
                onClick={() => handleLogin(pin)}
                disabled={loading}
                className="w-full mt-5 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50
                           text-black rounded-xl font-black text-sm tracking-wide transition-all
                           flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying...</> : 'Login →'}
              </button>
            )}

            {loading && pin.length === 6 && (
              <div className="flex justify-center mt-5">
                <Loader2 size={18} className="animate-spin text-amber-500" />
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
