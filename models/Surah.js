const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

const surahSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  arabic: { type: String, required: true, trim: true, maxlength: 10000 },
  transliteration: { type: String, default: '', trim: true, maxlength: 5000 },
  translation: { type: String, required: true, trim: true, maxlength: 10000 },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  ayahCount: { type: Number, default: 0 },
  order: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now }
});

surahSchema.index({ phase: 1, createdAt: -1 });

module.exports = mongoose.model('Surah', surahSchema);
