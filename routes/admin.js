const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const router = express.Router();

const Admin = require('../models/Admin');
const Ban = require('../models/Ban');
const Important = require('../models/Important');
const Book = require('../models/Book');
const Note = require('../models/Note');
const Question = require('../models/Question');
const Dars = require('../models/Dars');
const Dua = require('../models/Dua');
const { requireAdmin } = require('../middleware/auth');
const { loginLimiter, adminWriteLimiter } = require('../middleware/security');
const { clearBanCache, normIp } = require('../middleware/ipBan');
const { validateBody } = require('../middleware/validate');

const net = require('net');

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
    res.status(401).render('admin/login', { error: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
  } catch (err) {
    next(err);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ---------- Dashboard ----------
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const [cImportant, cBook, cNote, cQuestion, cDars, cDua, cBan] = await Promise.all([
      Important.countDocuments(),
      Book.countDocuments(),
      Note.countDocuments(),
      Question.countDocuments(),
      Dars.countDocuments(),
      Dua.countDocuments(),
      Ban.countDocuments()
    ]);
    res.render('admin/dashboard', {
      admin: req.session.admin,
      counts: { important: cImportant, book: cBook, note: cNote, question: cQuestion, dars: cDars, dua: cDua, ban: cBan }
    });
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

// ---------- Questions CRUD (প্রশ্ন + উত্তর যোগ/এডিট/ডিলিট — slug-safe) ----------
router.get('/questions', requireAdmin, async (req, res, next) => {
  try {
    const items = await Question.find().sort({ createdAt: -1 }).limit(500).lean();
    res.render('admin/question-list', { items, admin: req.session.admin });
  } catch (err) {
    next(err);
  }
});

router.get('/questions/new', requireAdmin, (req, res) => {
  res.render('admin/question-form', { item: {}, admin: req.session.admin, error: null });
});

router.post('/questions', requireAdmin, adminWriteLimiter, async (req, res) => {
  const { errors, data } = validateBody('question', req.body);
  if (errors.length) {
    return res.status(400).render('admin/question-form', {
      item: req.body, admin: req.session.admin, error: errors.join(' ')
    });
  }
  try {
    const created = new Question(data);
    await created.save(); // slug hook চলবে
    res.redirect('/admin/questions');
  } catch (e) {
    res.status(400).render('admin/question-form', {
      item: req.body, admin: req.session.admin, error: e.message
    });
  }
});

router.get('/questions/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.redirect('/admin/questions');
    const item = await Question.findById(req.params.id).lean();
    if (!item) return res.redirect('/admin/questions');
    res.render('admin/question-form', { item, admin: req.session.admin, error: null });
  } catch (err) {
    next(err);
  }
});

router.post('/questions/:id', requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.redirect('/admin/questions');
    const { errors, data } = validateBody('question', req.body);
    if (errors.length) {
      return res.status(400).render('admin/question-form', {
        item: { ...req.body, _id: req.params.id }, admin: req.session.admin, error: errors.join(' ')
      });
    }
    const doc = await Question.findById(req.params.id);
    if (!doc) return res.redirect('/admin/questions');
    doc.question = data.question;
    doc.answer = data.answer;
    doc.subject = data.subject;
    doc.chapter = data.chapter;
    doc.phase = data.phase;
    await doc.save(); // slug প্রয়োজনে রিজেনারেট হবে
    res.redirect('/admin/questions');
  } catch (err) {
    next(err);
  }
});

router.post('/questions/:id/delete', requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.redirect('/admin/questions');
    await Question.findByIdAndDelete(req.params.id);
    res.redirect('/admin/questions');
  } catch (err) {
    next(err);
  }
});

// ---------- IP Bans (নিরাপত্তা — IP ব্যান / মুক্ত) ----------
router.get('/bans', requireAdmin, async (req, res, next) => {
  try {
    const items = await Ban.find().sort({ createdAt: -1 }).lean();
    res.render('admin/ban-list', {
      items, admin: req.session.admin, error: null, success: null, myIp: req.clientIp || ''
    });
  } catch (err) {
    next(err);
  }
});

router.post('/bans', requireAdmin, adminWriteLimiter, async (req, res) => {
  const raw = (req.body.ip || '').toString();
  const reason = (req.body.reason || '').toString().trim().slice(0, 300);
  const valid = isValidIp(raw);
  const renderErr = async (msg) => {
    const items = await Ban.find().sort({ createdAt: -1 }).lean();
    res.status(400).render('admin/ban-list', {
      items, admin: req.session.admin, error: msg, success: null, myIp: req.clientIp || ''
    });
  };
  if (!valid) return renderErr('সঠিক IPv4/IPv6 ঠিকানা দিন।');
  if (normIp(valid) === normIp(req.clientIp)) return renderErr('নিজের IP ব্যান করা যাবে না!');
  try {
    await Ban.create({ ip: normIp(valid), reason });
    clearBanCache(); // সঙ্গে সঙ্গে কার্যকর
    res.redirect('/admin/bans');
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
