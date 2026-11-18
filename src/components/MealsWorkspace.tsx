import React, { useMemo, useState } from 'react';
import { Calendar, Check, Lock, Unlock, Users } from 'lucide-react';
import { formatDateLocal, toLocalDigits } from '../i18n/translations.js';
import { computeWeightedMeals } from '../shared/financialEngine.js';
import type {
  Language,
  MealRecord,
  MemberRecord,
  MessConfig,
} from '../shared/types.js';

interface MealsWorkspaceProps {
  lang: Language;
  todayStr: string;
  monthKey: string;
  config: MessConfig;
  currentMember: MemberRecord | null;
  members: MemberRecord[];
  meals: MealRecord[];
  isMonthClosed: boolean;
  onUpsertMeal: (payload: {
    membershipId: string;
    mealDate: string;
    breakfast: number;
    lunch: number;
    dinner: number;
    guestMeals: number;
  }) => Promise<void>;
  onLockDay: (mealDate: string, locked: boolean) => Promise<void>;
}

export const MealsWorkspace: React.FC<MealsWorkspaceProps> = ({
  lang,
  todayStr,
  monthKey,
  config,
  currentMember,
  members,
  meals,
  isMonthClosed,
  onUpsertMeal,
  onLockDay,
}) => {
  const isBn = lang === 'bn';
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const canManageAll =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.manageMeals);

  const activeMembers = members.filter(
    (m) => m.status === 'active' || m.status === 'away' || m.status === 'leaving_soon'
  );

  // Build days of the selected month up to end of month
  const monthDays = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `${monthKey}-${day}`;
    });
  }, [monthKey]);

  const dateMealMap = useMemo(() => {
    const map: Record<string, MealRecord> = {};
    for (const ml of meals) {
      if (ml.mealDate === selectedDate) {
        map[ml.membershipId] = ml;
      }
    }
    return map;
  }, [meals, selectedDate]);

  const isSelectedDayLocked = useMemo(() => {
    const records = meals.filter((m) => m.mealDate === selectedDate);
    return records.length > 0 && records.every((r) => r.locked);
  }, [meals, selectedDate]);

  // Daily totals for heatmap
  const dailyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ml of meals) {
      map[ml.mealDate] = (map[ml.mealDate] || 0) + computeWeightedMeals(ml, config);
    }
    return map;
  }, [meals, config]);

  const selectedDayStats = useMemo(() => {
    let b = 0;
    let l = 0;
    let d = 0;
    let g = 0;
    let weighted = 0;
    for (const ml of Object.values(dateMealMap)) {
      b += ml.breakfast ? 1 : 0;
      l += ml.lunch ? 1 : 0;
      d += ml.dinner ? 1 : 0;
      g += ml.guestMeals || 0;
      weighted += computeWeightedMeals(ml, config);
    }
    return { b, l, d, g, weighted };
  }, [dateMealMap, config]);

  const handleToggle = async (
    membershipId: string,
    field: 'breakfast' | 'lunch' | 'dinner' | 'guest_inc' | 'guest_dec'
  ) => {
    if (isMonthClosed) return;
    const current = dateMealMap[membershipId] || {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      guestMeals: 0,
    };
    const next = {
      membershipId,
      mealDate: selectedDate,
      breakfast: field === 'breakfast' ? (current.breakfast ? 0 : 1) : current.breakfast,
      lunch: field === 'lunch' ? (current.lunch ? 0 : 1) : current.lunch,
      dinner: field === 'dinner' ? (current.dinner ? 0 : 1) : current.dinner,
      guestMeals:
        field === 'guest_inc'
          ? current.guestMeals + 1
          : field === 'guest_dec'
            ? Math.max(0, current.guestMeals - 1)
            : current.guestMeals,
    };
    setSavingKey(`${membershipId}-${field}`);
    try {
      await onUpsertMeal(next);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isBn ? 'দৈনিক মিল ব্যবস্থাপনা ও ক্যালেন্ডার' : 'Meal Rhythm & Attendance'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isBn
                ? `সকাল (${config.breakfastWeight}) · দুপুর (${config.lunchWeight}) · রাত (${config.dinnerWeight}) · গেস্ট মিল ${config.guestMealRate} টাকা`
                : `Weights: Breakfast ${config.breakfastWeight} · Lunch ${config.lunchWeight} · Dinner ${config.dinnerWeight} · Guest meal ৳${config.guestMealRate}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {canManageAll && !isMonthClosed && (
              <button
                onClick={() => onLockDay(selectedDate, !isSelectedDayLocked)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  isSelectedDayLocked
                    ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                }`}
              >
                {isSelectedDayLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span>
                  {isSelectedDayLocked
                    ? isBn ? 'দিন আনলক করুন' : 'Unlock Day'
                    : isBn ? 'দিনের মিল লক করুন' : 'Lock Day'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Strip for Selected Date */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'তারিখ' : 'Selected Date'}</div>
            <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
              {formatDateLocal(selectedDate, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'সকাল' : 'Breakfast'}</div>
            <div className="font-mono tabular-nums font-bold text-lg text-slate-900 dark:text-white">
              {toLocalDigits(selectedDayStats.b, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'দুপুর' : 'Lunch'}</div>
            <div className="font-mono tabular-nums font-bold text-lg text-slate-900 dark:text-white">
              {toLocalDigits(selectedDayStats.l, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'রাত' : 'Dinner'}</div>
            <div className="font-mono tabular-nums font-bold text-lg text-slate-900 dark:text-white">
              {toLocalDigits(selectedDayStats.d, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'মোট ওজনকৃত মিল' : 'Total Weighted'}</div>
            <div className="font-mono tabular-nums font-bold text-lg text-emerald-700 dark:text-emerald-400">
              {toLocalDigits(selectedDayStats.weighted, lang)}
              {selectedDayStats.g > 0 && (
                <span className="text-xs text-amber-600 ml-1.5">
                  +{toLocalDigits(selectedDayStats.g, lang)}G
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Month Heatmap Calendar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isBn ? 'মাসিক মিল হিটম্যাপ (তারিখ নির্বাচন করুন)' : 'Monthly Meal Activity Calendar'}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{monthKey}</span>
        </div>
        <div className="grid grid-cols-7 sm:grid-cols-10 lg:grid-cols-16 gap-2">
          {monthDays.map((d) => {
            const count = dailyTotals[d] || 0;
            const isSelected = d === selectedDate;
            const isToday = d === todayStr;
            const dayNum = d.slice(8);
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : count > 0
                      ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 text-slate-900 dark:text-slate-100 hover:border-emerald-400'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <div className={`text-[11px] font-medium ${isToday && !isSelected ? 'text-emerald-700 dark:text-emerald-400 font-bold' : ''}`}>
                  {toLocalDigits(dayNum, lang)}
                </div>
                <div className="text-xs font-mono tabular-nums font-semibold mt-0.5">
                  {count > 0 ? toLocalDigits(count, lang) : '·'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Member Daily Meal Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {isBn ? 'সদস্যভিত্তিক মিল তালিকা' : 'Member Meal Roster'}
            </h2>
          </div>
          {isSelectedDayLocked && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {isBn ? 'লক করা (শুধুমাত্র ম্যানেজার সম্পাদনা)' : 'Locked (Manager override only)'}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/40">
                <th className="py-3 px-6">{isBn ? 'সদস্য' : 'Member'}</th>
                <th className="py-3 px-4 text-center">{isBn ? 'সকাল' : 'Breakfast'}</th>
                <th className="py-3 px-4 text-center">{isBn ? 'দুপুর' : 'Lunch'}</th>
                <th className="py-3 px-4 text-center">{isBn ? 'রাত' : 'Dinner'}</th>
                <th className="py-3 px-4 text-center">{isBn ? 'গেস্ট' : 'Guest'}</th>
                <th className="py-3 px-6 text-right">{isBn ? 'মোট' : 'Weighted'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {activeMembers.map((member) => {
                const ml = dateMealMap[member.id] || {
                  breakfast: 0,
                  lunch: 0,
                  dinner: 0,
                  guestMeals: 0,
                };
                const isSelf = currentMember?.id === member.id;
                const editable =
                  !isMonthClosed && (canManageAll || (isSelf && !isSelectedDayLocked));
                const weighted = computeWeightedMeals(ml as MealRecord, config);

                return (
                  <tr
                    key={member.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/30 ${
                      isSelf ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                    }`}
                  >
                    <td className="py-3 px-6">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {member.name}
                        {isSelf && (
                          <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">
                            ({isBn ? 'আপনি' : 'You'})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {member.roomNumber ? `Room ${member.roomNumber}` : 'No Room'} · {member.status}
                      </div>
                    </td>

                    {(['breakfast', 'lunch', 'dinner'] as const).map((field) => {
                      const active = Boolean(ml[field]);
                      const busy = savingKey === `${member.id}-${field}`;
                      return (
                        <td key={field} className="py-3 px-4 text-center">
                          <button
                            disabled={!editable || busy}
                            onClick={() => handleToggle(member.id, field)}
                            className={`w-10 h-10 rounded-xl inline-flex items-center justify-center border transition-colors ${
                              active
                                ? 'bg-emerald-700 border-emerald-700 text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                            } ${editable ? 'cursor-pointer hover:opacity-90' : 'opacity-50 cursor-not-allowed'}`}
                            aria-label={`Toggle ${field} for ${member.name}`}
                          >
                            {active ? <Check className="w-4 h-4" /> : '—'}
                          </button>
                        </td>
                      );
                    })}

                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          disabled={!editable || ml.guestMeals <= 0}
                          onClick={() => handleToggle(member.id, 'guest_dec')}
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono tabular-nums w-5 text-center text-slate-900 dark:text-white">
                          {toLocalDigits(ml.guestMeals || 0, lang)}
                        </span>
                        <button
                          disabled={!editable}
                          onClick={() => handleToggle(member.id, 'guest_inc')}
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {toLocalDigits(weighted, lang)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
