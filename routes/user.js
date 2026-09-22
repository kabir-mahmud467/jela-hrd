// Single login page: /login. Username+password decides the dashboard —
// admin creds -> /admin, user creds -> /dashboard. No separate admin page.
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Admin = require('../models/Admin');
const checklistData = require('../config/checklist');
const { requireUser } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');
const { flagEvent } = require('../middleware/traffic');

function sanitizeProgress(p) {
  const out = {};
  if (!p || typeof p !== 'object') return out;
  const phases = Object.keys(checklistData).filter((k) => k !== 'shared');
  phases.forEach((ph) => {
    const src = p[ph];
    if (!src || typeof src !== 'object') return;
    const list = checklistData[ph] || [];
    const dst = {};
    Object.keys(src).forEach((k) => {
      const i = parseInt(k, 10);
      if (!isNaN(i) && i >= 0 && i < list.length && src[k]) dst[i] = 1;
    });
    if (Object.keys(dst).length) out[ph] = dst;
  });
  // Shared cross-phase items: stable ids (progress.shared), so a tick in one
  // phase shows in all three. Unknown ids are dropped.
  const sharedList = checklistData.shared || [];
  const ssrc = p.shared;
  if (ssrc && typeof ssrc === 'object') {
    const known = {};
    sharedList.forEach((it) => { if (it && it.id) known[String(it.id).slice(0, 100)] = 1; });
    const sdst = {};
    Object.keys(ssrc).forEach((k) => {
      const id = String(k).slice(0, 100);
      if (known[id] && ssrc[k]) sdst[id] = 1;
    });
    if (Object.keys(sdst).length) out.shared = sdst;
  }
  return out;
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  if (req.session.admin) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = (req.body.username || '').toString().trim().slice(0, 100);
    const password = (req.body.password || '').toString().slice(0, 200);
    if (!username || !password) {
      return res.status(400).render('login', { error: 'ইউজারনেম ও পাসওয়ার্ড দিন।' });
    }
    // 1) Admin? -> admin dashboard
    let admin = await Admin.findOne({ username });
    if (!admin) {
      // Fallback: .env (প্রথমবার / DB খালি থাকলে) — আগের /admin/login আচরণ
      if (
        username === (process.env.ADMIN_USERNAME || 'admin') &&
        password === (process.env.ADMIN_PASSWORD || 'admin123')
      ) {
        await Admin.ensureDefaultAdmin();
        admin = await Admin.findOne({ username });
      }
    }
    if (admin && password && await admin.comparePassword(password)) {
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.admin = { id: admin._id, username: admin.username };
        return req.session.save(() => res.redirect('/admin'));
      });
      return;
    }
    // 2) User? -> user dashboard
    const user = await User.findOne({ username });
    const ok = user && password ? await user.comparePassword(password) : false;
    if (!ok || !user) {
      try {
        flagEvent({
          ip: (req.clientIp || req.ip || '').toString().replace(/^::ffff:/i, ''),
          kind: 'login-fail',
          path: '/login',
          method: 'POST',
          userAgent: req.get('user-agent') || '',
          status: 401
        });
      } catch { /* ignore */ }
      return res.status(401).render('login', { error: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user._id, username: user.username, name: user.name || '' };
      return req.session.save(() => res.redirect('/dashboard'));
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => res.redirect('/login'));
    return;
  }
  res.redirect('/login');
});

// User dashboard — checklist (DB progress + localStorage merge, online save)
router.get('/dashboard', requireUser, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id).lean();
    if (!user) {
      req.session.user = null;
      return res.redirect('/login');
    }
    res.render('dashboard', {
      me: { username: user.username, name: user.name || '', phone: user.phone || '' },
      progress: user.progress || {},
      checklistData
    });
  } catch (err) {
    next(err);
  }
});

// Save checklist progress (fetch from dashboard.js when online)
router.post('/dashboard/progress', requireUser, async (req, res, next) => {
  try {
    const clean = sanitizeProgress(req.body && req.body.progress);
    await User.findByIdAndUpdate(
      req.session.user.id,
      { $set: { progress: clean, updatedAt: new Date() } },
      { runValidators: true }
    );
    res.json({ ok: true, progress: clean });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.sanitizeProgress = sanitizeProgress;
