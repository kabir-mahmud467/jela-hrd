const express = require('express');
const router = express.Router();
const checklistData = require('../config/checklist');
const Question = require('../models/Question');

// GET /ayat-hadith — 3 porbo tabs, ayat-hadith topics only
router.get('/', (req, res) => {
  const phase = (req.query.phase || '').toString().slice(0, 50);
  const valid = Question.PHASE_VALUES.includes(phase) ? phase : '';
  res.render('ayat-hadith', { checklistData, phase: valid, phases: Question.PHASES });
});

router.get('/porbo/:phase', (req, res) => {
  const phase = req.params.phase.slice(0, 50);
  if (!Question.PHASE_VALUES.includes(phase)) return res.status(404).render('404');
  res.render('ayat-hadith', { checklistData, phase, phases: Question.PHASES });
});

module.exports = router;
