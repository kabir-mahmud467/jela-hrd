const mongoose = require('mongoose');

const BIBIDH_CATS = {
  'ilmul-quran': 'ইলমূল কুরআন',
  'ilmul-hadis': 'ইলমূল হাদিস',
  'ilmut-tajbid': 'ইলমুত তাজবীদ',
  'masala-masayel': 'মাসআলা-মাসায়েল',
  'shane-nuzul': 'শানে নুযুল',
  'jiboni': 'জীবনী',
  'dibosh': 'দিবস',
  'motobad': 'মতবাদ',
  'guruttopurno-ghotonaboli': 'গুরুত্বপূর্ণ ঘটনাবলী',
  'jatiyo-antorjatik': 'জাতীয় ও আন্তর্জাতিক',
  'onnanno-proshno': 'অন্যান্য প্রশ্ন',
  'samprotik-proshno': 'সাম্প্রতিক প্রশ্ন'
};
const BIBIDH_VALUES = Object.keys(BIBIDH_CATS);

const bibidhSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  category: { type: String, enum: BIBIDH_VALUES, default: 'ilmul-quran', index: true },
  reference: { type: String, default: '', trim: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now }
});

bibidhSchema.index({ category: 1, createdAt: -1 });

bibidhSchema.statics.BIBIDH_CATS = BIBIDH_CATS;
bibidhSchema.statics.BIBIDH_VALUES = BIBIDH_VALUES;

module.exports = mongoose.model('Bibidh', bibidhSchema);
