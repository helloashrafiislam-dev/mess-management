import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Plus, Search, Trash2, Upload } from 'lucide-react';
import { formatDateLocal, formatTaka, toLocalDigits } from '../i18n/translations.js';
import type {
  AllocationMethod,
  ExpenseCategory,
  ExpenseRecord,
  Language,
  MemberRecord,
  PaymentMethod,
} from '../shared/types.js';

interface BazarExpensesWorkspaceProps {
  lang: Language;
  todayStr: string;
  currentMember: MemberRecord | null;
  members: MemberRecord[];
  expenses: ExpenseRecord[];
  isMonthClosed: boolean;
  onAddExpense: (payload: {
    expenseDate: string;
    category: ExpenseCategory;
    bazarSubitems: { name: string; cost: number }[];
    amount: number;
    description: string;
    vendor: string;
    paidByMembershipId: string;
    paymentMethod: PaymentMethod;
    allocationMethod: AllocationMethod;
    receiptDataUrl: string | null;
  }) => Promise<void>;
  onUpdateExpenseStatus: (id: string, status: 'approved' | 'rejected' | 'voided') => Promise<void>;
}

const BAZAR_CHIPS = [
  'Rice (চাল)',
  'Vegetables (সবজি)',
  'Fish (মাছ)',
  'Chicken/Meat (মাংস)',
  'Eggs (ডিম)',
  'Oil & Spices (তেল-মসলা)',
  'Lentils (ডাল)',
];

const CATEGORIES: { value: ExpenseCategory; labelEn: string; labelBn: string; defaultAlloc: AllocationMethod }[] = [
  { value: 'bazar', labelEn: 'Daily Bazar', labelBn: 'দৈনিক বাজার', defaultAlloc: 'meal_based' },
  { value: 'electricity', labelEn: 'Electricity (DESCO/BPDB)', labelBn: 'বিদ্যুৎ বিল', defaultAlloc: 'equal' },
  { value: 'gas', labelEn: 'Gas (Titas/Cylinder)', labelBn: 'গ্যাস বিল', defaultAlloc: 'equal' },
  { value: 'water', labelEn: 'Water & Drinking Jar', labelBn: 'পানি ও জার', defaultAlloc: 'equal' },
  { value: 'internet', labelEn: 'Internet / Wi-Fi', labelBn: 'ইন্টারনেট বিল', defaultAlloc: 'equal' },
  { value: 'staff', labelEn: 'Khala / Staff Salary', labelBn: 'খালা / স্টাফ বেতন', defaultAlloc: 'equal' },
  { value: 'cleaning', labelEn: 'Cleaning Supplies', labelBn: 'পরিষ্কার সামগ্রী', defaultAlloc: 'equal' },
  { value: 'maintenance', labelEn: 'Maintenance & Repair', labelBn: 'মেরামত খরচ', defaultAlloc: 'equal' },
  { value: 'rent', labelEn: 'House Rent', labelBn: 'বাসা ভাড়া', defaultAlloc: 'equal' },
  { value: 'other', labelEn: 'Other Expense', labelBn: 'অন্যান্য খরচ', defaultAlloc: 'equal' },
];

