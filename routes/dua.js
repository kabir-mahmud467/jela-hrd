const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Dua = require('../models/Dua');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function buildFilter(q, cat) {
  const filter = {};
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { arabic: rx }, { content: rx }, { reference: rx }] });
  }
  if (cat && Dua.DUA_VALUES.includes(cat)) {
    and.push({ cat });
  }
  if (and.length) filter.$and = and;
  return filter;
}

// GET /dua?q=&cat= — তালিকা (শুধু দুআ, bounded)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const cat = (req.query.cat || '').toString().slice(0, 50);
    const filter = buildFilter(q, cat);
    const duas = await Dua.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.render('dua', { duas, q, cat, duaCats: Dua.DUA_CATS });
  } catch (err) {
    next(err);
  }
});

// GET /dua/dhara/:cat — ভাগভিত্তিক তালিকা (৩ ভাগ)
router.get('/dhara/:cat', async (req, res, next) => {
  try {
    const cat = req.params.cat.slice(0, 50);
    if (!Dua.DUA_VALUES.includes(cat)) return res.status(404).render('404');
    const duas = await Dua.find({ cat }).sort({ createdAt: -1 }).limit(200).lean();
    res.render('dua', { duas, q: '', cat, duaCats: Dua.DUA_CATS });
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
    res.render('dua-details', { dua, related, duaCats: Dua.DUA_CATS });
  } catch {
    return res.status(404).render('404');
  }
});

module.exports = router;
