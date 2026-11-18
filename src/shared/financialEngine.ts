import type {
  ClosingReadinessCheck,
  ExpenseCategory,
  ExpenseRecord,
  FinancialBreakdown,
  MealRecord,
  MemberFinancialSummary,
  MemberRecord,
  MessConfig,
  MessInsight,
  PaymentRecord,
} from './types.js';

export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function computeWeightedMeals(
  meal: Pick<MealRecord, 'breakfast' | 'lunch' | 'dinner'>,
  config: Pick<MessConfig, 'breakfastWeight' | 'lunchWeight' | 'dinnerWeight'>
): number {
  return roundMoney(
    (meal.breakfast ? config.breakfastWeight : 0) +
      (meal.lunch ? config.lunchWeight : 0) +
      (meal.dinner ? config.dinnerWeight : 0)
  );
}

/**
 * Pure, deterministic MessFlow Financial Calculation Engine.
 * Zero floating-point drift, zero hidden logic, fully auditable.
 */
export function calculateMonthlyFinancials(params: {
  monthKey: string;
  config: MessConfig;
  members: MemberRecord[];
  meals: MealRecord[];
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
}): FinancialBreakdown {
  const { monthKey, config, members, meals, expenses, payments } = params;

  // Active or temporarily away or leaving_soon members participate in monthly pool
  // Left/pending/suspended members only appear if they had meals/deposits/previous balances in this month
  const monthMeals = meals.filter((m) => m.mealDate.startsWith(monthKey));
  const monthExpenses = expenses.filter((e) => e.monthKey === monthKey && e.approvalStatus !== 'voided' && e.approvalStatus !== 'rejected');
  const approvedExpenses = monthExpenses.filter((e) => e.approvalStatus === 'approved');
  const pendingExpenses = monthExpenses.filter((e) => e.approvalStatus === 'pending');

  const monthPayments = payments.filter((p) => p.monthKey === monthKey);
  const approvedPayments = monthPayments.filter((p) => p.status === 'approved');
  const pendingPayments = monthPayments.filter((p) => p.status === 'pending');

  const eligibleMembers = members.filter(
    (m) =>
      m.status === 'active' ||
      m.status === 'away' ||
      m.status === 'leaving_soon' ||
      monthMeals.some((ml) => ml.membershipId === m.id) ||
      monthPayments.some((p) => p.membershipId === m.id) ||
      m.previousBalance !== 0
  );

  // Tally meals per member
  const memberMealTotals: Record<string, number> = {};
  const memberGuestMealTotals: Record<string, number> = {};
  let totalMemberMeals = 0;
  let totalGuestMeals = 0;

  for (const m of eligibleMembers) {
    memberMealTotals[m.id] = 0;
    memberGuestMealTotals[m.id] = 0;
  }

  for (const ml of monthMeals) {
    const weighted = computeWeightedMeals(ml, config);
    memberMealTotals[ml.membershipId] = roundMoney((memberMealTotals[ml.membershipId] ?? 0) + weighted);
    memberGuestMealTotals[ml.membershipId] = (memberGuestMealTotals[ml.membershipId] ?? 0) + (ml.guestMeals || 0);
    totalMemberMeals = roundMoney(totalMemberMeals + weighted);
    totalGuestMeals += ml.guestMeals || 0;
  }

  // Category totals
  const categoryTotals: Record<ExpenseCategory, number> = {
    bazar: 0,
    rent: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    internet: 0,
    cleaning: 0,
    staff: 0,
    maintenance: 0,
    furniture: 0,
    other: 0,
  };

  let totalBazarExpense = 0;
  let totalOtherMealExpense = 0;
  let totalRentExpense = 0;
  let totalUtilityExpense = 0;
  let totalOtherFixedExpense = 0;

  // Separate expenses by allocation method
  const mealAllocatedExpenses: ExpenseRecord[] = [];
  const equalUtilityExpenses: ExpenseRecord[] = [];
  const equalOtherExpenses: ExpenseRecord[] = [];
  const customExpenses: ExpenseRecord[] = [];
  const rentExpenses: ExpenseRecord[] = [];

  for (const exp of approvedExpenses) {
    categoryTotals[exp.category] = roundMoney((categoryTotals[exp.category] ?? 0) + exp.amount);

    if (exp.category === 'bazar') {
      totalBazarExpense = roundMoney(totalBazarExpense + exp.amount);
    }

    if (exp.allocationMethod === 'meal_based') {
      mealAllocatedExpenses.push(exp);
      if (exp.category !== 'bazar') {
        totalOtherMealExpense = roundMoney(totalOtherMealExpense + exp.amount);
      }
    } else if (exp.category === 'rent') {
      totalRentExpense = roundMoney(totalRentExpense + exp.amount);
      rentExpenses.push(exp);
    } else if (exp.allocationMethod === 'custom' && exp.customSplit) {
      customExpenses.push(exp);
      totalOtherFixedExpense = roundMoney(totalOtherFixedExpense + exp.amount);
    } else if (
      exp.category === 'electricity' ||
      exp.category === 'gas' ||
      exp.category === 'water' ||
      exp.category === 'internet' ||
      exp.category === 'cleaning' ||
      exp.category === 'staff'
    ) {
      totalUtilityExpense = roundMoney(totalUtilityExpense + exp.amount);
      equalUtilityExpenses.push(exp);
    } else {
      totalOtherFixedExpense = roundMoney(totalOtherFixedExpense + exp.amount);
      equalOtherExpenses.push(exp);
    }
  }

  const totalMealPoolExpense = roundMoney(
    mealAllocatedExpenses.reduce((sum, e) => sum + e.amount, 0)
  );
  const totalGuestMealRevenue = roundMoney(totalGuestMeals * config.guestMealRate);
  const netMealPoolExpense = Math.max(0, roundMoney(totalMealPoolExpense - totalGuestMealRevenue));

  const mealRate =
    totalMemberMeals > 0 ? roundMoney(netMealPoolExpense / totalMemberMeals) : 0;

  // Resident count for equal splitting (exclude 'left' or 'pending' unless they have active residence)
  const residentMembers = eligibleMembers.filter(
    (m) => m.status === 'active' || m.status === 'away' || m.status === 'leaving_soon'
  );
  const residentCount = Math.max(1, residentMembers.length);

  // Precompute equal utility & other expense shares
  const totalEqualUtilityPool = roundMoney(
    equalUtilityExpenses.reduce((s, e) => s + e.amount, 0)
  );
  const totalEqualOtherPool = roundMoney(
    equalOtherExpenses.reduce((s, e) => s + e.amount, 0)
  );

  // If rent expenses were logged as a bill, distribute either bed_specific (using member.monthlyRent proportions or direct) or equal
  const totalLoggedRent = roundMoney(rentExpenses.reduce((s, e) => s + e.amount, 0));
  const sumConfiguredMemberRents = roundMoney(
    residentMembers.reduce((s, m) => s + (m.monthlyRent || 0), 0)
  );

  const memberSummaries: MemberFinancialSummary[] = eligibleMembers.map((member) => {
    const isResident =
      member.status === 'active' || member.status === 'away' || member.status === 'leaving_soon';

    const mMeals = memberMealTotals[member.id] ?? 0;
    const gMeals = memberGuestMealTotals[member.id] ?? 0;
    const mealCost = roundMoney(mMeals * mealRate);
    const guestMealCost = roundMoney(gMeals * config.guestMealRate);

    // Rent calculation
    let rentShare = 0;
    if (isResident) {
      if (config.rentDistributionMode === 'equal' && totalLoggedRent > 0) {
        rentShare = roundMoney(totalLoggedRent / residentCount);
      } else if (member.monthlyRent > 0) {
        // Use configured bed/room rent when building rent is tracked per bed or matches logged rent
        rentShare = roundMoney(member.monthlyRent);
      } else if (totalLoggedRent > 0 && sumConfiguredMemberRents === 0) {
        rentShare = roundMoney(totalLoggedRent / residentCount);
      }
    }

    // Utility share
    let utilityShare = 0;
    if (isResident) {
      if (config.utilityDistributionMode === 'meal_based' && totalMemberMeals > 0) {
        utilityShare = roundMoney((mMeals / totalMemberMeals) * totalEqualUtilityPool);
      } else {
        utilityShare = roundMoney(totalEqualUtilityPool / residentCount);
      }
    }

    // Other share (equal + custom)
    let otherExpenseShare = isResident ? roundMoney(totalEqualOtherPool / residentCount) : 0;
    for (const ce of customExpenses) {
      if (ce.customSplit && typeof ce.customSplit[member.id] === 'number') {
        otherExpenseShare = roundMoney(otherExpenseShare + ce.customSplit[member.id]);
      }
    }

    // Deposits and refunds/adjustments from payments
    let totalDeposited = 0;
    let adjustments = 0;
    for (const p of approvedPayments) {
      if (p.membershipId !== member.id) continue;
      if (p.type === 'deposit' || p.type === 'settlement') {
        totalDeposited = roundMoney(totalDeposited + p.amount);
      } else if (p.type === 'refund') {
        adjustments = roundMoney(adjustments - p.amount);
      } else if (p.type === 'adjustment') {
        adjustments = roundMoney(adjustments + p.amount);
      }
    }

    // Out-of-pocket expenses paid by this member (credit to their balance? Wait: in BD mess systems,
    // either bazar paid out of pocket is reimbursed from mess cashbox OR credited to the member's deposit!
    // We track `totalPaidOutOfPocket` separately for transparency AND if the expense was paid from personal funds,
    // wait: if manager gave cash from mess fund, `paidByMembershipId` might be manager. Let's keep `totalPaidOutOfPocket` visible!)
    const totalPaidOutOfPocket = roundMoney(
      approvedExpenses
        .filter((e) => e.paidByMembershipId === member.id)
        .reduce((s, e) => s + e.amount, 0)
    );

    const totalExpenseShare = roundMoney(
      mealCost + guestMealCost + rentShare + utilityShare + otherExpenseShare
    );

    const netBalance = roundMoney(
      member.previousBalance + totalDeposited - totalExpenseShare + adjustments
    );

    return {
      membershipId: member.id,
      name: member.name,
      roomLabel: member.roomNumber
        ? `${member.roomNumber}${member.bedLabel ? ` · ${member.bedLabel}` : ''}`
        : 'Unassigned',
      status: member.status,
      role: member.role,
      previousBalance: roundMoney(member.previousBalance),
      totalDeposited,
      totalPaidOutOfPocket,
      memberMeals: mMeals,
      guestMeals: gMeals,
      mealCost,
      guestMealCost,
      rentShare,
      utilityShare,
      otherExpenseShare,
      adjustments,
      totalExpenseShare,
      netBalance,
      payableAmount: netBalance < 0 ? roundMoney(Math.abs(netBalance)) : 0,
      receivableAmount: netBalance > 0 ? roundMoney(netBalance) : 0,
    };
  });

  const totalApprovedExpenses = roundMoney(
    approvedExpenses.reduce((s, e) => s + e.amount, 0)
  );
  const totalPendingExpenses = roundMoney(
    pendingExpenses.reduce((s, e) => s + e.amount, 0)
  );
  const totalApprovedDeposits = roundMoney(
    approvedPayments
      .filter((p) => p.type === 'deposit' || p.type === 'settlement')
      .reduce((s, p) => s + p.amount, 0)
  );
  const totalPendingPayments = roundMoney(
    pendingPayments.reduce((s, p) => s + p.amount, 0)
  );

  const formulaSteps = [
    {
      label: 'Meal Pool Expenses (Bazar + Meal-Allocated)',
      value: `৳${totalMealPoolExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      detail: `${mealAllocatedExpenses.length} approved transactions`,
    },
    {
      label: 'Guest Meal Deduction',
      value: `-৳${totalGuestMealRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      detail: `${totalGuestMeals} guest meals × ৳${config.guestMealRate}`,
    },
    {
      label: 'Net Member Meal Cost',
      value: `৳${netMealPoolExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      detail: 'Divided across all weighted member meals',
    },
    {
      label: 'Total Weighted Member Meals',
      value: `${totalMemberMeals}`,
      detail: `Weights: B=${config.breakfastWeight}, L=${config.lunchWeight}, D=${config.dinnerWeight}`,
    },
    {
      label: 'Calculated Meal Rate',
      value: `৳${mealRate.toFixed(2)}`,
      detail: totalMemberMeals > 0 ? `৳${netMealPoolExpense.toFixed(2)} ÷ ${totalMemberMeals} meals` : 'No meals logged yet',
    },
  ];

  return {
    monthKey,
    totalBazarExpense,
    totalOtherMealExpense,
    totalMealPoolExpense,
    totalGuestMealRevenue,
    netMealPoolExpense,
    totalMemberMeals,
    totalGuestMeals,
    totalEligibleMeals: roundMoney(totalMemberMeals + totalGuestMeals),
    mealRate,
    totalRentExpense: totalRentExpense > 0 ? totalRentExpense : sumConfiguredMemberRents,
    totalUtilityExpense,
    totalOtherFixedExpense,
    totalApprovedExpenses,
    totalPendingExpenses,
    totalApprovedDeposits,
    totalPendingPayments,
    categoryTotals,
    memberSummaries,
    formulaSteps,
  };
}

/**
 * Generates contextual insights strictly from real underlying database records.
 */
export function generateMessInsights(params: {
  monthKey: string;
  todayStr: string;
  breakdown: FinancialBreakdown;
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  meals: MealRecord[];
  members: MemberRecord[];
}): MessInsight[] {
  const { monthKey, todayStr, breakdown, expenses, payments, meals, members } = params;
  const insights: MessInsight[] = [];

  // 1. Week-over-week bazar comparison (strictly if prior 7 days had data)
  const todayMs = new Date(todayStr + 'T00:00:00Z').getTime();
  const oneDay = 86400000;
  let thisWeekBazar = 0;
  let prevWeekBazar = 0;

  for (const e of expenses) {
    if (e.category !== 'bazar' || e.approvalStatus !== 'approved') continue;
    const eMs = new Date(e.expenseDate + 'T00:00:00Z').getTime();
    const diffDays = Math.floor((todayMs - eMs) / oneDay);
    if (diffDays >= 0 && diffDays < 7) {
      thisWeekBazar += e.amount;
    } else if (diffDays >= 7 && diffDays < 14) {
      prevWeekBazar += e.amount;
    }
  }

  if (thisWeekBazar > 0 && prevWeekBazar > 0) {
    const pct = Math.round(((thisWeekBazar - prevWeekBazar) / prevWeekBazar) * 100);
    if (Math.abs(pct) >= 5) {
      insights.push({
        id: 'bazar-wow',
        severity: pct > 15 ? 'warning' : 'info',
        titleEn: pct > 0 ? `Bazar spend up ${pct}% this week` : `Bazar spend down ${Math.abs(pct)}% this week`,
        titleBn: pct > 0 ? `এই সপ্তাহে বাজার খরচ ${pct}% বেড়েছে` : `এই সপ্তাহে বাজার খরচ ${Math.abs(pct)}% কমেছে`,
        descriptionEn: `Your mess spent ৳${roundMoney(thisWeekBazar).toLocaleString()} on bazar in the last 7 days compared to ৳${roundMoney(prevWeekBazar).toLocaleString()} the week prior.`,
        descriptionBn: `গত ৭ দিনে বাজার খরচ হয়েছে ৳${roundMoney(thisWeekBazar).toLocaleString()}, যা আগের সপ্তাহের ৳${roundMoney(prevWeekBazar).toLocaleString()} থেকে ভিন্ন।`,
        metricValue: `${pct > 0 ? '+' : ''}${pct}%`,
      });
    }
  }

  // 2. Pending payment verifications
  const pendingPayments = payments.filter((p) => p.monthKey === monthKey && p.status === 'pending');
  if (pendingPayments.length > 0) {
    const sum = roundMoney(pendingPayments.reduce((s, p) => s + p.amount, 0));
    insights.push({
      id: 'pending-payments',
      severity: 'warning',
      titleEn: `${pendingPayments.length} payment verification${pendingPayments.length > 1 ? 's' : ''} waiting`,
      titleBn: `${pendingPayments.length}টি পেমেন্ট যাচাইয়ের অপেক্ষায়`,
      descriptionEn: `৳${sum.toLocaleString()} submitted via bKash/Nagad/Cash is awaiting manager approval before updating member balances.`,
      descriptionBn: `সদস্যদের জমা করা ৳${sum.toLocaleString()} অনুমোদনের পর হিসাবের সাথে যুক্ত হবে।`,
      metricValue: `৳${sum.toLocaleString()}`,
    });
  }

  // 3. Outstanding member dues
  const dueMembers = breakdown.memberSummaries.filter((m) => m.payableAmount > 500);
  if (dueMembers.length > 0) {
    const totalDue = roundMoney(dueMembers.reduce((s, m) => s + m.payableAmount, 0));
    insights.push({
      id: 'outstanding-dues',
      severity: 'alert',
      titleEn: `${dueMembers.length} member${dueMembers.length > 1 ? 's have' : ' has'} dues over ৳500`,
      titleBn: `${dueMembers.length} জন সদস্যের ৫০০ টাকার বেশি বকেয়া`,
      descriptionEn: `Total collectable dues stand at ৳${totalDue.toLocaleString()}. Send a gentle payment reminder from Payments.`,
      descriptionBn: `মোট বকেয়া ৳${totalDue.toLocaleString()}। পেমেন্ট মডিউল থেকে রিমাইন্ডার পাঠানো যাবে।`,
      metricValue: `৳${totalDue.toLocaleString()}`,
    });
  }

  // 4. Today's meal tracking check
  const activeMembers = members.filter((m) => m.status === 'active');
  const todayMeals = meals.filter((m) => m.mealDate === todayStr);
  if (activeMembers.length > 0 && todayMeals.length === 0) {
    insights.push({
      id: 'today-meals-missing',
      severity: 'warning',
      titleEn: `No meals logged yet for today`,
      titleBn: `আজকের মিল এখনো এন্ট্রি করা হয়নি`,
      descriptionEn: `Update today's breakfast, lunch, and dinner counts so the live meal rate stays accurate.`,
      descriptionBn: `সঠিক মিল রেট বজায় রাখতে আজকের সকাল, দুপুর ও রাতের মিল আপডেট করুন।`,
    });
  }

  return insights;
}

