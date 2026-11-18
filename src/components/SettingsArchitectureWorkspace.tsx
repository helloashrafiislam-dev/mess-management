import React, { useState } from 'react';
import { CheckCircle2, Save, Smartphone } from 'lucide-react';
import type { Language, MemberRecord, MessConfig } from '../shared/types.js';

interface SettingsArchitectureWorkspaceProps {
  lang: Language;
  config: MessConfig;
  currentMember: MemberRecord | null;
  onSaveSettings: (payload: Partial<MessConfig>) => Promise<void>;
}

export const SettingsArchitectureWorkspace: React.FC<SettingsArchitectureWorkspaceProps> = ({
  lang,
  config,
  currentMember,
  onSaveSettings,
}) => {
  const isBn = lang === 'bn';
  const isOwner = currentMember?.role === 'owner';

  const [name, setName] = useState(config.name);
  const [address, setAddress] = useState(config.address);
  const [city, setCity] = useState(config.city);
  const [breakfastWeight, setBreakfastWeight] = useState(String(config.breakfastWeight));
  const [lunchWeight, setLunchWeight] = useState(String(config.lunchWeight));
  const [dinnerWeight, setDinnerWeight] = useState(String(config.dinnerWeight));
  const [bookingCutoff, setBookingCutoff] = useState(String(config.mealBookingCutoffHour));
  const [cancelCutoff, setCancelCutoff] = useState(String(config.mealCancelCutoffHour));
  const [guestRate, setGuestRate] = useState(String(config.guestMealRate));
  const [rentMode, setRentMode] = useState(config.rentDistributionMode);
  const [utilMode, setUtilMode] = useState(config.utilityDistributionMode);
  const [requireApproval, setRequireApproval] = useState(config.requireExpenseApproval);
  const [savedBanner, setSavedBanner] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({
      name,
      address,
      city,
      breakfastWeight: Number(breakfastWeight),
      lunchWeight: Number(lunchWeight),
      dinnerWeight: Number(dinnerWeight),
      mealBookingCutoffHour: Number(bookingCutoff),
      mealCancelCutoffHour: Number(cancelCutoff),
      guestMealRate: Number(guestRate),
      rentDistributionMode: rentMode,
      utilityDistributionMode: utilMode,
      requireExpenseApproval: requireApproval,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const playStoreChecklist = [
    'App ID: com.messflow.bd · Target SDK 35 (Android 15)',
    'Offline SQLite/Room local cache with idempotency keys',
    'One-handed bottom navigation (Home, Meals, হিসাব, Activity, Profile)',
    'Account Deletion & Full Data Export (Play Console Data Safety compliance)',
    'No unnecessary permissions (Camera/Gallery optional only for bKash receipts)',
    'Bilingual Bengali (Hind Siliguri) + English resource strings',
  ];

  const pricingTiers = [
    {
      name: 'Free (Choto Mess)',
      audience: 'For student & bachelor messes up to 8 members',
      price: '৳0 / month',
      limits: 'Up to 8 members · Daily meals & bazar · Basic monthly calculation · bKash manual verification',
    },
    {
      name: 'Standard Mess',
      audience: 'For active Dhaka/Chattogram shared messes',
      price: '৳299 / month (or ৳2,990/yr)',
      limits: 'Up to 25 members · PDF/CSV Monthly Statements · Multi-manager RBAC · Room/Bed map · 24-month archive',
    },
    {
      name: 'Hostel Pro',
      audience: 'For hostel owners & multi-branch residential operators',
      price: '৳999 / month',
      limits: 'Unlimited branches & members · Central Owner dashboard · Accountant role · Automated carry-forward & audit logs',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Editable Mess Rules */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isBn ? 'মেসের নিয়ম ও ফিন্যান্সিয়াল সেটিংস' : 'Mess Rules & Calculation Settings'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isOwner
                ? isBn ? 'মালিক হিসেবে আপনি মিল ওয়েট ও বণ্টন নিয়ম পরিবর্তন করতে পারেন' : 'Configure meal weights, cutoffs, and cost distribution formulas'
                : isBn ? 'শুধুমাত্র মেস মালিক সেটিংস পরিবর্তন করতে পারবেন' : 'Read-only view (Mess Owner permission required to edit)'}
            </p>
          </div>
          {savedBanner && (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Settings updated
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mess Name</label>
            <input
              disabled={!isOwner}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
            <input
              disabled={!isOwner}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
            <input
              disabled={!isOwner}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Breakfast Weight</label>
            <input
              disabled={!isOwner}
              type="number"
              step="0.25"
              value={breakfastWeight}
              onChange={(e) => setBreakfastWeight(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lunch Weight</label>
            <input
              disabled={!isOwner}
              type="number"
              step="0.25"
              value={lunchWeight}
              onChange={(e) => setLunchWeight(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dinner Weight</label>
            <input
              disabled={!isOwner}
              type="number"
              step="0.25"
              value={dinnerWeight}
              onChange={(e) => setDinnerWeight(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Guest Meal Fixed Rate (৳)</label>
            <input
              disabled={!isOwner}
              type="number"
              value={guestRate}
              onChange={(e) => setGuestRate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Rent Distribution Mode</label>
            <select
              disabled={!isOwner}
              value={rentMode}
              onChange={(e) => setRentMode(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="bed_specific">Bed / Seat Specific Rent</option>
              <option value="equal">Equal Split Across Residents</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Utility Distribution Mode</label>
            <select
              disabled={!isOwner}
              value={utilMode}
              onChange={(e) => setUtilMode(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="equal">Equal Split</option>
              <option value="meal_based">Proportional to Meals</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Booking Cutoff Hour (24h)</label>
            <input
              disabled={!isOwner}
              type="number"
              min="0"
              max="23"
              value={bookingCutoff}
              onChange={(e) => setBookingCutoff(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Cancellation Cutoff Hour (AM)</label>
            <input
              disabled={!isOwner}
              type="number"
              min="0"
              max="23"
              value={cancelCutoff}
              onChange={(e) => setCancelCutoff(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                disabled={!isOwner}
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                className="w-4 h-4 accent-emerald-700"
              />
              <span>Require owner approval for manager expenses</span>
            </label>
          </div>

          {isOwner && (
            <div className="md:col-span-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isBn ? 'সেটিংস সংরক্ষণ করুন' : 'Save Mess Rules'}</span>
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Bangladesh Market Fit, Pricing Tiers & Play Store Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Bangladesh SaaS Business Model & Pricing Tiers
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Designed around Bangladesh mess economics: free for small bachelor messes so members never pay per-seat friction; affordable mess-level tiers for larger hostels.
          </p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pricingTiers.map((tier) => (
              <div key={tier.name} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{tier.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{tier.audience}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{tier.limits}</div>
                </div>
                <div className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                  {tier.price}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Android Play Store Release Readiness
            </h2>
          </div>
          <div className="space-y-2.5">
            {playStoreChecklist.map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
