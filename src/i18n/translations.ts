import type { Language } from '../shared/types.js';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toLocalDigits(value: string | number, lang: Language): string {
  const str = String(value);
  if (lang !== 'bn') return str;
  return str.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function formatTaka(amount: number, lang: Language, decimals = 0): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}৳${toLocalDigits(formatted, lang)}`;
}

export function formatDateLocal(dateStr: string, lang: Language): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const translations = {
  en: {
    brandName: 'MessFlow',
    brandSubtitle: 'Living Mess OS',
    navOverview: 'Mess Pulse',
    navMeals: 'Meals',
    navBazar: 'Bazar & Expenses',
    navAccounts: 'Accounts',
    navPayments: 'Payments',
    navMembers: 'Members & Rooms',
    navSettlement: 'Month Closing',
    navNotices: 'Notices',
    navSettings: 'Settings & Docs',
    navAdmin: 'Super Admin',
    mobileModeLabel: 'Android Member View',
    webModeLabel: 'Web Workspace',
    quickBazar: 'Quick Bazar',
    submitPayment: 'Submit Payment',
    todayMealsTitle: 'Today’s Meal Rhythm',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    guestMeals: 'Guest Meals',
    activeMembers: 'Active Members',
    currentMealRate: 'Current Meal Rate',
    totalBazar: 'Total Bazar',
    totalDeposits: 'Approved Deposits',
    totalExpenses: 'Total Expenses',
    moneyFlow: 'Money Flow Breakdown',
    communityActivity: 'Community Activity',
    contextualInsights: 'Smart Mess Insights',
    pendingAlerts: 'Attention Needed',
    howMealRateCalculated: 'How Your Meal Rate Was Calculated',
    personalClarity: 'Your Financial Clarity',
    previousBalance: 'Previous Balance',
    deposited: 'Deposited',
    mealCost: 'Meal Cost',
    rentShare: 'Rent Share',
    utilityShare: 'Utilities & Staff',
    netBalance: 'Current Balance',
    advanceStatus: 'Advance (Receivable)',
    dueStatus: 'Due (Payable)',
    settledStatus: 'Settled',
    offlineBannerOnline: 'Synced',
    offlineBannerOffline: 'Offline mode · Viewing cached records',
    offlineBannerPending: 'Sync pending',
    simulateOffline: 'Test Offline',
    goOnline: 'Reconnect & Sync',
    closeMonth: 'Close & Lock Month',
    downloadCsv: 'Export CSV',
    printPdf: 'Print / PDF Statement',
    signOut: 'Sign Out',
  },
  bn: {
    brandName: 'মেসফ্লো',
    brandSubtitle: 'আধুনিক মেস সিস্টেম',
    navOverview: 'মেস পালস',
    navMeals: 'মিল হিসাব',
    navBazar: 'বাজার ও খরচ',
    navAccounts: 'আয়-ব্যয়',
    navPayments: 'পেমেন্ট',
    navMembers: 'সদস্য ও রুম',
    navSettlement: 'মাস ক্লোজিং',
    navNotices: 'নোটিশ',
    navSettings: 'সেটিংস ও ডকস',
    navAdmin: 'সুপার অ্যাডমিন',
    mobileModeLabel: 'অ্যান্ড্রয়েড মেম্বার ভিউ',
    webModeLabel: 'ওয়েব ড্যাশবোর্ড',
    quickBazar: 'দ্রুত বাজার',
    submitPayment: 'পেমেন্ট জমা',
    todayMealsTitle: 'আজকের মিলের অবস্থা',
    breakfast: 'সকাল',
    lunch: 'দুপুর',
    dinner: 'রাত',
    guestMeals: 'গেস্ট মিল',
    activeMembers: 'সক্রিয় সদস্য',
    currentMealRate: 'চলতি মিল রেট',
    totalBazar: 'মোট বাজার',
    totalDeposits: 'অনুমোদিত জমা',
    totalExpenses: 'মোট খরচ',
    moneyFlow: 'টাকা কোথায় খরচ হচ্ছে',
    communityActivity: 'সাম্প্রতিক কার্যক্রম',
    contextualInsights: 'মেস ইনসাইটস',
    pendingAlerts: 'জরুরি মনোযোগ প্রয়োজন',
    howMealRateCalculated: 'আপনার মিল রেট যেভাবে হিসাব করা হয়েছে',
    personalClarity: 'আপনার ব্যক্তিগত হিসাব',
    previousBalance: 'পূর্বের জের',
    deposited: 'জমা',
    mealCost: 'মিল খরচ',
    rentShare: 'রুম ভাড়া',
    utilityShare: 'বিল ও খালা',
    netBalance: 'বর্তমান ব্যালেন্স',
    advanceStatus: 'জমা আছে (পাবেন)',
    dueStatus: 'বকেয়া আছে (দিবেন)',
    settledStatus: 'সমান সমান',
    offlineBannerOnline: 'সিঙ্ক সম্পন্ন',
    offlineBannerOffline: 'অফলাইন মোড · সংরক্ষিত তথ্য দেখাচ্ছে',
    offlineBannerPending: 'সিঙ্ক অপেক্ষমাণ',
    simulateOffline: 'অফলাইন টেস্ট',
    goOnline: 'অনলাইন ও সিঙ্ক',
    closeMonth: 'মাস ক্লোজ ও লক করুন',
    downloadCsv: 'সিএসভি ডাউনলোড',
    printPdf: 'প্রিন্ট / পিডিএফ বিবরণী',
    signOut: 'লগ আউট',
  },
} as const;
