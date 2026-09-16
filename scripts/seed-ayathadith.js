require('dotenv').config();
const mongoose = require('mongoose');
const AyatHadith = require('../models/AyatHadith');
const items = [
  {title:'ঈমান বিষয়ক আয়াত', arabic:'إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ آمَنُوا بِاللَّهِ وَرَسُولِهِ', transliteration:'ইন্নামাল মু’মিনূনাল্লাযীনা আমানূ বিল্লাহি ওয়া রাসূলিহি', translation:'মুমিন তো তারাই যারা আল্লাহ ও তাঁর রাসূলের প্রতি ঈমান আনে।', reference:'সূরা হুজুরাত ১৫', phase:'abedonpotrer-purbe', kind:'ayat', topic:'ঈমান'},
  {title:'তাওহীদ বিষয়ক আয়াত', arabic:'قُلْ هُوَ اللَّهُ أَحَدٌ', transliteration:'ক্বুল হুওয়াল্লাহু আহাদ', translation:'বলুন, তিনিই আল্লাহ, এক ও অদ্বিতীয়।', reference:'সূরা ইখলাস ১', phase:'abedonpotrer-purbe', kind:'ayat', topic:'তাওহীদ'},
  {title:'রিসালাত বিষয়ক আয়াত', arabic:'مَّا كَانَ مُحَمَّدٌ أَبَا أَحَدٍ مِّن رِّجَالِكُمْ وَلَٰكِن رَّسُولَ اللَّهِ', transliteration:'মা কা-না মুহাম্মাদুন আবা আহাদিম...', translation:'মুহাম্মদ তোমাদের কোনো পুরুষের পিতা নন, বরং তিনি আল্লাহর রাসূল।', reference:'সূরা আহযাব ৪০', phase:'abedonpotrer-purbe', kind:'ayat', topic:'রিসালাত'},
  {title:'আখিরাত বিষয়ক আয়াত', arabic:'كُلُّ نَفْسٍ ذَائِقَةُ الْمَوْتِ', transliteration:'কুল্লু নাফসিন যা-ইক্বাতুল মাউত', translation:'প্রত্যেক প্রাণীকে মৃত্যুর স্বাদ গ্রহণ করতে হবে।', reference:'সূরা আল-ইমরান ১৮৫', phase:'abedonpotrer-purbe', kind:'ayat', topic:'আখিরাত'},
  {title:'তাকওয়া বিষয়ক আয়াত', arabic:'يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ حَقَّ تُقَاتِهِ', transliteration:'ইয়া আইয়্যুহাল্লাযীনা আমানুত্তাক্বুল্লাহা...', translation:'হে মুমিনগণ! আল্লাহকে যথাযথভাবে ভয় কর।', reference:'সূরা আল-ইমরান ১০২', phase:'abedonpotrer-purbe', kind:'ayat', topic:'তাকওয়া'},
  {title:'নিয়ত বিষয়ক হাদিস', arabic:'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', transliteration:'ইন্নামাল আ‘মালু বিন নিয়্যাত', translation:'নিশ্চয় সকল কাজ নিয়তের উপর নির্ভরশীল।', reference:'বুখারি ১', phase:'abedonpotrer-purbe', kind:'hadis', topic:'নিয়ত'},
  {title:'ইলম বিষয়ক হাদিস', arabic:'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ', transliteration:'ত্বলাবুল ‘ইলমি ফারীদাতুন...', translation:'জ্ঞান অর্জন প্রত্যেক মুসলমানের উপর ফরজ।', reference:'ইবনে মাজাহ ২২৪', phase:'abedonpotrer-purbe', kind:'hadis', topic:'ইলম'},
  {title:'আখলাক বিষয়ক হাদিস', arabic:'إِنَّمَا بُعِثْتُ لِأُتَمِّمَ مَكَارِمَ الْأَخْلَاقِ', transliteration:'ইন্নামা বু‘ইছতু লি উতাম্মিমা...', translation:'আমি উত্তম চরিত্র পূর্ণ করতে প্রেরিত হয়েছি।', reference:'মুয়াত্তা', phase:'abedonpotrer-purbe', kind:'hadis', topic:'আখলাক'},
  {title:'জান্নাত বিষয়ক আয়াত', arabic:'وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ', transliteration:'ওয়া সা-রি‘ঊ ইলা মাগফিরাতিম...', translation:'তোমরা তোমাদের রবের ক্ষমা ও জান্নাতের দিকে ধাবিত হও।', reference:'সূরা আল-ইমরান ১৩৩', phase:'proshnopotrer-purbe', kind:'ayat', topic:'জান্নাত'},
  {title:'জাহান্নাম বিষয়ক আয়াত', arabic:'إِنَّ جَهَنَّمَ كَانَتْ مِرْصَادًا', transliteration:'ইন্না জাহান্নামা কা-নাত মিরসাদা', translation:'নিশ্চয় জাহান্নাম ওঁৎ পেতে রয়েছে।', reference:'সূরা নাবা ২১', phase:'proshnopotrer-purbe', kind:'ayat', topic:'জাহান্নাম'},
  {title:'সবর বিষয়ক আয়াত', arabic:'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ', transliteration:'ইয়া আইয়্যুহাল্লাযীনা আমানুসতা‘ঈনূ...', translation:'হে মুমিনগণ! ধৈর্য ও নামাজের মাধ্যমে সাহায্য চাও।', reference:'সূরা বাকারা ১৫৩', phase:'proshnopotrer-purbe', kind:'ayat', topic:'সবর'},
  {title:'সবর বিষয়ক হাদিস', arabic:'عَجَبًا لِأَمْرِ الْمُؤْمِنِ', transliteration:'‘আজাবান লি আমরিল মু’মিন', translation:'মুমিনের বিষয় বিস্ময়কর।', reference:'মুসলিম ২৯৯৯', phase:'proshnopotrer-purbe', kind:'hadis', topic:'সবর'},
  {title:'জান্নাত বিষয়ক হাদিস', arabic:'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا', transliteration:'মান সালাকা ত্বরীক্বান...', translation:'যে জ্ঞানের পথে চলে, আল্লাহ তার জন্য জান্নাত সহজ করেন।', reference:'মুসলিম ২৬৯৯', phase:'proshnopotrer-purbe', kind:'hadis', topic:'জান্নাত'},
  {title:'যাকাত বিষয়ক আয়াত', arabic:'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ', transliteration:'ওয়া আক্বীমুস সালা-তা...', translation:'তোমরা নামাজ কায়েম কর এবং যাকাত দাও।', reference:'সূরা বাকারা ৪৩', phase:'shopother-purbe', kind:'ayat', topic:'যাকাত'},
  {title:'রাষ্ট্র বিষয়ক আয়াত', arabic:'وَأَمْرُهُمْ شُورَىٰ بَيْنَهُمْ', transliteration:'ওয়া আমরুহুম শূরা বাইনাহুম', translation:'তাদের কাজ পরস্পর পরামর্শের ভিত্তিতে হয়।', reference:'সূরা শূরা ৩৮', phase:'shopother-purbe', kind:'ayat', topic:'রাষ্ট্র'},
  {title:'পিতা-মাতার হক বিষয়ক আয়াত', arabic:'وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا', transliteration:'ওয়া ক্বাদ্বা রব্বুকা...', translation:'তোমার রব নির্দেশ দিয়েছেন... পিতা-মাতার সাথে সদ্ব্যবহার কর।', reference:'সূরা বনী ইসরাঈল ২৩', phase:'shopother-purbe', kind:'ayat', topic:'পিতা-মাতা'},
];
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI);
  await AyatHadith.deleteMany({});
  const ins = await AyatHadith.insertMany(items);
  console.log('inserted', ins.length);
  await mongoose.disconnect();
})();
