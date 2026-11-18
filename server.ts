import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  createSession,
  db,
  defaultPermissionsForRole,
  getMessAuditLogs,
  getMessConfig,
  getMessExpenses,
  getMessMeals,
  getMessMembers,
  getMessNotices,
  getMessPayments,
  getMessRoomsAndBeds,
  getMonthlySettlement,
  initSchema,
  logAudit,
  seedIfEmpty,
  toPublicUser,
} from './server/db.js';
import {
  calculateMonthlyFinancials,
  evaluateClosingReadiness,
  generateMessInsights,
} from './src/shared/financialEngine.js';

initSchema();
seedIfEmpty();

const app = express();
app.use(express.json({ limit: '4mb' }));

interface AuthContext {
  token: string;
  user: ReturnType<typeof toPublicUser>;
  activeMessId: string | null;
}

function getAuthContext(req: express.Request): AuthContext | null {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const token = bearer || (req.headers['x-session-token'] as string) || '';
  if (!token) return null;

  const session = db
    .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .get(token, new Date().toISOString()) as any;
  if (!session) return null;

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as any;
  if (!userRow) return null;

  return {
    token,
    user: toPublicUser(userRow),
    activeMessId: session.active_mess_id,
  };
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ctx = getAuthContext(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  (req as any).auth = ctx;
  next();
}

function getMemberContext(messId: string, userId: string) {
  const row = db
    .prepare('SELECT * FROM mess_memberships WHERE mess_id = ? AND user_id = ?')
    .get(messId, userId) as any;
  if (!row) return null;
  return {
    id: row.id as string,
    role: row.role as string,
    status: row.status as string,
    permissions: JSON.parse(row.permissions_json),
  };
}

// ---------- AUTH ROUTES ----------

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    res.status(400).json({ error: 'Phone/Email and password are required' });
    return;
  }
  const userRow = db
    .prepare('SELECT * FROM users WHERE email = ? OR phone = ?')
    .get(String(identifier).trim(), String(identifier).trim()) as any;

  if (!userRow || !bcrypt.compareSync(String(password), userRow.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const firstMess = db
    .prepare('SELECT mess_id FROM mess_memberships WHERE user_id = ? LIMIT 1')
    .get(userRow.id) as { mess_id: string } | undefined;

  const token = createSession(userRow.id, firstMess?.mess_id ?? null);
  res.json({
    token,
    user: toPublicUser(userRow),
    activeMessId: firstMess?.mess_id ?? null,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { name, phone, email, password, inviteCode } = req.body || {};
  if (!name || !phone || !email || !password) {
    res.status(400).json({ error: 'Name, phone, email, and password are required' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR phone = ?')
    .get(String(email).trim(), String(phone).trim());
  if (existing) {
    res.status(409).json({ error: 'Account with this email or phone already exists' });
    return;
  }

  const userId = `u-${crypto.randomUUID()}`;
  const passHash = bcrypt.hashSync(String(password), 10);
  const nowIso = new Date().toISOString();

  let joinedMessId: string | null = null;
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO users (id, name, phone, email, password_hash, platform_role, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, String(name).trim(), String(phone).trim(), String(email).trim(), passHash, 'user', 'en', nowIso);

    if (inviteCode) {
      const mess = db
        .prepare('SELECT id, name FROM messes WHERE invite_code = ?')
        .get(String(inviteCode).trim().toUpperCase()) as any;
      if (mess) {
        joinedMessId = mess.id;
        db.prepare(
          `INSERT INTO mess_memberships (
            id, mess_id, user_id, role, permissions_json, status, monthly_rent, previous_balance, joined_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          `mem-${crypto.randomUUID()}`,
          mess.id,
          userId,
          'member',
          JSON.stringify(defaultPermissionsForRole('member')),
          'active',
          0,
          0,
          nowIso.slice(0, 10)
        );
        logAudit({
          messId: mess.id,
          actorUserId: userId,
          actorName: String(name).trim(),
          action: 'member_joined',
          entityType: 'member',
          entityId: userId,
          details: `${String(name).trim()} joined via invite code`,
        });
      }
    }
  });
  tx();

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  const token = createSession(userId, joinedMessId);
  res.status(201).json({
    token,
    user: toPublicUser(userRow),
    activeMessId: joinedMessId,
  });
});

app.post('/api/auth/demo-switch', (req, res) => {
  const { userId, messId } = req.body || {};
  const targetId = userId || 'u-owner';
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!userRow) {
    res.status(404).json({ error: 'Demo user not found' });
    return;
  }

  let resolvedMessId = messId || null;
  if (!resolvedMessId) {
    const firstMess = db
      .prepare('SELECT mess_id FROM mess_memberships WHERE user_id = ? LIMIT 1')
      .get(userRow.id) as { mess_id: string } | undefined;
    resolvedMessId = firstMess?.mess_id ?? 'mess-dhaka-1';
  }

  const token = createSession(userRow.id, resolvedMessId);
  res.json({
    token,
    user: toPublicUser(userRow),
    activeMessId: resolvedMessId,
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const memberships = db
    .prepare(
      `SELECT mm.mess_id as messId, mm.role, mm.status, m.name as messName, m.city
       FROM mess_memberships mm
       JOIN messes m ON m.id = mm.mess_id
       WHERE mm.user_id = ?`
    )
    .all(ctx.user.id);
  res.json({
    user: ctx.user,
    activeMessId: ctx.activeMessId,
    memberships,
  });
});

app.patch('/api/auth/language', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const lang = req.body?.language === 'bn' ? 'bn' : 'en';
  db.prepare('UPDATE users SET language = ? WHERE id = ?').run(lang, ctx.user.id);
  res.json({ language: lang });
});

app.post('/api/auth/switch-mess', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId } = req.body || {};
  const membership = getMemberContext(messId, ctx.user.id);
  if (!membership && ctx.user.platformRole !== 'super_admin') {
    res.status(403).json({ error: 'Not a member of this mess' });
    return;
  }
  db.prepare('UPDATE sessions SET active_mess_id = ? WHERE token = ?').run(messId, ctx.token);
  res.json({ activeMessId: messId });
});

// ---------- MESS CREATION & JOINING ----------

app.post('/api/mess/create', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { name, address, city, guestMealRate } = req.body || {};
  if (!name || !address || !city) {
    res.status(400).json({ error: 'Mess name, address, and city are required' });
    return;
  }
  const messId = `mess-${crypto.randomUUID().slice(0, 8)}`;
  const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO messes (id, name, address, city, currency, invite_code, plan_tier, guest_meal_rate, created_at)
       VALUES (?, ?, ?, ?, 'BDT', ?, 'free', ?, ?)`
    ).run(messId, String(name).trim(), String(address).trim(), String(city).trim(), inviteCode, Number(guestMealRate) || 80, nowIso);

    db.prepare(
      `INSERT INTO mess_memberships (
        id, mess_id, user_id, role, permissions_json, status, monthly_rent, previous_balance, joined_at
      ) VALUES (?, ?, ?, 'owner', ?, 'active', 0, 0, ?)`
    ).run(`mem-${crypto.randomUUID()}`, messId, ctx.user.id, JSON.stringify(defaultPermissionsForRole('owner')), nowIso.slice(0, 10));

    db.prepare('UPDATE sessions SET active_mess_id = ? WHERE token = ?').run(messId, ctx.token);
    logAudit({
      messId,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      action: 'mess_created',
      entityType: 'mess',
      entityId: messId,
      details: `Created mess "${String(name).trim()}" in ${String(city).trim()}`,
    });
  })();

  res.status(201).json({ messId, inviteCode });
});

app.post('/api/mess/join', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const code = String(req.body?.inviteCode || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Invite code is required' });
    return;
  }
  const mess = db.prepare('SELECT id, name FROM messes WHERE invite_code = ?').get(code) as any;
  if (!mess) {
    res.status(404).json({ error: 'Invalid mess invite code' });
    return;
  }
  const existing = getMemberContext(mess.id, ctx.user.id);
  if (!existing) {
    db.prepare(
      `INSERT INTO mess_memberships (
        id, mess_id, user_id, role, permissions_json, status, monthly_rent, previous_balance, joined_at
      ) VALUES (?, ?, ?, 'member', ?, 'active', 0, 0, ?)`
    ).run(
      `mem-${crypto.randomUUID()}`,
      mess.id,
      ctx.user.id,
      JSON.stringify(defaultPermissionsForRole('member')),
      new Date().toISOString().slice(0, 10)
    );
    logAudit({
      messId: mess.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      action: 'member_joined',
      entityType: 'member',
      entityId: ctx.user.id,
      details: `${ctx.user.name} joined via invite code ${code}`,
    });
  }
  db.prepare('UPDATE sessions SET active_mess_id = ? WHERE token = ?').run(mess.id, ctx.token);
  res.json({ messId: mess.id, messName: mess.name });
});

// ---------- MESS SNAPSHOT ----------

app.get('/api/mess/snapshot', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const messId = (req.query.messId as string) || ctx.activeMessId;
  if (!messId) {
    res.status(404).json({ error: 'No active mess selected' });
    return;
  }

  const membership = getMemberContext(messId, ctx.user.id);
  if (!membership && ctx.user.platformRole !== 'super_admin') {
    res.status(403).json({ error: 'Access denied for this mess' });
    return;
  }

  const config = getMessConfig(messId);
  if (!config) {
    res.status(404).json({ error: 'Mess not found' });
    return;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthKey = ((req.query.monthKey as string) || todayStr.slice(0, 7)).slice(0, 7);

  const members = getMessMembers(messId);
  const { rooms, beds } = getMessRoomsAndBeds(messId);
  const meals = getMessMeals(messId, monthKey);
  const expenses = getMessExpenses(messId, monthKey);
  const payments = getMessPayments(messId, monthKey);
  const notices = getMessNotices(messId);
  const auditLogs = getMessAuditLogs(messId);
  const settlement = getMonthlySettlement(messId, monthKey);

  const financialBreakdown = calculateMonthlyFinancials({
    monthKey,
    config,
    members,
    meals,
    expenses,
    payments,
  });

  const insights = generateMessInsights({
    monthKey,
    todayStr,
    breakdown: financialBreakdown,
    expenses,
    payments,
    meals,
    members,
  });

  const closingReadiness = evaluateClosingReadiness({
    monthKey,
    breakdown: financialBreakdown,
    expenses,
    payments,
    meals,
  });

  const notifications = db
    .prepare('SELECT * FROM notifications WHERE mess_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(messId, ctx.user.id);

  const userMemberships = db
    .prepare(
      `SELECT mm.mess_id as messId, mm.role, m.name as messName, m.city
       FROM mess_memberships mm JOIN messes m ON m.id = mm.mess_id WHERE mm.user_id = ?`
    )
    .all(ctx.user.id);

  res.json({
    todayStr,
    monthKey,
    currentMember: members.find((m) => m.userId === ctx.user.id) || null,
    userMemberships,
    config,
    members,
    rooms,
    beds,
    meals,
    expenses,
    payments,
    notices,
    auditLogs,
    settlement,
    financialBreakdown,
    insights,
    closingReadiness,
    notifications,
  });
});

// ---------- MEAL OPERATIONS ----------

app.post('/api/meals/upsert', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId, membershipId, mealDate, breakfast, lunch, dinner, guestMeals } = req.body || {};
  const member = getMemberContext(messId, ctx.user.id);
  if (!member) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const isManager = member.role === 'owner' || member.permissions.manageMeals;
  if (membershipId !== member.id && !isManager) {
    res.status(403).json({ error: 'Only managers can edit other members’ meals' });
    return;
  }

  const existing = db
    .prepare('SELECT * FROM meal_records WHERE mess_id = ? AND membership_id = ? AND meal_date = ?')
    .get(messId, membershipId, mealDate) as any;

  if (existing && existing.locked && !isManager) {
    res.status(423).json({ error: 'Meal record for this date is locked by manager' });
    return;
  }

  // Enforce month lock
  const monthKey = String(mealDate).slice(0, 7);
  const settlement = getMonthlySettlement(messId, monthKey);
  if (settlement?.status === 'closed') {
    res.status(423).json({ error: 'This month has been closed and locked' });
    return;
  }

  const nowIso = new Date().toISOString();
  const b = breakfast ? 1 : 0;
  const l = lunch ? 1 : 0;
  const d = dinner ? 1 : 0;
  const g = Math.max(0, Math.min(20, Number(guestMeals) || 0));

  db.prepare(
    `INSERT INTO meal_records (id, mess_id, membership_id, meal_date, breakfast, lunch, dinner, guest_meals, locked, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(mess_id, membership_id, meal_date) DO UPDATE SET
       breakfast = excluded.breakfast,
       lunch = excluded.lunch,
       dinner = excluded.dinner,
       guest_meals = excluded.guest_meals,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`
  ).run(`meal-${membershipId}-${mealDate}`, messId, membershipId, mealDate, b, l, d, g, existing?.locked ? 1 : 0, ctx.user.id, nowIso);

  logAudit({
    messId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: 'meal_updated',
    entityType: 'meal',
    entityId: `${membershipId}:${mealDate}`,
    details: `Set ${mealDate} meals (B:${b}, L:${l}, D:${d}, Guest:${g})`,
  });

  res.json({ ok: true });
});

app.post('/api/meals/lock-day', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId, mealDate, locked } = req.body || {};
  const member = getMemberContext(messId, ctx.user.id);
  if (!member || (member.role !== 'owner' && !member.permissions.manageMeals)) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }
  db.prepare('UPDATE meal_records SET locked = ? WHERE mess_id = ? AND meal_date = ?').run(
    locked ? 1 : 0,
    messId,
    mealDate
  );
  logAudit({
    messId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: locked ? 'meal_day_locked' : 'meal_day_unlocked',
    entityType: 'meal',
    entityId: mealDate,
    details: `${locked ? 'Locked' : 'Unlocked'} meal counts for ${mealDate}`,
  });
  res.json({ ok: true });
});

