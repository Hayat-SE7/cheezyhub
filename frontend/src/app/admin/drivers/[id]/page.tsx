'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminDriverApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle,
  Wallet, Package, PhoneCall, Bike, Shield, ToggleLeft,
  ToggleRight, FileText, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const DRIVER_STATUS = {
  AVAILABLE:   { dot: 'bg-lime-400', text: 'text-lime-400',  label: 'Online'     },
  ON_DELIVERY: { dot: 'bg-blue-400', text: 'text-blue-400',  label: 'Delivering' },
  OFFLINE:     { dot: 'bg-zinc-600', text: 'text-zinc-500',  label: 'Offline'    },
};

const VERIFY_CFG = {
  PENDING:      { color: 'text-zinc-400',  bg: 'bg-zinc-800/50',     icon: AlertCircle,  label: 'Not Submitted'  },
  UNDER_REVIEW: { color: 'text-amber-400', bg: 'bg-amber-400/10',    icon: Clock,        label: 'Under Review'   },
  VERIFIED:     { color: 'text-lime-400',  bg: 'bg-lime-400/10',     icon: CheckCircle2, label: 'Verified'       },
  REJECTED:     { color: 'text-red-400',   bg: 'bg-red-400/10',      icon: XCircle,      label: 'Rejected'       },
};

