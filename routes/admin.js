const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const router = express.Router();

const Admin = require('../models/Admin');
const Ban = require('../models/Ban');
const Important = require('../models/Important');
const Book = require('../models/Book');
const Note = require('../models/Note');
const Dars = require('../models/Dars');
const Dua = require('../models/Dua');
const AyatHadith = require('../models/AyatHadith');
const Surah = require('../models/Surah');
const Bibidh = require('../models/Bibidh');
const { requireAdmin } = require('../middleware/auth');
const { loginLimiter, adminWriteLimiter } = require('../middleware/security');
const { clearBanCache, normIp } = require('../middleware/ipBan');
const { flagEvent, getTopIps } = require('../middleware/traffic');
const SecurityEvent = require('../models/SecurityEvent');
const { validateBody } = require('../middleware/validate');

const net = require('net');

function escRegex(s) {
  return (s || '').toString().trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidIp(v) {
  const s = (v || '').toString().trim();
  if (net.isIP(s)) return s;
  return null;
}

function isId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ---------- Login / Logout ----------
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = (req.body.username || '').toString().trim().slice(0, 100);
    const password = (req.body.password || '').toString().slice(0, 200);
    if (!username || !password) {
      return res.status(400).render('admin/login', { error: 'ইউজারনেম ও পাসওয়ার্ড দিন।' });
    }
    // 1) DB থেকে খোঁজো (Admin Panel থেকে পরিবর্তিত মান)
    let admin = await Admin.findOne({ username });
    let ok = false;
    if (admin && password) {
      ok = await admin.comparePassword(password);
    } else if (!admin) {
      // 2) Fallback: .env (প্রথমবার / DB খালি থাকলে)
      if (
        username === (process.env.ADMIN_USERNAME || 'admin') &&
        password === (process.env.ADMIN_PASSWORD || 'admin123')
      ) {
        ok = true;
        await Admin.ensureDefaultAdmin();
        admin = await Admin.findOne({ username });
      }
    }
    if (ok && admin) {
      req.session.regenerate(err => {
        if (err) return next(err);
        req.session.admin = { id: admin._id, username: admin.username };
        return req.session.save(() => res.redirect('/admin'));
      });
      return;
    }
    flagEvent({
      ip: (req.clientIp || req.ip || '').toString().replace(/^::ffff:/i, ''),
      kind: 'login-fail',
      path: '/admin/login',
      method: 'POST',
      userAgent: req.get('user-agent') || '',
      status: 401
    });
    res.status(401).render('admin/login', { error: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
  } catch (err) {
    next(err);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ---------- Dashboard (remake: stats + recent + live attacks + system) ----------
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const [cImportant, cBook, cNote, cDars, cDua, cAyatHadith, cSurah, cBibidh, cBan] = await Promise.all([
      Important.countDocuments(),
      Book.countDocuments(),
      Note.countDocuments(),
      Dars.countDocuments(),
      Dua.countDocuments(),
      AyatHadith.countDocuments(),
      Surah.countDocuments(),
      Bibidh.countDocuments(),
      Ban.countDocuments()
    ]);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentB, recentN, recentDars, recentDua, recentAyat, recentSurah, recentBibidh, recentImp, events24h] = await Promise.all([
      Book.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      Note.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      Dars.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      Dua.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      AyatHadith.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      Surah.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      Bibidh.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      Important.find().sort({ createdAt: -1 }).limit(2).select('title createdAt').lean().catch(() => []),
      SecurityEvent.countDocuments({ createdAt: { $gte: since24h } }).catch(() => 0)
    ]);
    const recent = [
      ...recentB.map(r => ({ type: 'বই', title: r.title, when: r.createdAt, adminUrl: '/admin/books' })),
      ...recentN.map(r => ({ type: 'নোট', title: r.title, when: r.createdAt, adminUrl: '/admin/notes' })),
      ...recentDars.map(r => ({ type: 'দারস', title: r.title, when: r.createdAt, adminUrl: '/admin/dars' })),
      ...recentDua.map(r => ({ type: 'দুআ', title: r.title, when: r.createdAt, adminUrl: '/admin/duas' })),
      ...recentAyat.map(r => ({ type: 'আয়াত-হাদিস', title: r.title, when: r.createdAt, adminUrl: '/admin/ayathadith' })),
      ...recentSurah.map(r => ({ type: 'সূরা', title: r.title, when: r.createdAt, adminUrl: '/admin/surah' })),
      ...recentBibidh.map(r => ({ type: 'বিবিধ', title: r.title, when: r.createdAt, adminUrl: '/admin/bibidh' })),
      ...recentImp.map(r => ({ type: 'তথ্য', title: r.title, when: r.createdAt, adminUrl: '/admin/importants' }))
    ]
      .sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0))
      .slice(0, 8);
    const topIps = getTopIps(5);
    const mem = process.memoryUsage();
    const upSec = Math.floor(process.uptime());
    const sys = {
      db: mongoose.connection.readyState === 1 ? 'up' : 'down',
      uptime: upSec >= 3600 ? `${Math.floor(upSec / 3600)}ঘ ${Math.floor((upSec % 3600) / 60)}মি` : upSec >= 60 ? `${Math.floor(upSec / 60)} মিনিট` : `${upSec} সেকেন্ড`,
      mem: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      node: process.version
    };
    res.render('admin/dashboard', {
      admin: req.session.admin,
      counts: { important: cImportant, book: cBook, note: cNote, dars: cDars, dua: cDua, ayatHadith: cAyatHadith, surah: cSurah, bibidh: cBibidh, ban: cBan },
      recent,
      topIps,
      events24h,
      sys
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Global search (সব কনটেন্টে একসাথে খোঁজো) ----------
router.get('/search', requireAdmin, async (req, res, next) => {
  try {
    const q = escRegex(req.query.q);
    if (!q) return res.redirect('/admin');
    const rx = new RegExp(q, 'i');
    const [books, notes, dars, duas, importants] = await Promise.all([
      Book.find({ $or: [{ title: rx }, { author: rx }] }).limit(20).select('title author').lean().catch(() => []),
      Note.find({ $or: [{ title: rx }, { content: rx }] }).limit(20).select('title').lean().catch(() => []),
      Dars.find({ $or: [{ title: rx }, { content: rx }] }).limit(20).select('title').lean().catch(() => []),
      Dua.find({ $or: [{ title: rx }, { content: rx }] }).limit(20).select('title').lean().catch(() => []),
      Important.find({ $or: [{ title: rx }, { description: rx }] }).limit(20).select('title').lean().catch(() => [])
    ]);
    res.render('admin/search', {
      admin: req.session.admin,
      q: req.query.q,
      results: { books, notes, dars, duas, importants }
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Export / backup (JSON download) ----------
router.get('/export/:type', requireAdmin, async (req, res, next) => {
  try {
    const t = req.params.type;
    const send = (name, docs) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="jela-hrd-${name}-${new Date().toISOString().slice(0, 10)}.json"`);
      res.send(JSON.stringify(docs, null, 2));
    };
    if (t === 'security') {
      const events = await SecurityEvent.find().sort({ createdAt: -1 }).limit(2000).lean();
      return send('security-events', events);
    }
    if (t === 'all') {
      const [books, notes, dars, duas, importants, bans] = await Promise.all([
        Book.find().limit(2000).lean(),
        Note.find().limit(2000).lean(),
        Dars.find().limit(2000).lean(),
        Dua.find().limit(2000).lean(),
        Important.find().limit(2000).lean(),
        Ban.find().lean()
      ]);
      return send('backup', { books, notes, dars, duas, importants, bans, exportedAt: new Date() });
    }
    return res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

// ---------- Security center (কে আক্রমণ করছে দেখো + এক ক্লিকে ব্যান) ----------
router.get('/security', requireAdmin, async (req, res, next) => {
  try {
    const live = getTopIps(50);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let offenders = [];
    let events = [];
    if (mongoose.connection.readyState === 1) {
      try {
        offenders = await SecurityEvent.aggregate([
          { $match: { createdAt: { $gte: since24h } } },
          {
            $group: {
              _id: '$ip',
              count: { $sum: 1 },
              kinds: { $addToSet: '$kind' },
              lastSeen: { $max: '$createdAt' }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 50 },
          { $project: { _id: 0, ip: '$_id', count: 1, kinds: 1, lastSeen: 1 } }
        ]);
        events = await SecurityEvent.find().sort({ createdAt: -1 }).limit(100).lean();
      } catch {
        offenders = [];
        events = [];
      }
    }
    const bannedIps = await Ban.find().select('ip').lean().catch(() => []);
    res.render('admin/security', {
      admin: req.session.admin,
      live,
      offenders,
      events,
      bannedIps,
      bannedSet: new Set(bannedIps.map(b => normIp(b.ip))),
      myIp: req.clientIp || '',
      error: null,
      success: req.query.banned ? 'IP ব্যান করা হয়েছে।' : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/security/clear', requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await SecurityEvent.deleteMany({});
    }
    res.redirect('/admin/security');
  } catch (err) {
    next(err);
  }
});

// ---------- Generic CRUD (importants/books/notes) ----------
function crudRoutes({ path, Model, viewPrefix, kind }) {
  router.get(`/${path}`, requireAdmin, async (req, res, next) => {
    try {
      const items = await Model.find().sort({ createdAt: -1 }).limit(500).lean();
      res.render(`admin/${viewPrefix}-list`, { items, admin: req.session.admin });
    } catch (err) {
      next(err);
    }
  });
  router.get(`/${path}/new`, requireAdmin, (req, res) => {
    res.render(`admin/${viewPrefix}-form`, { item: {}, admin: req.session.admin, error: null });
  });
  router.post(`/${path}`, requireAdmin, adminWriteLimiter, async (req, res, next) => {
    const { errors, data } = validateBody(kind, req.body);
    if (errors.length) {
      return res.status(400).render(`admin/${viewPrefix}-form`, {
        item: req.body, admin: req.session.admin, error: errors.join(' ')
      });
    }
    try {
      await Model.create(data);
      res.redirect(`/admin/${path}`);
    } catch (e) {
      res.status(400).render(`admin/${viewPrefix}-form`, {
        item: req.body, admin: req.session.admin, error: e.message
      });
    }
  });
  router.get(`/${path}/:id/edit`, requireAdmin, async (req, res, next) => {
    try {
      if (!isId(req.params.id)) return res.redirect(`/admin/${path}`);
      const item = await Model.findById(req.params.id).lean();
      if (!item) return res.redirect(`/admin/${path}`);
      res.render(`admin/${viewPrefix}-form`, { item, admin: req.session.admin, error: null });
    } catch (err) {
      next(err);
    }
  });
  router.post(`/${path}/:id`, requireAdmin, adminWriteLimiter, async (req, res, next) => {
    try {
      if (!isId(req.params.id)) return res.redirect(`/admin/${path}`);
      const { errors, data } = validateBody(kind, req.body);
      if (errors.length) {
        return res.status(400).render(`admin/${viewPrefix}-form`, {
          item: { ...req.body, _id: req.params.id }, admin: req.session.admin, error: errors.join(' ')
        });
      }
      await Model.findByIdAndUpdate(req.params.id, data, { runValidators: true });
      res.redirect(`/admin/${path}`);
    } catch (err) {
      next(err);
    }
  });
  router.post(`/${path}/:id/delete`, requireAdmin, adminWriteLimiter, async (req, res, next) => {
    try {
      if (!isId(req.params.id)) return res.redirect(`/admin/${path}`);
      await Model.findByIdAndDelete(req.params.id);
      res.redirect(`/admin/${path}`);
    } catch (err) {
      next(err);
    }
  });
}

crudRoutes({ path: 'importants', Model: Important, viewPrefix: 'important', kind: 'important' });
crudRoutes({ path: 'books', Model: Book, viewPrefix: 'book', kind: 'book' });
crudRoutes({ path: 'notes', Model: Note, viewPrefix: 'note', kind: 'note' });
crudRoutes({ path: 'dars', Model: Dars, viewPrefix: 'dars', kind: 'dars' });
crudRoutes({ path: 'duas', Model: Dua, viewPrefix: 'dua', kind: 'dua' });
crudRoutes({ path: 'ayathadith', Model: AyatHadith, viewPrefix: 'ayathadith', kind: 'ayathadith' });
crudRoutes({ path: 'surah', Model: Surah, viewPrefix: 'surah', kind: 'surah' });
crudRoutes({ path: 'bibidh', Model: Bibidh, viewPrefix: 'bibidh', kind: 'bibidh' });

// ---------- IP Bans (নিরাপত্তা — IP ব্যান / মুক্ত) ----------

// ---------- IP Bans (নিরাপত্তা — IP ব্যান / মুক্ত) ----------
router.get('/bans', requireAdmin, async (req, res, next) => {
  try {
    const items = await Ban.find().sort({ createdAt: -1 }).lean();
    res.render('admin/ban-list', {
      items, admin: req.session.admin, error: null, success: null, myIp: req.clientIp || '', prefill: (req.query.ip || '').toString().slice(0, 100)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/bans', requireAdmin, adminWriteLimiter, async (req, res) => {
  const raw = (req.body.ip || '').toString();
  const reason = (req.body.reason || '').toString().trim().slice(0, 300);
  const valid = isValidIp(raw);
  const afterBan = (req.get('referer') || '').includes('/admin/security') ? '/admin/security?banned=1' : '/admin/bans';
  const renderErr = async (msg) => {
    const items = await Ban.find().sort({ createdAt: -1 }).lean();
    // Security center থেকে এলে সেখানেই error দেখাও
    if ((req.get('referer') || '').includes('/admin/security')) {
      const live = getTopIps(50);
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let offenders = [];
      let events = [];
      try {
        offenders = await SecurityEvent.aggregate([
          { $match: { createdAt: { $gte: since24h } } },
          { $group: { _id: '$ip', count: { $sum: 1 }, kinds: { $addToSet: '$kind' }, lastSeen: { $max: '$createdAt' } } },
          { $sort: { count: -1 } },
          { $limit: 50 },
          { $project: { _id: 0, ip: '$_id', count: 1, kinds: 1, lastSeen: 1 } }
        ]);
        events = await SecurityEvent.find().sort({ createdAt: -1 }).limit(100).lean();
      } catch { /* ignore */ }
      const bannedIps = items;
      return res.status(400).render('admin/security', {
        admin: req.session.admin, live, offenders, events, bannedIps,
        bannedSet: new Set(bannedIps.map(b => normIp(b.ip))),
        myIp: req.clientIp || '', error: msg, success: null
      });
    }
    res.status(400).render('admin/ban-list', {
      items, admin: req.session.admin, error: msg, success: null, myIp: req.clientIp || '', prefill: raw
    });
  };
  if (!valid) return renderErr('সঠিক IPv4/IPv6 ঠিকানা দিন।');
  if (normIp(valid) === normIp(req.clientIp)) return renderErr('নিজের IP ব্যান করা যাবে না!');
  try {
    await Ban.create({ ip: normIp(valid), reason });
    clearBanCache(); // সঙ্গে সঙ্গে কার্যকর
    res.redirect(afterBan);
  } catch (e) {
    if (e.code === 11000) return renderErr('এই IP আগেই ব্যান করা আছে।');
    return renderErr(e.message);
  }
});

router.post('/bans/:id/delete', requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.redirect('/admin/bans');
    await Ban.findByIdAndDelete(req.params.id);
    clearBanCache();
    res.redirect('/admin/bans');
  } catch (err) {
    next(err);
  }
});

// ---------- Change credentials (.env মান Admin Panel থেকে পরিবর্তন) ----------
router.get('/settings', requireAdmin, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.session.admin.id).lean();
    if (!admin) return res.redirect('/admin/login');
    res.render('admin/settings', { admin, error: null, success: null });
  } catch (err) {
    next(err);
  }
});

router.post('/settings', requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    const username = (req.body.username || '').toString().trim().slice(0, 100);
    const currentPassword = (req.body.currentPassword || '').toString().slice(0, 500);
    const newPassword = (req.body.newPassword || '').toString().slice(0, 500);
    const admin = await Admin.findById(req.session.admin.id);
    if (!admin) return res.redirect('/admin/login');

    const ok = await admin.comparePassword(currentPassword);
    if (!ok) {
      return res.status(400).render('admin/settings', {
        admin: admin.toObject(), error: 'বর্তমান পাসওয়ার্ড ভুল!', success: null
      });
    }
    if (!username || username.length < 3) {
      return res.status(400).render('admin/settings', {
        admin: admin.toObject(), error: 'ইউজারনেম কমপক্ষে ৩ অক্ষর হতে হবে।', success: null
      });
    }
    admin.username = username;
    if (newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return res.status(400).render('admin/settings', {
          admin: admin.toObject(), error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।', success: null
        });
      }
      admin.password = await bcrypt.hash(newPassword.trim(), 12);
    }
    admin.updatedAt = new Date();
    await admin.save();
    req.session.admin.username = admin.username;
    res.render('admin/settings', {
      admin: admin.toObject(), error: null, success: 'সফলভাবে আপডেট হয়েছে! এখন থেকে নতুন লগিন ব্যবহার হবে।'
    });
  } catch (err) {
    if (err && err.code === 11000) {
      try {
        const admin = await Admin.findById(req.session.admin.id).lean();
        return res.status(400).render('admin/settings', {
          admin: admin || { username: req.body.username }, error: 'এই ইউজারনেম আগেই ব্যবহৃত হচ্ছে।', success: null
        });
      } catch {
        return next(err);
      }
    }
    return next(err);
  }
});

module.exports = router;
