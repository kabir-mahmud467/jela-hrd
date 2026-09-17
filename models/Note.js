const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// নোট — দুই ধরন (আলোচনা/বই), প্রতিটি ৩ পর্বে ভাগ
const NOTE_CATS = {
  'alochona': 'আলোচনা নোট',
  'boi': 'বই নোট'
};
const NOTE_VALUES = Object.keys(NOTE_CATS);

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  subject: { type: String, default: 'সাধারণ', trim: true, maxlength: 100 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  category: { type: String, enum: NOTE_VALUES, default: 'alochona', index: true },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  order: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now }
});

noteSchema.index({ category: 1, phase: 1, createdAt: -1 });

noteSchema.statics.NOTE_CATS = NOTE_CATS;
noteSchema.statics.NOTE_VALUES = NOTE_VALUES;

module.exports = mongoose.model('Note', noteSchema);
