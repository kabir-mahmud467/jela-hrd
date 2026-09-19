const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const Book = require('../models/Book');
const Audiobook = require('../models/Audiobook');
const Note = require('../models/Note');
const Dars = require('../models/Dars');
const Dua = require('../models/Dua');
const Bibidh = require('../models/Bibidh');
const Surah = require('../models/Surah');
const AyatHadith = require('../models/AyatHadith');
const checklistData = require('../config/checklist');
const { PHASE_VALUES, PHASES } = require('../config/phases');
const { isDBError } = require('../config/db');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

// হোমপেজ — সদস্য মানোন্নয়ন চেকলিস্ট (static data, DB লাগে না)
router.get('/', (req, res) => {
  res.render('index', { checklistData });
});

// অ্যাপ ডাউনলোড পেজ — DB লাগে না (APK ফাইলের তথ্য দেখায়)
const APK_FILE = path.join(__dirname, '..', 'android', 'Hrd.apk');
const APP_VER = '১.৪';
function apkInfo() {
  try {
    const st = fs.statSync(APK_FILE);
    const kb = Math.max(1, Math.round(st.size / 1024));
    return {
      size: String(kb).split('').map((c) => '০১২৩৪৫৬৭৮৯'[c] || c).join('') + ' কিলোবাইট',
      date: st.mtime.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  } catch {
    return { size: '', date: '' };
  }
}
router.get('/app', (req, res) => {
  const info = apkInfo();
  res.render('app', { appVer: APP_VER, appSize: info.size, appDate: info.date });
});
// APK ডাউনলোড — সরাসরি ফাইল (শুধু সাইটে; অ্যাপের ভেতরে এই পেজ নেই)
router.get('/app/download', (req, res, next) => {
  if (!fs.existsSync(APK_FILE)) return res.status(404).render('404');
  res.download(APK_FILE, 'Hrd.apk');
});

// বই — ৩ পর্বে ভাগ (প্রশ্নের পর্বের মতো)
router.get('/books', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const and = [];
    if (q) {
      and.push({
        $or: [{ title: new RegExp(escapeRegex(q), 'i') }, { author: new RegExp(escapeRegex(q), 'i') }]
      });
    }
    if (phase && PHASE_VALUES.includes(phase)) and.push({ phase });
    const filter = and.length ? { $and: and } : {};
    const books = await Book.find(filter).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    res.render('books', { books, q, phase, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

// বই — পর্বভিত্তিক
router.get('/books/phase/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const books = await Book.find({ phase }).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    res.render('books', { books, q: '', phase, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

// অডিওবুক — বই রুটের মতোই, শুধু PDF-এর বদলে অডিও লিংক (একই ৩ পর্ব)
router.get('/audiobooks', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const and = [];
    if (q) {
      and.push({
        $or: [{ title: new RegExp(escapeRegex(q), 'i') }, { author: new RegExp(escapeRegex(q), 'i') }]
      });
    }
    if (phase && PHASE_VALUES.includes(phase)) and.push({ phase });
    const filter = and.length ? { $and: and } : {};
    const items = await Audiobook.find(filter).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    res.render('audiobooks', { items, q, phase, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

// অডিওবুক — পর্বভিত্তিক
router.get('/audiobooks/phase/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const items = await Audiobook.find({ phase }).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    res.render('audiobooks', { items, q: '', phase, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

// নোট — ধরন (আলোচনা/বই) + ২ পর্ব ফিল্টারসহ (নোটে শপথ পর্ব নেই)।
// পুরনো ডকুমেন্টে category না থাকলে আলোচনা ধরা হয়।
const NOTE_PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe'];
function noteFilter(cat, q, phase) {
  const and = [];
  if (cat === 'boi') {
    and.push({ category: 'boi' });
  } else {
    and.push({ $or: [{ category: 'alochona' }, { category: { $exists: false } }] });
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { content: rx }] });
  }
  if (phase && NOTE_PHASE_VALUES.includes(phase)) and.push({ phase });
  return { $and: and };
}

function validNoteCat(c) {
  const s = (c || 'alochona').toString().slice(0, 50);
  return Note.NOTE_VALUES.includes(s) ? s : 'alochona';
}

// নোট — তালিকা (?cat=&q=&phase=)
router.get('/note', async (req, res, next) => {
  try {
    const cat = validNoteCat(req.query.cat);
    const q = (req.query.q || '').toString().slice(0, 100);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const notes = await Note.find(noteFilter(cat, q, phase)).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    res.render('note', {
      notes, q, phase: NOTE_PHASE_VALUES.includes(phase) ? phase : '',
      cat, cats: Note.NOTE_CATS, phases: PHASES
    });
  } catch (err) {
    next(err);
  }
});

// নোট — ধরনভিত্তিক
router.get('/note/cat/:cat', async (req, res, next) => {
  try {
    const cat = req.params.cat.slice(0, 50);
    if (!Note.NOTE_VALUES.includes(cat)) return res.status(404).render('404');
    const notes = await Note.find(noteFilter(cat, '', '')).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    res.render('note', { notes, q: '', phase: '', cat, cats: Note.NOTE_CATS, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

// নোট — পর্বভিত্তিক (ধরন query-তে, default আলোচনা; শপথ পর্ব নোটে নেই → 404)
router.get('/note/phase/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!NOTE_PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const cat = validNoteCat(req.query.cat);
    const notes = await Note.find(noteFilter(cat, '', phase)).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    res.render('note', { notes, q: '', phase, cat, cats: Note.NOTE_CATS, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

router.get('/note/:id', async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const note = await Note.findById(req.params.id).lean();
    if (!note) return res.status(404).render('404');
    res.render('note-details', { note, cats: Note.NOTE_CATS });
  } catch (err) {
    // DB blip হলে 404 নয় — 503 retry পেজ (error handler দেখো)
    if (isDBError(err)) return next(err);
    return res.status(404).render('404');
  }
});

// পুরনো /notes লিংক (শেয়ার/PWA cache) → /note (301, query সহ)
router.get(/^\/notes(\/.*)?$/, (req, res) => {
  res.redirect(301, req.originalUrl.replace(/^\/notes/, '/note'));
});

// NOTE: /dars routes routes/dars.js এ, /dua routes routes/dua.js এ

module.exports = router;
