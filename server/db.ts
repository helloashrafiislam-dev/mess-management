import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AuditLogRecord,
  BedRecord,
  ExpenseRecord,
  MealRecord,
  MemberPermissions,
  MemberRecord,
  MessConfig,
  MonthlySettlementRecord,
  NoticeRecord,
  PaymentRecord,
  RoomRecord,
  UserRecord,
} from '../src/shared/types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'messflow.sqlite');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      platform_role TEXT NOT NULL DEFAULT 'user',
      language TEXT NOT NULL DEFAULT 'en',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active_mess_id TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BDT',
      invite_code TEXT NOT NULL UNIQUE,
      plan_tier TEXT NOT NULL DEFAULT 'free',
      breakfast_weight REAL NOT NULL DEFAULT 0.5,
      lunch_weight REAL NOT NULL DEFAULT 1.0,
      dinner_weight REAL NOT NULL DEFAULT 1.0,
      meal_booking_cutoff_hour INTEGER NOT NULL DEFAULT 22,
      meal_cancel_cutoff_hour INTEGER NOT NULL DEFAULT 8,
      guest_meal_rate REAL NOT NULL DEFAULT 85,
      rent_distribution_mode TEXT NOT NULL DEFAULT 'bed_specific',
      utility_distribution_mode TEXT NOT NULL DEFAULT 'equal',
      require_expense_approval INTEGER NOT NULL DEFAULT 0,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      building TEXT NOT NULL,
      floor TEXT NOT NULL,
      room_number TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      default_rent REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beds (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      bed_label TEXT NOT NULL,
      occupant_membership_id TEXT,
      monthly_rent REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mess_memberships (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      permissions_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      room_id TEXT,
      bed_id TEXT,
      monthly_rent REAL NOT NULL DEFAULT 0,
      previous_balance REAL NOT NULL DEFAULT 0,
      emergency_contact TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL,
      leaving_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      UNIQUE(mess_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS meal_records (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      membership_id TEXT NOT NULL REFERENCES mess_memberships(id) ON DELETE CASCADE,
      meal_date TEXT NOT NULL,
      breakfast INTEGER NOT NULL DEFAULT 0,
      lunch INTEGER NOT NULL DEFAULT 0,
      dinner INTEGER NOT NULL DEFAULT 0,
      guest_meals INTEGER NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(mess_id, membership_id, meal_date)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      month_key TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      bazar_subitems_json TEXT NOT NULL DEFAULT '[]',
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      vendor TEXT NOT NULL DEFAULT '',
      paid_by_membership_id TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      allocation_method TEXT NOT NULL DEFAULT 'meal_based',
      custom_split_json TEXT,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      receipt_data_url TEXT,
      idempotency_key TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(mess_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      membership_id TEXT NOT NULL REFERENCES mess_memberships(id) ON DELETE CASCADE,
      month_key TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      transaction_id TEXT NOT NULL DEFAULT '',
      payment_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'deposit',
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      verified_by TEXT,
      idempotency_key TEXT,
      created_at TEXT NOT NULL,
      verified_at TEXT,
      UNIQUE(mess_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS monthly_settlements (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      month_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      total_bazar REAL NOT NULL DEFAULT 0,
      total_meals REAL NOT NULL DEFAULT 0,
      meal_rate REAL NOT NULL DEFAULT 0,
      total_fixed_costs REAL NOT NULL DEFAULT 0,
      total_deposits REAL NOT NULL DEFAULT 0,
      snapshot_json TEXT NOT NULL DEFAULT '{}',
      closed_by TEXT,
      closed_at TEXT,
      UNIQUE(mess_id, month_key)
    );

    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      priority TEXT NOT NULL DEFAULT 'normal',
      expires_at TEXT,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notice_reads (
      notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TEXT NOT NULL,
      PRIMARY KEY (notice_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      mess_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_meals_mess_date ON meal_records(mess_id, meal_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_mess_month ON expenses(mess_id, month_key);
    CREATE INDEX IF NOT EXISTS idx_payments_mess_month ON payments(mess_id, month_key);
    CREATE INDEX IF NOT EXISTS idx_audit_mess ON audit_logs(mess_id, created_at);
  `);
}

export function defaultPermissionsForRole(role: string): MemberPermissions {
  if (role === 'owner') {
    return {
      manageMeals: true,
      addBazar: true,
      addUtilities: true,
      manageMembers: true,
      verifyPayments: true,
      approveExpenses: true,
      manageNotices: true,
      closeMonth: true,
    };
  }
  if (role === 'manager') {
    return {
      manageMeals: true,
      addBazar: true,
      addUtilities: true,
      manageMembers: true,
      verifyPayments: true,
      approveExpenses: false,
      manageNotices: true,
      closeMonth: false,
    };
  }
  if (role === 'accountant') {
    return {
      manageMeals: false,
      addBazar: true,
      addUtilities: true,
      manageMembers: false,
      verifyPayments: true,
      approveExpenses: true,
      manageNotices: false,
      closeMonth: true,
    };
  }
  return {
    manageMeals: false,
    addBazar: false,
    addUtilities: false,
    manageMembers: false,
    verifyPayments: false,
    approveExpenses: false,
    manageNotices: false,
    closeMonth: false,
  };
}

export function seedIfEmpty() {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount > 0) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthKey = todayStr.slice(0, 7);

  const dayOffset = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const passHash = bcrypt.hashSync('messflow123', 10);

  const tx = db.transaction(() => {
    // Users
    const insertUser = db.prepare(
      'INSERT INTO users (id, name, phone, email, password_hash, platform_role, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const users = [
      ['u-super', 'Tanvir Ahmed (Admin)', '01700000000', 'admin@messflow.app', passHash, 'super_admin', 'en', '2026-01-01T08:00:00Z'],
      ['u-owner', 'Mahmudul Hasan', '01711223344', 'mahmud@messflow.app', passHash, 'user', 'en', '2026-01-05T08:00:00Z'],
      ['u-manager', 'Rakibul Islam', '01811223344', 'rakib@messflow.app', passHash, 'user', 'en', '2026-01-06T08:00:00Z'],
      ['u-m3', 'Sajid Karim', '01911223344', 'sajid@messflow.app', passHash, 'user', 'en', '2026-02-10T08:00:00Z'],
      ['u-m4', 'Nafis Chowdhury', '01611223344', 'nafis@messflow.app', passHash, 'user', 'en', '2026-03-01T08:00:00Z'],
      ['u-m5', 'Farhan Sadiq', '01511223344', 'farhan@messflow.app', passHash, 'user', 'bn', '2026-04-12T08:00:00Z'],
      ['u-m6', 'Imran Hossain', '01722334455', 'imran@messflow.app', passHash, 'user', 'en', '2026-05-15T08:00:00Z'],
      ['u-m7', 'Zayed Khan', '01822334455', 'zayed@messflow.app', passHash, 'user', 'en', '2026-09-01T08:00:00Z'],
    ];
    for (const u of users) insertUser.run(...u);

    // Messes
    const insertMess = db.prepare(`
      INSERT INTO messes (
        id, name, address, city, currency, invite_code, plan_tier,
        breakfast_weight, lunch_weight, dinner_weight,
        meal_booking_cutoff_hour, meal_cancel_cutoff_hour, guest_meal_rate,
        rent_distribution_mode, utility_distribution_mode, require_expense_approval,
        is_suspended, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMess.run(
      'mess-dhaka-1',
      'Greenview Bachelor Mess',
      'House 24, Road 15, Dhanmondi',
      'Dhaka',
      'BDT',
      'GRNV24',
      'premium',
      0.5,
      1.0,
      1.0,
      22,
      8,
      85,
      'bed_specific',
      'equal',
      0,
      0,
      '2026-01-05T08:00:00Z'
    );
    insertMess.run(
      'mess-raj-2',
      'Padma Scholars Hostel',
      'Talaimari Mor, Motihar',
      'Rajshahi',
      'BDT',
      'PADMA9',
      'hostel',
      0.5,
      1.0,
      1.0,
      21,
      7,
      70,
      'bed_specific',
      'equal',
      1,
      0,
      '2026-03-10T08:00:00Z'
    );

    // Rooms & Beds for mess-dhaka-1
    const insertRoom = db.prepare(
      'INSERT INTO rooms (id, mess_id, building, floor, room_number, capacity, default_rent) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertRoom.run('rm-101', 'mess-dhaka-1', 'Main Building', '1st Floor', '101', 2, 4500);
    insertRoom.run('rm-102', 'mess-dhaka-1', 'Main Building', '1st Floor', '102', 3, 3800);
    insertRoom.run('rm-201', 'mess-dhaka-1', 'Main Building', '2nd Floor', '201', 2, 4200);
    insertRoom.run('rm-202', 'mess-dhaka-1', 'Main Building', '2nd Floor', '202', 2, 4000);

    const insertBed = db.prepare(
      'INSERT INTO beds (id, room_id, mess_id, bed_label, occupant_membership_id, monthly_rent) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const beds = [
      ['bed-101a', 'rm-101', 'mess-dhaka-1', 'Window Bed', 'mem-1', 4500],
      ['bed-101b', 'rm-101', 'mess-dhaka-1', 'Door Bed', 'mem-2', 4500],
      ['bed-102a', 'rm-102', 'mess-dhaka-1', 'East Bed', 'mem-3', 3800],
      ['bed-102b', 'rm-102', 'mess-dhaka-1', 'Center Bed', 'mem-4', 3800],
      ['bed-102c', 'rm-102', 'mess-dhaka-1', 'Balcony Bed', 'mem-5', 4000],
      ['bed-201a', 'rm-201', 'mess-dhaka-1', 'North Bed', 'mem-6', 4200],
      ['bed-201b', 'rm-201', 'mess-dhaka-1', 'South Bed', null, 4200],
      ['bed-202a', 'rm-202', 'mess-dhaka-1', 'Single A', 'mem-7', 4000],
      ['bed-202b', 'rm-202', 'mess-dhaka-1', 'Single B', null, 4000],
    ];
    for (const b of beds) insertBed.run(...b);

    // Memberships
    const insertMember = db.prepare(`
      INSERT INTO mess_memberships (
        id, mess_id, user_id, role, permissions_json, status, room_id, bed_id,
        monthly_rent, previous_balance, emergency_contact, joined_at, leaving_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const memberships = [
      ['mem-1', 'mess-dhaka-1', 'u-owner', 'owner', JSON.stringify(defaultPermissionsForRole('owner')), 'active', 'rm-101', 'bed-101a', 4500, 650, '01711998877', '2026-01-05', null, 'Mess Founder & Leaseholder'],
      ['mem-2', 'mess-dhaka-1', 'u-manager', 'manager', JSON.stringify(defaultPermissionsForRole('manager')), 'active', 'rm-101', 'bed-101b', 4500, 320, '01811998877', '2026-01-06', null, 'November Mess Manager'],
      ['mem-3', 'mess-dhaka-1', 'u-m3', 'member', JSON.stringify(defaultPermissionsForRole('member')), 'active', 'rm-102', 'bed-102a', 3800, -180, '01911998877', '2026-02-10', null, 'DU CSE Final Year'],
      ['mem-4', 'mess-dhaka-1', 'u-m4', 'accountant', JSON.stringify(defaultPermissionsForRole('accountant')), 'active', 'rm-102', 'bed-102b', 3800, 410, '01611998877', '2026-03-01', null, 'Assists with monthly audit'],
      ['mem-5', 'mess-dhaka-1', 'u-m5', 'member', JSON.stringify(defaultPermissionsForRole('member')), 'active', 'rm-102', 'bed-102c', 4000, 0, '01511998877', '2026-04-12', null, 'Software Engineer at Karwan Bazar'],
      ['mem-6', 'mess-dhaka-1', 'u-m6', 'member', JSON.stringify(defaultPermissionsForRole('member')), 'leaving_soon', 'rm-201', 'bed-201a', 4200, -450, '01722998877', '2026-05-15', dayOffset(-12), 'Relocating to Uttara next month'],
      ['mem-7', 'mess-dhaka-1', 'u-m7', 'member', JSON.stringify(defaultPermissionsForRole('member')), 'away', 'rm-202', 'bed-202a', 4000, 1200, '01822998877', '2026-09-01', null, 'Visited village home for 4 days'],
      ['mem-raj-1', 'mess-raj-2', 'u-owner', 'owner', JSON.stringify(defaultPermissionsForRole('owner')), 'active', null, null, 3200, 200, '01711998877', '2026-03-10', null, 'Hostel Owner'],
    ];
    for (const m of memberships) insertMember.run(...m);

    // Seed 14 days of realistic meal records up to today
    const insertMeal = db.prepare(`
      INSERT INTO meal_records (
        id, mess_id, membership_id, meal_date, breakfast, lunch, dinner, guest_meals, locked, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const activeMemIds = ['mem-1', 'mem-2', 'mem-3', 'mem-4', 'mem-5', 'mem-6', 'mem-7'];
    for (let d = 14; d >= 0; d--) {
      const dateStr = dayOffset(d);
      if (!dateStr.startsWith(monthKey)) continue;
      for (const memId of activeMemIds) {
        // mem-7 away for last 3 days
        const isAwayToday = memId === 'mem-7' && d <= 2;
        const b = isAwayToday ? 0 : (d + memId.charCodeAt(4)) % 4 === 0 ? 0 : 1;
        const l = isAwayToday ? 0 : 1;
        const dn = isAwayToday ? 0 : (memId === 'mem-6' && d % 3 === 0 ? 0 : 1);
        const guest = memId === 'mem-3' && d === 2 ? 1 : memId === 'mem-1' && d === 6 ? 2 : 0;
        insertMeal.run(
          `meal-${memId}-${dateStr}`,
          'mess-dhaka-1',
          memId,
          dateStr,
          b,
          l,
          dn,
          guest,
          d > 2 ? 1 : 0,
          'u-manager',
          `${dateStr}T09:00:00Z`
        );
      }
    }

    // Seed Expenses (last 14 days of bazar + monthly rent & utilities)
    const insertExpense = db.prepare(`
      INSERT INTO expenses (
        id, mess_id, month_key, expense_date, category, bazar_subitems_json, amount,
        description, vendor, paid_by_membership_id, payment_method, allocation_method,
        custom_split_json, approval_status, receipt_data_url, idempotency_key, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const bazarEntries = [
      { id: 'exp-b1', daysAgo: 0, amount: 1480, desc: 'Rui Fish, Potatoes, Green Chili & Coriander', vendor: 'Hatirpool Bazar', by: 'mem-2', items: [{ name: 'Rui Fish (2.5kg)', cost: 920 }, { name: 'Vegetables & Spices', cost: 560 }] },
      { id: 'exp-b2', daysAgo: 1, amount: 1850, desc: 'Sonali Chicken, Lentils & Cooking Oil', vendor: 'Rayerbazar Kacha Bazar', by: 'mem-2', items: [{ name: 'Sonali Chicken (3kg)', cost: 1050 }, { name: 'Soybean Oil 5L', cost: 800 }] },
      { id: 'exp-b3', daysAgo: 3, amount: 2650, desc: 'Miniket Rice 25kg & Onion 5kg', vendor: 'Town Hall Market', by: 'mem-1', items: [{ name: 'Miniket Rice 25kg', cost: 2150 }, { name: 'Onion & Garlic', cost: 500 }] },
      { id: 'exp-b4', daysAgo: 5, amount: 1120, desc: 'Eggs (4 Dozen), Pangas Fish & Spinach', vendor: 'Jigatola Bazar', by: 'mem-4', items: [{ name: 'Eggs 4 Dozen', cost: 560 }, { name: 'Fish & Greens', cost: 560 }] },
      { id: 'exp-b5', daysAgo: 8, amount: 1640, desc: 'Beef Curry Cut & Ginger-Garlic Paste', vendor: 'Hatirpool Bazar', by: 'mem-2', items: [{ name: 'Beef 2kg', cost: 1480 }, { name: 'Spices', cost: 160 }] },
      { id: 'exp-b6', daysAgo: 10, amount: 1390, desc: 'Broiler Chicken, Tomato & Brinjal', vendor: 'Rayerbazar Kacha Bazar', by: 'mem-5', items: [{ name: 'Broiler Chicken', cost: 890 }, { name: 'Vegetables', cost: 500 }] },
      { id: 'exp-b7', daysAgo: 12, amount: 1280, desc: 'Tilapia Fish, Dal & Mustard Oil', vendor: 'Jigatola Bazar', by: 'mem-2', items: [{ name: 'Tilapia & Dal', cost: 1280 }] },
    ];

    for (const b of bazarEntries) {
      const dStr = dayOffset(b.daysAgo);
      const mKey = dStr.slice(0, 7);
      insertExpense.run(
        b.id,
        'mess-dhaka-1',
        mKey,
        dStr,
        'bazar',
        JSON.stringify(b.items),
        b.amount,
        b.desc,
        b.vendor,
        b.by,
        'cash',
        'meal_based',
        null,
        'approved',
        null,
        `seed-${b.id}`,
        'u-manager',
        `${dStr}T11:30:00Z`
      );
    }

    const fixedBills = [
      ['exp-u1', 11, 'electricity', 2450, 'DESCO Prepaid Meter Recharge', 'DESCO', 'mem-1', 'bkash', 'equal', 'approved'],
      ['exp-u2', 11, 'gas', 1080, 'Titas Double Burner Gas Bill', 'Titas Gas', 'mem-1', 'bkash', 'equal', 'approved'],
      ['exp-u3', 10, 'water', 700, 'WASA & Drinking Jar Water (14 Jars)', 'PureFlow Jar', 'mem-2', 'cash', 'equal', 'approved'],
      ['exp-u4', 9, 'internet', 1200, '60Mbps Fiber Broadband Monthly Bill', 'Link3', 'mem-4', 'nagad', 'equal', 'approved'],
      ['exp-u5', 7, 'staff', 4200, 'Khala Monthly Cooking & Cleaning Salary', 'Rahima Begum (Khala)', 'mem-1', 'cash', 'equal', 'approved'],
      ['exp-u6', 1, 'maintenance', 650, 'Kitchen Filter Cartridge Replacement', 'Dhanmondi Hardware', 'mem-2', 'cash', 'equal', 'pending'],
    ] as const;

    for (const f of fixedBills) {
      const dStr = dayOffset(f[1]);
      const mKey = dStr.slice(0, 7);
      insertExpense.run(
        f[0],
        'mess-dhaka-1',
        mKey,
        dStr,
        f[2],
        '[]',
        f[3],
        f[4],
        f[5],
        f[6],
        f[7],
        f[8],
        null,
        f[9],
        null,
        `seed-${f[0]}`,
        'u-manager',
        `${dStr}T14:00:00Z`
      );
    }

    // Payments / Deposits
    const insertPayment = db.prepare(`
      INSERT INTO payments (
        id, mess_id, membership_id, month_key, amount, method, transaction_id,
        payment_date, type, status, notes, verified_by, idempotency_key, created_at, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const paymentsData = [
      ['pay-1', 'mess-dhaka-1', 'mem-1', monthKey, 7500, 'bkash', 'BK9K21M88P', dayOffset(12), 'deposit', 'approved', 'Rent + Bazar Advance', 'u-manager', 'seed-pay-1', `${dayOffset(12)}T10:00:00Z`, `${dayOffset(12)}T10:15:00Z`],
      ['pay-2', 'mess-dhaka-1', 'mem-2', monthKey, 7000, 'cash', 'CASH-002', dayOffset(11), 'deposit', 'approved', 'November Deposit', 'u-owner', 'seed-pay-2', `${dayOffset(11)}T11:00:00Z`, `${dayOffset(11)}T11:10:00Z`],
      ['pay-3', 'mess-dhaka-1', 'mem-3', monthKey, 6500, 'nagad', 'NG77410023', dayOffset(9), 'deposit', 'approved', 'Rent & Meal Advance', 'u-manager', 'seed-pay-3', `${dayOffset(9)}T16:00:00Z`, `${dayOffset(9)}T16:30:00Z`],
      ['pay-4', 'mess-dhaka-1', 'mem-4', monthKey, 6800, 'bkash', 'BK4P88210L', dayOffset(8), 'deposit', 'approved', 'Monthly Deposit', 'u-manager', 'seed-pay-4', `${dayOffset(8)}T18:00:00Z`, `${dayOffset(8)}T18:20:00Z`],
      ['pay-5', 'mess-dhaka-1', 'mem-5', monthKey, 7200, 'bank', 'NPSB-99412', dayOffset(6), 'deposit', 'approved', 'City Bank Transfer', 'u-owner', 'seed-pay-5', `${dayOffset(6)}T12:00:00Z`, `${dayOffset(6)}T13:00:00Z`],
      ['pay-6', 'mess-dhaka-1', 'mem-6', monthKey, 4500, 'bkash', 'BK229901XZ', dayOffset(1), 'deposit', 'pending', 'Sent partial bKash, please verify', null, 'seed-pay-6', `${dayOffset(1)}T20:10:00Z`, null],
      ['pay-7', 'mess-dhaka-1', 'mem-7', monthKey, 5000, 'rocket', 'RK5510293', dayOffset(4), 'deposit', 'approved', 'Before going home', 'u-manager', 'seed-pay-7', `${dayOffset(4)}T09:00:00Z`, `${dayOffset(4)}T09:30:00Z`],
    ];
    for (const p of paymentsData) insertPayment.run(...p);

    // Notices
    const insertNotice = db.prepare(`
      INSERT INTO notices (id, mess_id, title, body, category, priority, expires_at, created_by, created_by_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertNotice.run(
      'not-1',
      'mess-dhaka-1',
      'Meal Cancellation Cutoff Strictly 8:00 AM',
      'Please update your lunch and dinner cancellation before 8:00 AM daily so Khala can plan cooking quantities accurately without food waste.',
      'meal',
      'important',
      null,
      'u-manager',
      'Rakibul Islam',
      `${dayOffset(2)}T09:00:00Z`
    );
    insertNotice.run(
      'not-2',
      'mess-dhaka-1',
      'DESCO Meter Recharged & Internet Bill Paid',
      'DESCO electricity meter recharged with ৳2,450 and Link3 60Mbps bill cleared. Receipts are attached in the Expenses tab.',
      'utility',
      'normal',
      null,
      'u-owner',
      'Mahmudul Hasan',
      `${dayOffset(9)}T15:00:00Z`
    );
    insertNotice.run(
      'not-3',
      'mess-dhaka-1',
      'Monthly Deposit Reminder (Target: 10th of Month)',
      'Members with pending deposits are requested to submit via bKash (01811-223344) or Cash and log the Transaction ID in Payments.',
      'payment',
      'urgent',
      null,
      'u-manager',
      'Rakibul Islam',
      `${dayOffset(1)}T19:00:00Z`
    );

    // Audit logs
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, mess_id, actor_user_id, actor_name, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run('aud-1', 'mess-dhaka-1', 'u-manager', 'Rakibul Islam', 'expense_created', 'expense', 'exp-b1', 'Added ৳1,480 Bazar (Rui Fish, Potatoes, Green Chili)', `${dayOffset(0)}T11:30:00Z`);
    insertAudit.run('aud-2', 'mess-dhaka-1', 'u-m6', 'Imran Hossain', 'payment_submitted', 'payment', 'pay-6', 'Submitted ৳4,500 via bKash (TrxID: BK229901XZ)', `${dayOffset(1)}T20:10:00Z`);
    insertAudit.run('aud-3', 'mess-dhaka-1', 'u-manager', 'Rakibul Islam', 'meal_updated', 'meal', 'today', 'Updated daily meal count for active members', `${dayOffset(0)}T09:05:00Z`);
    insertAudit.run('aud-4', 'mess-dhaka-1', 'u-owner', 'Mahmudul Hasan', 'payment_approved', 'payment', 'pay-5', 'Verified City Bank transfer of ৳7,200 from Farhan Sadiq', `${dayOffset(6)}T13:00:00Z`);
  });

  tx();
}

export function createSession(userId: string, activeMessId: string | null): string {
  const token = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  db.prepare(
    'INSERT INTO sessions (token, user_id, active_mess_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(token, userId, activeMessId, now.toISOString(), expires.toISOString());
  return token;
}

export function getMessConfig(messId: string): MessConfig | null {
  const row = db.prepare('SELECT * FROM messes WHERE id = ?').get(messId) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    currency: row.currency,
    inviteCode: row.invite_code,
    planTier: row.plan_tier,
    breakfastWeight: row.breakfast_weight,
    lunchWeight: row.lunch_weight,
    dinnerWeight: row.dinner_weight,
    mealBookingCutoffHour: row.meal_booking_cutoff_hour,
    mealCancelCutoffHour: row.meal_cancel_cutoff_hour,
    guestMealRate: row.guest_meal_rate,
    rentDistributionMode: row.rent_distribution_mode,
    utilityDistributionMode: row.utility_distribution_mode,
    requireExpenseApproval: Boolean(row.require_expense_approval),
    createdAt: row.created_at,
  };
}

export function getMessMembers(messId: string): MemberRecord[] {
  const rows = db
    .prepare(
      `SELECT mm.*, u.name, u.phone, u.email, r.room_number, b.bed_label
       FROM mess_memberships mm
       JOIN users u ON u.id = mm.user_id
       LEFT JOIN rooms r ON r.id = mm.room_id
       LEFT JOIN beds b ON b.id = mm.bed_id
       WHERE mm.mess_id = ?
       ORDER BY CASE mm.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 WHEN 'accountant' THEN 3 ELSE 4 END, u.name ASC`
    )
    .all(messId) as any[];
  return rows.map((row) => ({
    id: row.id,
    messId: row.mess_id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    permissions: JSON.parse(row.permissions_json),
    status: row.status,
    roomId: row.room_id,
    bedId: row.bed_id,
    roomNumber: row.room_number || null,
    bedLabel: row.bed_label || null,
    monthlyRent: row.monthly_rent,
    previousBalance: row.previous_balance,
    emergencyContact: row.emergency_contact,
    joinedAt: row.joined_at,
    leavingDate: row.leaving_date,
    notes: row.notes,
  }));
}

export function getMessRoomsAndBeds(messId: string): { rooms: RoomRecord[]; beds: BedRecord[] } {
  const rooms = (db.prepare('SELECT * FROM rooms WHERE mess_id = ? ORDER BY floor, room_number').all(messId) as any[]).map((r) => ({
    id: r.id,
    messId: r.mess_id,
    building: r.building,
    floor: r.floor,
    roomNumber: r.room_number,
    capacity: r.capacity,
    defaultRent: r.default_rent,
  }));
  const beds = (db.prepare('SELECT * FROM beds WHERE mess_id = ? ORDER BY bed_label').all(messId) as any[]).map((b) => ({
    id: b.id,
    roomId: b.room_id,
    messId: b.mess_id,
    bedLabel: b.bed_label,
    occupantMembershipId: b.occupant_membership_id,
    monthlyRent: b.monthly_rent,
  }));
  return { rooms, beds };
}

export function getMessMeals(messId: string, monthKey: string): MealRecord[] {
  const rows = db
    .prepare('SELECT * FROM meal_records WHERE mess_id = ? AND meal_date LIKE ? ORDER BY meal_date DESC')
    .all(messId, `${monthKey}%`) as any[];
  return rows.map((r) => ({
    id: r.id,
    messId: r.mess_id,
    membershipId: r.membership_id,
    mealDate: r.meal_date,
    breakfast: r.breakfast,
    lunch: r.lunch,
    dinner: r.dinner,
    guestMeals: r.guest_meals,
    locked: Boolean(r.locked),
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  }));
}

export function getMessExpenses(messId: string, monthKey: string): ExpenseRecord[] {
  const rows = db
    .prepare('SELECT * FROM expenses WHERE mess_id = ? AND month_key = ? ORDER BY expense_date DESC, created_at DESC')
    .all(messId, monthKey) as any[];
  return rows.map((r) => ({
    id: r.id,
    messId: r.mess_id,
    monthKey: r.month_key,
    expenseDate: r.expense_date,
    category: r.category,
    bazarSubitems: JSON.parse(r.bazar_subitems_json || '[]'),
    amount: r.amount,
    description: r.description,
    vendor: r.vendor,
    paidByMembershipId: r.paid_by_membership_id,
    paymentMethod: r.payment_method,
    allocationMethod: r.allocation_method,
    customSplit: r.custom_split_json ? JSON.parse(r.custom_split_json) : null,
    approvalStatus: r.approval_status,
    receiptDataUrl: r.receipt_data_url,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
}

export function getMessPayments(messId: string, monthKey: string): PaymentRecord[] {
  const rows = db
    .prepare('SELECT * FROM payments WHERE mess_id = ? AND month_key = ? ORDER BY payment_date DESC, created_at DESC')
    .all(messId, monthKey) as any[];
  return rows.map((r) => ({
    id: r.id,
    messId: r.mess_id,
    membershipId: r.membership_id,
    monthKey: r.month_key,
    amount: r.amount,
    method: r.method,
    transactionId: r.transaction_id,
    paymentDate: r.payment_date,
    type: r.type,
    status: r.status,
    notes: r.notes,
    verifiedBy: r.verified_by,
    createdAt: r.created_at,
    verifiedAt: r.verified_at,
  }));
}

export function getMessNotices(messId: string): NoticeRecord[] {
  const rows = db
    .prepare('SELECT * FROM notices WHERE mess_id = ? ORDER BY created_at DESC')
    .all(messId) as any[];
  const readsStmt = db.prepare('SELECT user_id FROM notice_reads WHERE notice_id = ?');
  return rows.map((r) => ({
    id: r.id,
    messId: r.mess_id,
    title: r.title,
    body: r.body,
    category: r.category,
    priority: r.priority,
    expiresAt: r.expires_at,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    readByUserIds: (readsStmt.all(r.id) as { user_id: string }[]).map((x) => x.user_id),
  }));
}

export function getMessAuditLogs(messId: string): AuditLogRecord[] {
  return (
    db
      .prepare('SELECT * FROM audit_logs WHERE mess_id = ? ORDER BY created_at DESC LIMIT 60')
      .all(messId) as any[]
  ).map((r) => ({
    id: r.id,
    messId: r.mess_id,
    actorUserId: r.actor_user_id,
    actorName: r.actor_name,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    details: r.details,
    createdAt: r.created_at,
  }));
}

export function getMonthlySettlement(messId: string, monthKey: string): MonthlySettlementRecord | null {
  const row = db
    .prepare('SELECT * FROM monthly_settlements WHERE mess_id = ? AND month_key = ?')
    .get(messId, monthKey) as any;
  if (!row) return null;
  return {
    id: row.id,
    messId: row.mess_id,
    monthKey: row.month_key,
    status: row.status,
    totalBazar: row.total_bazar,
    totalMeals: row.total_meals,
    mealRate: row.meal_rate,
    totalFixedCosts: row.total_fixed_costs,
    totalDeposits: row.total_deposits,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
  };
}

export function logAudit(params: {
  messId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}) {
  db.prepare(
    'INSERT INTO audit_logs (id, mess_id, actor_user_id, actor_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    `aud-${crypto.randomUUID()}`,
    params.messId,
    params.actorUserId,
    params.actorName,
    params.action,
    params.entityType,
    params.entityId,
    params.details,
    new Date().toISOString()
  );
}

export function toPublicUser(row: any): UserRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    platformRole: row.platform_role,
    language: row.language,
    createdAt: row.created_at,
  };
}
