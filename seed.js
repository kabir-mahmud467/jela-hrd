require('dotenv').config();
const mongoose = require('mongoose');
const Important = require('./models/Important');
const Book = require('./models/Book');
const Note = require('./models/Note');
const Question = require('./models/Question');
const Dars = require('./models/Dars');
const Dua = require('./models/Dua');

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing in .env');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('Seeding...');

  try {

  if ((await Important.countDocuments()) === 0) {
    await Important.insertMany([
      { title: 'ভর্তি / পরীক্ষার গুরুত্বপূর্ণ নোটিশ', description: 'এখানে জেলার গুরুত্বপূর্ণ আপডেট থাকবে। Admin panel থেকে পরিবর্তন করুন।', category: 'নোটিশ', isPinned: true },
      { title: 'সাপ্তাহিক আলোচনা সভা', description: 'প্রতি শুক্রবার বিকাল ৩টায় আলোচনা সভা অনুষ্ঠিত হবে।', category: 'সভা' }
    ]);
  }
  if ((await Book.countDocuments()) === 0) {
    await Book.insertMany([
      { title: 'বাংলা ব্যাকরণ বই', author: 'ড. সুনীতিকুমার', link: 'https://example.com/book1.pdf', description: 'ব্যাকরণ শেখার সেরা বই', category: 'বাংলা', phase: 'abedonpotrer-purbe' },
      { title: 'সাধারণ জ্ঞান', author: 'সম্পাদনা পরিষদ', link: 'https://example.com/book2.pdf', description: 'চাকরি পরীক্ষার জন্য', category: 'GK', phase: 'proshnopotrer-purbe' }
    ]);
  }
  if ((await Note.countDocuments()) === 0) {
    await Note.insertMany([
      { title: 'আলোচনা নোট: ভাষা আন্দোলন', subject: 'বাংলাদেশ', content: '১৯৫২ সালের ভাষা আন্দোলন সম্পর্কে বিস্তারিত আলোচনা...\n\n১. পটভূমি\n২. গুরুত্ব\n৩. ফলাফল', phase: 'abedonpotrer-purbe' },
      { title: 'আলোচনা নোট: মুক্তিযুদ্ধ', subject: 'ইতিহাস', content: '১৯৭১ সালের মুক্তিযুদ্ধের ১১টি সেক্টর সম্পর্কে আলোচনা...', phase: 'proshnopotrer-purbe' }
    ]);
  }
  if ((await Dars.countDocuments()) === 0) {
    await Dars.insertMany([
      { title: 'দারসুল কুরআন: সূরা ফাতিহা', content: 'সূরা ফাতিহার সংক্ষিপ্ত তাফসির ও শিক্ষা...', kind: 'darsul-quran', phase: 'abedonpotrer-purbe', reference: 'সূরা ফাতিহা: ১-৭' },
      { title: 'দারসুল হাদিস: নিয়ত', content: 'কাজের ফলাফল নিয়তের ওপর নির্ভরশীল — এই হাদিসের ব্যাখ্যা...', kind: 'darsul-hadis', phase: 'proshnopotrer-purbe', reference: 'সহিহ বুখারি: ১' }
    ]);
  }
  if ((await Dua.countDocuments()) === 0) {
    await Dua.insertMany([
      { title: 'সকালে পড়ার দুআ', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا', content: 'হে আল্লাহ! আপনার অনুগ্রহে আমরা সকালে উপনীত হই...', cat: 'sokal-sondha', phase: 'abedonpotrer-purbe', reference: 'তিরমিজি' },
      { title: 'ঘুম থেকে ওঠার দুআ', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا', content: 'সমস্ত প্রশংসা আল্লাহর, যিনি আমাদের মৃত্যুর পর জীবিত করেছেন...', cat: 'doinondin', phase: 'proshnopotrer-purbe', reference: 'সহিহ বুখারি' },
      { title: 'সফরের দুআ', arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا', content: 'পবিত্র সেই সত্তা যিনি আমাদের জন্য এটিকে বশীভূত করেছেন...', cat: 'bipod-sofor', phase: 'shopother-purbe', reference: 'সহিহ মুসলিম' }
    ]);
  }
  if ((await Question.countDocuments()) === 0) {
    // save() ব্যবহার করলে slug auto-generate হবে
    const docs = [
      { question: 'বাংলাদেশের জাতীয় সংগীতের রচয়িতা কে?', answer: 'রবীন্দ্রনাথ ঠাকুর। আমার সোনার বাংলা গানটি ১৯০৫ সালে রচিত।', subject: 'সাধারণ জ্ঞান', chapter: 'জাতীয় বিষয়', phase: 'abedonpotrer-purbe' },
      { question: 'পদ্মা সেতুর দৈর্ঘ্য কত?', answer: '৬.১৫ কিলোমিটার। এটি বাংলাদেশের দীর্ঘতম সেতু।', subject: 'সাধারণ জ্ঞান', chapter: 'অবকাঠামো', phase: 'proshnopotrer-purbe' },
      { question: 'বাংলা বর্ণমালায় স্বরবর্ণ কয়টি?', answer: '১১টি। অ, আ, ই, ঈ, উ, ঊ, ঋ, এ, ঐ, ও, ঔ।', subject: 'বাংলা', chapter: 'ব্যাকরণ', phase: 'shopother-purbe' }
    ];
    for (const d of docs) {
      await new Question(d).save();
    }
  }

    console.log('Seed done');
  } finally {
    await mongoose.disconnect();
  }
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
