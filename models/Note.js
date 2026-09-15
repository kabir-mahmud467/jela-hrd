const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// আলোচনা নোট — প্রশ্নের মতোই ৩ পর্বে ভাগ
const noteSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  subject: { type: String, default: 'সাধারণ', trim: true, maxlength: 100 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  createdAt: { type: Date, default: Date.now }
});

noteSchema.index({ phase: 1, createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
