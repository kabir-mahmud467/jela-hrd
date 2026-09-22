const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// দারস — শুধু ৩ পর্ব (প্রশ্নের মতোই)
const darsSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'শিরোনাম আবশ্যক'], trim: true, maxlength: 300 },
  content: { type: String, required: [true, 'বিস্তারিত আবশ্যক'], trim: true, maxlength: 10000 },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  order: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

darsSchema.index({ phase: 1, createdAt: -1 });

module.exports = mongoose.model('Dars', darsSchema);
