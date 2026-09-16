const express = require('express');
const router = express.Router();

const Important = require('../models/Important');
const Book = require('../models/Book');
const Note = require('../models/Note');
const Question = require('../models/Question');
const Dars = require('../models/Dars');
const Dua = require('../models/Dua');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

// হোমপেজ — প্রশ্ন + ৩ পর্ব + বই + আলোচনা নোট + গুরুত্বপূর্ণ তথ্য (সব হালকা, limit সহ)
router.get('/', async (req, res, next) => {
  try {
    const [questions, subjects, books, notes, importants, lessons, duas, phaseAgg, qCount, bookCount, noteCount, impCount, darsCount, duaCount] =
      await Promise.all([
        Question.find()
          .select('question answer subject chapter phase slug')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        Question.distinct('subject'),
        Book.find().sort({ createdAt: -1 }).limit(6).lean(),
        Note.find().select('title subject content phase createdAt').sort({ createdAt: -1 }).limit(6).lean(),
        Important.find().sort({ isPinned: -1, createdAt: -1 }).limit(6).lean(),
        Dars.find().select('title phase reference createdAt').sort({ createdAt: -1 }).limit(6).lean(),
        Dua.find().select('title phase reference createdAt').sort({ createdAt: -1 }).limit(6).lean(),
        Question.aggregate([{ $group: { _id: '$phase', count: { $sum: 1 } } }]),
        Question.estimatedDocumentCount().catch(() => 0),
        Book.estimatedDocumentCount().catch(() => 0),
        Note.estimatedDocumentCount().catch(() => 0),
        Important.estimatedDocumentCount().catch(() => 0),
        Dars.estimatedDocumentCount().catch(() => 0),
        Dua.estimatedDocumentCount().catch(() => 0)
      ]);
    const phaseCounts = {};
    (phaseAgg || []).forEach((p) => {
      phaseCounts[p._id] = p.count;
    });
    res.render('index', {
      questions,
      subjects,
      books,
      notes,
      importants,
      lessons,
      duas,
      phases: Question.PHASES,
      phaseCounts,
      qCount,
      bookCount,
      noteCount,
      impCount,
      darsCount,
      duaCount,
      sCount: subjects.length
    });
  } catch (err) {
    next(err);
  }
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
      '/questions',
      '/books',
      '/notes',
      '/dars',
      '/dua',
      '/gurutto',
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
    const phases = Question.PHASE_VALUES;
    phases.forEach((p) => {
      urls.add(`/questions/phase/${p}`);
      urls.add(`/books/phase/${p}`);
      urls.add(`/notes/phase/${p}`);
      urls.add(`/dars/porbo/${p}`);
      urls.add(`/dua/porbo/${p}`);
    });

    const [subjects, questions, notes, dars, duas, importants, counts] = await Promise.all([
      Question.distinct('subject'),
      Question.find().select('slug').limit(500).lean(),
      Note.find().select('_id').limit(500).lean(),
      Dars.find().select('_id').limit(500).lean(),
      Dua.find().select('_id').limit(500).lean(),
      Important.find().select('_id').limit(500).lean(),
      Promise.all([
        Question.estimatedDocumentCount().catch(() => 0),
        Book.estimatedDocumentCount().catch(() => 0),
        Note.estimatedDocumentCount().catch(() => 0),
        Dars.estimatedDocumentCount().catch(() => 0),
        Dua.estimatedDocumentCount().catch(() => 0),
        Important.estimatedDocumentCount().catch(() => 0)
      ])
    ]);
    (subjects || []).forEach((s) => {
      if (s) urls.add(`/questions/subject/${encodeURIComponent(s)}`);
    });
    (questions || []).forEach((q) => {
      if (q && q.slug) urls.add(`/questions/${q.slug}`);
    });
    (notes || []).forEach((n) => urls.add(`/notes/${n._id}`));
    (dars || []).forEach((d) => urls.add(`/dars/${d._id}`));
    (duas || []).forEach((d) => urls.add(`/dua/${d._id}`));
    (importants || []).forEach((i) => urls.add(`/gurutto/${i._id}`));

    const total = counts.reduce((a, b) => a + b, 0);
    res.json({ version: `c${total}`, urls: [...urls] });
  } catch (err) {
    next(err);
  }
});

// গুরুত্বপূর্ণ তথ্য তালিকা
router.get('/gurutto', async (req, res, next) => {
  try {
    const importants = await Important.find().sort({ isPinned: -1, createdAt: -1 }).limit(200).lean();
    res.render('importants', { importants });
  } catch (err) {
    next(err);
  }
});

router.get('/gurutto/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const item = await Important.findById(req.params.id).lean();
    if (!item) return res.status(404).render('404');
    res.render('important-details', { item });
  } catch {
    return res.status(404).render('404');
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
    if (phase && Question.PHASE_VALUES.includes(phase)) and.push({ phase });
    const filter = and.length ? { $and: and } : {};
    const books = await Book.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.render('books', { books, q, phase, phases: Question.PHASES });
  } catch (err) {
    next(err);
  }
});

// বই — পর্বভিত্তিক
router.get('/books/phase/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const books = await Book.find({ phase }).sort({ createdAt: -1 }).limit(200).lean();
    res.render('books', { books, q: '', phase, phases: Question.PHASES });
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
    if (phase && Question.PHASE_VALUES.includes(phase)) and.push({ phase });
    const filter = and.length ? { $and: and } : {};
    const notes = await Note.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.render('notes', { notes, q, phase, phases: Question.PHASES });
  } catch (err) {
    next(err);
  }
});

// আলোচনা নোট — পর্বভিত্তিক
router.get('/notes/phase/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const notes = await Note.find({ phase }).sort({ createdAt: -1 }).limit(200).lean();
    res.render('notes', { notes, q: '', phase, phases: Question.PHASES });
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

// NOTE: /questions routes এখন routes/questions.js এ, /dars routes routes/dars.js এ

module.exports = router;
