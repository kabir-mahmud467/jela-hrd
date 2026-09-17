const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Dars = require('../models/Dars');
const Question = require('../models/Question');
const { isDBError } = require('../config/db');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function buildFilter(q, phase) {
  const filter = {};
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { content: rx }, { reference: rx }] });
  }
  if (phase && Question.PHASE_VALUES.includes(phase)) {
    and.push({ phase });
  }
  if (and.length) filter.$and = and;
  return filter;
}

function renderList(res, lessons, q, phase) {
  res.render('dars', { lessons, q, phase, phases: Question.PHASES });
}

// GET /dars?q=&phase= — তালিকা (শুধু ৩ পর্ব ফিল্টার, bounded)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const lessons = await Dars.find(buildFilter(q, phase)).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    renderList(res, lessons, q, Question.PHASE_VALUES.includes(phase) ? phase : '');
  } catch (err) {
    next(err);
  }
});

// GET /dars/porbo/:phase — পর্বভিত্তিক
router.get('/porbo/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const lessons = await Dars.find(buildFilter('', phase)).sort({ order: 1, createdAt: -1 }).limit(200).lean();
    renderList(res, lessons, '', phase);
  } catch (err) {
    next(err);
  }
});

// GET /dars/:id — বিস্তারিত
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const lesson = await Dars.findById(req.params.id).lean();
    if (!lesson) return res.status(404).render('404');
    const related = await Dars.find({ _id: { $ne: lesson._id }, phase: lesson.phase })
      .select('title')
      .sort({ order: 1, createdAt: -1 })
      .limit(5)
      .lean();
    res.render('dars-details', { lesson, related, phases: Question.PHASES });
  } catch (err) {
    // DB blip হলে 404 নয় — 503 retry পেজ (error handler দেখো)
    if (isDBError(err)) return next(err);
    return res.status(404).render('404');
  }
});

module.exports = router;
