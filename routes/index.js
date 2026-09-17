const express = require('express');
const router = express.Router();

const Important = require('../models/Important');
const Book = require('../models/Book');
const Note = require('../models/Note');
const Dars = require('../models/Dars');
const Dua = require('../models/Dua');
const Bibidh = require('../models/Bibidh');
const Surah = require('../models/Surah');
const AyatHadith = require('../models/AyatHadith');
const checklistData = require('../config/checklist');
const { PHASE_VALUES, PHASES } = require('../config/phases');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

// হোমপেজ — সদস্য মানোন্নয়ন চেকলিস্ট (static data, DB লাগে না)
router.get('/', (req, res) => {
  res.render('index', { checklistData });
});

// অ্যাপ ইনস্টল নির্দেশনা (PWA manual install) — DB লাগে না, তবু public router-এ
router.get('/install', (req, res) => {
  res.render('install');
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
      '/notes',
      '/dars',
      '/dua',
      '/bibidh',
      '/surah',
      '/ayat-hadith',
      '/install',
      '/offline.html',
      '/manifest.webmanifest',
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
      urls.add(`/notes/phase/${p}`);
      urls.add(`/dars/porbo/${p}`);
      urls.add(`/dua/porbo/${p}`);
      urls.add(`/bibidh?cat=${p}`);
      urls.add(`/surah/porbo/${p}`);
      urls.add(`/ayat-hadith/porbo/${p}`);
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
    (notes || []).forEach((n) => urls.add(`/notes/${n._id}`));
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

// bibidh handles guruttopurno totho replacement — keep old gurutto as redirect for bookmarks
router.get('/gurutto', (req,res)=> res.redirect(301,'/bibidh'));
router.get('/gurutto/:id', (req,res)=> {
  const id=(req.params.id||'').toString();
  return res.redirect(301, '/bibidh/'+encodeURIComponent(id));
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

// আলোচনা নোট — ৩ পর্বে ভাগ (একটাই রুট, পর্ব ফিল্টারসহ)
router.get('/notes', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const and = [];
    if (q) {
      and.push({
        $or: [{ title: new RegExp(escapeRegex(q), 'i') }, { subject: new RegExp(escapeRegex(q), 'i') }]
      });
    }
    if (phase && PHASE_VALUES.includes(phase)) and.push({ phase });
    const filter = and.length ? { $and: and } : {};
    const notes = await Note.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.render('notes', { notes, q, phase, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

// আলোচনা নোট — পর্বভিত্তিক
router.get('/notes/phase/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const notes = await Note.find({ phase }).sort({ createdAt: -1 }).limit(200).lean();
    res.render('notes', { notes, q: '', phase, phases: PHASES });
  } catch (err) {
    next(err);
  }
});

router.get('/notes/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const note = await Note.findById(req.params.id).lean();
    if (!note) return res.status(404).render('404');
    res.render('note-details', { note });
  } catch {
    return res.status(404).render('404');
  }
});

// NOTE: /dars routes routes/dars.js এ, /dua routes routes/dua.js এ

module.exports = router;
