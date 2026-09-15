const express = require('express');
const router = express.Router();

const Important = require('../models/Important');
const Book = require('../models/Book');
const Note = require('../models/Note');
const Question = require('../models/Question');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

// হোমপেজ — শুধু প্রশ্ন (হালকা ও দ্রুত: সীমিত ফিল্ড, সীমিত সংখ্যা)
router.get('/', async (req, res, next) => {
  try {
    const [questions, subjects] = await Promise.all([
      Question.find()
        .select('question answer subject chapter phase slug')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      Question.distinct('subject')
    ]);
    const qCount = await Question.estimatedDocumentCount().catch(() => questions.length);
    res.render('index', { questions, subjects, qCount, sCount: subjects.length });
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

// বই লিংক
router.get('/books', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const filter = q
      ? { $or: [{ title: new RegExp(escapeRegex(q), 'i') }, { author: new RegExp(escapeRegex(q), 'i') }] }
      : {};
    const books = await Book.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.render('books', { books, q });
  } catch (err) {
    next(err);
  }
});

// আলোচনা নোট
router.get('/notes', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const filter = q
      ? { $or: [{ title: new RegExp(escapeRegex(q), 'i') }, { subject: new RegExp(escapeRegex(q), 'i') }] }
      : {};
    const notes = await Note.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.render('notes', { notes, q });
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

// NOTE: /questions routes এখন routes/questions.js এ (প্রতিটি প্রশ্নের আলাদা route সহ)

module.exports = router;
