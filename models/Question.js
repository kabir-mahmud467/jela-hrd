const mongoose = require('mongoose');

function toSlug(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'proshno';
}

const PHASES = {
  'abedonpotrer-purbe': 'আবেদনপত্রের পূর্বে',
  'proshnopotrer-purbe': 'প্রশ্নপত্রের পূর্বে',
  'shopother-purbe': 'শপথের পূর্বে'
};
const PHASE_VALUES = Object.keys(PHASES);

// গুরুত্বপূর্ণ প্রশ্ন — ৩টি পর্বে ভাগ: আবেদনপত্রের পূর্বে / প্রশ্নপত্রের পূর্বে / শপথের পূর্বে
const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: [true, 'প্রশ্ন আবশ্যক'], trim: true, maxlength: 500 },
    answer: { type: String, required: [true, 'উত্তর আবশ্যক'], trim: true, maxlength: 5000 },
    subject: { type: String, default: 'সাধারণ', trim: true, maxlength: 100 },
    chapter: { type: String, default: '', trim: true, maxlength: 100 },
    phase: { type: String, enum: PHASE_VALUES, default: 'abedonpotrer-purbe', index: true },
    slug: { type: String, unique: true, index: true },
    views: { type: Number, default: 0 }
  },
  { timestamps: true }
);

questionSchema.pre('save', async function (next) {
  if (!this.isModified('question') && this.slug) return next();
  const base = toSlug(this.question);
  let slug = base;
  // সংঘর্ষ হলে unique না পাওয়া পর্যন্ত suffix বাড়াও
  for (let i = 0; i < 5; i++) {
    const exists = await this.constructor.findOne({ slug, _id: { $ne: this._id } }).select('_id').lean();
    if (!exists) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  this.slug = slug;
  next();
});

questionSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const set = update.$set || update;
  const q = set.question;
  if (q) {
    const base = toSlug(q);
    let slug = base;
    const docId = this.getQuery()._id;
    for (let i = 0; i < 5; i++) {
      const exists = await this.model.findOne({ slug, _id: { $ne: docId } }).select('_id').lean();
      if (!exists) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    if (update.$set) update.$set.slug = slug;
    else update.slug = slug;
    this.setUpdate(update);
  }
  next();
});

questionSchema.index({ subject: 1, createdAt: -1 });
questionSchema.index({ phase: 1, createdAt: -1 });

questionSchema.statics.PHASES = PHASES;
questionSchema.statics.PHASE_VALUES = PHASE_VALUES;

module.exports = mongoose.model('Question', questionSchema);
