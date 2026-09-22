// Native APK sync API — offline-first app pulls this when online.
// GET /api/content.json        full public snapshot {version, checklist, books, ...}
// GET /api/content.json?check=1  light version probe {version, counts}
// version = total + ':' + max(createdAt, updatedAt) — EDIT-ও version বদলায়,
// তাই এডিটের পর অ্যাপ "আপডেট আছে" দেখে ও নতুন কন্টেন্ট টানে (আগে শুধু
// createdAt দেখত বলে এডিট sync হতো না)।
// App auth (in-app login, no outside URL — offline reader XHR calls these
// when online; content stays offline):
//   POST /api/user/login {username,password} -> {token, user}
//   GET  /api/user/me?token=...             -> {user}
//   POST /api/user/progress {token,progress} -> {ok, progress}
//   POST /api/admin/login {username,password} -> {token}
//   GET  /api/admin/users?token=...          -> {users}
//   GET  /api/admin/overview?token=...       -> {counts}
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const Book = require('../models/Book');
const Audiobook = require('../models/Audiobook');
const Note = require('../models/Note');
const Dars = require('../models/Dars');
const Dua = require('../models/Dua');
const Bibidh = require('../models/Bibidh');
const Surah = require('../models/Surah');
const AyatHadith = require('../models/AyatHadith');
const User = require('../models/User');
const Admin = require('../models/Admin');
const checklistData = require('../config/checklist');
const userRouteMod = require('./user');

// file:// origin (APK WebView) থেকে XHR আসে — CORS খোলা রাখো (public data + token auth)
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const CAP = 500;
const SORT = { order: 1, createdAt: -1 };

function maxTime(arr) {
  let latest = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i];
    if (!d) continue;
    const t1 = d.createdAt ? new Date(d.createdAt).getTime() : 0;
    // পুরনো ডকুমেন্টে updatedAt নাও থাকতে পারে — তখন createdAt-ই ধরা হয়
    const t2 = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
    const t = t2 > t1 ? t2 : t1;
    if (t > latest) latest = t;
  }
  return latest;
}

async function snapshot() {
  const [books, audiobooks, notes, dars, duas, ayathadith, surah, bibidh] = await Promise.all([
    Book.find().sort(SORT).limit(CAP)
      .select('title author link description category phase order createdAt updatedAt').lean(),
    Audiobook.find().sort(SORT).limit(CAP)
      .select('title author audioLink phase order createdAt updatedAt').lean(),
    Note.find().sort(SORT).limit(CAP)
      .select('title subject content category phase order createdAt updatedAt').lean(),
    Dars.find().sort(SORT).limit(CAP)
      .select('title content phase reference order createdAt updatedAt').lean(),
    Dua.find().sort(SORT).limit(CAP)
      .select('title arabic transliteration content phase reference order createdAt updatedAt').lean(),
    AyatHadith.find().sort(SORT).limit(CAP)
      .select('title arabic transliteration translation reference phase kind topic order createdAt updatedAt').lean(),
    Surah.find().sort(SORT).limit(CAP)
      .select('title arabic transliteration translation reference phase ayahCount order createdAt updatedAt').lean(),
    Bibidh.find().sort(SORT).limit(CAP)
      .select('title content category reference order createdAt updatedAt').lean()
  ]);
  const cols = { books, audiobooks, notes, dars, duas, ayathadith, surah, bibidh };
  let total = 0;
  let latest = 0;
  Object.keys(cols).forEach((k) => {
    const arr = cols[k] || [];
    total += arr.length;
    const m = maxTime(arr);
    if (m > latest) latest = m;
  });
  const counts = {};
  Object.keys(cols).forEach((k) => { counts[k] = (cols[k] || []).length; });
  return {
    v: 1,
    version: total + ':' + latest,
    exportedAt: new Date().toISOString(),
    counts,
    checklist: checklistData,
    books, audiobooks, notes, dars, duas, ayathadith, surah, bibidh
  };
}

