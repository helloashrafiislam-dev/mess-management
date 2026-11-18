import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Plus,
  Receipt,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
} from 'lucide-react';
import { formatDateLocal, formatTaka, toLocalDigits } from '../i18n/translations.js';
import type {
  AuditLogRecord,
  ExpenseRecord,
  FinancialBreakdown,
  Language,
  MealRecord,
  MemberRecord,
  MessConfig,
  MessInsight,
  NoticeRecord,
  PaymentRecord,
} from '../shared/types.js';

interface OverviewPulseProps {
  lang: Language;
  todayStr: string;
  monthKey: string;
  config: MessConfig;
  currentMember: MemberRecord | null;
  members: MemberRecord[];
  meals: MealRecord[];
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  notices: NoticeRecord[];
  auditLogs: AuditLogRecord[];
  breakdown: FinancialBreakdown;
  insights: MessInsight[];
  onNavigate: (tab: string) => void;
  onQuickToggleMeal: (field: 'breakfast' | 'lunch' | 'dinner') => void;
  onOpenQuickBazar: () => void;
  onOpenQuickPayment: () => void;
}

export const OverviewPulse: React.FC<OverviewPulseProps> = ({
  lang,
  todayStr,
  monthKey,
  config,
  currentMember,
  members,
  meals,
  expenses,
  payments,
  notices,
  auditLogs,
  breakdown,
  insights,
  onNavigate,
  onQuickToggleMeal,
  onOpenQuickBazar,
  onOpenQuickPayment,
}) => {
  const isBn = lang === 'bn';
  const activeMembers = members.filter((m) => m.status === 'active');
  const todayMeals = meals.filter((m) => m.mealDate === todayStr);

  const todayBreakfast = todayMeals.reduce((s, m) => s + (m.breakfast ? 1 : 0), 0);
  const todayLunch = todayMeals.reduce((s, m) => s + (m.lunch ? 1 : 0), 0);
  const todayDinner = todayMeals.reduce((s, m) => s + (m.dinner ? 1 : 0), 0);
  const todayGuests = todayMeals.reduce((s, m) => s + (m.guestMeals || 0), 0);

  const myTodayMeal = currentMember
    ? todayMeals.find((m) => m.membershipId === currentMember.id)
    : undefined;

  const mySummary = currentMember
    ? breakdown.memberSummaries.find((m) => m.membershipId === currentMember.id)
    : undefined;

  const todayExpenses = expenses.filter((e) => e.expenseDate === todayStr && e.approvalStatus !== 'voided');
  const todaySpend = todayExpenses.reduce((s, e) => s + e.amount, 0);

  const pendingPayments = payments.filter((p) => p.monthKey === monthKey && p.status === 'pending');

  // Money flow segments
  const bazarTotal = breakdown.categoryTotals.bazar || 0;
  const rentTotal = breakdown.totalRentExpense || 0;
  const utilitiesTotal =
    (breakdown.categoryTotals.electricity || 0) +
    (breakdown.categoryTotals.gas || 0) +
    (breakdown.categoryTotals.water || 0) +
    (breakdown.categoryTotals.internet || 0);
  const staffAndOther =
    (breakdown.categoryTotals.staff || 0) +
    (breakdown.categoryTotals.cleaning || 0) +
    (breakdown.categoryTotals.maintenance || 0) +
    (breakdown.categoryTotals.other || 0);

  const moneyFlowTotal = Math.max(1, bazarTotal + rentTotal + utilitiesTotal + staffAndOther);
  const flowSegments = [
    {
      label: isBn ? 'বাজার' : 'Bazar',
      amount: bazarTotal,
      pct: Math.round((bazarTotal / moneyFlowTotal) * 100),
      barClass: 'bg-emerald-600',
    },
    {
      label: isBn ? 'বাসা ভাড়া' : 'Rent',
      amount: rentTotal,
      pct: Math.round((rentTotal / moneyFlowTotal) * 100),
      barClass: 'bg-slate-800 dark:bg-slate-400',
    },
    {
      label: isBn ? 'গ্যাস, বিদ্যুৎ ও নেট' : 'Utilities',
      amount: utilitiesTotal,
      pct: Math.round((utilitiesTotal / moneyFlowTotal) * 100),
      barClass: 'bg-amber-500',
    },
    {
      label: isBn ? 'খালা ও অন্যান্য' : 'Staff & Other',
      amount: staffAndOther,
      pct: Math.max(0, 100 - Math.round((bazarTotal / moneyFlowTotal) * 100) - Math.round((rentTotal / moneyFlowTotal) * 100) - Math.round((utilitiesTotal / moneyFlowTotal) * 100)),
      barClass: 'bg-sky-600',
    },
  ];

  // Calculate Mess Operational Health strictly from real records
  const totalChecks = 4;
  const passedChecks =
    (todayMeals.length > 0 ? 1 : 0) +
    (pendingPayments.length === 0 ? 1 : 0) +
    (breakdown.totalPendingExpenses === 0 ? 1 : 0) +
    (breakdown.memberSummaries.filter((m) => m.payableAmount > 2000).length === 0 ? 1 : 0);

  return (
    <div className="space-y-8">
      {/* Mess Pulse Hero Strip */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{config.city}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDateLocal(todayStr, lang)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {toLocalDigits(activeMembers.length, lang)} {isBn ? 'জন সক্রিয় সদস্য' : 'active members'}
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              {isBn ? 'মেস পালস ও আজকের অবস্থা' : 'The Living Mess Pulse'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isBn
                ? `আজ ${toLocalDigits(todaySpend, lang)} টাকা খরচ হয়েছে এবং চলতি মিল রেট ${formatTaka(breakdown.mealRate, lang, 2)}`
                : `Today’s spend is ${formatTaka(todaySpend, lang)} across ${toLocalDigits(todayExpenses.length, lang)} entries · Operational checks ${toLocalDigits(passedChecks, lang)}/${toLocalDigits(totalChecks, lang)} clear`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenQuickBazar}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? 'দ্রুত বাজার এন্ট্রি' : 'Quick Bazar'}</span>
            </button>
            <button
              onClick={onOpenQuickPayment}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>{isBn ? 'পেমেন্ট জমা দিন' : 'Submit Payment'}</span>
            </button>
          </div>
        </div>

        {/* 4 Key Monthly Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isBn ? 'চলতি মিল রেট' : 'Live Meal Rate'}
            </div>
            <div className="mt-1.5 text-2xl lg:text-3xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatTaka(breakdown.mealRate, lang, 2)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {toLocalDigits(breakdown.totalMemberMeals, lang)} {isBn ? 'টি মোট মিল' : 'weighted meals'}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isBn ? 'মোট বাজার খরচ' : 'Month Bazar'}
            </div>
            <div className="mt-1.5 text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatTaka(breakdown.totalBazarExpense, lang)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isBn ? 'মোট অনুমোদিত:' : 'All approved:'} {formatTaka(breakdown.totalApprovedExpenses, lang)}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isBn ? 'অনুমোদিত জমা' : 'Verified Deposits'}
            </div>
            <div className="mt-1.5 text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatTaka(breakdown.totalApprovedDeposits, lang)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {pendingPayments.length > 0
                ? `${toLocalDigits(pendingPayments.length, lang)} ${isBn ? 'টি যাচাই বাকি' : 'pending verification'}`
                : isBn ? 'সব পেমেন্ট যাচাইকৃত' : 'All payments verified'}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isBn ? 'আপনার বর্তমান ব্যালেন্স' : 'Your Net Balance'}
            </div>
            <div
              className={`mt-1.5 text-2xl lg:text-3xl font-bold font-mono tabular-nums ${
                (mySummary?.netBalance ?? 0) >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {mySummary ? formatTaka(mySummary.netBalance, lang) : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mySummary
                ? mySummary.netBalance >= 0
                  ? isBn ? 'জমা আছে (পাবেন)' : 'Advance credit'
                  : isBn ? 'বকেয়া আছে (দিবেন)' : 'Payable due'
                : isBn ? 'মেম্বার হিসাব নেই' : 'Observer view'}
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Today's Meal Rhythm & Personal Financial Clarity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Meal Rhythm (7 cols) */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {isBn ? 'আজকের মিল রিদম' : 'Today’s Meal Rhythm'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn
                    ? `বুকিং শেষ সময় রাত ${toLocalDigits(config.mealBookingCutoffHour, lang)}:০০ · বাতিলের শেষ সময় সকাল ${toLocalDigits(config.mealCancelCutoffHour, lang)}:০০`
                    : `Booking cutoff ${config.mealBookingCutoffHour}:00 · Cancel cutoff ${config.mealCancelCutoffHour}:00 AM`}
                </p>
              </div>
              <button
                onClick={() => onNavigate('meals')}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{isBn ? 'সম্পূর্ণ মিল চার্ট' : 'Full Meal Grid'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Breakfast -> Lunch -> Dinner Timeline */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                {
                  key: 'breakfast' as const,
                  label: isBn ? 'সকাল (নাস্তা)' : 'Breakfast',
                  count: todayBreakfast,
                  weight: config.breakfastWeight,
                  mine: Boolean(myTodayMeal?.breakfast),
                },
                {
                  key: 'lunch' as const,
                  label: isBn ? 'দুপুর (লাঞ্চ)' : 'Lunch',
                  count: todayLunch,
                  weight: config.lunchWeight,
                  mine: Boolean(myTodayMeal?.lunch),
                },
                {
                  key: 'dinner' as const,
                  label: isBn ? 'রাত (ডিনার)' : 'Dinner',
                  count: todayDinner,
                  weight: config.dinnerWeight,
                  mine: Boolean(myTodayMeal?.dinner),
                },
              ].map((slot) => (
                <div
                  key={slot.key}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{slot.label}</span>
                    <span className="font-mono">{slot.weight}x</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {toLocalDigits(slot.count, lang)}
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      / {toLocalDigits(activeMembers.length, lang)}
                    </span>
                  </div>
                  {currentMember && (
                    <button
                      onClick={() => onQuickToggleMeal(slot.key)}
                      className={`mt-3 w-full py-2 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        slot.mine
                          ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {slot.mine
                        ? isBn ? 'আমার মিল চালু' : 'My Meal: ON'
                        : isBn ? 'আমার মিল বন্ধ' : 'My Meal: OFF'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>
                {isBn
                  ? `আজ গেস্ট মিল: ${toLocalDigits(todayGuests, lang)} টি`
                  : `Today’s guest meals: ${todayGuests}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span>
                {isBn
                  ? `ছুটিতে আছেন: ${toLocalDigits(members.filter((m) => m.status === 'away').length, lang)} জন`
                  : `Members away: ${members.filter((m) => m.status === 'away').length}`}
              </span>
            </div>
          </div>
        </section>

        {/* Personal Financial Clarity (5 cols) */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isBn ? 'আপনার ব্যক্তিগত হিসাব' : 'Personal Financial Clarity'}
            </h2>
            <button
              onClick={() => onNavigate('accounts')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isBn ? 'বিস্তারিত' : 'Full Ledger'}
            </button>
          </div>

          {mySummary ? (
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">{isBn ? 'পূর্বের জের' : 'Previous month balance'}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatTaka(mySummary.previousBalance, lang)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">{isBn ? 'চলতি মাসে জমা' : 'Approved deposits'}</span>
                <span className="font-mono tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                  +{formatTaka(mySummary.totalDeposited, lang)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">
                  {isBn
                    ? `মিল খরচ (${toLocalDigits(mySummary.memberMeals, lang)} মিল)`
                    : `Meal cost (${mySummary.memberMeals} meals)`}
                </span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                  -{formatTaka(mySummary.mealCost + mySummary.guestMealCost, lang)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">{isBn ? 'সিট/রুম ভাড়া' : 'Room & bed rent'}</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                  -{formatTaka(mySummary.rentShare, lang)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">{isBn ? 'বিদ্যুৎ, গ্যাস, নেট ও খালা' : 'Utilities, staff & shared'}</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                  -{formatTaka(mySummary.utilityShare + mySummary.otherExpenseShare, lang)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {mySummary.netBalance >= 0
                      ? isBn ? 'আপনার জমা আছে' : 'You have advance'
                      : isBn ? 'আপনাকে পরিশোধ করতে হবে' : 'Amount payable'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {mySummary.totalPaidOutOfPocket > 0
                      ? isBn
                        ? `আপনি নিজ পকেট থেকে বাজার করেছেন ${formatTaka(mySummary.totalPaidOutOfPocket, lang)}`
                        : `You paid ${formatTaka(mySummary.totalPaidOutOfPocket, lang)} out-of-pocket`
                      : isBn ? 'স্বচ্ছ অটোমেটিক হিসাব' : 'Updated live from approved entries'}
                  </div>
                </div>
                <span
                  className={`text-xl font-bold font-mono tabular-nums ${
                    mySummary.netBalance >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatTaka(Math.abs(mySummary.netBalance), lang)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              {isBn
                ? 'আপনি সুপার অ্যাডমিন মোডে আছেন। সদস্যদের হিসাব দেখতে অ্যাকাউন্টস ট্যাবে যান।'
                : 'Viewing as platform administrator. Open Accounts to inspect member ledgers.'}
            </div>
          )}
        </section>
      </div>

      {/* Money Flow + Insights & Community Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Money Flow */}
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isBn ? 'টাকা কোথায় যাচ্ছে (মানি ফ্লো)' : 'Money Flow — Where Costs Go'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isBn ? 'মাসিক মোট খরচ ও ভাড়ার অনুপাত' : 'Proportional share of bazar, rent, utilities & staff'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('bazar')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isBn ? 'সব খরচ দেখুন' : 'All Expenses'}
            </button>
          </div>

          {/* Stacked Bar */}
          <div className="mt-5 h-3.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
            {flowSegments.map((seg) => (
              <div
                key={seg.label}
                style={{ width: `${seg.pct}%` }}
                className={`${seg.barClass} transition-all`}
                title={`${seg.label}: ${formatTaka(seg.amount, lang)} (${seg.pct}%)`}
              />
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {flowSegments.map((seg) => (
              <div key={seg.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${seg.barClass}`} />
                  <span className="text-slate-700 dark:text-slate-300">{seg.label}</span>
                </div>
                <div className="flex items-center gap-4 font-mono tabular-nums">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {toLocalDigits(seg.pct, lang)}%
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white min-w-[90px] text-right">
                    {formatTaka(seg.amount, lang)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Smart Insights */}
          {insights.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{isBn ? 'স্বয়ংক্রিয় মেস ইনসাইটস' : 'Contextual Insights'}</span>
              </div>
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-800/30 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    {ins.severity === 'alert' ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    ) : ins.severity === 'warning' ? (
                      <CalendarClock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {isBn ? ins.titleBn : ins.titleEn}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {isBn ? ins.descriptionBn : ins.descriptionEn}
                      </div>
                    </div>
                  </div>
                  {ins.metricValue && (
                    <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white shrink-0">
                      {ins.metricValue}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Community Activity & Active Notices */}
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isBn ? 'সাম্প্রতিক কার্যক্রম ও নোটিশ' : 'Community Activity & Notices'}
            </h2>
            <button
              onClick={() => onNavigate('notices')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isBn ? 'নোটিশ বোর্ড' : 'Notice Board'}
            </button>
          </div>

          {notices.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 p-4">
              <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{notices[0].title}</span>
                <span>{notices[0].createdByName}</span>
              </div>
              <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                {notices[0].body}
              </p>
            </div>
          )}

          <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
            {auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Receipt className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-800 dark:text-slate-200">
                      <span className="font-medium">{log.actorName}</span> · {log.details}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {new Date(log.createdAt).toLocaleString(isBn ? 'bn-BD' : 'en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
