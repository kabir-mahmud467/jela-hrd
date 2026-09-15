const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Dars = require('../models/Dars');
const Question = require('../models/Question');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function buildFilter(q, kind, phase) {
  const filter = {};
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { content: rx }, { reference: rx }] });
  }
  if (kind && Dars.DARS_VALUES.includes(kind)) {
    and.push({ kind });
  }
  if (phase && Question.PHASE_VALUES.includes(phase)) {
    and.push({ phase });
  }
  if (and.length) filter.$and = and;
  return filter;
}

function renderList(res, lessons, q, kind, phase) {
  res.render('dars', { lessons, q, kind, phase, darsMap: Dars.DARS, phases: Question.PHASES });
}

// GET /dars?q=&kind=&phase= — তালিকা (ধারা + পর্ব ফিল্টার, bounded)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const kind = (req.query.kind || '').toString().slice(0, 50);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const lessons = await Dars.find(buildFilter(q, kind, phase)).sort({ createdAt: -1 }).limit(200).lean();
    renderList(res, lessons, q, Dars.DARS_VALUES.includes(kind) ? kind : '', Question.PHASE_VALUES.includes(phase) ? phase : '');
  } catch (err) {
    next(err);
  }
});

// GET /dars/dhara/:kind — ধারাভিত্তিক (?phase= সহ)
router.get('/dhara/:kind', async (req, res, next) => {
  try {
    const kind = req.params.kind.slice(0, 50);
    if (!Dars.DARS_VALUES.includes(kind)) return res.status(404).render('404');
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const lessons = await Dars.find(buildFilter('', kind, phase)).sort({ createdAt: -1 }).limit(200).lean();
    renderList(res, lessons, '', kind, Question.PHASE_VALUES.includes(phase) ? phase : '');
  } catch (err) {
    next(err);
  }
});

// GET /dars/porbo/:phase — পর্বভিত্তিক (?kind= সহ)
router.get('/porbo/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const kind = (req.query.kind || '').toString().slice(0, 50);
    const lessons = await Dars.find(buildFilter('', kind, phase)).sort({ createdAt: -1 }).limit(200).lean();
    renderList(res, lessons, '', Dars.DARS_VALUES.includes(kind) ? kind : '', phase);
  } catch (err) {
    next(err);
  }
});

// GET /dars/:id — বিস্তারিত
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const lesson = await Dars.findById(req.params.id).lean();
    if (!lesson) return res.status(404).render('404');
    const related = await Dars.find({ _id: { $ne: lesson._id }, kind: lesson.kind })
      .select('title')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    res.render('dars-details', { lesson, related, darsMap: Dars.DARS, phases: Question.PHASES });
  } catch {
    return res.status(404).render('404');
  }
});

module.exports = router;
