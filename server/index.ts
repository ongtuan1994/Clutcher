import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { BillingCycle, ReconciliationStatus } from '@prisma/client';
import { prisma } from './lib/prisma.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from './lib/auth.js';
import { totalMonthlySubscriptionSpend } from './lib/money.js';
import { avatarPublicUrl, skyAssetPublicUrl } from './lib/assetUrls.js';
import { deleteObject as deleteGcsObject, isGcsConfigured, writeObject as writeGcsObject } from './lib/gcsUpload.js';
import { mapDatabaseError } from './lib/dbErrors.js';

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.DATABASE_URL?.trim()) {
  console.warn('[db] DATABASE_URL is missing. Set it in .env (see .env.example). Auth and API calls will fail until then.');
}
const app = express();

const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
const skyDir = path.join(process.cwd(), 'uploads', 'sky');
if (!isGcsConfigured()) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(skyDir, { recursive: true });
}

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: 'connected' });
  } catch (e) {
    const mapped = mapDatabaseError(e);
    res.status(503).json({
      ok: false,
      database: 'disconnected',
      error: mapped?.error ?? (e instanceof Error ? e.message : 'Database check failed'),
    });
  }
});

const imageFilter = (_req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
    cb(new Error('Only image uploads allowed'));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const skyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: imageFilter,
});

function safeImageExt(originalName: string): string {
  const e = path.extname(originalName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(e)) return e;
  return '.jpg';
}

type AuthedRequest = express.Request & { userId?: string };

function authMiddleware(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload?.sub) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  req.userId = payload.sub;
  next();
}

function userPublic(u: {
  id: string;
  email: string;
  displayName: string | null;
  monthlyIncome: number;
  avatarFilename: string | null;
  isAdmin: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    monthlyIncome: u.monthlyIncome,
    avatarUrl: avatarPublicUrl(u.avatarFilename),
    isAdmin: u.isAdmin,
  };
}

const ADMIN_LOGIN_EMAIL = 'admin@clutcher.app';

async function ensureBootstrapAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_LOGIN_EMAIL } });
  if (!existing) {
    const passwordHash = await hashPassword('admin');
    await prisma.user.create({
      data: {
        email: ADMIN_LOGIN_EMAIL,
        passwordHash,
        displayName: 'Admin',
        isAdmin: true,
        monthlyIncome: 0,
      },
    });
    console.log(`[bootstrap] Admin user created: ${ADMIN_LOGIN_EMAIL} (password: admin; sign in as "admin" or full email)`);
  } else if (!existing.isAdmin) {
    await prisma.user.update({ where: { email: ADMIN_LOGIN_EMAIL }, data: { isAdmin: true } });
  }
}

