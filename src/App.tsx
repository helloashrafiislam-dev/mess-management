import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  CalendarDays,
  CreditCard,
  FileCheck2,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBasket,
  Smartphone,
  Sun,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { AccountsPaymentsWorkspace } from './components/AccountsPaymentsWorkspace.js';
import { AuthGateModal } from './components/AuthGateModal.js';
import { BazarExpensesWorkspace } from './components/BazarExpensesWorkspace.js';
import { MealsWorkspace } from './components/MealsWorkspace.js';
import { MembersRoomsWorkspace } from './components/MembersRoomsWorkspace.js';
import { MobileMemberApp } from './components/MobileMemberApp.js';
import { OverviewPulse } from './components/OverviewPulse.js';
import { SettingsArchitectureWorkspace } from './components/SettingsArchitectureWorkspace.js';
import { SettlementNoticesWorkspace } from './components/SettlementNoticesWorkspace.js';
import { SuperAdminConsole } from './components/SuperAdminConsole.js';
import { translations } from './i18n/translations.js';
import { apiRequest, flushOfflineQueue, getSessionToken, setSessionToken } from './lib/api.js';
import {
  clearSyncedQueueItems,
  enqueueOfflineAction,
  getOfflineQueue,
  loadSnapshotCache,
  saveSnapshotCache,
  type OfflineQueuedAction,
} from './lib/offlineQueue.js';
import type {
  AuditLogRecord,
  BedRecord,
  ClosingReadinessCheck,
  ExpenseRecord,
  FinancialBreakdown,
  Language,
  MealRecord,
  MemberRecord,
  MessConfig,
  MessInsight,
  MonthlySettlementRecord,
  NoticeRecord,
  PaymentRecord,
  RoomRecord,
  UserRecord,
} from './shared/types.js';

interface SnapshotData {
  todayStr: string;
  monthKey: string;
  currentMember: MemberRecord | null;
  userMemberships: { messId: string; role: string; messName: string; city: string }[];
  config: MessConfig;
  members: MemberRecord[];
  rooms: RoomRecord[];
  beds: BedRecord[];
  meals: MealRecord[];
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  notices: NoticeRecord[];
  auditLogs: AuditLogRecord[];
  settlement: MonthlySettlementRecord | null;
  financialBreakdown: FinancialBreakdown;
  insights: MessInsight[];
  closingReadiness: ClosingReadinessCheck[];
}

