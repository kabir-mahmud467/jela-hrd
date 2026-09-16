const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// মাসনুন দুআ — শুধু ৩ পর্ব (আবেদনপত্রের পূর্বে / প্রশ্নপত্রের পূর্বে / শপথের পূর্বে)
const duaSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'শিরোনাম আবশ্যক'], trim: true, maxlength: 300 },
  arabic: { type: String, default: '', trim: true, maxlength: 2000 },
  transliteration: { type: String, default: '', trim: true, maxlength: 2000 },
  content: { type: String, required: [true, 'অর্থ/ব্যাখ্যা আবশ্যক'], trim: true, maxlength: 10000 },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now }
});

duaSchema.index({ phase: 1, createdAt: -1 });

module.exports = mongoose.model('Dua', duaSchema);
