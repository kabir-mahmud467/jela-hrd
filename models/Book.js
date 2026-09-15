const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// বই লিংক
function isHttpUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  author: { type: String, default: '', trim: true, maxlength: 200 },
  link: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
    validate: { validator: isHttpUrl, message: 'সঠিক লিংক দিন (http/https)।' }
  }, // PDF / Drive / বাইরের লিংক
  description: { type: String, default: '', trim: true, maxlength: 2000 },
  category: { type: String, default: 'সাধারণ', trim: true, maxlength: 100 },
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  createdAt: { type: Date, default: Date.now }
});

bookSchema.index({ phase: 1, createdAt: -1 });

module.exports = mongoose.model('Book', bookSchema);
