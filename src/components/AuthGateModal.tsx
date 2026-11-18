import React, { useState } from 'react';
import { apiRequest, setSessionToken } from '../lib/api.js';

interface AuthGateModalProps {
  onAuthenticated: () => Promise<void>;
}

const DEMO_PERSONAS = [
  { userId: 'u-owner', name: 'Mahmudul Hasan', role: 'Mess Owner', detail: 'Full control over Greenview Mess' },
  { userId: 'u-manager', name: 'Rakibul Islam', role: 'Manager', detail: 'Daily meals, bazar & payment verification' },
  { userId: 'u-m3', name: 'Sajid Karim', role: 'Member', detail: 'Student member view & meal booking' },
  { userId: 'u-m4', name: 'Nafis Chowdhury', role: 'Accountant', detail: 'Financial audit & month closing' },
  { userId: 'u-super', name: 'Tanvir Ahmed', role: 'Super Admin', detail: 'Platform-wide multi-mess administration' },
];

export const AuthGateModal: React.FC<AuthGateModalProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('mahmud@messflow.app');
  const [password, setPassword] = useState('messflow123');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('GRNV24');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await apiRequest('/api/auth/login', {
              method: 'POST',
              body: JSON.stringify({ identifier, password }),
            })
          : await apiRequest('/api/auth/register', {
              method: 'POST',
              body: JSON.stringify({ name, phone, email, password, inviteCode }),
            });
      setSessionToken(res.token);
      await onAuthenticated();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSwitch = async (userId: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/demo-switch', {
        method: 'POST',
        body: JSON.stringify({ userId, messId: 'mess-dhaka-1' }),
      });
      setSessionToken(res.token);
      await onAuthenticated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {/* Left: Instant Role Sandbox & Context */}
        <div className="lg:col-span-6 p-7 lg:p-9 bg-slate-900 text-white flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              MessFlow · Living Mess OS
            </div>
            <h1 className="mt-2 text-2xl lg:text-3xl font-bold tracking-tight text-balance">
              Transparent shared living for Bangladesh messes.
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Automated meal rates, 10-second bazar logging, bKash/Nagad verification, and monthly হিসাব closing without spreadsheet arguments.
            </p>
          </div>

          <div className="mt-8 space-y-2.5">
            <div className="text-xs font-medium text-slate-400">
              Instant Role Sign-In (Greenview Bachelor Mess · Dhanmondi)
            </div>
            {DEMO_PERSONAS.map((p) => (
              <button
                key={p.userId}
                disabled={loading}
                onClick={() => handleDemoSwitch(p.userId)}
                className="w-full text-left p-3 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 transition-colors flex items-center justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="text-sm font-medium text-white">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.detail}</div>
                </div>
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0">
                  {p.role} →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Real Auth Form */}
        <div className="lg:col-span-6 p-7 lg:p-9 flex flex-col justify-center">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit mb-6">
            <button
              onClick={() => setMode('login')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                mode === 'login' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                mode === 'register' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ashfaqur Rahman"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Invite Code (Optional)</label>
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="GRNV24"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </>
            )}

            {mode === 'login' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Phone or Email
                </label>
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? '...' : mode === 'login' ? 'Sign In to MessFlow' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
