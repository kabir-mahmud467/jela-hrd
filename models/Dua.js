const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// মাসনুন দুআ — আলাদা রুট, ৩ ভাগ + ৩ পর্ব
const DUA_CATS = {
  'sokal-sondha': 'সকাল-সন্ধ্যার দুআ',
  'doinondin': 'দৈনন্দিন কাজের দুআ',
  'bipod-sofor': 'বিপদ ও সফরের দুআ'
};
const DUA_VALUES = Object.keys(DUA_CATS);

const duaSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'শিরোনাম আবশ্যক'], trim: true, maxlength: 300 },
  arabic: { type: String, default: '', trim: true, maxlength: 2000 },
  content: { type: String, required: [true, 'অর্থ/ব্যাখ্যা আবশ্যক'], trim: true, maxlength: 10000 },
  cat: { type: String, enum: DUA_VALUES, default: 'doinondin', index: true },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now }
});

duaSchema.index({ cat: 1, createdAt: -1 });
duaSchema.index({ phase: 1, createdAt: -1 });

duaSchema.statics.DUA_CATS = DUA_CATS;
duaSchema.statics.DUA_VALUES = DUA_VALUES;

module.exports = mongoose.model('Dua', duaSchema);