function statusLabel(s: ReconciliationStatus): 'Balanced' | 'Adjusted' | 'Perfect Match' {
  if (s === 'PerfectMatch') return 'Perfect Match';
  return s;
}

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = req.body?.displayName ? String(req.body.displayName).trim() : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    if (email === ADMIN_LOGIN_EMAIL) {
      res.status(403).json({ error: 'This email is reserved' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName: displayName || null },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: userPublic(user) });
  } catch (e) {
    console.error('[auth/register]', e);
    const mapped = mapDatabaseError(e);
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.error });
      return;
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    let email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    if (email === 'admin') {
      email = ADMIN_LOGIN_EMAIL;
    }
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken(user.id);
    res.json({ token, user: userPublic(user) });
  } catch (e) {
    console.error('[auth/login]', e);
    const mapped = mapDatabaseError(e);
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.error });
      return;
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: userPublic(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// --- Profile ---
app.patch('/api/profile', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const displayName =
      req.body?.displayName !== undefined ? String(req.body.displayName).trim() || null : undefined;
    const monthlyIncome =
      req.body?.monthlyIncome !== undefined ? Number(req.body.monthlyIncome) : undefined;

    if (monthlyIncome !== undefined && (Number.isNaN(monthlyIncome) || monthlyIncome < 0)) {
      res.status(400).json({ error: 'Invalid monthly income' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(monthlyIncome !== undefined && { monthlyIncome }),
      },
    });
    res.json({ user: userPublic(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.post(
  '/api/profile/avatar',
  authMiddleware,
  (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Upload failed' });
        return;
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    try {
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer) {
        res.status(400).json({ error: 'No file' });
        return;
      }

      const ext = safeImageExt(file.originalname);
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

      const prev = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { avatarFilename: true },
      });
      if (prev?.avatarFilename) {
        if (isGcsConfigured()) {
          await deleteGcsObject(`avatars/${prev.avatarFilename}`);
        } else {
          const oldPath = path.join(uploadsDir, prev.avatarFilename);
          fs.unlink(oldPath, () => {});
        }
      }

      if (isGcsConfigured()) {
        await writeGcsObject(`avatars/${filename}`, file.buffer, file.mimetype);
      } else {
        fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
      }

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: { avatarFilename: filename },
      });
      res.json({ user: userPublic(user) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Avatar update failed' });
    }
  },
);

// --- Subscriptions ---
app.get('/api/subscriptions', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase();
    const list = await prisma.subscription.findMany({
      where: {
        userId: req.userId!,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { category: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      subscriptions: list.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        amount: s.amount,
        billingCycle: s.billingCycle as BillingCycle,
        billingStart: s.billingStart.toISOString().slice(0, 10),
        icon: s.icon,
        archived: s.archived,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load subscriptions' });
  }
});

app.post('/api/subscriptions', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const category = String(req.body?.category || '').trim();
    const amount = Number(req.body?.amount);
    const billingCycle = req.body?.billingCycle as BillingCycle;
    const billingStart = String(req.body?.billingStart || '');
    const icon = String(req.body?.icon || 'palette').trim() || 'palette';

    if (!name || !category || Number.isNaN(amount) || amount < 0) {
      res.status(400).json({ error: 'Name, category, and valid amount required' });
      return;
    }
    if (!['Weekly', 'Monthly', 'Yearly'].includes(billingCycle)) {
      res.status(400).json({ error: 'Invalid billing cycle' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(billingStart)) {
      res.status(400).json({ error: 'billingStart must be YYYY-MM-DD' });
      return;
    }

    const s = await prisma.subscription.create({
      data: {
        userId: req.userId!,
        name,
        category,
        amount,
        billingCycle,
        billingStart: new Date(billingStart + 'T12:00:00'),
        icon,
      },
    });
    res.status(201).json({
      subscription: {
        id: s.id,
        name: s.name,
        category: s.category,
        amount: s.amount,
        billingCycle: s.billingCycle,
        billingStart: s.billingStart.toISOString().slice(0, 10),
        icon: s.icon,
        archived: s.archived,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

app.patch('/api/subscriptions/:id', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.subscription.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const billingStart =
      req.body?.billingStart !== undefined
        ? String(req.body.billingStart)
        : undefined;
    const s = await prisma.subscription.update({
      where: { id },
      data: {
        ...(req.body?.name !== undefined && { name: String(req.body.name).trim() }),
        ...(req.body?.category !== undefined && { category: String(req.body.category).trim() }),
        ...(req.body?.amount !== undefined && { amount: Number(req.body.amount) }),
        ...(req.body?.billingCycle !== undefined && {
          billingCycle: req.body.billingCycle as BillingCycle,
        }),
        ...(req.body?.icon !== undefined && { icon: String(req.body.icon) }),
        ...(req.body?.archived !== undefined && { archived: Boolean(req.body.archived) }),
        ...(billingStart !== undefined && {
          billingStart: new Date(billingStart + 'T12:00:00'),
        }),
      },
    });
    res.json({
      subscription: {
        id: s.id,
        name: s.name,
        category: s.category,
        amount: s.amount,
        billingCycle: s.billingCycle,
        billingStart: s.billingStart.toISOString().slice(0, 10),
        icon: s.icon,
        archived: s.archived,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/subscriptions/:id', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const r = await prisma.subscription.deleteMany({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (r.count === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// --- Reconciliation ---
function computeStatus(projected: number, real: number): ReconciliationStatus {
  const diff = Math.abs(real - projected);
  if (diff < 0.01) return 'PerfectMatch';
  if (real >= projected) return 'Balanced';
  return 'Adjusted';
}

app.get('/api/reconciliation', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const rows = await prisma.reconciliationRecord.findMany({
      where: { userId: req.userId! },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json({
      records: rows.map((r) => ({
        id: r.id,
        month: new Date(r.year, r.month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        year: r.year,
        monthNum: r.month,
        projected: r.projected,
        realBalance: r.realBalance,
        date: r.recordedAt.toISOString().slice(0, 10),
        status: statusLabel(r.status),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load reconciliation' });
  }
});

app.post('/api/reconciliation', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    const realBalance = Number(req.body?.realBalance);

    if (!year || !month || month < 1 || month > 12 || Number.isNaN(realBalance)) {
      res.status(400).json({ error: 'year, month (1-12), and realBalance required' });
      return;
    }

    const subs = await prisma.subscription.findMany({
      where: { userId: req.userId!, archived: false },
    });
    const projected = totalMonthlySubscriptionSpend(subs);

    const status = computeStatus(projected, realBalance);

    const row = await prisma.reconciliationRecord.upsert({
      where: {
        userId_year_month: {
          userId: req.userId!,
          year,
          month,
        },
      },
      create: {
        userId: req.userId!,
        year,
        month,
        projected,
        realBalance,
        status,
      },
      update: {
        projected,
        realBalance,
        status,
        recordedAt: new Date(),
      },
    });

    res.json({
      record: {
        id: row.id,
        month: new Date(row.year, row.month - 1, 1).toLocaleString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
        year: row.year,
        monthNum: row.month,
        projected: row.projected,
        realBalance: row.realBalance,
        date: row.recordedAt.toISOString().slice(0, 10),
        status: statusLabel(row.status),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save reconciliation' });
  }
});

// --- Analytics / dashboard summary ---
app.get('/api/analytics/summary', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const subs = await prisma.subscription.findMany({
      where: { userId: req.userId!, archived: false },
    });
    const monthlyTotal = totalMonthlySubscriptionSpend(subs);
    const yearlyProjected = monthlyTotal * 12;
    const income = user.monthlyIncome;
    const coverRatio = monthlyTotal > 0 ? income / monthlyTotal : null;

    const now = new Date();
    const flow: { month: string; income: number; subs: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      flow.push({ month: label, income, subs: monthlyTotal });
    }

    res.json({
      monthlySubscriptionTotal: monthlyTotal,
      yearlyProjected,
      monthlyIncome: income,
      incomeCoversTimes: coverRatio,
      flow,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// --- Trajectory for reconciliation chart (last 12 months of records + optional padding) ---
app.get('/api/analytics/trajectory', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const records = await prisma.reconciliationRecord.findMany({
      where: { userId: req.userId! },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 12,
    });
    const chronological = [...records].reverse();
    const subs = await prisma.subscription.findMany({
      where: { userId: req.userId!, archived: false },
    });
    const projected = totalMonthlySubscriptionSpend(subs);

    const points = chronological.map((r) => ({
      label: new Date(r.year, r.month - 1, 1).toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      real: r.realBalance,
      projected: r.projected,
    }));

    res.json({ points, defaultProjected: projected });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load trajectory' });
  }
});

// --- Public sky images (dashboard hero per score 0–10) ---
app.get('/api/sky-assets', async (_req, res) => {
  try {
    const rows = await prisma.skyAsset.findMany();
    const assets: Record<string, string | null> = {};
    for (let i = 0; i <= 10; i++) assets[String(i)] = null;
    for (const r of rows) {
      if (r.score >= 0 && r.score <= 10) {
        assets[String(r.score)] = skyAssetPublicUrl(r.filename);
      }
    }
    res.json({ assets });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load sky assets' });
  }
});

app.post(
  '/api/admin/sky-assets/:score',
  authMiddleware,
  (req, res, next) => {
    skyUpload.single('image')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Upload failed' });
        return;
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    try {
      const me = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!me?.isAdmin) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const score = parseInt(req.params.score, 10);
      if (!Number.isFinite(score) || score < 0 || score > 10) {
        res.status(400).json({ error: 'score must be 0–10' });
        return;
      }
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer) {
        res.status(400).json({ error: 'No file' });
        return;
      }
      const ext = safeImageExt(file.originalname);
      const filename = `sky-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

      const prev = await prisma.skyAsset.findUnique({ where: { score } });
      if (prev?.filename) {
        if (isGcsConfigured()) {
          await deleteGcsObject(`sky/${prev.filename}`);
        } else {
          const oldPath = path.join(skyDir, prev.filename);
          fs.unlink(oldPath, () => {});
        }
      }

      if (isGcsConfigured()) {
        await writeGcsObject(`sky/${filename}`, file.buffer, file.mimetype);
      } else {
        fs.writeFileSync(path.join(skyDir, filename), file.buffer);
      }

      await prisma.skyAsset.upsert({
        where: { score },
        create: { score, filename },
        update: { filename },
      });
      res.json({ score, url: skyAssetPublicUrl(filename) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Upload failed' });
    }
  },
);

// --- Static SPA in production ---
const dist = path.join(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendFile(path.join(dist, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  void (async () => {
    try {
      await prisma.$connect();
      console.log('[db] Prisma connected');
    } catch (e) {
      console.error('[db] Prisma could not connect:', e);
      console.error(
        '[db] Fix: set DATABASE_URL in .env, start PostgreSQL (`docker compose up -d`), then run `npx prisma migrate deploy`.',
      );
    }
    await ensureBootstrapAdmin().catch((e) => console.error('[bootstrap]', e));
  })();
  console.log(`API listening on http://localhost:${PORT}`);
});
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use (another dev server or app). Close that process or set a different PORT in .env.`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
