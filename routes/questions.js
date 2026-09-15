const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Question = require('../models/Question');

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

function buildFilter(q, subject, phase) {
  const filter = {};
  const and = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ question: rx }, { subject: rx }, { chapter: rx }] });
  }
  if (subject) {
    and.push({ subject: new RegExp(`^${escapeRegex(subject)}$`, 'i') });
  }
  if (phase && Question.PHASE_VALUES.includes(phase)) {
    and.push({ phase });
  }
  if (and.length) filter.$and = and;
  return filter;
}

async function findBySlugOrId(slugOrId) {
  // lean() ধারাবাহিকভাবে — view-এ plain object যায়
  const id = (slugOrId || '').toString().slice(0, 120);
  let item = await Question.findOne({ slug: id }).lean();
  if (item) return item;
  // 2) ObjectId হলে id দিয়ে খোঁজো
  if (mongoose.Types.ObjectId.isValid(id)) {
    item = await Question.findById(id).lean();
  }
  return item;
}

// GET /questions?q=&subject=&phase= — তালিকা (bounded: 최대 200)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().slice(0, 100);
    const subject = (req.query.subject || '').toString().slice(0, 100);
    const phase = (req.query.phase || '').toString().slice(0, 50);
    const filter = buildFilter(q, subject, phase);
    const [questions, subjects] = await Promise.all([
      Question.find(filter).select('question answer subject chapter phase slug').sort({ createdAt: -1 }).limit(200).lean(),
      Question.distinct('subject')
    ]);
    res.render('questions', { questions, q, subject, phase, subjects, phases: Question.PHASES });
  } catch (err) {
    next(err);
  }
});

// GET /questions/subject/:subject — বিষয়ভিত্তিক তালিকা (প্রতিটি বিষয়ের আলাদা route)
router.get('/subject/:subject', async (req, res, next) => {
  try {
    const subject = req.params.subject.slice(0, 100);
    const questions = await Question.find(buildFilter('', subject, ''))
      .select('question answer subject chapter phase slug')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const subjects = await Question.distinct('subject');
    res.render('questions', { questions, q: '', subject, phase: '', subjects, phases: Question.PHASES });
  } catch (err) {
    next(err);
  }
});

// GET /questions/phase/:phase — পর্বভিত্তিক তালিকা
router.get('/phase/:phase', async (req, res, next) => {
  try {
    const phase = req.params.phase.slice(0, 50);
    if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
    const questions = await Question.find(buildFilter('', '', phase))
      .select('question answer subject chapter phase slug')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const subjects = await Question.distinct('subject');
    res.render('questions', { questions, q: '', subject: '', phase, subjects, phases: Question.PHASES });
  } catch (err) {
    next(err);
  }
});

// GET /questions/id/:id — পুরনো id লিংক সাপোর্ট (canonical slug-এ redirect)
router.get('/id/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render('404');
    const item = await Question.findById(req.params.id).lean();
    if (!item) return res.status(404).render('404');
    if (item.slug) return res.redirect(301, `/questions/${item.slug}`);
    return res.render('question-details', { item });
  } catch {
    return res.status(404).render('404');
  }
});

// GET /questions/new — ভুল করে new কে slug ভাবা আটকাও
router.get('/new', (req, res) => res.redirect('/questions'));

// GET /questions/:slugOrId — প্রতিটি প্রশ্নের আলাদা পেজ
router.get('/:slugOrId', async (req, res, next) => {
  try {
    const item = await findBySlugOrId(req.params.slugOrId);
    if (!item) return res.status(404).render('404');
    // view count (best-effort)
    Question.updateOne({ _id: item._id }, { $inc: { views: 1 } }).exec().catch(() => {});
    // canonical slug না হলে redirect (SEO)
    if (item.slug && req.params.slugOrId !== item.slug && req.params.slugOrId === String(item._id)) {
      return res.redirect(301, `/questions/${item.slug}`);
    }
    const related = await Question.find({
      _id: { $ne: item._id },
      subject: item.subject
    })
      .select('question slug')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    res.render('question-details', { item, related, phases: Question.PHASES });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
