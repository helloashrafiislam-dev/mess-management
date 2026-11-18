import { describe, expect, it } from 'vitest';
import {
  calculateMonthlyFinancials,
  computeWeightedMeals,
  evaluateClosingReadiness,
} from '../financialEngine.js';
import type { ExpenseRecord, MealRecord, MemberRecord, MessConfig, PaymentRecord } from '../types.js';

const baseConfig: MessConfig = {
  id: 'mess-1',
  name: 'Test Mess',
  address: 'Dhanmondi, Dhaka',
  city: 'Dhaka',
  currency: 'BDT',
  inviteCode: 'TEST01',
  planTier: 'free',
  breakfastWeight: 0.5,
  lunchWeight: 1,
  dinnerWeight: 1,
  mealBookingCutoffHour: 22,
  mealCancelCutoffHour: 8,
  guestMealRate: 80,
  rentDistributionMode: 'bed_specific',
  utilityDistributionMode: 'equal',
  requireExpenseApproval: false,
  createdAt: '2026-11-01T00:00:00Z',
};

const defaultPerms = {
  manageMeals: false,
  addBazar: false,
  addUtilities: false,
  manageMembers: false,
  verifyPayments: false,
  approveExpenses: false,
  manageNotices: false,
  closeMonth: false,
};

const members: MemberRecord[] = [
  {
    id: 'm-1',
    messId: 'mess-1',
    userId: 'u-1',
    name: 'Arif Rahman',
    phone: '01711000001',
    email: 'arif@example.com',
    role: 'owner',
    permissions: { ...defaultPerms, manageMeals: true, closeMonth: true },
    status: 'active',
    roomId: 'r-1',
    bedId: 'b-1',
    roomNumber: '101',
    bedLabel: 'Bed A',
    monthlyRent: 4500,
    previousBalance: 500, // +500 carry-forward advance
    emergencyContact: '01700000000',
    joinedAt: '2026-01-01',
    leavingDate: null,
    notes: '',
  },
  {
    id: 'm-2',
    messId: 'mess-1',
    userId: 'u-2',
    name: 'Tariq Hasan',
    phone: '01711000002',
    email: 'tariq@example.com',
    role: 'member',
    permissions: defaultPerms,
    status: 'active',
    roomId: 'r-1',
    bedId: 'b-2',
    roomNumber: '101',
    bedLabel: 'Bed B',
    monthlyRent: 4000,
    previousBalance: -200, // -200 carry-forward due
    emergencyContact: '01700000001',
    joinedAt: '2026-02-01',
    leavingDate: null,
    notes: '',
  },
];

