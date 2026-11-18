export type Language = 'en' | 'bn';

export type PlatformRole = 'user' | 'super_admin';
export type MessRole = 'owner' | 'manager' | 'accountant' | 'member' | 'pending';
export type MemberStatus = 'active' | 'pending' | 'away' | 'leaving_soon' | 'left' | 'suspended';

export type ExpenseCategory =
  | 'bazar'
  | 'rent'
  | 'electricity'
  | 'gas'
  | 'water'
  | 'internet'
  | 'cleaning'
  | 'staff'
  | 'maintenance'
  | 'furniture'
  | 'other';

export type AllocationMethod = 'meal_based' | 'equal' | 'fixed' | 'custom';
export type ExpenseApprovalStatus = 'approved' | 'pending' | 'rejected' | 'voided';
export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank' | 'other';
export type PaymentType = 'deposit' | 'settlement' | 'refund' | 'adjustment';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export type NoticeCategory = 'bazar' | 'payment' | 'meal' | 'maintenance' | 'utility' | 'meeting' | 'general';
export type NoticePriority = 'normal' | 'important' | 'urgent';

export type PlanTier = 'free' | 'premium' | 'hostel';

export interface MemberPermissions {
  manageMeals: boolean;
  addBazar: boolean;
  addUtilities: boolean;
  manageMembers: boolean;
  verifyPayments: boolean;
  approveExpenses: boolean;
  manageNotices: boolean;
  closeMonth: boolean;
}

export interface UserRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  platformRole: PlatformRole;
  language: Language;
  createdAt: string;
}

export interface MessConfig {
  id: string;
  name: string;
  address: string;
  city: string;
  currency: string;
  inviteCode: string;
  planTier: PlanTier;
  breakfastWeight: number;
  lunchWeight: number;
  dinnerWeight: number;
  mealBookingCutoffHour: number;
  mealCancelCutoffHour: number;
  guestMealRate: number;
  rentDistributionMode: 'bed_specific' | 'equal';
  utilityDistributionMode: 'equal' | 'meal_based';
  requireExpenseApproval: boolean;
  createdAt: string;
}

export interface MemberRecord {
  id: string; // membership_id
  messId: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  role: MessRole;
  permissions: MemberPermissions;
  status: MemberStatus;
  roomId: string | null;
  bedId: string | null;
  roomNumber: string | null;
  bedLabel: string | null;
  monthlyRent: number;
  previousBalance: number;
  emergencyContact: string;
  joinedAt: string;
  leavingDate: string | null;
  notes: string;
}

export interface RoomRecord {
  id: string;
  messId: string;
  building: string;
  floor: string;
  roomNumber: string;
  capacity: number;
  defaultRent: number;
}

export interface BedRecord {
  id: string;
  roomId: string;
  messId: string;
  bedLabel: string;
  occupantMembershipId: string | null;
  monthlyRent: number;
}

export interface MealRecord {
  id: string;
  messId: string;
  membershipId: string;
  mealDate: string; // YYYY-MM-DD
  breakfast: number; // 0 or 1
  lunch: number; // 0 or 1
  dinner: number; // 0 or 1
  guestMeals: number;
  locked: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface BazarSubitem {
  name: string;
  qty?: string;
  cost: number;
}

export interface ExpenseRecord {
  id: string;
  messId: string;
  monthKey: string; // YYYY-MM
  expenseDate: string; // YYYY-MM-DD
  category: ExpenseCategory;
  bazarSubitems: BazarSubitem[];
  amount: number;
  description: string;
  vendor: string;
  paidByMembershipId: string;
  paymentMethod: PaymentMethod;
  allocationMethod: AllocationMethod;
  customSplit: Record<string, number> | null;
  approvalStatus: ExpenseApprovalStatus;
  receiptDataUrl: string | null;
  createdBy: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  messId: string;
  membershipId: string;
  monthKey: string;
  amount: number;
  method: PaymentMethod;
  transactionId: string;
  paymentDate: string;
  type: PaymentType;
  status: PaymentStatus;
  notes: string;
  verifiedBy: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface NoticeRecord {
  id: string;
  messId: string;
  title: string;
  body: string;
  category: NoticeCategory;
  priority: NoticePriority;
  expiresAt: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  readByUserIds: string[];
}

export interface AuditLogRecord {
  id: string;
  messId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface MonthlySettlementRecord {
  id: string;
  messId: string;
  monthKey: string;
  status: 'open' | 'closed';
  totalBazar: number;
  totalMeals: number;
  mealRate: number;
  totalFixedCosts: number;
  totalDeposits: number;
  closedBy: string | null;
  closedAt: string | null;
}

export interface MemberFinancialSummary {
  membershipId: string;
  name: string;
  roomLabel: string;
  status: MemberStatus;
  role: MessRole;
  previousBalance: number;
  totalDeposited: number;
  totalPaidOutOfPocket: number; // expenses paid directly by this member (e.g. bazar from pocket)
  memberMeals: number;
  guestMeals: number;
  mealCost: number;
  guestMealCost: number;
  rentShare: number;
  utilityShare: number;
  otherExpenseShare: number;
  adjustments: number;
  totalExpenseShare: number;
  netBalance: number; // positive = advance/receivable, negative = due/payable
  payableAmount: number;
  receivableAmount: number;
}

export interface FinancialBreakdown {
  monthKey: string;
  totalBazarExpense: number;
  totalOtherMealExpense: number;
  totalMealPoolExpense: number;
  totalGuestMealRevenue: number;
  netMealPoolExpense: number;
  totalMemberMeals: number;
  totalGuestMeals: number;
  totalEligibleMeals: number;
  mealRate: number;
  totalRentExpense: number;
  totalUtilityExpense: number;
  totalOtherFixedExpense: number;
  totalApprovedExpenses: number;
  totalPendingExpenses: number;
  totalApprovedDeposits: number;
  totalPendingPayments: number;
  categoryTotals: Record<ExpenseCategory, number>;
  memberSummaries: MemberFinancialSummary[];
  formulaSteps: {
    label: string;
    value: string;
    detail: string;
  }[];
}

export interface MessInsight {
  id: string;
  severity: 'info' | 'warning' | 'alert';
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  metricValue?: string;
}

export interface ClosingReadinessCheck {
  id: string;
  passed: boolean;
  labelEn: string;
  labelBn: string;
  detailEn: string;
  detailBn: string;
}