// ---------- EXPENSE & BAZAR OPERATIONS ----------

app.post('/api/expenses', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const {
    messId,
    expenseDate,
    category,
    bazarSubitems,
    amount,
    description,
    vendor,
    paidByMembershipId,
    paymentMethod,
    allocationMethod,
    receiptDataUrl,
    idempotencyKey,
  } = req.body || {};

  const member = getMemberContext(messId, ctx.user.id);
  if (!member) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const canAdd =
    member.role === 'owner' ||
    (category === 'bazar' ? member.permissions.addBazar : member.permissions.addUtilities);
  if (!canAdd) {
    res.status(403).json({ error: 'You do not have permission to log this expense' });
    return;
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0' });
    return;
  }

  const monthKey = String(expenseDate).slice(0, 7);
  const settlement = getMonthlySettlement(messId, monthKey);
  if (settlement?.status === 'closed') {
    res.status(423).json({ error: 'Cannot add expense to a closed month' });
    return;
  }

  if (idempotencyKey) {
    const dup = db
      .prepare('SELECT id FROM expenses WHERE mess_id = ? AND idempotency_key = ?')
      .get(messId, idempotencyKey);
    if (dup) {
      res.json({ ok: true, deduplicated: true });
      return;
    }
  }

  const config = getMessConfig(messId)!;
  const approvalStatus =
    config.requireExpenseApproval && member.role !== 'owner' && !member.permissions.approveExpenses
      ? 'pending'
      : 'approved';

  const id = `exp-${crypto.randomUUID()}`;
  db.prepare(
    `INSERT INTO expenses (
      id, mess_id, month_key, expense_date, category, bazar_subitems_json, amount,
      description, vendor, paid_by_membership_id, payment_method, allocation_method,
      custom_split_json, approval_status, receipt_data_url, idempotency_key, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    messId,
    monthKey,
    expenseDate,
    category,
    JSON.stringify(bazarSubitems || []),
    numAmount,
    String(description || '').trim() || `${category} expense`,
    String(vendor || '').trim(),
    paidByMembershipId || member.id,
    paymentMethod || 'cash',
    allocationMethod || (category === 'bazar' ? 'meal_based' : 'equal'),
    null,
    approvalStatus,
    receiptDataUrl || null,
    idempotencyKey || null,
    ctx.user.id,
    new Date().toISOString()
  );

  logAudit({
    messId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: 'expense_created',
    entityType: 'expense',
    entityId: id,
    details: `Logged ৳${numAmount.toLocaleString()} ${category} (${String(description || '').trim()}) [${approvalStatus}]`,
  });

  res.status(201).json({ id, approvalStatus });
});

app.patch('/api/expenses/:id/status', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id) as any;
  if (!exp) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }
  const member = getMemberContext(exp.mess_id, ctx.user.id);
  if (!member || (member.role !== 'owner' && !member.permissions.approveExpenses)) {
    res.status(403).json({ error: 'Only owner or approver can change expense status' });
    return;
  }
  const settlement = getMonthlySettlement(exp.mess_id, exp.month_key);
  if (settlement?.status === 'closed') {
    res.status(423).json({ error: 'Cannot alter expenses in a closed month' });
    return;
  }
  const status = req.body?.status;
  if (!['approved', 'rejected', 'voided'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  db.prepare('UPDATE expenses SET approval_status = ? WHERE id = ?').run(status, exp.id);
  logAudit({
    messId: exp.mess_id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: `expense_${status}`,
    entityType: 'expense',
    entityId: exp.id,
    details: `Marked ${exp.category} expense ৳${exp.amount} as ${status}`,
  });
  res.json({ ok: true });
});

// ---------- PAYMENTS & VERIFICATION ----------

app.post('/api/payments', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const {
    messId,
    membershipId,
    amount,
    method,
    transactionId,
    paymentDate,
    type,
    notes,
    idempotencyKey,
  } = req.body || {};

  const actor = getMemberContext(messId, ctx.user.id);
  if (!actor) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const targetMembershipId = membershipId || actor.id;
  const canVerify = actor.role === 'owner' || actor.permissions.verifyPayments;
  if (targetMembershipId !== actor.id && !canVerify) {
    res.status(403).json({ error: 'Cannot submit payment for another member' });
    return;
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0' });
    return;
  }

  if (idempotencyKey) {
    const dup = db
      .prepare('SELECT id FROM payments WHERE mess_id = ? AND idempotency_key = ?')
      .get(messId, idempotencyKey);
    if (dup) {
      res.json({ ok: true, deduplicated: true });
      return;
    }
  }

  const dateStr = paymentDate || new Date().toISOString().slice(0, 10);
  const monthKey = dateStr.slice(0, 7);
  const id = `pay-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();

  // If manager/owner logs a cash deposit directly, auto-approve; if member submits bKash/Nagad, set pending verification
  const autoApprove = canVerify && targetMembershipId !== actor.id;
  const status = autoApprove ? 'approved' : 'pending';

  db.prepare(
    `INSERT INTO payments (
      id, mess_id, membership_id, month_key, amount, method, transaction_id,
      payment_date, type, status, notes, verified_by, idempotency_key, created_at, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    messId,
    targetMembershipId,
    monthKey,
    numAmount,
    method || 'bkash',
    String(transactionId || '').trim(),
    dateStr,
    type || 'deposit',
    status,
    String(notes || '').trim(),
    autoApprove ? ctx.user.id : null,
    idempotencyKey || null,
    nowIso,
    autoApprove ? nowIso : null
  );

  logAudit({
    messId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: 'payment_submitted',
    entityType: 'payment',
    entityId: id,
    details: `Submitted ৳${numAmount.toLocaleString()} via ${method} (Trx: ${transactionId || 'N/A'}) [${status}]`,
  });

  res.status(201).json({ id, status });
});

app.patch('/api/payments/:id/verify', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id) as any;
  if (!payment) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }
  const actor = getMemberContext(payment.mess_id, ctx.user.id);
  if (!actor || (actor.role !== 'owner' && !actor.permissions.verifyPayments)) {
    res.status(403).json({ error: 'Only owner or manager can verify payments' });
    return;
  }

  const decision = req.body?.status === 'rejected' ? 'rejected' : 'approved';
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE payments SET status = ?, verified_by = ?, verified_at = ? WHERE id = ?').run(
    decision,
    ctx.user.id,
    nowIso,
    payment.id
  );

  logAudit({
    messId: payment.mess_id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: `payment_${decision}`,
    entityType: 'payment',
    entityId: payment.id,
    details: `${decision === 'approved' ? 'Verified' : 'Rejected'} ৳${payment.amount} (${payment.method})`,
  });

  res.json({ ok: true, status: decision });
});

// ---------- MEMBERS, ROOMS & BEDS ----------

app.post('/api/members/add', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId, name, phone, email, role, monthlyRent, bedId, emergencyContact } = req.body || {};
  const actor = getMemberContext(messId, ctx.user.id);
  if (!actor || (actor.role !== 'owner' && !actor.permissions.manageMembers)) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }
  if (!name || !phone) {
    res.status(400).json({ error: 'Name and phone are required' });
    return;
  }

  const cleanPhone = String(phone).trim();
  const cleanEmail = String(email || `${cleanPhone}@messflow.local`).trim();
  const nowIso = new Date().toISOString();
  let userRow = db.prepare('SELECT * FROM users WHERE phone = ? OR email = ?').get(cleanPhone, cleanEmail) as any;

  const membershipId = `mem-${crypto.randomUUID()}`;
  db.transaction(() => {
    if (!userRow) {
      const userId = `u-${crypto.randomUUID()}`;
      const hash = bcrypt.hashSync('messflow123', 10);
      db.prepare(
        'INSERT INTO users (id, name, phone, email, password_hash, platform_role, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, String(name).trim(), cleanPhone, cleanEmail, hash, 'user', 'en', nowIso);
      userRow = { id: userId };
    }

    let roomId: string | null = null;
    let resolvedRent = Number(monthlyRent) || 0;
    if (bedId) {
      const bed = db.prepare('SELECT * FROM beds WHERE id = ? AND mess_id = ?').get(bedId, messId) as any;
      if (bed && !bed.occupant_membership_id) {
        roomId = bed.room_id;
        if (!resolvedRent) resolvedRent = bed.monthly_rent;
        db.prepare('UPDATE beds SET occupant_membership_id = ? WHERE id = ?').run(membershipId, bedId);
      }
    }

    const assignedRole = role || 'member';
    db.prepare(
      `INSERT INTO mess_memberships (
        id, mess_id, user_id, role, permissions_json, status, room_id, bed_id,
        monthly_rent, previous_balance, emergency_contact, joined_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, 0, ?, ?)`
    ).run(
      membershipId,
      messId,
      userRow.id,
      assignedRole,
      JSON.stringify(defaultPermissionsForRole(assignedRole)),
      roomId,
      bedId || null,
      resolvedRent,
      String(emergencyContact || ''),
      nowIso.slice(0, 10)
    );

    logAudit({
      messId,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      action: 'member_added',
      entityType: 'member',
      entityId: membershipId,
      details: `Added ${String(name).trim()} as ${assignedRole}`,
    });
  })();

  res.status(201).json({ membershipId });
});

app.patch('/api/members/:id', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const target = db.prepare('SELECT * FROM mess_memberships WHERE id = ?').get(req.params.id) as any;
  if (!target) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  const actor = getMemberContext(target.mess_id, ctx.user.id);
  if (!actor || (actor.role !== 'owner' && !actor.permissions.manageMembers)) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }

  const { role, status, monthlyRent, notes, permissions } = req.body || {};
  const nextRole = role || target.role;
  const nextStatus = status || target.status;
  const nextRent = monthlyRent !== undefined ? Number(monthlyRent) : target.monthly_rent;
  const nextPerms = permissions
    ? JSON.stringify(permissions)
    : role && role !== target.role
      ? JSON.stringify(defaultPermissionsForRole(nextRole))
      : target.permissions_json;

  db.prepare(
    'UPDATE mess_memberships SET role = ?, status = ?, monthly_rent = ?, notes = ?, permissions_json = ? WHERE id = ?'
  ).run(nextRole, nextStatus, nextRent, notes !== undefined ? String(notes) : target.notes, nextPerms, target.id);

  logAudit({
    messId: target.mess_id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: 'member_updated',
    entityType: 'member',
    entityId: target.id,
    details: `Updated member role=${nextRole}, status=${nextStatus}, rent=৳${nextRent}`,
  });
  res.json({ ok: true });
});

app.post('/api/rooms', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId, building, floor, roomNumber, capacity, defaultRent } = req.body || {};
  const actor = getMemberContext(messId, ctx.user.id);
  if (!actor || (actor.role !== 'owner' && !actor.permissions.manageMembers)) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }
  const cap = Math.max(1, Math.min(10, Number(capacity) || 2));
  const rent = Number(defaultRent) || 4000;
  const roomId = `rm-${crypto.randomUUID().slice(0, 8)}`;

  db.transaction(() => {
    db.prepare(
      'INSERT INTO rooms (id, mess_id, building, floor, room_number, capacity, default_rent) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(roomId, messId, building || 'Main Building', floor || '1st Floor', String(roomNumber), cap, rent);

    const labels = ['Bed A', 'Bed B', 'Bed C', 'Bed D', 'Bed E', 'Bed F', 'Bed G', 'Bed H', 'Bed I', 'Bed J'];
    const insertBed = db.prepare(
      'INSERT INTO beds (id, room_id, mess_id, bed_label, occupant_membership_id, monthly_rent) VALUES (?, ?, ?, ?, NULL, ?)'
    );
    for (let i = 0; i < cap; i++) {
      insertBed.run(`bed-${crypto.randomUUID().slice(0, 8)}`, roomId, messId, labels[i], rent);
    }
  })();
  res.status(201).json({ roomId });
});

app.post('/api/beds/assign', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId, bedId, membershipId } = req.body || {};
  const actor = getMemberContext(messId, ctx.user.id);
  if (!actor || (actor.role !== 'owner' && !actor.permissions.manageMembers)) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }
  const bed = db.prepare('SELECT * FROM beds WHERE id = ? AND mess_id = ?').get(bedId, messId) as any;
  if (!bed) {
    res.status(404).json({ error: 'Bed not found' });
    return;
  }

  db.transaction(() => {
    // Clear previous bed for this member if assigning
    if (membershipId) {
      db.prepare('UPDATE beds SET occupant_membership_id = NULL WHERE occupant_membership_id = ? AND mess_id = ?').run(membershipId, messId);
      db.prepare('UPDATE beds SET occupant_membership_id = ? WHERE id = ?').run(membershipId, bedId);
      db.prepare('UPDATE mess_memberships SET room_id = ?, bed_id = ?, monthly_rent = ? WHERE id = ?').run(
        bed.room_id,
        bedId,
        bed.monthly_rent,
        membershipId
      );
    } else {
      if (bed.occupant_membership_id) {
        db.prepare('UPDATE mess_memberships SET room_id = NULL, bed_id = NULL WHERE id = ?').run(bed.occupant_membership_id);
      }
      db.prepare('UPDATE beds SET occupant_membership_id = NULL WHERE id = ?').run(bedId);
    }
  })();

  res.json({ ok: true });
});

// ---------- NOTICES & SETTINGS ----------

app.post('/api/notices', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId, title, body, category, priority } = req.body || {};
  const actor = getMemberContext(messId, ctx.user.id);
  if (!actor || (actor.role !== 'owner' && !actor.permissions.manageNotices)) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }
  const id = `not-${crypto.randomUUID()}`;
  db.prepare(
    'INSERT INTO notices (id, mess_id, title, body, category, priority, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, messId, String(title).trim(), String(body).trim(), category || 'general', priority || 'normal', ctx.user.id, ctx.user.name, new Date().toISOString());

  logAudit({
    messId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: 'notice_published',
    entityType: 'notice',
    entityId: id,
    details: `Published notice: ${String(title).trim()}`,
  });
  res.status(201).json({ id });
});

app.post('/api/notices/:id/read', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  db.prepare('INSERT OR IGNORE INTO notice_reads (notice_id, user_id, read_at) VALUES (?, ?, ?)').run(
    req.params.id,
    ctx.user.id,
    new Date().toISOString()
  );
  res.json({ ok: true });
});

app.patch('/api/mess/settings', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const {
    messId,
    name,
    address,
    city,
    breakfastWeight,
    lunchWeight,
    dinnerWeight,
    mealBookingCutoffHour,
    mealCancelCutoffHour,
    guestMealRate,
    rentDistributionMode,
    utilityDistributionMode,
    requireExpenseApproval,
  } = req.body || {};

  const actor = getMemberContext(messId, ctx.user.id);
  if (!actor || actor.role !== 'owner') {
    res.status(403).json({ error: 'Only Mess Owner can modify mess settings' });
    return;
  }

  db.prepare(
    `UPDATE messes SET
      name = ?, address = ?, city = ?, breakfast_weight = ?, lunch_weight = ?, dinner_weight = ?,
      meal_booking_cutoff_hour = ?, meal_cancel_cutoff_hour = ?, guest_meal_rate = ?,
      rent_distribution_mode = ?, utility_distribution_mode = ?, require_expense_approval = ?
     WHERE id = ?`
  ).run(
    name,
    address,
    city,
    Number(breakfastWeight),
    Number(lunchWeight),
    Number(dinnerWeight),
    Number(mealBookingCutoffHour),
    Number(mealCancelCutoffHour),
    Number(guestMealRate),
    rentDistributionMode,
    utilityDistributionMode,
    requireExpenseApproval ? 1 : 0,
    messId
  );

  logAudit({
    messId,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name,
    action: 'settings_updated',
    entityType: 'mess',
    entityId: messId,
    details: 'Updated meal weights, cutoffs, and allocation configuration',
  });
  res.json({ ok: true });
});

// ---------- MONTHLY SETTLEMENT (CLOSING) ----------

app.post('/api/settlement/close', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  const { messId, monthKey, carryForwardBalances } = req.body || {};
  const actor = getMemberContext(messId, ctx.user.id);
  if (!actor || (actor.role !== 'owner' && !actor.permissions.closeMonth)) {
    res.status(403).json({ error: 'Only owner or authorized accountant can close the month' });
    return;
  }

  const existing = getMonthlySettlement(messId, monthKey);
  if (existing?.status === 'closed') {
    res.status(409).json({ error: 'This month is already closed and locked' });
    return;
  }

  const config = getMessConfig(messId)!;
  const members = getMessMembers(messId);
  const meals = getMessMeals(messId, monthKey);
  const expenses = getMessExpenses(messId, monthKey);
  const payments = getMessPayments(messId, monthKey);

  const breakdown = calculateMonthlyFinancials({
    monthKey,
    config,
    members,
    meals,
    expenses,
    payments,
  });

  const nowIso = new Date().toISOString();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO monthly_settlements (
        id, mess_id, month_key, status, total_bazar, total_meals, meal_rate,
        total_fixed_costs, total_deposits, snapshot_json, closed_by, closed_at
      ) VALUES (?, ?, ?, 'closed', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `set-${messId}-${monthKey}`,
      messId,
      monthKey,
      breakdown.totalBazarExpense,
      breakdown.totalMemberMeals,
      breakdown.mealRate,
      breakdown.totalRentExpense + breakdown.totalUtilityExpense + breakdown.totalOtherFixedExpense,
      breakdown.totalApprovedDeposits,
      JSON.stringify(breakdown),
      ctx.user.id,
      nowIso
    );

    db.prepare('UPDATE meal_records SET locked = 1 WHERE mess_id = ? AND meal_date LIKE ?').run(
      messId,
      `${monthKey}%`
    );

    if (carryForwardBalances) {
      const updBal = db.prepare('UPDATE mess_memberships SET previous_balance = ? WHERE id = ?');
      for (const ms of breakdown.memberSummaries) {
        updBal.run(ms.netBalance, ms.membershipId);
      }
    }

    logAudit({
      messId,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      action: 'month_closed',
      entityType: 'settlement',
      entityId: monthKey,
      details: `Closed ${monthKey} settlement at meal rate ৳${breakdown.mealRate.toFixed(2)}`,
    });
  })();

  res.json({ ok: true, breakdown });
});

// ---------- SUPER ADMIN ROUTES ----------

app.get('/api/admin/overview', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  if (ctx.user.platformRole !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin access required' });
    return;
  }
  const messes = db
    .prepare(
      `SELECT m.*,
        (SELECT COUNT(*) FROM mess_memberships mm WHERE mm.mess_id = m.id AND mm.status = 'active') as activeMembers,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses e WHERE e.mess_id = m.id AND e.approval_status = 'approved') as totalExpenses
       FROM messes m ORDER BY m.created_at DESC`
    )
    .all();
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const totalPaymentsVolume = (
    db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE status = 'approved'").get() as { s: number }
  ).s;

  res.json({
    messes,
    totalUsers,
    totalMesses: messes.length,
    totalPaymentsVolume,
  });
});

app.patch('/api/admin/mess/:id', requireAuth, (req, res) => {
  const ctx = (req as any).auth as AuthContext;
  if (ctx.user.platformRole !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin access required' });
    return;
  }
  const { planTier, isSuspended } = req.body || {};
  db.prepare('UPDATE messes SET plan_tier = COALESCE(?, plan_tier), is_suspended = COALESCE(?, is_suspended) WHERE id = ?').run(
    planTier || null,
    isSuspended !== undefined ? (isSuspended ? 1 : 0) : null,
    req.params.id
  );
  res.json({ ok: true });
});

// ---------- SERVER BOOTSTRAP ----------

async function start() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MessFlow server running at http://localhost:${PORT}`);
  });
}

start();
