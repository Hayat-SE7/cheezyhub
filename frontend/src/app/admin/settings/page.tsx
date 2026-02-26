'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Save, MapPin, DollarSign, Radius, Phone, Store } from 'lucide-react';

interface Settings {
  deliveryFee: number;
  serviceCharge: number;
  deliveryRadiusKm: number;
  restaurantLat: number;
  restaurantLng: number;
  ordersAccepting: boolean;
  restaurantName: string;
  restaurantPhone: string;
}

const FIELD_CONFIG = [
  {
    section: 'Restaurant Info',
    icon: Store,
    fields: [
      { key: 'restaurantName', label: 'Restaurant Name', type: 'text', placeholder: 'CheezyHub' },
      { key: 'restaurantPhone', label: 'Phone Number', type: 'text', placeholder: '+923001234567' },
    ],
  },
  {
    section: 'Fees',
    icon: DollarSign,
    fields: [
      { key: 'deliveryFee', label: 'Delivery Fee ($)', type: 'number', placeholder: '3.99' },
      { key: 'serviceCharge', label: 'Service Charge ($)', type: 'number', placeholder: '0.00' },
    ],
  },
  {
    section: 'Delivery Radius',
    icon: Radius,
    fields: [
      { key: 'deliveryRadiusKm', label: 'Max Radius (km)', type: 'number', placeholder: '10' },
    ],
  },
  {
    section: 'Restaurant Location',
    icon: MapPin,
    fields: [
      { key: 'restaurantLat', label: 'Latitude', type: 'number', placeholder: '24.8607' },
      { key: 'restaurantLng', label: 'Longitude', type: 'number', placeholder: '67.0104' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getSettings()
      .then((res) => setSettings(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await adminApi.updateSettings(settings);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Settings, value: any) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  if (loading || !settings) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Settings</h1>
          <p className="text-[#4a4a58] text-sm mt-0.5">Restaurant configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-press flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl font-display font-bold text-sm transition-colors"
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Orders toggle */}
      <div className="mb-5 p-5 rounded-2xl bg-[#0f0f11] border border-[#222228]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-[#f2f2f5] text-sm">Accept Orders</div>
            <div className="text-[#4a4a58] text-xs mt-0.5">Toggle to pause all new orders</div>
          </div>
          <button
            onClick={() => update('ordersAccepting', !settings.ordersAccepting)}
            className={`relative w-14 h-7 rounded-full transition-colors ${settings.ordersAccepting ? 'bg-emerald-500' : 'bg-[#222228]'}`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${settings.ordersAccepting ? 'left-8' : 'left-1'}`} />
          </button>
        </div>
        <div className={`mt-2 text-xs font-semibold ${settings.ordersAccepting ? 'text-emerald-400' : 'text-red-400'}`}>
          {settings.ordersAccepting ? '✅ Orders are OPEN' : '⏸ Orders are PAUSED'}
        </div>
      </div>

      {/* Field groups */}
      <div className="space-y-4">
        {FIELD_CONFIG.map(({ section, icon: Icon, fields }) => (
          <div key={section} className="bg-[#0f0f11] rounded-2xl border border-[#222228] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon size={15} className="text-amber-400" />
              <span className="font-display font-bold text-[#f2f2f5] text-sm">{section}</span>
            </div>
            <div className="grid gap-3">
              {fields.map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <input
                    type={type}
                    step={type === 'number' ? '0.01' : undefined}
                    className="w-full px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 transition-colors"
                    placeholder={placeholder}
                    value={(settings as any)[key] ?? ''}
                    onChange={(e) =>
                      update(
                        key as keyof Settings,
                        type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Location tip */}
      <div className="mt-4 p-4 rounded-xl bg-amber-500/8 border border-amber-500/15">
        <p className="text-amber-400/80 text-xs leading-relaxed">
          <strong className="font-bold">📍 Location Tip:</strong> Set your restaurant's exact latitude/longitude to enable delivery radius validation.
          Leave at 0,0 to skip radius checks. You can find coordinates using{' '}
          <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="underline">Google Maps</a>{' '}
          (right-click on map → "What's here?").
        </p>
      </div>
    </div>
  );
}
