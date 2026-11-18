import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Download, Search, X } from 'lucide-react';
import { formatDateLocal, formatTaka, toLocalDigits } from '../i18n/translations.js';
import { downloadCsv } from '../lib/api.js';
import type {
  FinancialBreakdown,
  Language,
  MemberFinancialSummary,
  MemberRecord,
  PaymentMethod,
  PaymentRecord,
  PaymentType,
} from '../shared/types.js';

interface AccountsPaymentsWorkspaceProps {
  lang: Language;
  todayStr: string;
  monthKey: string;
  currentMember: MemberRecord | null;
  members: MemberRecord[];
  payments: PaymentRecord[];
  breakdown: FinancialBreakdown;
  isMonthClosed: boolean;
  onSubmitPayment: (payload: {
    membershipId: string;
    amount: number;
    method: PaymentMethod;
    transactionId: string;
    paymentDate: string;
    type: PaymentType;
    notes: string;
  }) => Promise<void>;
  onVerifyPayment: (id: string, status: 'approved' | 'rejected') => Promise<void>;
}

export const AccountsPaymentsWorkspace: React.FC<AccountsPaymentsWorkspaceProps> = ({
  lang,
  todayStr,
  monthKey,
  currentMember,
  members,
  payments,
  breakdown,
  isMonthClosed,
  onSubmitPayment,
  onVerifyPayment,
}) => {
  const isBn = lang === 'bn';
  const [search, setSearch] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<MemberFinancialSummary | null>(null);

  // Payment submission form
  const canVerify =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.verifyPayments);

  const [targetMemberId, setTargetMemberId] = useState(currentMember?.id || members[0]?.id || '');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bkash');
  const [trxId, setTrxId] = useState('');
  const [payDate, setPayDate] = useState(todayStr);
  const [payType, setPayType] = useState<PaymentType>('deposit');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const memberById = useMemo(() => {
    const map: Record<string, MemberRecord> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const filteredSummaries = useMemo(() => {
    if (!search.trim()) return breakdown.memberSummaries;
    const q = search.toLowerCase();
    return breakdown.memberSummaries.filter((m) => m.name.toLowerCase().includes(q));
  }, [breakdown.memberSummaries, search]);

  const pendingPayments = payments.filter((p) => p.status === 'pending');

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(payAmount);
    if (!num || num <= 0) return;
    setSubmitting(true);
    try {
      await onSubmitPayment({
        membershipId: targetMemberId || currentMember?.id || '',
        amount: num,
        method: payMethod,
        transactionId: trxId.trim(),
        paymentDate: payDate,
        type: payType,
        notes: payNotes.trim(),
      });
      setPayAmount('');
      setTrxId('');
      setPayNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportLedgerCsv = () => {
    downloadCsv(
      `messflow-ledger-${monthKey}.csv`,
      [
        'Member',
        'Room',
        'Prev Balance',
        'Deposited',
        'Weighted Meals',
        'Meal Cost',
        'Guest Meal Cost',
        'Rent Share',
        'Utility & Other',
        'Total Expense',
        'Net Balance',
      ],
      breakdown.memberSummaries.map((m) => [
        m.name,
        m.roomLabel,
        m.previousBalance,
        m.totalDeposited,
        m.memberMeals,
        m.mealCost,
        m.guestMealCost,
        m.rentShare,
        m.utilityShare + m.otherExpenseShare,
        m.totalExpenseShare,
        m.netBalance,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Transparent Formula: How Your Meal Rate Was Calculated */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isBn ? 'আপনার মিল রেট যেভাবে হিসাব করা হয়েছে' : 'How Your Meal Rate Was Calculated'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isBn
                ? 'সম্পূর্ণ স্বচ্ছ সূত্র — কোনো গোপন হিসাব নেই'
                : 'Every approved bazar entry and weighted meal is traceable here'}
            </p>
          </div>
          <button
            onClick={handleExportLedgerCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{isBn ? 'হিসাব CSV ডাউনলোড' : 'Export Ledger CSV'}</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {breakdown.formulaSteps.map((step, idx) => (
            <div
              key={step.label}
              className={`p-4 rounded-xl border ${
                idx === breakdown.formulaSteps.length - 1
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'
              }`}
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{step.label}</div>
              <div className="mt-1.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {step.value}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{step.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Member Financial Ledger */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isBn ? 'সদস্যদের পূর্ণাঙ্গ আর্থিক লেজার' : 'Member Financial Ledger'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn
                ? 'যেকোনো সদস্যের নামে ক্লিক করে ব্যক্তিগত স্টেটমেন্ট দেখুন'
                : 'Click any member row to view their itemized personal statement'}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isBn ? 'সদস্য খুঁজুন...' : 'Filter member...'}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-3 px-5">{isBn ? 'সদস্য' : 'Member'}</th>
                <th className="py-3 px-4 text-right">{isBn ? 'পূর্বের জের' : 'Prev Bal'}</th>
                <th className="py-3 px-4 text-right">{isBn ? 'জমা' : 'Deposited'}</th>
                <th className="py-3 px-4 text-right">{isBn ? 'মিল' : 'Meals'}</th>
                <th className="py-3 px-4 text-right">{isBn ? 'মিল খরচ' : 'Meal Cost'}</th>
                <th className="py-3 px-4 text-right">{isBn ? 'ভাড়া ও বিল' : 'Rent & Util'}</th>
                <th className="py-3 px-5 text-right">{isBn ? 'বর্তমান ব্যালেন্স' : 'Balance'}</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredSummaries.map((ms) => (
                <tr
                  key={ms.membershipId}
                  onClick={() => setSelectedSummary(ms)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="py-3.5 px-5">
                    <div className="font-medium text-slate-900 dark:text-white">{ms.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ms.roomLabel} · {ms.status}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatTaka(ms.previousBalance, lang)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                    {formatTaka(ms.totalDeposited, lang)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {toLocalDigits(ms.memberMeals, lang)}
                    {ms.guestMeals > 0 ? `+${ms.guestMeals}G` : ''}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatTaka(ms.mealCost + ms.guestMealCost, lang)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatTaka(ms.rentShare + ms.utilityShare + ms.otherExpenseShare, lang)}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div
                      className={`font-mono tabular-nums font-bold ${
                        ms.netBalance >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatTaka(ms.netBalance, lang)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {ms.netBalance >= 0 ? (isBn ? 'জমা আছে' : 'Advance') : isBn ? 'বকেয়া' : 'Due'}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-400">
                    <ChevronRight className="w-4 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payments Submission & Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Submit Payment */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isBn ? 'জমা বা পেমেন্ট এন্ট্রি' : 'Submit Deposit / Payment'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isBn
              ? 'বিকাশ, নগদ, রকেট, ব্যাংক অথবা নগদ জমার তথ্য দিন'
              : 'Record bKash, Nagad, Rocket, Bank, or Cash payments with TrxID'}
          </p>

          <form onSubmit={handlePaySubmit} className="mt-5 space-y-4">
            {canVerify && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'সদস্য নির্বাচন' : 'Member'}
                </label>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'পরিমাণ (৳)' : 'Amount (৳)'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-base font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'মাধ্যম' : 'Method'}
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'ট্রানজেকশন আইডি (TrxID)' : 'Transaction ID'}
                </label>
                <input
                  type="text"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="BK8K21..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'ধরন' : 'Entry Type'}
                </label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as PaymentType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                >
                  <option value="deposit">{isBn ? 'মাসিক জমা' : 'Monthly Deposit'}</option>
                  <option value="settlement">{isBn ? 'বকেয়া পরিশোধ' : 'Due Settlement'}</option>
                  {canVerify && <option value="adjustment">{isBn ? 'সমন্বয়' : 'Adjustment'}</option>}
                  {canVerify && <option value="refund">{isBn ? 'ফেরত (রিফান্ড)' : 'Refund'}</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'তারিখ' : 'Date'}
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'নোট' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder={isBn ? 'সংক্ষিপ্ত নোট' : 'Optional note'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isMonthClosed}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? '...' : isBn ? 'পেমেন্ট জমা দিন' : 'Submit Payment Record'}
            </button>
          </form>
        </section>

        {/* Verification Queue & Payment History */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isBn ? 'পেমেন্ট ভেরিফিকেশন ও ইতিহাস' : 'Payment Verification & History'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pendingPayments.length > 0
                  ? `${toLocalDigits(pendingPayments.length, lang)} ${isBn ? 'টি পেমেন্ট যাচাইয়ের অপেক্ষায়' : 'payment(s) pending manager verification'}`
                  : isBn ? 'সব পেমেন্ট যাচাই সম্পন্ন' : 'All payments reconciled'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
            {payments.map((p) => {
              const payer = memberById[p.membershipId]?.name || 'Member';
              return (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold uppercase text-slate-700 dark:text-slate-300">
                        {p.method}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateLocal(p.paymentDate, lang)}</span>
                      {p.transactionId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{p.transactionId}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          p.status === 'approved'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : p.status === 'pending'
                              ? 'text-amber-600 font-semibold'
                              : 'text-red-600 font-medium'
                        }
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {payer}
                      {p.notes && (
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-2">
                          — {p.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-white">
                      {formatTaka(p.amount, lang)}
                    </span>

                    {canVerify && p.status === 'pending' && !isMonthClosed && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onVerifyPayment(p.id, 'approved')}
                          className="p-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                          title="Approve payment"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onVerifyPayment(p.id, 'rejected')}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Reject payment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Individual Member Statement Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedSummary.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedSummary.roomLabel} · {monthKey}
                </p>
              </div>
              <button
                onClick={() => setSelectedSummary(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Previous Balance</span>
                <span className="font-mono tabular-nums font-medium">{formatTaka(selectedSummary.previousBalance, lang)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Approved Deposits</span>
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                  +{formatTaka(selectedSummary.totalDeposited, lang)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  Meal Cost ({selectedSummary.memberMeals} × ৳{breakdown.mealRate.toFixed(2)})
                </span>
                <span className="font-mono tabular-nums">-{formatTaka(selectedSummary.mealCost, lang)}</span>
              </div>
              {selectedSummary.guestMealCost > 0 && (
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Guest Meals ({selectedSummary.guestMeals})
                  </span>
                  <span className="font-mono tabular-nums">-{formatTaka(selectedSummary.guestMealCost, lang)}</span>
                </div>
              )}
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Room / Seat Rent</span>
                <span className="font-mono tabular-nums">-{formatTaka(selectedSummary.rentShare, lang)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Utilities & Staff Share</span>
                <span className="font-mono tabular-nums">-{formatTaka(selectedSummary.utilityShare + selectedSummary.otherExpenseShare, lang)}</span>
              </div>
              <div className="pt-3 flex justify-between font-bold text-base">
                <span>{selectedSummary.netBalance >= 0 ? 'Advance Balance' : 'Payable Due'}</span>
                <span className={`font-mono tabular-nums ${selectedSummary.netBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                  {formatTaka(selectedSummary.netBalance, lang)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