export default function App() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [activeMessId, setActiveMessId] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOutExplicitly, setSignedOutExplicitly] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileCompanionMode, setMobileCompanionMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<Language>('en');

  // Offline & Toast feedback
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedAction[]>(() => getOfflineQueue());
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Create / Join Mess Modal
  const [showCreateJoinMess, setShowCreateJoinMess] = useState(false);
  const [messModalTab, setMessModalTab] = useState<'create' | 'join'>('create');
  const [newMessName, setNewMessName] = useState('');
  const [newMessAddress, setNewMessAddress] = useState('');
  const [newMessCity, setNewMessCity] = useState('Dhaka');
  const [joinCode, setJoinCode] = useState('');

  const isOffline = simulatedOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
  const t = translations[lang];

  const notify = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const loadSessionAndSnapshot = useCallback(
    async (overrideMessId?: string, overrideMonth?: string) => {
      try {
        let token = getSessionToken();
        if (!token && !signedOutExplicitly) {
          const demo = await apiRequest('/api/auth/demo-switch', {
            method: 'POST',
            body: JSON.stringify({ userId: 'u-owner', messId: 'mess-dhaka-1' }),
          });
          token = demo.token;
          setSessionToken(token);
        }
        if (!token) {
          setLoading(false);
          return;
        }

        const me = await apiRequest('/api/auth/me');
        setUser(me.user);
        setLang(me.user.language === 'bn' ? 'bn' : 'en');
        const resolvedMess = overrideMessId || me.activeMessId || me.memberships?.[0]?.messId || 'mess-dhaka-1';
        setActiveMessId(resolvedMess);

        const targetMonth = overrideMonth || monthKey;
        const snap = await apiRequest<SnapshotData>(
          `/api/mess/snapshot?messId=${encodeURIComponent(resolvedMess)}&monthKey=${encodeURIComponent(targetMonth)}`
        );
        setSnapshot(snap);
        saveSnapshotCache(resolvedMess, targetMonth, snap);
      } catch (err: any) {
        if (activeMessId) {
          const cached = loadSnapshotCache<SnapshotData>(activeMessId, monthKey);
          if (cached) {
            setSnapshot(cached.data);
            notify('Loaded cached mess data (offline fallback)', 'info');
          }
        }
        if (err.message?.includes('Authentication')) {
          setSessionToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [activeMessId, monthKey, signedOutExplicitly]
  );

  useEffect(() => {
    loadSessionAndSnapshot();
  }, [monthKey]);

  const refreshSnapshot = async (messIdOverride?: string) => {
    const mId = messIdOverride || activeMessId;
    if (!mId) return;
    if (isOffline) {
      const cached = loadSnapshotCache<SnapshotData>(mId, monthKey);
      if (cached) setSnapshot(cached.data);
      return;
    }
    const snap = await apiRequest<SnapshotData>(
      `/api/mess/snapshot?messId=${encodeURIComponent(mId)}&monthKey=${encodeURIComponent(monthKey)}`
    );
    setSnapshot(snap);
    saveSnapshotCache(mId, monthKey, snap);
  };

  const handleToggleOffline = async () => {
    if (simulatedOffline) {
      setSimulatedOffline(false);
      const result = await flushOfflineQueue();
      setOfflineQueue(getOfflineQueue());
      if (result.synced > 0) {
        clearSyncedQueueItems();
        setOfflineQueue(getOfflineQueue());
        notify(`Synced ${result.synced} offline action(s) safely`, 'success');
      }
      await refreshSnapshot();
    } else {
      setSimulatedOffline(true);
      notify('Offline mode enabled — actions will queue locally', 'info');
    }
  };

  const handleToggleLanguage = async () => {
    const next: Language = lang === 'en' ? 'bn' : 'en';
    setLang(next);
    if (!isOffline) {
      await apiRequest('/api/auth/language', {
        method: 'PATCH',
        body: JSON.stringify({ language: next }),
      }).catch(() => {});
    }
  };

  const handleRoleQuickSwitch = async (userId: string) => {
    const res = await apiRequest('/api/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ userId, messId: activeMessId || 'mess-dhaka-1' }),
    });
    setSessionToken(res.token);
    setSignedOutExplicitly(false);
    await loadSessionAndSnapshot(res.activeMessId);
    if (userId === 'u-super') {
      setActiveTab('admin');
    } else if (activeTab === 'admin') {
      setActiveTab('overview');
    }
    notify(`Switched account to ${res.user.name}`);
  };

  const handleSignOut = () => {
    setSessionToken(null);
    setSignedOutExplicitly(true);
    setUser(null);
    setSnapshot(null);
  };

  // Action Handlers with Offline Queue support
  const runOrQueueAction = async (params: {
    endpoint: string;
    method: 'POST' | 'PATCH';
    payload: Record<string, any>;
    label: string;
    successMsg: string;
  }) => {
    if (isOffline) {
      enqueueOfflineAction({
        endpoint: params.endpoint,
        method: params.method,
        payload: params.payload,
        label: params.label,
      });
      setOfflineQueue(getOfflineQueue());
      notify(`Saved locally (${params.label}) — sync pending`, 'info');
      return;
    }
    try {
      await apiRequest(params.endpoint, {
        method: params.method,
        body: JSON.stringify(params.payload),
      });
      await refreshSnapshot();
      notify(params.successMsg, 'success');
    } catch (err: any) {
      notify(err.message || 'Operation failed', 'error');
      throw err;
    }
  };

  const handleQuickToggleMyMeal = async (field: 'breakfast' | 'lunch' | 'dinner') => {
    if (!snapshot?.currentMember || !activeMessId) return;
    const todayMeal = snapshot.meals.find(
      (m) => m.membershipId === snapshot.currentMember!.id && m.mealDate === snapshot.todayStr
    );
    const current = todayMeal || { breakfast: 0, lunch: 0, dinner: 0, guestMeals: 0 };
    const payload = {
      messId: activeMessId,
      membershipId: snapshot.currentMember.id,
      mealDate: snapshot.todayStr,
      breakfast: field === 'breakfast' ? (current.breakfast ? 0 : 1) : current.breakfast,
      lunch: field === 'lunch' ? (current.lunch ? 0 : 1) : current.lunch,
      dinner: field === 'dinner' ? (current.dinner ? 0 : 1) : current.dinner,
      guestMeals: current.guestMeals || 0,
    };

    // Optimistic local state update when offline
    if (isOffline && snapshot) {
      const updatedMeals = [...snapshot.meals];
      const idx = updatedMeals.findIndex(
        (m) => m.membershipId === payload.membershipId && m.mealDate === payload.mealDate
      );
      const optimisticRecord: MealRecord = {
        id: `meal-${payload.membershipId}-${payload.mealDate}`,
        messId: activeMessId,
        membershipId: payload.membershipId,
        mealDate: payload.mealDate,
        breakfast: payload.breakfast,
        lunch: payload.lunch,
        dinner: payload.dinner,
        guestMeals: payload.guestMeals,
        locked: false,
        updatedBy: user?.id || '',
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) updatedMeals[idx] = optimisticRecord;
      else updatedMeals.unshift(optimisticRecord);
      setSnapshot({ ...snapshot, meals: updatedMeals });
    }

    await runOrQueueAction({
      endpoint: '/api/meals/upsert',
      method: 'POST',
      payload,
      label: `Meal ${field}`,
      successMsg: `Updated ${field} for today`,
    });
  };

  const handleCreateOrJoinMess = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (messModalTab === 'create') {
        const res = await apiRequest('/api/mess/create', {
          method: 'POST',
          body: JSON.stringify({ name: newMessName, address: newMessAddress, city: newMessCity }),
        });
        setShowCreateJoinMess(false);
        setNewMessName('');
        setNewMessAddress('');
        await loadSessionAndSnapshot(res.messId);
        notify(`Created "${newMessName}" · Invite code: ${res.inviteCode}`);
      } else {
        const res = await apiRequest('/api/mess/join', {
          method: 'POST',
          body: JSON.stringify({ inviteCode: joinCode }),
        });
        setShowCreateJoinMess(false);
        setJoinCode('');
        await loadSessionAndSnapshot(res.messId);
        notify(`Joined ${res.messName}`);
      }
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-sm text-slate-500">
        Loading MessFlow workspace...
      </div>
    );
  }

  if (!user || !snapshot) {
    return (
      <AuthGateModal
        onAuthenticated={async () => {
          setSignedOutExplicitly(false);
          await loadSessionAndSnapshot();
        }}
      />
    );
  }

  const navItems = [
    { id: 'overview', label: t.navOverview, icon: Activity },
    { id: 'meals', label: t.navMeals, icon: CalendarDays },
    { id: 'bazar', label: t.navBazar, icon: ShoppingBasket },
    { id: 'accounts', label: t.navAccounts, icon: CreditCard },
    { id: 'members', label: t.navMembers, icon: Users },
    { id: 'settlement', label: t.navSettlement, icon: FileCheck2 },
    { id: 'notices', label: t.navNotices, icon: Megaphone },
    { id: 'settings', label: t.navSettings, icon: Settings },
    ...(user.platformRole === 'super_admin'
      ? [{ id: 'admin', label: t.navAdmin, icon: Shield }]
      : []),
  ];

  const isMonthClosed = snapshot.settlement?.status === 'closed';
  const pendingOfflineCount = offlineQueue.filter((q) => q.status !== 'synced').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Navigation (Desktop fixed, Mobile drawer) */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-40 w-[264px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Brand Wordmark */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-display font-bold flex items-center justify-center text-sm">
                M
              </div>
              <div>
                <div className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white leading-none">
                  {t.brandName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {t.brandSubtitle}
                </div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mess Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Active Mess</span>
              <button
                onClick={() => setShowCreateJoinMess(true)}
                className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                + New / Join
              </button>
            </div>
            <select
              value={activeMessId || ''}
              onChange={async (e) => {
                const mId = e.target.value;
                await apiRequest('/api/auth/switch-mess', {
                  method: 'POST',
                  body: JSON.stringify({ messId: mId }),
                });
                setActiveMessId(mId);
                await refreshSnapshot(mId);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            >
              {snapshot.userMemberships.map((m) => (
                <option key={m.messId} value={m.messId}>
                  {m.messName} ({m.city})
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = !mobileCompanionMode && activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMobileCompanionMode(false);
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Android Member Experience Switch */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                setMobileCompanionMode(!mobileCompanionMode);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                mobileCompanionMode
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>{mobileCompanionMode ? t.webModeLabel : t.mobileModeLabel}</span>
            </button>
          </div>
        </div>

        {/* Bottom User & Role Switcher */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/60 dark:bg-slate-900">
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {user.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
              {user.platformRole === 'super_admin'
                ? 'Super Admin'
                : snapshot.currentMember?.role || 'Member'}{' '}
              · {snapshot.config.planTier}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1">
              Test Role View
            </label>
            <select
              value={user.id}
              onChange={(e) => handleRoleQuickSwitch(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            >
              <option value="u-owner">Mahmudul (Mess Owner)</option>
              <option value="u-manager">Rakibul (Manager)</option>
              <option value="u-m4">Nafis (Accountant)</option>
              <option value="u-m3">Sajid (Member)</option>
              <option value="u-super">Tanvir (Super Admin)</option>
            </select>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-red-600 cursor-pointer py-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean SaaS Top Header */}
        <header className="no-print sticky top-0 z-30 h-16 px-4 lg:px-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 hidden sm:block" />
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {snapshot.config.name}
              </span>
              <span className="text-slate-400 hidden sm:inline">/</span>
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                {mobileCompanionMode
                  ? t.mobileModeLabel
                  : navItems.find((n) => n.id === activeTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
            />

            <button
              onClick={handleToggleOffline}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer whitespace-nowrap ${
                isOffline
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="Toggle offline simulation"
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-600" />}
              <span>
                {isOffline
                  ? pendingOfflineCount > 0
                    ? `${pendingOfflineCount} pending`
                    : 'Offline'
                  : 'Online'}
              </span>
            </button>

            <button
              onClick={handleToggleLanguage}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              {lang === 'en' ? 'বাংলা' : 'EN'}
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                setMobileCompanionMode(false);
                setActiveTab('bazar');
              }}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.quickBazar}</span>
            </button>
          </div>
        </header>

        {/* Offline Queue Status Banner */}
        {(isOffline || pendingOfflineCount > 0) && (
          <div className="no-print px-4 lg:px-8 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span>
              {isOffline ? t.offlineBannerOffline : `${pendingOfflineCount} queued offline action(s)`}
            </span>
            <button
              onClick={handleToggleOffline}
              className="inline-flex items-center gap-1 font-semibold underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isOffline ? t.goOnline : 'Sync Now'}</span>
            </button>
          </div>
        )}

        {/* Viewport Container */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {mobileCompanionMode ? (
            <MobileMemberApp
              lang={lang}
              todayStr={snapshot.todayStr}
              config={snapshot.config}
              currentMember={snapshot.currentMember}
              meals={snapshot.meals}
              notices={snapshot.notices}
              auditLogs={snapshot.auditLogs}
              breakdown={snapshot.financialBreakdown}
              isOffline={isOffline}
              offlineQueue={offlineQueue}
              onToggleMeal={handleQuickToggleMyMeal}
              onSubmitPayment={(p) =>
                runOrQueueAction({
                  endpoint: '/api/payments',
                  method: 'POST',
                  payload: { messId: activeMessId, ...p },
                  label: `Payment ৳${p.amount}`,
                  successMsg: 'Payment submitted for verification',
                })
              }
              onSwitchToWeb={() => setMobileCompanionMode(false)}
            />
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewPulse
                  lang={lang}
                  todayStr={snapshot.todayStr}
                  monthKey={snapshot.monthKey}
                  config={snapshot.config}
                  currentMember={snapshot.currentMember}
                  members={snapshot.members}
                  meals={snapshot.meals}
                  expenses={snapshot.expenses}
                  payments={snapshot.payments}
                  notices={snapshot.notices}
                  auditLogs={snapshot.auditLogs}
                  breakdown={snapshot.financialBreakdown}
                  insights={snapshot.insights}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onQuickToggleMeal={handleQuickToggleMyMeal}
                  onOpenQuickBazar={() => setActiveTab('bazar')}
                  onOpenQuickPayment={() => setActiveTab('accounts')}
                />
              )}

              {activeTab === 'meals' && (
                <MealsWorkspace
                  lang={lang}
                  todayStr={snapshot.todayStr}
                  monthKey={snapshot.monthKey}
                  config={snapshot.config}
                  currentMember={snapshot.currentMember}
                  members={snapshot.members}
                  meals={snapshot.meals}
                  isMonthClosed={isMonthClosed}
                  onUpsertMeal={(p) =>
                    runOrQueueAction({
                      endpoint: '/api/meals/upsert',
                      method: 'POST',
                      payload: { messId: activeMessId, ...p },
                      label: `Meal ${p.mealDate}`,
                      successMsg: 'Meal count updated',
                    })
                  }
                  onLockDay={async (mealDate, locked) => {
                    await apiRequest('/api/meals/lock-day', {
                      method: 'POST',
                      body: JSON.stringify({ messId: activeMessId, mealDate, locked }),
                    });
                    await refreshSnapshot();
                    notify(locked ? `Locked ${mealDate}` : `Unlocked ${mealDate}`);
                  }}
                />
              )}

              {activeTab === 'bazar' && (
                <BazarExpensesWorkspace
                  lang={lang}
                  todayStr={snapshot.todayStr}
                  currentMember={snapshot.currentMember}
                  members={snapshot.members}
                  expenses={snapshot.expenses}
                  isMonthClosed={isMonthClosed}
                  onAddExpense={(p) =>
                    runOrQueueAction({
                      endpoint: '/api/expenses',
                      method: 'POST',
                      payload: { messId: activeMessId, ...p },
                      label: `${p.category} ৳${p.amount}`,
                      successMsg: `Logged ৳${p.amount.toLocaleString()} ${p.category}`,
                    })
                  }
                  onUpdateExpenseStatus={async (id, status) => {
                    await apiRequest(`/api/expenses/${id}/status`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status }),
                    });
                    await refreshSnapshot();
                    notify(`Expense marked ${status}`);
                  }}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountsPaymentsWorkspace
                  lang={lang}
                  todayStr={snapshot.todayStr}
                  monthKey={snapshot.monthKey}
                  currentMember={snapshot.currentMember}
                  members={snapshot.members}
                  payments={snapshot.payments}
                  breakdown={snapshot.financialBreakdown}
                  isMonthClosed={isMonthClosed}
                  onSubmitPayment={(p) =>
                    runOrQueueAction({
                      endpoint: '/api/payments',
                      method: 'POST',
                      payload: { messId: activeMessId, ...p },
                      label: `Payment ৳${p.amount}`,
                      successMsg: 'Payment record saved',
                    })
                  }
                  onVerifyPayment={async (id, status) => {
                    await apiRequest(`/api/payments/${id}/verify`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status }),
                    });
                    await refreshSnapshot();
                    notify(`Payment ${status}`);
                  }}
                />
              )}

              {activeTab === 'members' && (
                <MembersRoomsWorkspace
                  lang={lang}
                  config={snapshot.config}
                  currentMember={snapshot.currentMember}
                  members={snapshot.members}
                  rooms={snapshot.rooms}
                  beds={snapshot.beds}
                  onAddMember={async (p) => {
                    await apiRequest('/api/members/add', {
                      method: 'POST',
                      body: JSON.stringify({ messId: activeMessId, ...p }),
                    });
                    await refreshSnapshot();
                    notify(`Added ${p.name}`);
                  }}
                  onUpdateMember={async (id, patch) => {
                    await apiRequest(`/api/members/${id}`, {
                      method: 'PATCH',
                      body: JSON.stringify(patch),
                    });
                    await refreshSnapshot();
                    notify('Member updated');
                  }}
                  onAddRoom={async (p) => {
                    await apiRequest('/api/rooms', {
                      method: 'POST',
                      body: JSON.stringify({ messId: activeMessId, ...p }),
                    });
                    await refreshSnapshot();
                    notify(`Room ${p.roomNumber} created`);
                  }}
                  onAssignBed={async (bedId, membershipId) => {
                    await apiRequest('/api/beds/assign', {
                      method: 'POST',
                      body: JSON.stringify({ messId: activeMessId, bedId, membershipId }),
                    });
                    await refreshSnapshot();
                    notify('Bed assignment updated');
                  }}
                />
              )}

              {(activeTab === 'settlement' || activeTab === 'notices') && (
                <SettlementNoticesWorkspace
                  mode={activeTab === 'notices' ? 'notices' : 'settlement'}
                  lang={lang}
                  monthKey={snapshot.monthKey}
                  config={snapshot.config}
                  currentMember={snapshot.currentMember}
                  currentUserId={user.id}
                  breakdown={snapshot.financialBreakdown}
                  settlement={snapshot.settlement}
                  readiness={snapshot.closingReadiness}
                  notices={snapshot.notices}
                  onCloseMonth={async (carryForwardBalances) => {
                    await apiRequest('/api/settlement/close', {
                      method: 'POST',
                      body: JSON.stringify({
                        messId: activeMessId,
                        monthKey: snapshot.monthKey,
                        carryForwardBalances,
                      }),
                    });
                    await refreshSnapshot();
                    notify(`Closed & locked ${snapshot.monthKey} settlement`);
                  }}
                  onCreateNotice={async (p) => {
                    await apiRequest('/api/notices', {
                      method: 'POST',
                      body: JSON.stringify({ messId: activeMessId, ...p }),
                    });
                    await refreshSnapshot();
                    notify('Notice published');
                  }}
                  onMarkNoticeRead={async (id) => {
                    await apiRequest(`/api/notices/${id}/read`, { method: 'POST' });
                    await refreshSnapshot();
                  }}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsArchitectureWorkspace
                  lang={lang}
                  config={snapshot.config}
                  currentMember={snapshot.currentMember}
                  onSaveSettings={async (patch) => {
                    await apiRequest('/api/mess/settings', {
                      method: 'PATCH',
                      body: JSON.stringify({ messId: activeMessId, ...patch }),
                    });
                    await refreshSnapshot();
                    notify('Mess settings saved');
                  }}
                />
              )}

              {activeTab === 'admin' && (
                <SuperAdminConsole
                  lang={lang}
                  onSelectMess={async (messId) => {
                    await apiRequest('/api/auth/switch-mess', {
                      method: 'POST',
                      body: JSON.stringify({ messId }),
                    });
                    setActiveMessId(messId);
                    await refreshSnapshot(messId);
                    setActiveTab('overview');
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Create / Join Mess Modal */}
      {showCreateJoinMess && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setMessModalTab('create')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                    messModalTab === 'create' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Create Mess
                </button>
                <button
                  onClick={() => setMessModalTab('join')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                    messModalTab === 'join' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Join via Code
                </button>
              </div>
              <button onClick={() => setShowCreateJoinMess(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateOrJoinMess} className="space-y-3">
              {messModalTab === 'create' ? (
                <>
                  <input
                    required
                    value={newMessName}
                    onChange={(e) => setNewMessName(e.target.value)}
                    placeholder="Mess Name (e.g. Uttara Sector 7 Bachelor Mess)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    required
                    value={newMessAddress}
                    onChange={(e) => setNewMessAddress(e.target.value)}
                    placeholder="Street / House Address"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    required
                    value={newMessCity}
                    onChange={(e) => setNewMessCity(e.target.value)}
                    placeholder="City (Dhaka, Chattogram, Rajshahi...)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </>
              ) : (
                <input
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter Invite Code (e.g. GRNV24 or PADMA9)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono uppercase"
                />
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer"
              >
                {messModalTab === 'create' ? 'Create Mess Workspace' : 'Join Mess'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`no-print fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-xs font-medium shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-900 dark:text-red-200'
              : toast.type === 'info'
                ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200'
                : 'bg-slate-900 border-slate-800 text-white dark:bg-emerald-700 dark:border-emerald-600'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