export default function DriverDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [driver, setDriver]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'overview' | 'orders' | 'settlements'>('overview');

  // Verify form
  const [verifyNote, setVerifyNote]     = useState('');
  const [verifying, setVerifying]       = useState(false);
  const [confirmVerify, setConfirmVerify] = useState<'approve' | 'reject' | null>(null);

  // COD settle form
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote]     = useState('');
  const [settling, setSettling]         = useState(false);
  const [confirmSettle, setConfirmSettle] = useState(false);

  // Manual assign form
  const [assignOrderId, setAssignOrderId] = useState('');
  const [assigning, setAssigning]         = useState(false);

  const fetchDriver = async () => {
    try {
      const res = await adminDriverApi.getOne(id);
      setDriver(res.data.data);
    } catch { toast.error('Driver not found'); router.back(); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (id) fetchDriver(); }, [id]);

  const handleToggleActive = async () => {
    try {
      await adminDriverApi.update(id, { isActive: !driver.isActive });
      setDriver((d: any) => ({ ...d, isActive: !d.isActive }));
      toast.success(driver.isActive ? 'Driver deactivated' : 'Driver activated');
    } catch { toast.error('Update failed'); }
  };

  const handleVerify = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !verifyNote.trim()) { toast.error('Add a note for rejection'); return; }
    setVerifying(true);
    try {
      await adminDriverApi.verify(id, { action, note: verifyNote || undefined });
      toast.success(action === 'approve' ? 'Driver verified ✓' : 'Verification rejected');
      fetchDriver();
      setVerifyNote('');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed');
    } finally { setVerifying(false); }
  };

  const handleSettle = async () => {
    const amount = parseFloat(settleAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > driver.codPending + 0.01) { toast.error(`Maximum is Rs.${Math.round(driver.codPending)}`); return; }
    setSettling(true);
    try {
      await adminDriverApi.settle({ driverId: id, submittedAmount: amount, notes: settleNote || undefined });
      toast.success('Settlement recorded!');
      setSettleAmount(''); setSettleNote('');
      fetchDriver();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Settle failed');
    } finally { setSettling(false); }
  };

  const handleAssign = async () => {
    if (!assignOrderId.trim()) { toast.error('Enter an order ID'); return; }
    setAssigning(true);
    try {
      await adminDriverApi.manualAssign(id, assignOrderId.trim());
      toast.success('Driver assigned!');
      setAssignOrderId('');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Assign failed');
    } finally { setAssigning(false); }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-[#0c0c0e] animate-pulse" />)}
    </div>
  );

  if (!driver) return null;

  const vs     = VERIFY_CFG[driver.verificationStatus as keyof typeof VERIFY_CFG] ?? VERIFY_CFG.PENDING;
  const ds     = DRIVER_STATUS[driver.driverStatus as keyof typeof DRIVER_STATUS] ?? DRIVER_STATUS.OFFLINE;
  const VIcon  = vs.icon;

  const docLinks = [
    { label: 'CNIC Front',    url: driver.cnicFrontUrl    },
    { label: 'CNIC Back',     url: driver.cnicBackUrl     },
    { label: 'License Photo', url: driver.licensePhotoUrl },
    { label: 'Profile Photo', url: driver.profilePhotoUrl },
  ].filter(d => d.url);

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/drivers')}
          className="w-8 h-8 rounded-xl bg-[#0c0c0e] border border-[#1e1e22] flex items-center justify-center text-[#4a4a58] hover:text-[#9898a5] transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#f2f2f5]">{driver.fullName ?? driver.username}</h1>
          <p className="text-xs text-[#4a4a58]">@{driver.username} · {driver.vehicleType ?? 'No vehicle set'}</p>
        </div>
        {/* Active toggle */}
        <button
          onClick={handleToggleActive}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
          style={driver.isActive
            ? { background: 'rgb(16 185 129 / 0.05)', borderColor: 'rgb(52 211 153 / 0.2)', color: 'rgb(52 211 153)' }
            : { background: 'rgb(239 68 68 / 0.05)',  borderColor: 'rgb(239 68 68 / 0.2)',  color: 'rgb(239 68 68)'  }}
        >
          {driver.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {driver.isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className={clsx('w-2 h-2 rounded-full', ds.dot)} />
          <span className={clsx('text-sm font-medium', ds.text)}>{ds.label}</span>
        </div>
        <div className={clsx('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full', vs.bg, vs.color)}>
          <VIcon size={11} /> {vs.label}
        </div>
        {driver.vehiclePlate && (
          <span className="text-xs text-[#4a4a58] bg-[#0c0c0e] border border-[#1e1e22] px-2.5 py-1 rounded-full">
            {driver.vehiclePlate}
          </span>
        )}
        {driver.phone && (
          <a href={`tel:${driver.phone}`} className="flex items-center gap-1.5 text-xs text-[#4a4a58] hover:text-[#9898a5] transition-colors">
            <PhoneCall size={11} /> {driver.phone}
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Today',      value: driver.todayDeliveries,              color: 'text-[#f2f2f5]' },
          { label: 'Total',      value: driver.totalDeliveries,              color: 'text-[#f2f2f5]' },
          { label: 'Active Now', value: driver.activeOrderCount,             color: driver.activeOrderCount ? 'text-blue-400' : 'text-[#4a4a58]' },
          { label: 'COD Due',    value: `Rs.${Math.round(driver.codPending).toLocaleString()}`, color: driver.codPending > 0 ? 'text-red-400' : 'text-lime-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-3 py-3 text-center">
            <p className={clsx('text-lg font-bold', color)}>{value}</p>
            <p className="text-[11px] text-[#4a4a58] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-[#0c0c0e] rounded-xl p-1 border border-[#1e1e22] gap-1">
        {(['overview', 'orders', 'settlements'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-2 rounded-lg text-xs font-medium transition-colors capitalize',
              tab === t ? 'bg-[#1e1e22] text-[#f2f2f5]' : 'text-[#4a4a58] hover:text-[#9898a5]'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">

          {/* Verification action */}
          {driver.verificationStatus === 'UNDER_REVIEW' && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400">Verification Review</h3>
              </div>

              {/* Doc links */}
              {docLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {docLinks.map(d => (
                    <a
                      key={d.label}
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[#9898a5] bg-[#131316] border border-[#1e1e22] px-3 py-1.5 rounded-lg hover:text-amber-400 transition-colors"
                    >
                      <FileText size={11} /> {d.label} ↗
                    </a>
                  ))}
                </div>
              )}

              {/* Driver details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['CNIC',     driver.cnic],
                  ['Phone',    driver.phone],
                  ['Vehicle',  driver.vehicleType],
                  ['Plate',    driver.vehiclePlate],
                  ['Emergency',driver.emergencyContact],
                ].filter(([,v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[#9898a5] border-b border-[#1e1e22] py-1.5">
                    <span className="text-[#4a4a58]">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>

              <textarea
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder="Add a note (required for rejection)…"
                rows={2}
                className="w-full bg-[#131316] border border-[#1e1e22] rounded-xl px-3 py-2.5 text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 resize-none transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmVerify('reject')}
                  disabled={verifying}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => setConfirmVerify('approve')}
                  disabled={verifying}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-lime-400/10 border border-lime-400/20 text-lime-400 hover:bg-lime-400/20 disabled:opacity-50 transition-colors"
                >
                  {verifying ? 'Processing…' : 'Approve ✓'}
                </button>
              </div>
            </div>
          )}

          {/* COD Settlement */}
          {driver.codPending > 0 && (
            <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet size={15} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-[#f2f2f5]">Settle COD</h3>
                </div>
                <p className="text-red-400 font-bold">Rs.{Math.round(driver.codPending).toLocaleString()} pending</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder={`Max Rs.${Math.round(driver.codPending)}`}
                  className="flex-1 bg-[#131316] border border-[#1e1e22] rounded-xl px-3.5 py-2.5 text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 transition-colors"
                />
                <button
                  onClick={() => setSettleAmount(String(Math.round(driver.codPending)))}
                  className="px-3 py-2 rounded-xl text-xs text-[#4a4a58] bg-[#131316] border border-[#1e1e22] hover:text-[#9898a5] transition-colors whitespace-nowrap"
                >
                  Full
                </button>
              </div>
              <input
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full bg-[#131316] border border-[#1e1e22] rounded-xl px-3.5 py-2.5 text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 transition-colors"
              />
              <button
                onClick={() => setConfirmSettle(true)}
                disabled={settling || !settleAmount}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-black text-sm font-bold disabled:opacity-50 hover:bg-amber-400 transition-colors"
              >
                {settling ? 'Recording…' : 'Record Settlement'}
              </button>
            </div>
          )}

          {/* Manual assign */}
          <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Bike size={15} className="text-[#4a4a58]" />
              <h3 className="text-sm font-semibold text-[#f2f2f5]">Manual Order Assignment</h3>
            </div>
            <p className="text-xs text-[#4a4a58]">
              Paste an order ID to assign it to this driver. Use this when auto-assignment fails.
            </p>
            <div className="flex gap-2">
              <input
                value={assignOrderId}
                onChange={(e) => setAssignOrderId(e.target.value)}
                placeholder="Order ID (cuid)…"
                className="flex-1 bg-[#131316] border border-[#1e1e22] rounded-xl px-3.5 py-2.5 text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 font-mono transition-colors"
              />
              <button
                onClick={handleAssign}
                disabled={assigning || !assignOrderId.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#1e1e22] text-[#9898a5] text-sm font-medium disabled:opacity-50 hover:bg-[#2a2a32] hover:text-[#f2f2f5] transition-colors whitespace-nowrap"
              >
                {assigning ? '…' : 'Assign'}
              </button>
            </div>
          </div>

          {/* Profile info */}
          {(driver.verificationStatus !== 'UNDER_REVIEW') && (
            <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-[#9898a5] mb-3">Profile Details</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Full Name',  driver.fullName],
                  ['Phone',      driver.phone],
                  ['CNIC',       driver.cnic],
                  ['Vehicle',    driver.vehicleType],
                  ['Plate',      driver.vehiclePlate],
                  ['Emergency',  driver.emergencyContact],
                  ['Verified At',driver.verifiedAt ? new Date(driver.verifiedAt).toLocaleDateString() : null],
                  ['Note',       driver.verificationNote],
                ].filter(([,v]) => v).map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-[#9898a5] border-b border-[#1e1e22] py-1.5">
                    <span className="text-[#4a4a58]">{k}</span>
                    <span className="text-right max-w-[60%] truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ORDERS TAB ────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="space-y-2">
          {(driver.deliveries ?? []).length === 0 ? (
            <EmptyState icon={Package} title="No order history" dark />
          ) : (driver.deliveries as any[]).map((o: any) => (
            <div key={o.id} className="flex items-center justify-between bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#f2f2f5]">#{o.orderNumber}</p>
                <p className="text-xs text-[#4a4a58]">
                  {o.customer?.name ?? 'Counter'} · {new Date(o.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#f2f2f5]">Rs.{Math.round(o.total)}</p>
                <span className="text-[10px] text-[#4a4a58]">{o.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SETTLEMENTS TAB ───────────────────────────────── */}
      {tab === 'settlements' && (
        <div className="space-y-2">
          {(driver.settlements ?? []).length === 0 ? (
            <EmptyState icon={Wallet} title="No settlements yet" dark />
          ) : (driver.settlements as any[]).map((s: any) => (
            <div key={s.id} className="bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <p className="text-xs text-[#4a4a58]">{new Date(s.createdAt).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' })}</p>
                <span className="text-xs text-lime-400/70 bg-lime-400/5 border border-lime-400/10 px-2 py-0.5 rounded-full">Settled</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#4a4a58]">Collected</span>
                <span className="text-[#9898a5]">Rs.{Math.round(s.collectedAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#4a4a58]">Submitted</span>
                <span className="text-lime-400">Rs.{Math.round(s.submittedAmount)}</span>
              </div>
              {s.remainingAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#4a4a58]">Carried over</span>
                  <span className="text-amber-400">Rs.{Math.round(s.remainingAmount)}</span>
                </div>
              )}
              {s.notes && <p className="text-xs text-[#3a3a48] pt-1 border-t border-[#1e1e22]">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Confirm modals */}
      <ConfirmModal
        open={confirmVerify !== null}
        title={confirmVerify === 'approve' ? 'Approve Driver' : 'Reject Verification'}
        description={confirmVerify === 'approve'
          ? `This will verify ${driver.fullName ?? driver.username} and allow them to go online.`
          : `This will reject ${driver.fullName ?? driver.username}'s verification. They will need to resubmit documents.`}
        confirmLabel={confirmVerify === 'approve' ? 'Approve' : 'Reject'}
        variant={confirmVerify === 'reject' ? 'danger' : 'warning'}
        loading={verifying}
        onConfirm={async () => { await handleVerify(confirmVerify!); setConfirmVerify(null); }}
        onCancel={() => setConfirmVerify(null)}
      />
      <ConfirmModal
        open={confirmSettle}
        title="Record Settlement"
        description={`Record Rs.${settleAmount || 0} as submitted by ${driver.fullName ?? driver.username}. This cannot be undone.`}
        confirmLabel="Record Settlement"
        variant="warning"
        loading={settling}
        onConfirm={async () => { await handleSettle(); setConfirmSettle(false); }}
        onCancel={() => setConfirmSettle(false)}
      />
    </div>
  );
}

