import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Check,
  Home,
  Receipt,
  User,
  Utensils,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { formatDateLocal, formatTaka, toLocalDigits } from '../i18n/translations.js';
import type { OfflineQueuedAction } from '../lib/offlineQueue.js';
import type {
  AuditLogRecord,
  FinancialBreakdown,
  Language,
  MealRecord,
  MemberRecord,
  MessConfig,
  NoticeRecord,
  PaymentMethod,
  PaymentType,
} from '../shared/types.js';

interface MobileMemberAppProps {
  lang: Language;
  todayStr: string;
  config: MessConfig;
  currentMember: MemberRecord | null;
  meals: MealRecord[];
  notices: NoticeRecord[];
  auditLogs: AuditLogRecord[];
  breakdown: FinancialBreakdown;
  isOffline: boolean;
  offlineQueue: OfflineQueuedAction[];
  onToggleMeal: (field: 'breakfast' | 'lunch' | 'dinner') => Promise<void>;
  onSubmitPayment: (payload: {
    membershipId: string;
    amount: number;
    method: PaymentMethod;
    transactionId: string;
    paymentDate: string;
    type: PaymentType;
    notes: string;
  }) => Promise<void>;
  onSwitchToWeb: () => void;
}

export const MobileMemberApp: React.FC<MobileMemberAppProps> = ({
  lang,
  todayStr,
  config,
  currentMember,
  meals,
  notices,
  auditLogs,
  breakdown,
  isOffline,
  offlineQueue,
  onToggleMeal,
  onSubmitPayment,
  onSwitchToWeb,
}) => {
  const isBn = lang === 'bn';
  const [tab, setTab] = useState<'home' | 'meals' | 'hisab' | 'activity' | 'profile'>('home');
  const [showPaySheet, setShowPaySheet] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bkash');
  const [trxId, setTrxId] = useState('');

  const myToday = currentMember
    ? meals.find((m) => m.membershipId === currentMember.id && m.mealDate === todayStr)
    : undefined;
  const myMeals = currentMember
    ? meals.filter((m) => m.membershipId === currentMember.id).slice(0, 10)
    : [];
  const mySummary = currentMember
    ? breakdown.memberSummaries.find((m) => m.membershipId === currentMember.id)
    : undefined;

  const pendingSyncCount = offlineQueue.filter((q) => q.status !== 'synced').length;

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember || !payAmount) return;
    await onSubmitPayment({
      membershipId: currentMember.id,
      amount: Number(payAmount),
      method: payMethod,
      transactionId: trxId,
      paymentDate: todayStr,
      type: 'deposit',
      notes: 'Submitted via Android Member App',
    });
    setPayAmount('');
    setTrxId('');
    setShowPaySheet(false);
  };

  return (
    <div className="flex flex-col items-center py-2">
      {/* Desktop framing note */}
      <div className="hidden md:flex items-center justify-between w-full max-w-[420px] mb-3 px-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Android Member Companion (390px Thumb-Zone UX)</span>
        <button
          onClick={onSwitchToWeb}
          className="text-emerald-700 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
        >
          {isBn ? 'ওয়েব ড্যাশবোর্ডে ফিরুন' : 'Back to Web Workspace'}
        </button>
      </div>

      {/* Mobile Viewport Shell */}
      <div className="w-full max-w-[420px] min-h-[740px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden flex flex-col relative shadow-sm">
        {/* Compact Mobile Top Bar (<= 56px) */}
        <header className="h-14 px-4 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {config.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {currentMember ? currentMember.name : 'Member'} · {formatDateLocal(todayStr, lang)}
            </div>
          </div>
          <button
            onClick={() => setTab('activity')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
        </header>

        {/* Offline / Sync Status Strip */}
        {(isOffline || pendingSyncCount > 0) && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              {isOffline
                ? isBn ? 'অফলাইন · লোকাল সেভ চালু' : 'Offline · Saved locally'
                : `${pendingSyncCount} action(s) sync pending`}
            </span>
          </div>
        )}

        {/* Scrollable Content Zone */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
          {tab === 'home' && (
            <>
              {/* Personal Balance Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isBn ? 'আপনার বর্তমান হিসাব' : 'Your Current Balance'}
                </div>
                <div
                  className={`mt-1 text-3xl font-bold font-mono tabular-nums ${
                    (mySummary?.netBalance ?? 0) >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {mySummary ? formatTaka(mySummary.netBalance, lang) : '৳0'}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {(mySummary?.netBalance ?? 0) >= 0
                    ? isBn ? 'জমা আছে (পাবেন)' : 'Advance balance remaining'
                    : isBn ? 'বকেয়া আছে (পরিশোধযোগ্য)' : 'Amount payable'}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500">{isBn ? 'মিল রেট' : 'Meal Rate'}</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatTaka(breakdown.mealRate, lang, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">{isBn ? 'আপনার মোট মিল' : 'Your Meals'}</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {toLocalDigits(mySummary?.memberMeals ?? 0, lang)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's 1-Tap Meal Toggles (>=48px touch targets) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {isBn ? 'আজকের মিল বুকিং' : 'Today’s Meal Status'}
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    Cutoff {config.mealCancelCutoffHour}:00 AM
                  </span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {(
                    [
                      { key: 'breakfast', label: isBn ? 'সকাল (নাস্তা)' : 'Breakfast', on: Boolean(myToday?.breakfast) },
                      { key: 'lunch', label: isBn ? 'দুপুর (লাঞ্চ)' : 'Lunch', on: Boolean(myToday?.lunch) },
                      { key: 'dinner', label: isBn ? 'রাত (ডিনার)' : 'Dinner', on: Boolean(myToday?.dinner) },
                    ] as const
                  ).map((slot) => (
                    <button
                      key={slot.key}
                      onClick={() => onToggleMeal(slot.key)}
                      className={`w-full min-h-[48px] px-4 rounded-xl border flex items-center justify-between text-sm font-medium transition-colors cursor-pointer ${
                        slot.on
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span>{slot.label}</span>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {slot.on && <Check className="w-4 h-4" />}
                        {slot.on ? (isBn ? 'চালু' : 'Booked') : isBn ? 'বন্ধ' : 'Off'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Pay CTA in Natural Thumb Zone */}
              <button
                onClick={() => setShowPaySheet(true)}
                className="w-full h-12 rounded-xl bg-slate-900 dark:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>{isBn ? 'বিকাশ / নগদ পেমেন্ট জমা দিন' : 'Submit bKash / Nagad Payment'}</span>
              </button>

              {/* Latest Notice */}
              {notices[0] && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {notices[0].title}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {notices[0].body}
                  </p>
                </div>
              )}
            </>
          )}

          {tab === 'meals' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isBn ? 'আমার সাম্প্রতিক মিল ইতিহাস' : 'My Recent Meal Log'}
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myMeals.map((ml) => (
                  <div key={ml.id} className="py-3 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatDateLocal(ml.mealDate, lang)}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-slate-600 dark:text-slate-300">
                      <span>B:{ml.breakfast}</span>
                      <span>L:{ml.lunch}</span>
                      <span>D:{ml.dinner}</span>
                      {ml.guestMeals > 0 && <span className="text-amber-600">+{ml.guestMeals}G</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'hisab' && mySummary && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isBn ? 'মাসিক হিসাব বিবরণী' : 'Monthly হিসাব Breakdown'}
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">{isBn ? 'পূর্বের জের' : 'Previous Balance'}</span>
                  <span className="font-mono">{formatTaka(mySummary.previousBalance, lang)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">{isBn ? 'মোট জমা' : 'Deposited'}</span>
                  <span className="font-mono text-emerald-700">+{formatTaka(mySummary.totalDeposited, lang)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">{isBn ? 'মিল খরচ' : 'Meal Cost'}</span>
                  <span className="font-mono">-{formatTaka(mySummary.mealCost + mySummary.guestMealCost, lang)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">{isBn ? 'রুম ভাড়া' : 'Rent'}</span>
                  <span className="font-mono">-{formatTaka(mySummary.rentShare, lang)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">{isBn ? 'বিল ও খালা' : 'Utilities & Staff'}</span>
                  <span className="font-mono">-{formatTaka(mySummary.utilityShare + mySummary.otherExpenseShare, lang)}</span>
                </div>
                <div className="pt-3 flex justify-between font-bold text-base">
                  <span>{isBn ? 'নিট ব্যালেন্স' : 'Net Balance'}</span>
                  <span className={`font-mono ${mySummary.netBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatTaka(mySummary.netBalance, lang)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="py-3 text-xs">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {log.actorName} · {log.details}
                  </div>
                  <div className="text-slate-400 mt-0.5">{log.createdAt.slice(0, 16).replace('T', ' ')}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'profile' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {currentMember?.name}
                </div>
                <div className="text-xs text-slate-500">
                  {currentMember?.phone} · {currentMember?.roomNumber ? `Room ${currentMember.roomNumber}` : 'Unassigned'}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div>Mess Invite Code: <strong className="font-mono">{config.inviteCode}</strong></div>
                <div>Offline Sync Queue: {offlineQueue.length} item(s)</div>
              </div>
              <button
                onClick={onSwitchToWeb}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
              >
                {isBn ? 'সম্পূর্ণ ওয়েব ড্যাশবোর্ড খুলুন' : 'Open Full Web Dashboard'}
              </button>
            </div>
          )}
        </div>

        {/* Fixed Bottom Navigation Bar (Natural Thumb Zone) */}
        <nav className="absolute bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center">
          {(
            [
              { id: 'home', label: isBn ? 'হোম' : 'Home', icon: Home },
              { id: 'meals', label: isBn ? 'মিল' : 'Meals', icon: Utensils },
              { id: 'hisab', label: 'হিসাব', icon: Receipt },
              { id: 'activity', label: isBn ? 'কার্যক্রম' : 'Activity', icon: Activity },
              { id: 'profile', label: isBn ? 'প্রোফাইল' : 'Profile', icon: User },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  active ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Sheet Payment Drawer */}
        {showPaySheet && (
          <div className="absolute inset-0 z-40 bg-black/50 flex items-end">
            <form
              onSubmit={handlePaySubmit}
              className="w-full bg-white dark:bg-slate-900 rounded-t-3xl p-5 space-y-4 border-t border-slate-200 dark:border-slate-800"
            >
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {isBn ? 'পেমেন্ট তথ্য জমা দিন' : 'Submit Payment'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPaySheet(false)}
                  className="text-xs text-slate-500 cursor-pointer"
                >
                  Close
                </button>
              </div>
              <input
                type="number"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Amount (৳)"
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-base font-bold"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="cash">Cash</option>
                </select>
                <input
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="TrxID"
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
              >
                {isBn ? 'যাচাইয়ের জন্য পাঠান' : 'Send for Verification'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
