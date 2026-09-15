const mongoose = require('mongoose');

// গুরুত্বপূর্ণ তথ্য / নোটিশ
const importantSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, default: 'সাধারণ', trim: true, maxlength: 100 },
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Important', importantSchema);