router.get('/content.json', async (req, res) => {
  try {
    const data = await snapshot();
    res.set('Cache-Control', 'no-store');
    if (req.query.check) {
      return res.json({ v: 1, version: data.version, counts: data.counts });
    }
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

// ---------- App auth (token) ----------

function tokenOf(req) {
  if (req.body && req.body.token) return String(req.body.token).slice(0, 100);
  if (req.query && req.query.token) return String(req.query.token).slice(0, 100);
  const h = req.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].slice(0, 100);
  return '';
}

router.post('/user/login', async (req, res) => {
  try {
    const username = (req.body.username || '').toString().trim().slice(0, 30);
    const password = (req.body.password || '').toString().slice(0, 200);
    if (!username || !password) return res.status(400).json({ error: 'missing-credentials' });
    const user = await User.findOne({ username });
    const ok = user && password ? await user.comparePassword(password) : false;
    if (!ok || !user) return res.status(401).json({ error: 'invalid-login' });
    user.apiToken = crypto.randomBytes(32).toString('hex');
    user.updatedAt = new Date();
    await user.save();
    res.json({ token: user.apiToken, user: user.publicJSON() });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.get('/user/me', async (req, res) => {
  try {
    const t = tokenOf(req);
    if (!t) return res.status(401).json({ error: 'no-token' });
    const user = await User.findOne({ apiToken: t }).lean();
    if (!user) return res.status(401).json({ error: 'bad-token' });
    res.json({
      user: {
        username: user.username,
        name: user.name || '',
        phone: user.phone || '',
        progress: user.progress || {},
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.post('/user/progress', async (req, res) => {
  try {
    const t = tokenOf(req);
    if (!t) return res.status(401).json({ error: 'no-token' });
    const user = await User.findOne({ apiToken: t });
    if (!user) return res.status(401).json({ error: 'bad-token' });
    const clean = userRouteMod.sanitizeProgress
      ? userRouteMod.sanitizeProgress(req.body.progress)
      : (req.body.progress || {});
    user.progress = clean;
    user.updatedAt = new Date();
    await user.save();
    res.json({ ok: true, progress: clean });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.post('/admin/login', async (req, res) => {
  try {
    const username = (req.body.username || '').toString().trim().slice(0, 100);
    const password = (req.body.password || '').toString().slice(0, 200);
    if (!username || !password) return res.status(400).json({ error: 'missing-credentials' });
    const admin = await Admin.findOne({ username });
    const ok = admin && password ? await admin.comparePassword(password) : false;
    if (!ok || !admin) return res.status(401).json({ error: 'invalid-login' });
    admin.apiToken = crypto.randomBytes(32).toString('hex');
    admin.updatedAt = new Date();
    await admin.save();
    res.json({ token: admin.apiToken, username: admin.username });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

async function requireAdminToken(req, res, next) {
  try {
    const t = tokenOf(req);
    if (!t) return res.status(401).json({ error: 'no-token' });
    const admin = await Admin.findOne({ apiToken: t }).lean();
    if (!admin) return res.status(401).json({ error: 'bad-token' });
    req.apiAdmin = admin;
    next();
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
}

// Admin panel (app built-in): users + progress overview
router.get('/admin/users', requireAdminToken, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(500)
      .select('username name phone progress updatedAt').lean();
    res.json({ users });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.get('/admin/overview', requireAdminToken, async (req, res) => {
  try {
    const [books, audiobooks, notes, dars, duas, ayathadith, surah, bibidh, users] = await Promise.all([
      Book.countDocuments().catch(() => 0),
      Audiobook.countDocuments().catch(() => 0),
      Note.countDocuments().catch(() => 0),
      Dars.countDocuments().catch(() => 0),
      Dua.countDocuments().catch(() => 0),
      AyatHadith.countDocuments().catch(() => 0),
      Surah.countDocuments().catch(() => 0),
      Bibidh.countDocuments().catch(() => 0),
      User.countDocuments().catch(() => 0)
    ]);
    res.json({ counts: { books, audiobooks, notes, dars, duas, ayathadith, surah, bibidh, users } });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

module.exports = router;
