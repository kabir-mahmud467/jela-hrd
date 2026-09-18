const express = require('express');
const router = express.Router();

const Book = require('../models/Book');
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

// অফলাইন প্যাক: PWA "ডাউনলোড" বাটনের জন্য সব public পেজের URL তালিকা।
// version বদলালে ক্লায়েন্ট বুঝবে নতুন কনটেন্ট এসেছে (doc সংখ্যা + package version)।
router.get('/offline-manifest.json', async (req, res, next) => {
  try {
    const { getAssetVer } = require('../config/assets');
    const v = getAssetVer();
    const urls = new Set([
      '/',
      '/books',
      '/note',
      '/dars',
      '/dua',
      '/bibidh',
      '/surah',
      '/ayat-hadith',
      '/offline.html',
      '/manifest.webmanifest',
      `/css/theme.css?v=${v}`,
      `/css/style.css?v=${v}`,
      `/js/main.js?v=${v}`,
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/maskable-512.png',
      '/icons/apple-touch-icon.png'
    ]);
    const phases = PHASE_VALUES;
    phases.forEach((p) => {
      urls.add(`/books/phase/${p}`);
      urls.add(`/dars/porbo/${p}`);
      urls.add(`/dua/porbo/${p}`);
      urls.add(`/surah/porbo/${p}`);
      urls.add(`/ayat-hadith/porbo/${p}`);
    });
    // নোটে শপথ পর্ব নেই — শুধু ২ পর্ব
    ['abedonpotrer-purbe', 'proshnopotrer-purbe'].forEach((p) => {
      urls.add(`/note/phase/${p}`);
    });
    Note.NOTE_VALUES.forEach((c) => {
      urls.add(`/note?cat=${c}`);
      urls.add(`/note/cat/${c}`);
    });
    Bibidh.BIBIDH_VALUES.forEach((c) => {
      urls.add(`/bibidh?cat=${c}`);
      urls.add(`/bibidh/cat/${c}`);
    });

    const [notes, dars, duas, bibidh, surah, ayatHadith, counts] = await Promise.all([
      Note.find().select('_id').limit(500).lean(),
      Dars.find().select('_id').limit(500).lean(),
      Dua.find().select('_id').limit(500).lean(),
      Bibidh.find().select('_id').limit(500).lean(),
      Surah.find().select('_id').limit(500).lean(),
      AyatHadith.find().select('_id').limit(500).lean(),
      Promise.all([
        Book.estimatedDocumentCount().catch(() => 0),
        Note.estimatedDocumentCount().catch(() => 0),
        Dars.estimatedDocumentCount().catch(() => 0),
        Dua.estimatedDocumentCount().catch(() => 0),
        Bibidh.estimatedDocumentCount().catch(() => 0),
        Surah.estimatedDocumentCount().catch(() => 0),
        AyatHadith.estimatedDocumentCount().catch(() => 0)
      ])
    ]);
    (notes || []).forEach((n) => urls.add(`/note/${n._id}`));
    (dars || []).forEach((d) => urls.add(`/dars/${d._id}`));
    (duas || []).forEach((d) => urls.add(`/dua/${d._id}`));
    (bibidh || []).forEach((b) => urls.add(`/bibidh/${b._id}`));
    (surah || []).forEach((s) => urls.add(`/surah/${s._id}`));
    (ayatHadith || []).forEach((a) => urls.add(`/ayat-hadith/${a._id}`));

    const total = counts.reduce((a, b) => a + b, 0);
    res.json({ version: `c${total}`, urls: [...urls] });
  } catch (err) {
    next(err);
  }
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
    const books = await Book.find(filter).sort({ createdAt: -1 }).limit(200).lean();
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
    const books = await Book.find({ phase }).sort({ createdAt: -1 }).limit(200).lean();
    res.render('books', { books, q: '', phase, phases: PHASES });
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
    const notes = await Note.find(noteFilter(cat, q, phase)).sort({ createdAt: -1 }).limit(200).lean();
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
    const notes = await Note.find(noteFilter(cat, '', '')).sort({ createdAt: -1 }).limit(200).lean();
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
    const notes = await Note.find(noteFilter(cat, '', phase)).sort({ createdAt: -1 }).limit(200).lean();
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
