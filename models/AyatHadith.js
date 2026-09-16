const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

const ayatHadithSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'শিরোনাম আবশ্যক'], trim: true, maxlength: 300 },
  arabic: { type: String, default: '', trim: true, maxlength: 2000 },
  transliteration: { type: String, default: '', trim: true, maxlength: 2000 },
  translation: { type: String, required: [true, 'অর্থ আবশ্যক'], trim: true, maxlength: 10000 },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  kind: { type: String, enum: ['ayat','hadis'], required: true, index: true },
  topic: { type: String, default: '', trim: true, maxlength: 100 },
  createdAt: { type: Date, default: Date.now }
});

ayatHadithSchema.index({ phase: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model('AyatHadith', ayatHadithSchema);
