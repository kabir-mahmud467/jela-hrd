const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Dars = require('../models/Dars');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function buildFilter(q, kind) {
  const filter = {};
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { content: rx }, { reference: rx }] });
  }
  if (kind && Dars.DARS_VALUES.includes(kind)) {
    and.push({ kind });
  }
  if (and.length) filter.$and = and;
  return filter;
}

// GET /dars?q=&kind= — তালিকা (সব ধারা, bounded)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const kind = (req.query.kind || '').toString().slice(0, 50);
    const filter = buildFilter(q, kind);
    const lessons = await Dars.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.render('dars', { lessons, q, kind, darsMap: Dars.DARS });
  } catch (err) {
    next(err);
  }
});

// GET /dars/dhara/:kind — ধারাভিত্তিক তালিকা (দারসুল কুরআন / দারসুল হাদিস / মাসনুন দুআ)
router.get('/dhara/:kind', async (req, res, next) => {
  try {
    const kind = req.params.kind.slice(0, 50);
    if (!Dars.DARS_VALUES.includes(kind)) return res.status(404).render('404');
    const lessons = await Dars.find({ kind }).sort({ createdAt: -1 }).limit(200).lean();
    res.render('dars', { lessons, q: '', kind, darsMap: Dars.DARS });
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
    res.render('dars-details', { lesson, related, darsMap: Dars.DARS });
  } catch {
    return res.status(404).render('404');
  }
});

module.exports = router;
