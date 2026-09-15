const mongoose = require('mongoose');

// দারস — ৩ ধারা: দারসুল কুরআন / দারসুল হাদিস / মাসনুন দুআ
const DARS = {
  'darsul-quran': 'দারসুল কুরআন',
  'darsul-hadis': 'দারসুল হাদিস',
  'masnun-dua': 'মাসনুন দুআ'
};
const DARS_VALUES = Object.keys(DARS);

const darsSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'শিরোনাম আবশ্যক'], trim: true, maxlength: 300 },
  content: { type: String, required: [true, 'বিস্তারিত আবশ্যক'], trim: true, maxlength: 10000 },
  kind: { type: String, enum: DARS_VALUES, default: 'darsul-quran', index: true },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now }
});

darsSchema.index({ kind: 1, createdAt: -1 });

darsSchema.statics.DARS = DARS;
darsSchema.statics.DARS_VALUES = DARS_VALUES;

module.exports = mongoose.model('Dars', darsSchema);
