const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const AyatHadith = require('../models/AyatHadith');
const Question = require('../models/Question');

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
  res.render('ayat-hadith', { items, q, phase, kind, phases: Question.PHASES });
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

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const item = await AyatHadith.findById(req.params.id).lean();
    if (!item) return res.status(404).render('404');
    res.render('ayat-hadith-details', { item, phases: Question.PHASES });
  } catch { return res.status(404).render('404'); }
});

module.exports = router;
