// Native APK sync API — offline-first app pulls this when online.
// GET /api/content.json        full public snapshot {version, checklist, books, ...}
// GET /api/content.json?check=1  light version probe {version, counts}
// No auth, public fields only, sorted like the live site.
const express = require('express');
const router = express.Router();

const Book = require('../models/Book');
const Note = require('../models/Note');
const Dars = require('../models/Dars');
const Dua = require('../models/Dua');
const Bibidh = require('../models/Bibidh');
const Surah = require('../models/Surah');
const AyatHadith = require('../models/AyatHadith');
const checklistData = require('../config/checklist');

const CAP = 500;
const SORT = { order: 1, createdAt: -1 };

async function snapshot() {
  const [books, notes, dars, duas, ayathadith, surah, bibidh] = await Promise.all([
    Book.find().sort(SORT).limit(CAP)
      .select('title author link description category phase order createdAt').lean(),
    Note.find().sort(SORT).limit(CAP)
      .select('title subject content category phase order createdAt').lean(),
    Dars.find().sort(SORT).limit(CAP)
      .select('title content phase reference order createdAt').lean(),
    Dua.find().sort(SORT).limit(CAP)
      .select('title arabic transliteration content phase reference order createdAt').lean(),
    AyatHadith.find().sort(SORT).limit(CAP)
      .select('title arabic transliteration translation reference phase kind topic order createdAt').lean(),
    Surah.find().sort(SORT).limit(CAP)
      .select('title arabic transliteration translation reference phase ayahCount order createdAt').lean(),
    Bibidh.find().sort(SORT).limit(CAP)
      .select('title content category reference order createdAt').lean()
  ]);
  const cols = { books, notes, dars, duas, ayathadith, surah, bibidh };
  let total = 0;
  let latest = 0;
  Object.keys(cols).forEach((k) => {
    const arr = cols[k] || [];
    total += arr.length;
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i] && arr[i].createdAt ? new Date(arr[i].createdAt).getTime() : 0;
      if (t > latest) latest = t;
    }
  });
  const counts = {};
  Object.keys(cols).forEach((k) => { counts[k] = (cols[k] || []).length; });
  return {
    v: 1,
    version: total + ':' + latest,
    exportedAt: new Date().toISOString(),
    counts,
    checklist: checklistData,
    books, notes, dars, duas, ayathadith, surah, bibidh
  };
}

router.get('/content.json', async (req, res) => {
  try {
    const data = await snapshot();
    res.set('Cache-Control', 'no-store');
    if (req.query.check) {
      return res.json({ v: 1, version: data.version, counts: data.counts });
    }
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'database-busy', retryAfter: 5 });
  }
});

module.exports = router;
