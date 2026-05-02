'use client';

import { useState, useEffect, useRef } from 'react';
import { useDeliveryStore } from '@/store/deliveryStore';
import { deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, Clock, XCircle, AlertCircle, ChevronDown, ChevronUp,
  LogOut, User, Phone, CreditCard, Car, Upload, Camera, Loader2, Image as ImageIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

const VEHICLE_TYPES = ['bike', 'car', 'van'];

const STATUS_CONFIG = {
  PENDING:      { color: 'text-zinc-400',  bg: 'bg-zinc-800',       icon: AlertCircle,   label: 'Not Submitted'    },
  UNDER_REVIEW: { color: 'text-amber-400', bg: 'bg-amber-400/10',   icon: Clock,         label: 'Under Review'     },
  VERIFIED:     { color: 'text-lime-400',  bg: 'bg-lime-400/10',    icon: CheckCircle2,  label: 'Verified'         },
  REJECTED:     { color: 'text-red-400',   bg: 'bg-red-400/10',     icon: XCircle,       label: 'Rejected'         },
};

export default function DeliveryProfilePage() {
  const router = useRouter();
  const { user, logout, updateUser } = useDeliveryStore();
  const [profile, setProfile]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [expanded, setExpanded]     = useState<string | null>('personal');

  const [form, setForm] = useState({
    fullName: '', phone: '', cnic: '', vehicleType: 'bike', vehiclePlate: '',
    emergencyContact: '', cnicFrontUrl: '', cnicBackUrl: '',
    licensePhotoUrl: '', profilePhotoUrl: '',
  });

  useEffect(() => {
    deliveryApi.getProfile()
      .then((res) => {
        const p = res.data.data;
        setProfile(p);
        setForm({
          fullName:         p.fullName         ?? '',
          phone:            p.phone            ?? '',
          cnic:             p.cnic             ?? '',
          vehicleType:      p.vehicleType      ?? 'bike',
          vehiclePlate:     p.vehiclePlate     ?? '',
          emergencyContact: p.emergencyContact ?? '',
          cnicFrontUrl:     p.cnicFrontUrl     ?? '',
          cnicBackUrl:      p.cnicBackUrl      ?? '',
          licensePhotoUrl:  p.licensePhotoUrl  ?? '',
          profilePhotoUrl:  p.profilePhotoUrl  ?? '',
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '')
      );
      const res = await deliveryApi.updateProfile(payload);
      updateUser({ verificationStatus: res.data.data.verificationStatus });
      setProfile((p: any) => ({ ...p, ...form, verificationStatus: res.data.data.verificationStatus }));
      toast.success('Profile saved!');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/delivery/login');
  };

  if (loading) return (
    <div className="px-4 pt-5 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-zinc-900 animate-pulse" />)}
    </div>
  );

  const vstatus = (profile?.verificationStatus ?? 'PENDING') as keyof typeof STATUS_CONFIG;
  const cfg     = STATUS_CONFIG[vstatus];
  const StatusIcon = cfg.icon;

  const docs = [
    { key: 'cnicFrontUrl',    label: 'CNIC Front'    },
    { key: 'cnicBackUrl',     label: 'CNIC Back'     },
    { key: 'licensePhotoUrl', label: 'License Photo' },
  ];
  const docsComplete = docs.every(d => form[d.key as keyof typeof form]);

  const sections = [
    { id: 'personal', label: 'Personal Info',    icon: User },
    { id: 'vehicle',  label: 'Vehicle Details',  icon: Car  },
    { id: 'docs',     label: 'Documents',        icon: CreditCard },
  ];

  return (
    <div className="px-4 pt-5 pb-4 space-y-4">

      {/* Verification status card */}
      <div className={clsx('rounded-2xl p-4 border', cfg.bg, 'border-current/10')}>
        <div className="flex items-center gap-3">
          <StatusIcon size={20} className={cfg.color} />
          <div>
            <p className={clsx('text-sm font-semibold', cfg.color)}>{cfg.label}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {vstatus === 'PENDING'      && 'Fill in your details and upload documents to apply'}
              {vstatus === 'UNDER_REVIEW' && 'Your documents are being reviewed — usually within 24h'}
              {vstatus === 'VERIFIED'     && 'You can go online and start accepting deliveries'}
              {vstatus === 'REJECTED'     && (profile?.verificationNote ?? 'Resubmit your documents')}
            </p>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      {sections.map(({ id, label, icon: Icon }) => (
        <div key={id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === id ? null : id)}
            className="w-full flex items-center justify-between px-4 py-3.5"
          >
            <div className="flex items-center gap-2.5">
              <Icon size={15} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-200">{label}</span>
            </div>
            {expanded === id ? <ChevronUp size={15} className="text-zinc-600" /> : <ChevronDown size={15} className="text-zinc-600" />}
          </button>

          {expanded === id && (
            <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">

              {id === 'personal' && (
                <>
                  <Field label="Full Name"       value={form.fullName}         onChange={v => setForm(f => ({...f, fullName: v}))}         placeholder="Ali Hassan" />
                  <Field label="Phone"           value={form.phone}            onChange={v => setForm(f => ({...f, phone: v}))}            placeholder="+92 300 0000000" type="tel" />
                  <Field label="CNIC Number"     value={form.cnic}             onChange={v => setForm(f => ({...f, cnic: v}))}             placeholder="00000-0000000-0" />
                  <Field label="Emergency Contact" value={form.emergencyContact} onChange={v => setForm(f => ({...f, emergencyContact: v}))} placeholder="+92 300 0000000" type="tel" />
                </>
              )}

              {id === 'vehicle' && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Vehicle Type</label>
                    <div className="flex gap-2">
                      {VEHICLE_TYPES.map(t => (
                        <button
                          key={t}
                          onClick={() => setForm(f => ({...f, vehicleType: t}))}
                          className={clsx(
                            'flex-1 py-2.5 rounded-xl text-xs font-medium capitalize border transition-colors',
                            form.vehicleType === t
                              ? 'bg-lime-400/10 border-lime-400/30 text-lime-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="Number Plate" value={form.vehiclePlate} onChange={v => setForm(f => ({...f, vehiclePlate: v}))} placeholder="LHR-1234" />
                </>
              )}

              {id === 'docs' && (
                <>
                  <p className="text-xs text-zinc-500 pt-1">
                    Upload your documents below. All 3 are required for verification.
                    Accepted formats: JPEG, PNG, WebP, PDF (max 5MB).
                  </p>
                  {docs.map(doc => (
                    <DocumentUploadField
                      key={doc.key}
                      label={doc.label}
                      field={doc.key}
                      currentUrl={form[doc.key as keyof typeof form] as string}
                      onUploaded={(url) => setForm(f => ({...f, [doc.key]: url}))}
                    />
                  ))}
                  <DocumentUploadField
                    label="Profile Photo (optional)"
                    field="profilePhotoUrl"
                    currentUrl={form.profilePhotoUrl}
                    onUploaded={(url) => setForm(f => ({...f, profilePhotoUrl: url}))}
                  />
                  {!docsComplete && (
                    <p className="text-xs text-zinc-600 flex items-center gap-1">
                      <AlertCircle size={11} />
                      Upload all 3 required docs to submit for verification
                    </p>
                  )}
                  {docsComplete && vstatus === 'PENDING' && (
                    <p className="text-xs text-lime-400/70 flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      All docs ready — save to submit for verification
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-lime-400 text-black font-bold text-sm disabled:opacity-50 hover:bg-lime-300 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl text-zinc-600 text-sm font-medium hover:text-red-400 flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut size={14} /> Sign Out
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-lime-400/40 transition-colors"
      />
    </div>
  );
}

function DocumentUploadField({ label, field, currentUrl, onUploaded }: {
  label: string;
  field: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum 5MB.');
      return;
    }

    // Show local preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const res = await deliveryApi.uploadDocument(file, field);
      const url = res.data.data.url;
      onUploaded(url);
      toast.success(`${label} uploaded!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const displayUrl = preview || currentUrl;
  const isImage = displayUrl && !displayUrl.endsWith('.pdf');

  return (
    <div>
      <label className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1">
        <Camera size={10} /> {label}
        {currentUrl && <CheckCircle2 size={10} className="text-lime-400 ml-1" />}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {displayUrl ? (
        <div className="relative group">
          {isImage ? (
            <img
              src={displayUrl}
              alt={label}
              className="w-full h-32 object-cover rounded-xl border border-zinc-700"
            />
          ) : (
            <div className="w-full h-32 rounded-xl border border-zinc-700 bg-zinc-800 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon size={24} className="text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-500 mt-1">PDF Document</p>
              </div>
            </div>
          )}

          {/* Re-upload overlay */}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center"
          >
            {uploading ? (
              <Loader2 size={20} className="text-white animate-spin" />
            ) : (
              <div className="text-center">
                <Upload size={18} className="text-white mx-auto" />
                <p className="text-xs text-white mt-1">Replace</p>
              </div>
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={clsx(
            'w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors',
            uploading
              ? 'border-lime-400/30 bg-lime-400/5'
              : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800'
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="text-lime-400 animate-spin" />
              <span className="text-xs text-lime-400">Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={20} className="text-zinc-500" />
              <span className="text-xs text-zinc-500">Tap to upload {label.toLowerCase()}</span>
              <span className="text-[10px] text-zinc-600">JPEG, PNG, WebP, PDF up to 5MB</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
