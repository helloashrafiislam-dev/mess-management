import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatTaka } from '../i18n/translations.js';
import { apiRequest } from '../lib/api.js';
import type { Language, PlanTier } from '../shared/types.js';

interface SuperAdminConsoleProps {
  lang: Language;
  onSelectMess: (messId: string) => Promise<void>;
}

export const SuperAdminConsole: React.FC<SuperAdminConsoleProps> = ({ lang, onSelectMess }) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      const res = await apiRequest('/api/admin/overview');
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load platform metrics');
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleUpdateMess = async (id: string, patch: { planTier?: PlanTier; isSuspended?: boolean }) => {
    await apiRequest(`/api/admin/mess/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await loadOverview();
  };

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-sm text-slate-500">
        Loading platform analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Platform Super Admin Console
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Multi-tenant mess governance, subscription tiers, and verified transaction volume
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500">Total Registered Messes</div>
            <div className="text-3xl font-bold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
              {data.totalMesses}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Platform Users</div>
            <div className="text-3xl font-bold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
              {data.totalUsers}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Verified Deposits Volume</div>
            <div className="text-3xl font-bold font-mono tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
              {formatTaka(data.totalPaymentsVolume, lang)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
          All Mess Tenants
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-3 px-6">Mess Name</th>
                <th className="py-3 px-4">City & Code</th>
                <th className="py-3 px-4 text-right">Members</th>
                <th className="py-3 px-4 text-right">Logged Expenses</th>
                <th className="py-3 px-4">Plan Tier</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.messes.map((m: any) => (
                <tr key={m.id}>
                  <td className="py-3.5 px-6">
                    <div className="font-medium text-slate-900 dark:text-white">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.address}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    {m.city} · <span className="font-mono">{m.invite_code}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">{m.activeMembers}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    {formatTaka(m.totalExpenses, lang)}
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={m.plan_tier}
                      onChange={(e) => handleUpdateMess(m.id, { planTier: e.target.value as PlanTier })}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs capitalize"
                    >
                      <option value="free">Free (৳0)</option>
                      <option value="premium">Standard (৳299)</option>
                      <option value="hostel">Hostel Pro (৳999)</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onSelectMess(m.id)}
                        className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => handleUpdateMess(m.id, { isSuspended: !m.is_suspended })}
                        className={`p-1.5 rounded-lg border cursor-pointer ${
                          m.is_suspended
                            ? 'border-emerald-200 text-emerald-700'
                            : 'border-red-200 text-red-600'
                        }`}
                        title={m.is_suspended ? 'Reactivate mess' : 'Suspend mess'}
                      >
                        {m.is_suspended ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      </button>
                    </div>
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
