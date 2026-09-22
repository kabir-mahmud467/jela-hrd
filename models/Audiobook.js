const mongoose = require('mongoose');
const { PHASE_VALUES } = require('./Question');

// অডিওবুক লিংক (বই রুটের মতোই, শুধু PDF-এর বদলে অডিও)
function isHttpUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const audiobookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  author: { type: String, default: '', trim: true, maxlength: 200 },
  audioLink: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
    validate: { validator: isHttpUrl, message: 'সঠিক অডিও লিংক দিন (http/https)।' }
  }, // MP3 / Drive / বাইরের অডিও লিংক
  phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
  order: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

audiobookSchema.index({ phase: 1, createdAt: -1 });

module.exports = mongoose.model('Audiobook', audiobookSchema);
