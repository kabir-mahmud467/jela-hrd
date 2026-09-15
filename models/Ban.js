const mongoose = require('mongoose');

// ব্যান করা IP — Admin Panel (/admin/bans) থেকে যোগ/মুক্ত করা যায়
const banSchema = new mongoose.Schema(
  {
    ip: { type: String, required: [true, 'IP আবশ্যক'], unique: true, trim: true, maxlength: 100 },
    reason: { type: String, default: '', trim: true, maxlength: 300 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ban', banSchema);