describe('MessFlow Financial Engine', () => {
  it('computes weighted meals accurately', () => {
    expect(computeWeightedMeals({ breakfast: 1, lunch: 1, dinner: 1 }, baseConfig)).toBe(2.5);
    expect(computeWeightedMeals({ breakfast: 0, lunch: 1, dinner: 1 }, baseConfig)).toBe(2);
    expect(computeWeightedMeals({ breakfast: 1, lunch: 0, dinner: 0 }, baseConfig)).toBe(0.5);
  });

  it('calculates meal rate, guest deduction, equal utilities, bed rent, and net balance cleanly', () => {
    const meals: MealRecord[] = [
      {
        id: 'ml-1',
        messId: 'mess-1',
        membershipId: 'm-1',
        mealDate: '2026-11-05',
        breakfast: 1,
        lunch: 1,
        dinner: 1,
        guestMeals: 1, // 80 BDT guest charge
        locked: false,
        updatedBy: 'u-1',
        updatedAt: '2026-11-05T10:00:00Z',
      },
      {
        id: 'ml-2',
        messId: 'mess-1',
        membershipId: 'm-2',
        mealDate: '2026-11-05',
        breakfast: 1,
        lunch: 1,
        dinner: 1,
        guestMeals: 0,
        locked: false,
        updatedBy: 'u-1',
        updatedAt: '2026-11-05T10:00:00Z',
      },
    ];
    // Total weighted member meals = 2.5 + 2.5 = 5.0
    const expenses: ExpenseRecord[] = [
      {
        id: 'e-1',
        messId: 'mess-1',
        monthKey: '2026-11',
        expenseDate: '2026-11-05',
        category: 'bazar',
        bazarSubitems: [{ name: 'Rice & Chicken', cost: 480 }],
        amount: 480,
        description: 'Daily bazar',
        vendor: 'Town Hall Market',
        paidByMembershipId: 'm-1',
        paymentMethod: 'cash',
        allocationMethod: 'meal_based',
        customSplit: null,
        approvalStatus: 'approved',
        receiptDataUrl: null,
        createdBy: 'u-1',
        createdAt: '2026-11-05T12:00:00Z',
      },
      {
        id: 'e-2',
        messId: 'mess-1',
        monthKey: '2026-11',
        expenseDate: '2026-11-05',
        category: 'internet',
        bazarSubitems: [],
        amount: 1000,
        description: 'Wi-Fi Bill',
        vendor: 'Carnival',
        paidByMembershipId: 'm-1',
        paymentMethod: 'bkash',
        allocationMethod: 'equal',
        customSplit: null,
        approvalStatus: 'approved',
        receiptDataUrl: null,
        createdBy: 'u-1',
        createdAt: '2026-11-05T12:00:00Z',
      },
      // Voided expense must be ignored
      {
        id: 'e-3',
        messId: 'mess-1',
        monthKey: '2026-11',
        expenseDate: '2026-11-05',
        category: 'bazar',
        bazarSubitems: [],
        amount: 9999,
        description: 'Duplicate entry voided',
        vendor: '',
        paidByMembershipId: 'm-1',
        paymentMethod: 'cash',
        allocationMethod: 'meal_based',
        customSplit: null,
        approvalStatus: 'voided',
        receiptDataUrl: null,
        createdBy: 'u-1',
        createdAt: '2026-11-05T12:00:00Z',
      },
    ];

    const payments: PaymentRecord[] = [
      {
        id: 'p-1',
        messId: 'mess-1',
        membershipId: 'm-1',
        monthKey: '2026-11',
        amount: 5000,
        method: 'bkash',
        transactionId: 'TX123',
        paymentDate: '2026-11-02',
        type: 'deposit',
        status: 'approved',
        notes: '',
        verifiedBy: 'u-1',
        createdAt: '2026-11-02T10:00:00Z',
        verifiedAt: '2026-11-02T11:00:00Z',
      },
      // Pending payment must not affect balance until approved
      {
        id: 'p-2',
        messId: 'mess-1',
        membershipId: 'm-2',
        monthKey: '2026-11',
        amount: 6000,
        method: 'nagad',
        transactionId: 'NG999',
        paymentDate: '2026-11-04',
        type: 'deposit',
        status: 'pending',
        notes: '',
        verifiedBy: null,
        createdAt: '2026-11-04T10:00:00Z',
        verifiedAt: null,
      },
    ];

    const result = calculateMonthlyFinancials({
      monthKey: '2026-11',
      config: baseConfig,
      members,
      meals,
      expenses,
      payments,
    });

    // Net meal pool = 480 - (1 * 80) = 400. Meal rate = 400 / 5 = 80.00
    expect(result.totalBazarExpense).toBe(480);
    expect(result.totalGuestMealRevenue).toBe(80);
    expect(result.netMealPoolExpense).toBe(400);
    expect(result.totalMemberMeals).toBe(5);
    expect(result.mealRate).toBe(80);

    const m1 = result.memberSummaries.find((m) => m.membershipId === 'm-1')!;
    const m2 = result.memberSummaries.find((m) => m.membershipId === 'm-2')!;

    // m1: prev 500 + dep 5000 - (meal 2.5*80=200 + guest 80 + rent 4500 + util 500) = 5500 - 5280 = +220
    expect(m1.mealCost).toBe(200);
    expect(m1.guestMealCost).toBe(80);
    expect(m1.rentShare).toBe(4500);
    expect(m1.utilityShare).toBe(500);
    expect(m1.netBalance).toBe(220);
    expect(m1.receivableAmount).toBe(220);
    expect(m1.payableAmount).toBe(0);

    // m2: prev -200 + dep 0 (pending ignored) - (meal 200 + rent 4000 + util 500) = -200 - 4700 = -4900
    expect(m2.totalDeposited).toBe(0);
    expect(m2.netBalance).toBe(-4900);
    expect(m2.payableAmount).toBe(4900);

    const readiness = evaluateClosingReadiness({
      monthKey: '2026-11',
      breakdown: result,
      expenses,
      payments,
      meals,
    });
    const payCheck = readiness.find((r) => r.id === 'chk-payments')!;
    expect(payCheck.passed).toBe(false);
  });
});
