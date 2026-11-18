import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Download,
  Lock,
  Plus,
  Printer,
} from 'lucide-react';
import { formatDateLocal, formatTaka, toLocalDigits } from '../i18n/translations.js';
import { downloadCsv } from '../lib/api.js';
import type {
  ClosingReadinessCheck,
  FinancialBreakdown,
  Language,
  MemberRecord,
  MessConfig,
  MonthlySettlementRecord,
  NoticeCategory,
  NoticePriority,
  NoticeRecord,
} from '../shared/types.js';

interface SettlementNoticesWorkspaceProps {
  mode: 'settlement' | 'notices';
  lang: Language;
  monthKey: string;
  config: MessConfig;
  currentMember: MemberRecord | null;
  currentUserId: string;
  breakdown: FinancialBreakdown;
  settlement: MonthlySettlementRecord | null;
  readiness: ClosingReadinessCheck[];
  notices: NoticeRecord[];
  onCloseMonth: (carryForward: boolean) => Promise<void>;
  onCreateNotice: (payload: {
    title: string;
    body: string;
    category: NoticeCategory;
    priority: NoticePriority;
  }) => Promise<void>;
  onMarkNoticeRead: (id: string) => Promise<void>;
}

export const SettlementNoticesWorkspace: React.FC<SettlementNoticesWorkspaceProps> = ({
  mode,
  lang,
  monthKey,
  config,
  currentMember,
  currentUserId,
  breakdown,
  settlement,
  readiness,
  notices,
  onCloseMonth,
  onCreateNotice,
  onMarkNoticeRead,
}) => {
  const isBn = lang === 'bn';
  const [carryForward, setCarryForward] = useState(true);
  const [closing, setClosing] = useState(false);

  // Notice state
  const [nTitle, setNTitle] = useState('');
  const [nBody, setNBody] = useState('');
  const [nCat, setNCat] = useState<NoticeCategory>('general');
  const [nPriority, setNPriority] = useState<NoticePriority>('normal');

  const canClose =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.closeMonth);
  const canNotice =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.manageNotices);

  const handleClose = async () => {
    setClosing(true);
    try {
      await onCloseMonth(carryForward);
    } finally {
      setClosing(false);
    }
  };

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nTitle.trim() || !nBody.trim()) return;
    await onCreateNotice({
      title: nTitle,
      body: nBody,
      category: nCat,
      priority: nPriority,
    });
    setNTitle('');
    setNBody('');
  };

  const handleDownloadCsv = () => {
    downloadCsv(
      `messflow-statement-${monthKey}.csv`,
      [
        'Member',
        'Prev Balance',
        'Deposits',
        'Meals',
        'Meal Rate',
        'Meal Cost',
        'Rent',
        'Utilities',
        'Total Expense',
        'Final Balance',
        'Status',
      ],
      breakdown.memberSummaries.map((m) => [
        m.name,
        m.previousBalance,
        m.totalDeposited,
        m.memberMeals,
        breakdown.mealRate,
        m.mealCost + m.guestMealCost,
        m.rentShare,
        m.utilityShare + m.otherExpenseShare,
        m.totalExpenseShare,
        m.netBalance,
        m.netBalance >= 0 ? 'Advance' : 'Due',
      ])
    );
  };

  if (mode === 'notices') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {canNotice && (
          <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-fit">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isBn ? 'নতুন নোটিশ প্রকাশ করুন' : 'Publish Mess Notice'}
            </h1>
            <form onSubmit={handleNoticeSubmit} className="mt-4 space-y-4">
              <input
                required
                value={nTitle}
                onChange={(e) => setNTitle(e.target.value)}
                placeholder={isBn ? 'নোটিশের শিরোনাম' : 'Notice headline'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={nCat}
                  onChange={(e) => setNCat(e.target.value as NoticeCategory)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="general">General</option>
                  <option value="bazar">Bazar Schedule</option>
                  <option value="payment">Payment Deadline</option>
                  <option value="meal">Meal Rules</option>
                  <option value="utility">Water / Electricity</option>
                  <option value="meeting">Mess Meeting</option>
                </select>
                <select
                  value={nPriority}
                  onChange={(e) => setNPriority(e.target.value as NoticePriority)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <textarea
                required
                rows={4}
                value={nBody}
                onChange={(e) => setNBody(e.target.value)}
                placeholder={isBn ? 'বিস্তারিত বার্তা লিখুন...' : 'Write clear instructions for members...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'নোটিশ পাঠান' : 'Publish Notice'}</span>
              </button>
            </form>
          </section>
        )}

        <section className={`${canNotice ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isBn ? 'সকল নোটিশ ও ঘোষণা' : 'Notice Board'}
          </h2>
          {notices.map((n) => {
            const isRead = n.readByUserIds.includes(currentUserId);
            return (
              <div
                key={n.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                        {n.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={n.priority === 'urgent' ? 'text-red-600 font-semibold' : ''}>
                        {n.priority.toUpperCase()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{n.createdByName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateLocal(n.createdAt.slice(0, 10), lang)}</span>
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-white">
                      {n.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                  {!isRead ? (
                    <button
                      onClick={() => onMarkNoticeRead(n.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {isBn ? 'পড়েছি' : 'Acknowledge'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                      <Bell className="w-3.5 h-3.5" /> Read ({n.readByUserIds.length})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  // Monthly Settlement Mode
  return (
    <div className="space-y-6">
      {/* Readiness Checklist + Close Trigger */}
      <section className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isBn ? `মাসিক হিসাব ক্লোজিং (${monthKey})` : `Monthly Settlement — ${monthKey}`}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {settlement?.status === 'closed'
                ? isBn
                  ? `এই মাস ক্লোজ ও লক করা হয়েছে (${formatDateLocal(settlement.closedAt || '', lang)})`
                  : `Month closed and locked permanently on ${formatDateLocal((settlement.closedAt || '').slice(0, 10), lang)}`
                : isBn
                  ? 'মাস চূড়ান্ত করার আগে নিচের যাচাই তালিকা পরীক্ষা করুন'
                  : 'Verify readiness checks before locking the month and carrying forward member balances'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isBn ? 'CSV ডাউনলোড' : 'Export CSV'}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isBn ? 'প্রিন্ট / PDF' : 'Print / Save PDF'}</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {readiness.map((chk) => (
            <div
              key={chk.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start gap-3"
            >
              {chk.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  {isBn ? chk.labelBn : chk.labelEn}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn ? chk.detailBn : chk.detailEn}
                </div>
              </div>
            </div>
          ))}
        </div>

        {settlement?.status !== 'closed' && canClose && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={carryForward}
                onChange={(e) => setCarryForward(e.target.checked)}
                className="w-4 h-4 accent-emerald-700"
              />
              <span>
                {isBn
                  ? 'সকল সদস্যের নিট ব্যালেন্স পরবর্তী মাসের পূর্বের জের হিসেবে যুক্ত করুন'
                  : 'Carry forward each member’s net balance into next month’s opening balance'}
              </span>
            </label>

            <button
              onClick={handleClose}
              disabled={closing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 text-white text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{closing ? '...' : isBn ? 'মাস ক্লোজ ও লক করুন' : 'Close & Lock Month'}</span>
            </button>
          </div>
        )}
      </section>

      {/* Printable Monthly Mess Statement */}
      <section className="print-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              MessFlow Official Monthly Statement
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {config.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {config.address}, {config.city} · Billing Cycle: {monthKey}
            </p>
          </div>
          <div className="text-left sm:text-right font-mono tabular-nums text-xs space-y-1">
            <div>
              Meal Rate: <strong className="text-base text-slate-900 dark:text-white">৳{breakdown.mealRate.toFixed(2)}</strong>
            </div>
            <div>Total Bazar: {formatTaka(breakdown.totalBazarExpense, lang)}</div>
            <div>Total Weighted Meals: {toLocalDigits(breakdown.totalMemberMeals, lang)}</div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4">Member</th>
                <th className="py-2.5 px-2 text-right">Prev Bal</th>
                <th className="py-2.5 px-2 text-right">Deposited</th>
                <th className="py-2.5 px-2 text-right">Meals</th>
                <th className="py-2.5 px-2 text-right">Meal Cost</th>
                <th className="py-2.5 px-2 text-right">Rent</th>
                <th className="py-2.5 px-2 text-right">Utilities</th>
                <th className="py-2.5 pl-2 text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {breakdown.memberSummaries.map((m) => (
                <tr key={m.membershipId}>
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">{m.name}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">{formatTaka(m.previousBalance, lang)}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">{formatTaka(m.totalDeposited, lang)}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">{toLocalDigits(m.memberMeals, lang)}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">{formatTaka(m.mealCost + m.guestMealCost, lang)}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">{formatTaka(m.rentShare, lang)}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">{formatTaka(m.utilityShare + m.otherExpenseShare, lang)}</td>
                  <td className={`py-2.5 pl-2 text-right font-mono tabular-nums font-bold ${m.netBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatTaka(m.netBalance, lang)} ({m.netBalance >= 0 ? 'Adv' : 'Due'})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
