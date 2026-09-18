const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const AyatHadith = require('../models/AyatHadith');
const Question = require('../models/Question');
const { isDBError } = require('../config/db');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function buildFilter(q, phase, kind) {
  const filter = {};
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { arabic: rx }, { translation: rx }, { reference: rx }, { topic: rx }] });
  }
  if (phase && Question.PHASE_VALUES.includes(phase)) and.push({ phase });
  if (kind && ['ayat','hadis'].includes(kind)) and.push({ kind });
  if (and.length) filter.$and = and;
  return filter;
}

function renderList(res, items, q, phase, kind) {
  // বিষয় অনুযায়ী গ্রুপ: প্রতি বিষয়ে আগে আয়াত (১, ২…), তারপর হাদিস (১, ২…)
  const groups = [];
  const byTopic = new Map();
  (items || []).forEach((it) => {
    const t = it.topic || 'সাধারণ';
    if (!byTopic.has(t)) {
      const g = { topic: t, ayat: [], hadis: [] };
      byTopic.set(t, g);
      groups.push(g);
    }
    const g = byTopic.get(t);
    if (it.kind === 'hadis') g.hadis.push(it);
    else g.ayat.push(it);
  });
  res.render('ayat-hadith', { items, groups, q, phase, kind, phases: Question.PHASES });
}

// GET /ayat-hadith?q=&phase=&kind=
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const kind = (req.query.kind || '').toString().slice(0, 20);
    const items = await AyatHadith.find(buildFilter(q, phase, kind)).sort({ createdAt: 1 }).limit(200).lean();
    renderList(res, items, q, Question.PHASE_VALUES.includes(phase) ? phase : '', ['ayat','hadis'].includes(kind) ? kind : '');
  } catch (err) { next(err); }
});

router.get('/porbo/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const kind = (req.query.kind || '').toString().slice(0, 20);
    const items = await AyatHadith.find(buildFilter('', phase, kind)).sort({ createdAt: 1 }).limit(200).lean();
    renderList(res, items, '', phase, ['ayat','hadis'].includes(kind) ? kind : '');
  } catch (err) { next(err); }
});

router.get('/kind/:kind', async (req, res, next) => {
  try {
    const kind = req.params.kind.slice(0, 20);
    if (!['ayat','hadis'].includes(kind)) return res.status(404).render('404');
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const items = await AyatHadith.find(buildFilter('', phase, kind)).sort({ createdAt: 1 }).limit(200).lean();
    renderList(res, items, '', Question.PHASE_VALUES.includes(phase) ? phase : '', kind);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const item = await AyatHadith.findById(req.params.id).lean();
    if (!item) return res.status(404).render('404');
    res.render('ayat-hadith-details', { item, phases: Question.PHASES });
  } catch (err) {
    // DB blip হলে 404 নয় — 503 retry পেজ (error handler দেখো)
    if (isDBError(err)) return next(err);
    return res.status(404).render('404');
  }
});

module.exports = router;