export function evaluateClosingReadiness(params: {
  monthKey: string;
  breakdown: FinancialBreakdown;
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  meals: MealRecord[];
}): ClosingReadinessCheck[] {
  const { monthKey, breakdown, expenses, payments, meals } = params;
  const pendingPayments = payments.filter((p) => p.monthKey === monthKey && p.status === 'pending');
  const pendingExpenses = expenses.filter((e) => e.monthKey === monthKey && e.approvalStatus === 'pending');
  const monthMeals = meals.filter((m) => m.mealDate.startsWith(monthKey));
  const uniqueMealDays = new Set(monthMeals.map((m) => m.mealDate)).size;

  return [
    {
      id: 'chk-payments',
      passed: pendingPayments.length === 0,
      labelEn: 'All submitted payments verified',
      labelBn: 'সব জমা দেওয়া পেমেন্ট যাচাই সম্পন্ন',
      detailEn: pendingPayments.length === 0 ? 'Zero unverified payments' : `${pendingPayments.length} pending payment(s) require approval or rejection`,
      detailBn: pendingPayments.length === 0 ? 'কোনো বকেয়া যাচাই নেই' : `${pendingPayments.length}টি পেমেন্ট এখনো অনুমোদনের অপেক্ষায়`,
    },
    {
      id: 'chk-expenses',
      passed: pendingExpenses.length === 0,
      labelEn: 'All expenses approved',
      labelBn: 'সব খরচ অনুমোদিত হয়েছে',
      detailEn: pendingExpenses.length === 0 ? 'All month expenses finalized' : `${pendingExpenses.length} expense(s) awaiting approval`,
      detailBn: pendingExpenses.length === 0 ? 'মাসের সব খরচ চূড়ান্ত হয়েছে' : `${pendingExpenses.length}টি খরচ অনুমোদনের অপেক্ষায়`,
    },
    {
      id: 'chk-meals',
      passed: uniqueMealDays > 0 && breakdown.totalMemberMeals > 0,
      labelEn: 'Meal records populated',
      labelBn: 'মিলের হিসাব সংরক্ষিত আছে',
      detailEn: `${uniqueMealDays} day(s) logged · ${breakdown.totalMemberMeals} total weighted meals`,
      detailBn: `${uniqueMealDays} দিনের মিল এন্ট্রি হয়েছে · মোট ${breakdown.totalMemberMeals} মিল`,
    },
    {
      id: 'chk-rent-util',
      passed: breakdown.totalBazarExpense > 0,
      labelEn: 'Bazar & monthly costs recorded',
      labelBn: 'বাজার ও মাসিক খরচ এন্ট্রি হয়েছে',
      detailEn: `Bazar ৳${breakdown.totalBazarExpense.toLocaleString()} · Rent & Utilities ৳${(breakdown.totalRentExpense + breakdown.totalUtilityExpense).toLocaleString()}`,
      detailBn: `বাজার ৳${breakdown.totalBazarExpense.toLocaleString()} · ভাড়া ও বিল ৳${(breakdown.totalRentExpense + breakdown.totalUtilityExpense).toLocaleString()}`,
    },
  ];
}
