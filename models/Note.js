const mongoose = require('mongoose');

// আলোচনা নোট
const noteSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  subject: { type: String, default: 'সাধারণ', trim: true, maxlength: 100 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', noteSchema);
