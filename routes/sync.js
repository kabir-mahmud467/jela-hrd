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
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
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
const { validateBody } = require('../middleware/validate');

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

// ---------- App admin: full content CRUD (same power as the site panel) ----------
// type: books|audiobooks|notes|dars|duas|ayathadith|surah|bibidh
const CONTENT_MODELS = {
  books: Book, audiobooks: Audiobook, notes: Note, dars: Dars,
  duas: Dua, ayathadith: AyatHadith, surah: Surah, bibidh: Bibidh
};
const CONTENT_KINDS = {
  books: 'book', audiobooks: 'audiobook', notes: 'note', dars: 'dars',
  duas: 'dua', ayathadith: 'ayathadith', surah: 'surah', bibidh: 'bibidh'
};
// Site parity: new items go last for duas/surah/ayathadith, first otherwise.
const APPEND_LAST = { duas: 1, surah: 1, ayathadith: 1 };

function contentModel(type) {
  return CONTENT_MODELS[type] || null;
}
function isId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.get('/admin/content', requireAdminToken, async (req, res) => {
  try {
    const type = String(req.query.type || '');
    const Model = contentModel(type);
    if (!Model) return res.status(400).json({ error: 'bad-type' });
    const items = await Model.find().sort(SORT).limit(CAP).lean();
    res.json({ type, items });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.post('/admin/content', requireAdminToken, async (req, res) => {
  try {
    const type = String((req.body || {}).type || '');
    const Model = contentModel(type);
    if (!Model) return res.status(400).json({ error: 'bad-type' });
    const { errors, data } = validateBody(CONTENT_KINDS[type], (req.body || {}).data || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    try {
      const edge = await Model.findOne().sort({ order: APPEND_LAST[type] ? -1 : 1 }).select('order').lean();
      const edgeOrder = edge && typeof edge.order === 'number' ? edge.order : 0;
      data.order = APPEND_LAST[type] ? edgeOrder + 1 : edgeOrder - 1;
    } catch {
      data.order = 0;
    }
    const doc = await Model.create(data);
    res.json({ ok: true, item: doc });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.post('/admin/content/update', requireAdminToken, async (req, res) => {
  try {
    const body = req.body || {};
    const type = String(body.type || '');
    const Model = contentModel(type);
    const id = String(body.id || '');
    if (!Model || !isId(id)) return res.status(400).json({ error: 'bad-request' });
    const { errors, data } = validateBody(CONTENT_KINDS[type], body.data || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    await Model.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { runValidators: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.post('/admin/content/delete', requireAdminToken, async (req, res) => {
  try {
    const body = req.body || {};
    const type = String(body.type || '');
    const Model = contentModel(type);
    if (!Model) return res.status(400).json({ error: 'bad-type' });
    const raw = Array.isArray(body.ids) ? body.ids : [body.id];
    const ids = [];
    const seen = {};
    for (let k = 0; k < raw.length && ids.length < 500; k++) {
      const id = String(raw[k] || '').trim();
      if (id && isId(id) && !seen[id]) { seen[id] = 1; ids.push(id); }
    }
    if (!ids.length) return res.status(400).json({ error: 'no-ids' });
    await Model.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

// Reorder a whole section in one save (site parity: single bulkWrite).
router.post('/admin/content/reorder', requireAdminToken, async (req, res) => {
  try {
    const body = req.body || {};
    const type = String(body.type || '');
    const Model = contentModel(type);
    if (!Model) return res.status(400).json({ error: 'bad-type' });
    const raw = Array.isArray(body.ids) ? body.ids : String(body.ids || '').split(',');
    const seen = {};
    const seq = [];
    for (let k = 0; k < raw.length && seq.length < 500; k++) {
      const id = String(raw[k] || '').trim();
      if (id && isId(id) && !seen[id]) { seen[id] = 1; seq.push(id); }
    }
    if (seq.length) {
      await Model.bulkWrite(
        seq.map((one, n) => ({ updateOne: { filter: { _id: one }, update: { $set: { order: n } } } }))
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

// ---------- App admin: users (create + delete; list exists above) ----------
router.post('/admin/users', requireAdminToken, async (req, res) => {
  try {
    const { errors, data } = validateBody('user', (req.body || {}).data || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const hashed = await bcrypt.hash(data.password, 12);
    try {
      const u = await User.create({ username: data.username, name: data.name, phone: data.phone, password: hashed });
      res.json({ ok: true, user: { username: u.username, name: u.name, phone: u.phone } });
    } catch (e) {
      if (e.code === 11000) return res.status(400).json({ error: 'এই ইউজারনেম আগেই ব্যবহৃত হচ্ছে।' });
      throw e;
    }
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

router.post('/admin/users/delete', requireAdminToken, async (req, res) => {
  try {
    const id = String((req.body || {}).id || '');
    if (!isId(id)) return res.status(400).json({ error: 'bad-id' });
    await User.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

// ---------- App user: change own password ----------
// Stored passwords are hashed — they can never be displayed, only changed.
router.post('/user/password', async (req, res) => {
  try {
    const t = tokenOf(req);
    if (!t) return res.status(401).json({ error: 'no-token' });
    const user = await User.findOne({ apiToken: t });
    if (!user) return res.status(401).json({ error: 'bad-token' });
    const cur = ((req.body || {}).currentPassword || '').toString().slice(0, 200);
    const next = ((req.body || {}).newPassword || '').toString().slice(0, 200);
    if (!(await user.comparePassword(cur))) {
      return res.status(400).json({ error: 'বর্তমান পাসওয়ার্ড ভুল!' });
    }
    if (next.trim().length < 4) {
      return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষর হতে হবে।' });
    }
    user.password = await bcrypt.hash(next.trim(), 12);
    user.apiToken = crypto.randomBytes(32).toString('hex');
    user.updatedAt = new Date();
    await user.save();
    res.json({ ok: true, token: user.apiToken });
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

module.exports = router;
