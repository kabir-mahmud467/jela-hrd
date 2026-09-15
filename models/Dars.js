const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// দারস — ২ ধারা + প্রশ্নের মতোই ৩ পর্ব
const DARS = {
  'darsul-quran': 'দারসুল কুরআন',
  'darsul-hadis': 'দারসুল হাদিস'
};
const DARS_VALUES = Object.keys(DARS);

const darsSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'শিরোনাম আবশ্যক'], trim: true, maxlength: 300 },
  content: { type: String, required: [true, 'বিস্তারিত আবশ্যক'], trim: true, maxlength: 10000 },
  kind: { type: String, enum: DARS_VALUES, default: 'darsul-quran', index: true },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now }
});

darsSchema.index({ kind: 1, createdAt: -1 });
darsSchema.index({ phase: 1, createdAt: -1 });

darsSchema.statics.DARS = DARS;
darsSchema.statics.DARS_VALUES = DARS_VALUES;

module.exports = mongoose.model('Dars', darsSchema);
