const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Dua = require('../models/Dua');
const Question = require('../models/Question');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function buildFilter(q, cat, phase) {
  const filter = {};
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { arabic: rx }, { content: rx }, { reference: rx }] });
  }
  if (cat && Dua.DUA_VALUES.includes(cat)) {
    and.push({ cat });
  }
  if (phase && Question.PHASE_VALUES.includes(phase)) {
    and.push({ phase });
  }
  if (and.length) filter.$and = and;
  return filter;
}

function renderList(res, duas, q, cat, phase) {
  res.render('dua', { duas, q, cat, phase, duaCats: Dua.DUA_CATS, phases: Question.PHASES });
}

// GET /dua?q=&cat=&phase= — তালিকা (শুধু দুআ, ভাগ + পর্ব ফিল্টার, bounded)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const cat = (req.query.cat || '').toString().slice(0, 50);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const duas = await Dua.find(buildFilter(q, cat, phase)).sort({ createdAt: -1 }).limit(200).lean();
    renderList(res, duas, q, Dua.DUA_VALUES.includes(cat) ? cat : '', Question.PHASE_VALUES.includes(phase) ? phase : '');
  } catch (err) {
    next(err);
  }
});

// GET /dua/dhara/:cat — ভাগভিত্তিক (?phase= সহ)
router.get('/dhara/:cat', async (req, res, next) => {
  try {
    const cat = req.params.cat.slice(0, 50);
    if (!Dua.DUA_VALUES.includes(cat)) return res.status(404).render('404');
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const duas = await Dua.find(buildFilter('', cat, phase)).sort({ createdAt: -1 }).limit(200).lean();
    renderList(res, duas, '', cat, Question.PHASE_VALUES.includes(phase) ? phase : '');
  } catch (err) {
    next(err);
  }
});

// GET /dua/porbo/:phase — পর্বভিত্তিক (?cat= সহ)
router.get('/porbo/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const cat = (req.query.cat || '').toString().slice(0, 50);
    const duas = await Dua.find(buildFilter('', cat, phase)).sort({ createdAt: -1 }).limit(200).lean();
    renderList(res, duas, '', Dua.DUA_VALUES.includes(cat) ? cat : '', phase);
  } catch (err) {
    next(err);
  }
});

// GET /dua/:id — বিস্তারিত
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const dua = await Dua.findById(req.params.id).lean();
    if (!dua) return res.status(404).render('404');
    const related = await Dua.find({ _id: { $ne: dua._id }, cat: dua.cat })
      .select('title')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    res.render('dua-details', { dua, related, duaCats: Dua.DUA_CATS, phases: Question.PHASES });
  } catch {
    return res.status(404).render('404');
  }
});

module.exports = router;