export const BazarExpensesWorkspace: React.FC<BazarExpensesWorkspaceProps> = ({
  lang,
  todayStr,
  currentMember,
  members,
  expenses,
  isMonthClosed,
  onAddExpense,
  onUpdateExpenseStatus,
}) => {
  const isBn = lang === 'bn';
  const [filterCat, setFilterCat] = useState<'all' | ExpenseCategory>('all');
  const [search, setSearch] = useState('');

  // Quick Entry Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('bazar');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [paidBy, setPaidBy] = useState(currentMember?.id || members[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('meal_based');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canAddBazar =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.addBazar);
  const canAddUtil =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.addUtilities);
  const canApprove =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.approveExpenses);

  const canCreateCurrent = category === 'bazar' ? canAddBazar : canAddUtil;

  const handleCategoryChange = (nextCat: ExpenseCategory) => {
    setCategory(nextCat);
    const meta = CATEGORIES.find((c) => c.value === nextCat);
    if (meta) setAllocationMethod(meta.defaultAlloc);
  };

  const toggleChip = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setReceiptDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) return;
    const autoDesc =
      description.trim() ||
      (selectedChips.length > 0 ? selectedChips.join(', ') : `${category} purchase`);

    setSubmitting(true);
    try {
      await onAddExpense({
        expenseDate,
        category,
        bazarSubitems: selectedChips.map((c) => ({ name: c, cost: 0 })),
        amount: num,
        description: autoDesc,
        vendor: vendor.trim(),
        paidByMembershipId: paidBy || currentMember?.id || members[0]?.id,
        paymentMethod,
        allocationMethod,
        receiptDataUrl,
      });
      setAmount('');
      setDescription('');
      setVendor('');
      setSelectedChips([]);
      setReceiptDataUrl(null);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterCat !== 'all' && e.category !== filterCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          e.vendor.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, filterCat, search]);

  const memberById = useMemo(() => {
    const m: Record<string, MemberRecord> = {};
    for (const mem of members) m[mem.id] = mem;
    return m;
  }, [members]);

  // Person-wise bazar contribution
  const bazarContributors = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of expenses) {
      if (e.category === 'bazar' && e.approvalStatus === 'approved') {
        totals[e.paidByMembershipId] = (totals[e.paidByMembershipId] || 0) + e.amount;
      }
    }
    return Object.entries(totals)
      .map(([id, total]) => ({ id, name: memberById[id]?.name || 'Member', total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, memberById]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* <10-Second Quick Expense Entry */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isBn ? 'দ্রুত বাজার ও খরচ এন্ট্রি' : 'Quick Bazar & Expense Entry'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isBn
              ? '১০ সেকেন্ডের কম সময়ে পরিমাণ ও বিবরণ লিখে সংরক্ষণ করুন'
              : 'Amount → Category → Quick items → Save in under 10 seconds'}
          </p>

          {!canCreateCurrent || isMonthClosed ? (
            <div className="mt-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-sm text-slate-600 dark:text-slate-400">
              {isMonthClosed
                ? isBn ? 'এই মাস ক্লোজ ও লক করা হয়েছে।' : 'Month is closed and locked.'
                : isBn ? 'খরচ যোগ করার অনুমতি শুধুমাত্র ম্যানেজার বা মালিকের।' : 'Only Owner, Manager, or Accountant can record expenses.'}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isBn ? 'টাকার পরিমাণ (৳)' : 'Amount (৳)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1450"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isBn ? 'ক্যাটাগরি' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {isBn ? c.labelBn : c.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {category === 'bazar' && (
                <div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    {isBn ? 'দ্রুত আইটেম নির্বাচন করুন' : 'Quick Bazar Items'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAZAR_CHIPS.map((chip) => {
                      const active = selectedChips.includes(chip);
                      return (
                        <button
                          type="button"
                          key={chip}
                          onClick={() => toggleChip(chip)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'বিবরণ (ঐচ্ছিক)' : 'Description'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isBn ? 'যেমন: রুই মাছ ২ কেজি ও সবজি' : 'e.g. Rui fish 2kg, potatoes & spices'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isBn ? 'তারিখ' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isBn ? 'কে পরিশোধ করেছেন' : 'Paid By'}
                  </label>
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isBn ? 'হিসাব বণ্টন পদ্ধতি' : 'Allocation Rule'}
                  </label>
                  <select
                    value={allocationMethod}
                    onChange={(e) => setAllocationMethod(e.target.value as AllocationMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="meal_based">{isBn ? 'মিল অনুপাতে' : 'Meal-Based Pool'}</option>
                    <option value="equal">{isBn ? 'সমান ভাগে' : 'Equal Split'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isBn ? 'মাধ্যম' : 'Payment Method'}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900">
                  <Upload className="w-4 h-4" />
                  <span>{receiptDataUrl ? (isBn ? 'রশিদ যুক্ত হয়েছে' : 'Receipt attached') : (isBn ? 'রশিদের ছবি দিন' : 'Attach receipt')}</span>
                  <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submitting ? '...' : isBn ? 'খরচ সংরক্ষণ' : 'Save Expense'}</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Person-wise Bazar & Expense Ledger */}
        <section className="lg:col-span-7 space-y-6">
          {/* Bazar Contributors Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {isBn ? 'কে কত বাজার করেছেন (এই মাস)' : 'Person-wise Bazar Purchases'}
            </h2>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {bazarContributors.length === 0 ? (
                <div className="col-span-full text-sm text-slate-500">
                  {isBn ? 'এখনো কোনো বাজার এন্ট্রি নেই।' : 'No approved bazar purchases yet this month.'}
                </div>
              ) : (
                bazarContributors.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30"
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.name}</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatTaka(c.total, lang)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expense Ledger Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isBn ? 'বাজার বা খরচ খুঁজুন...' : 'Search bazar, vendor, utility...'}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                />
              </div>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
              >
                <option value="all">{isBn ? 'সব ক্যাটাগরি' : 'All Categories'}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {isBn ? c.labelBn : c.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
              {filteredExpenses.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  {isBn ? 'কোনো খরচ পাওয়া যায়নি।' : 'No matching expenses recorded.'}
                </div>
              ) : (
                filteredExpenses.map((exp) => {
                  const payer = memberById[exp.paidByMembershipId]?.name || 'Mess Fund';
                  const isVoided = exp.approvalStatus === 'voided' || exp.approvalStatus === 'rejected';
                  return (
                    <div
                      key={exp.id}
                      className={`p-4 flex items-start justify-between gap-4 ${
                        isVoided ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                            {exp.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDateLocal(exp.expenseDate, lang)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{exp.allocationMethod === 'meal_based' ? (isBn ? 'মিল খাত' : 'Meal Pool') : (isBn ? 'সমান ভাগ' : 'Equal')}</span>
                          {exp.approvalStatus !== 'approved' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className={exp.approvalStatus === 'pending' ? 'text-amber-600 font-semibold' : 'text-red-600'}>
                                {exp.approvalStatus.toUpperCase()}
                              </span>
                            </>
                          )}
                        </div>
                        <div className={`mt-1 text-sm font-medium text-slate-900 dark:text-white ${isVoided ? 'line-through' : ''}`}>
                          {exp.description}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {isBn ? 'পরিশোধকারী:' : 'Paid by'} {payer}
                          {exp.vendor ? ` · ${exp.vendor}` : ''}
                          {exp.receiptDataUrl && (
                            <a
                              href={exp.receiptDataUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 underline"
                            >
                              <FileText className="w-3 h-3" />
                              Receipt
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`text-base font-bold font-mono tabular-nums ${isVoided ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {formatTaka(exp.amount, lang)}
                        </div>

                        {canApprove && !isMonthClosed && exp.approvalStatus === 'pending' && (
                          <button
                            onClick={() => onUpdateExpenseStatus(exp.id, 'approved')}
                            className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                            title="Approve expense"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {canApprove && !isMonthClosed && exp.approvalStatus !== 'voided' && (
                          <button
                            onClick={() => onUpdateExpenseStatus(exp.id, 'voided')}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                            title="Void entry (keeps audit trail)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
