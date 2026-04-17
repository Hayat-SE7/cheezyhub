'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryStore } from '@/store/deliveryStore';
import { deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Bike, Delete } from 'lucide-react';

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function DeliveryLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useDeliveryStore();

  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [step, setStep]         = useState<'username' | 'pin'>('username');
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/delivery');
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
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.fullName ?? data.user.username}!`);
      router.replace('/delivery');
    } catch (err: any) {
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 py-12">

      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center">
          <Bike size={32} className="text-lime-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white tracking-tight">CheezyHub</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Driver Portal</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-xs">

        {step === 'username' ? (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm text-center">Enter your driver username</p>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && username.trim()) setStep('pin'); }}
              placeholder="username"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white text-center text-lg tracking-widest placeholder:text-zinc-700 outline-none focus:border-lime-400/50 transition-colors"
            />
            <button
              onClick={() => { if (username.trim()) setStep('pin'); }}
              disabled={!username.trim()}
              className="w-full py-3.5 rounded-xl bg-lime-400 text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-lime-300 transition-colors"
            >
              Continue →
            </button>
          </div>

        ) : (
          <div className="space-y-6">
            {/* Back + username display */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStep('username'); setPin(''); }}
                className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
              >
                ← back
              </button>
              <span className="text-zinc-400 text-sm flex-1 text-center">{username}</span>
            </div>

            {/* PIN dots */}
            <div
              className={`flex justify-center gap-3 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
              style={shake ? { animation: 'shake 0.4s ease-in-out' } : {}}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                    i < pin.length
                      ? 'bg-lime-400 border-lime-400 scale-110'
                      : 'bg-transparent border-zinc-700'
                  }`}
                />
              ))}
            </div>

            <p className="text-zinc-500 text-xs text-center">Enter your PIN</p>

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
                      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                      : 'bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800 hover:border-lime-400/30'
                  } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {key === '⌫' ? <Delete size={18} className="mx-auto" /> : key}
                </button>
              ))}
            </div>

            {loading && (
              <div className="flex justify-center">
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
