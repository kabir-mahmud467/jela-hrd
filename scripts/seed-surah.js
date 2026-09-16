require('dotenv').config();
const mongoose = require('mongoose');
const Surah = require('../models/Surah');
const list = [
  // abedon 15
  {title:'সূরা ফাতিহা', phase:'abedonpotrer-purbe', arabic:'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nالْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ\nالرَّحْمَٰنِ الرَّحِيمِ\nمَالِكِ يَوْمِ الدِّينِ\nإِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ\nاهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ\nصِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', transliteration:'বিসমিল্লাহির রাহমানির রাহীম\nআলহামদু লিল্লাহি রব্বিল আলামীন\nআর-রাহমানির রাহীম\nমা-লিকি ইয়াওমিদ্দীন\nইয়্যাকা না‘বুদু ওয়া ইয়্যাকা নাসতা‘ঈন\nইহদিনাস সিরাতাল মুসতাক্বীম\nসিরাতাল্লাযীনা আন‘আমতা আলাইহিম...', translation:'অনন্ত করুণাময় পরম দয়ালু আল্লাহর নামে।\nসমস্ত প্রশংসা আল্লাহর, যিনি জগতসমূহের প্রতিপালক।\nযিনি পরম করুণাময়, অতি দয়ালু।\nযিনি বিচার দিনের মালিক।\nআমরা কেবল আপনারই ইবাদত করি এবং আপনারই সাহায্য চাই।\nআমাদের সরল পথ দেখান।\nতাদের পথ, যাদের প্রতি আপনি অনুগ্রহ করেছেন...', reference:'সূরা ফাতিহা ১-৭'},
  {title:'সূরা আন-নাস', phase:'abedonpotrer-purbe', arabic:'قُلْ أَعُوذُ بِرَبِّ النَّاسِ\nمَلِكِ النَّاسِ\nإِلَٰهِ النَّاسِ\nمِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ\nالَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ\nمِنَ الْجِنَّةِ وَالنَّاسِ', transliteration:'ক্বুল আ‘ঊযু বিরাব্বিন না-স, মালিকিন না-স...', translation:'বলুন, আমি আশ্রয় চাই মানুষের রবের কাছে...', reference:'সূরা নাস ১-৬'},
  {title:'সূরা আল-ফালাক', phase:'abedonpotrer-purbe', arabic:'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ\nمِن شَرِّ مَا خَلَقَ\nوَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', transliteration:'ক্বুল আ‘ঊযু বিরাব্বিল ফালাক্ব...', translation:'বলুন, আমি আশ্রয় চাই ভোরের রবের কাছে...', reference:'সূরা ফালাক ১-৫'},
  {title:'সূরা আল-ইখলাস', phase:'abedonpotrer-purbe', arabic:'قُلْ هُوَ اللَّهُ أَحَدٌ\nاللَّهُ الصَّمَدُ\nلَمْ يَلِدْ وَلَمْ يُولَدْ\nوَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', transliteration:'ক্বুল হুওয়াল্লাহু আহাদ...', translation:'বলুন, তিনিই আল্লাহ এক...', reference:'সূরা ইখলাস ১-৪'},
  {title:'সূরা আল-লাহাব', phase:'abedonpotrer-purbe', arabic:'تَبَّتْ يَدَا أَبِي لَهَبٍ وَتَبَّ', transliteration:'তাব্বাত ইয়াদা আবী লাহাব...', translation:'ধ্বংস হোক আবু লাহাবের হাত...', reference:'সূরা লাহাব ১-৫'},
  {title:'সূরা আন-নাসর', phase:'abedonpotrer-purbe', arabic:'إِذَا جَاءَ نَصْرُ اللَّهِ وَالْفَتْحُ', transliteration:'ইযা জা-আ নাসরুল্লাহি ওয়াল ফাতহ...', translation:'যখন আল্লাহর সাহায্য ও বিজয় আসবে...', reference:'সূরা নাসর ১-৩'},
  {title:'সূরা আল-কাফিরুন', phase:'abedonpotrer-purbe', arabic:'قُلْ يَا أَيُّهَا الْكَافِرُونَ\nلَا أَعْبُدُ مَا تَعْبُدُونَ', transliteration:'ক্বুল ইয়া আইয়্যুহাল কা-ফিরূন...', translation:'বলুন, হে কাফিররা! আমি ইবাদত করি না যার ইবাদত তোমরা কর...', reference:'সূরা কাফিরুন ১-৬'},
  {title:'সূরা আল-কাওসার', phase:'abedonpotrer-purbe', arabic:'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ', transliteration:'ইন্না আ‘ত্বাইনা-কাল কাওছার...', translation:'নিশ্চয় আমি তোমাকে কাওসার দান করেছি...', reference:'সূরা কাওসার ১-৩'},
  {title:'সূরা আল-মাউন', phase:'abedonpotrer-purbe', arabic:'أَرَأَيْتَ الَّذِي يُكَذِّبُ بِالدِّينِ', transliteration:'আরাআইতাল্লাযী ইউকাযযিবু বিদ্দীন...', translation:'তুমি কি দেখেছ তাকে যে দ্বীনকে অস্বীকার করে...', reference:'সূরা মাউন ১-৭'},
  {title:'সূরা কুরাইশ', phase:'abedonpotrer-purbe', arabic:'لِإِيلَافِ قُرَيْشٍ', transliteration:'লি ঈলা-ফি ক্বুরাইশ...', translation:'কুরাইশের আসক্তির জন্য...', reference:'সূরা কুরাইশ ১-৪'},
  {title:'সূরা আল-ফীল', phase:'abedonpotrer-purbe', arabic:'أَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِأَصْحَابِ الْفِيلِ', transliteration:'আলাম তারা কাইফা ফা‘আলা রব্বুকা...', translation:'তুমি কি দেখনি তোমার রব হাতিওয়ালাদের সাথে কেমন করেছেন...', reference:'সূরা ফীল ১-৫'},
  {title:'সূরা আল-আসর', phase:'abedonpotrer-purbe', arabic:'وَالْعَصْرِ\nإِنَّ الْإِنسَانَ لَفِي خُسْرٍ', transliteration:'ওয়াল ‘আসর, ইন্নাল ইনসা-না লাফী খুসর...', translation:'সময়ের শপথ, নিশ্চয় মানুষ ক্ষতির মধ্যে...', reference:'সূরা আসর ১-৩'},
  {title:'সূরা আদ-দুহা', phase:'abedonpotrer-purbe', arabic:'وَالضُّحَىٰ\nوَاللَّيْلِ إِذَا سَجَىٰ', transliteration:'ওয়াদ্দুহা, ওয়াল্লাইলি ইযা সাজা...', translation:'শপথ পূর্বাহ্ণের, শপথ রাতের যখন তা নিঝুম হয়...', reference:'সূরা দুহা ১-১১'},
  {title:'সূরা আল-আ\'লা', phase:'abedonpotrer-purbe', arabic:'سَبِّحِ اسْمَ رَبِّكَ الْأَعْلَى', transliteration:'সাব্বিহিসমা রব্বিকাল আ‘লা...', translation:'তোমার মহান রবের নামের পবিত্রতা বর্ণনা কর...', reference:'সূরা আলা ১-১৯'},
  {title:'সূরা আল-বুরুজ', phase:'abedonpotrer-purbe', arabic:'وَالسَّمَاءِ ذَاتِ الْبُرُوجِ', transliteration:'ওয়াস সামা-ই যাতিল বুরূজ...', translation:'শপথ বুরুজ বিশিষ্ট আকাশের...', reference:'সূরা বুরুজ ১-২২'},
  // proshno 5
  {title:'সূরা আল-হুমাযাহ', phase:'proshnopotrer-purbe', arabic:'وَيْلٌ لِّكُلِّ هُمَزَةٍ لُّمَزَةٍ', transliteration:'ওয়াইলুল লি কুল্লি হুমাযাতিল লুমাযাহ...', translation:'ধ্বংস প্রত্যেক সামনে ও পেছনে নিন্দাকারীর জন্য...', reference:'সূরা হুমাযাহ ১-৯'},
  {title:'সূরা আত-তাকাসুর', phase:'proshnopotrer-purbe', arabic:'أَلْهَاكُمُ التَّكَاثُرُ', transliteration:'আলহা-কুমুত তাকা-ছুর...', translation:'প্রাচুর্যের প্রতিযোগিতা তোমাদের ভুলিয়ে রাখে...', reference:'সূরা তাকাসুর ১-৮'},
  {title:'সূরা আল-কারিয়াহ', phase:'proshnopotrer-purbe', arabic:'الْقَارِعَةُ\nمَا الْقَارِعَةُ', transliteration:'আল-ক্বারি‘আহ, মাল ক্বারি‘আহ...', translation:'মহা প্রলয়, কী সেই মহা প্রলয়...', reference:'সূরা কারিয়াহ ১-১১'},
  {title:'সূরা আশ-শারহ', phase:'proshnopotrer-purbe', arabic:'أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ', transliteration:'আলাম নাশরাহ লাকা সদরাক...', translation:'আমি কি তোমার বক্ষ প্রশস্ত করিনি...', reference:'সূরা ইনশিরাহ ১-৮'},
  {title:'সূরা আল-আদিয়াত', phase:'proshnopotrer-purbe', arabic:'وَالْعَادِيَاتِ ضَبْحًا', transliteration:'ওয়াল ‘আদিয়াতি দ্ববহা...', translation:'শপথ ঊর্ধ্বশ্বাসে ধাবমান অশ্বের...', reference:'সূরা আদিয়াত ১-১১'},
  // shopoth 5
  {title:'সূরা বায়্যিনাহ', phase:'shopother-purbe', arabic:'لَمْ يَكُنِ الَّذِينَ كَفَرُوا مِنْ أَهْلِ الْكِتَابِ', transliteration:'লাম ইয়াকুনিল্লাযীনা কাফারূ...', translation:'আহলে কিতাব ও মুশরিকদের মধ্যে যারা কুফরী করেছে...', reference:'সূরা বায়্যিনাহ ১-৮'},
  {title:'সূরা আল-লাইল', phase:'shopother-purbe', arabic:'وَاللَّيْلِ إِذَا يَغْشَىٰ', transliteration:'ওয়াল্লাইলি ইযা ইয়াগশা...', translation:'শপথ রাতের যখন তা আচ্ছন্ন করে...', reference:'সূরা লাইল ১-২১'},
  {title:'সূরা আশ-শামস', phase:'shopother-purbe', arabic:'وَالشَّمْسِ وَضُحَاهَا', transliteration:'ওয়াশ শামসি ওয়া দুহা-হা...', translation:'শপথ সূর্যের ও তার কিরণের...', reference:'সূরা শামস ১-১৫'},
  {title:'সূরা আল-কদর', phase:'shopother-purbe', arabic:'إِنَّا أَنزَلْنَاهُ فِي لَيْلَةِ الْقَدْرِ', transliteration:'ইন্না আনযালনা-হু ফী লাইলাতিল ক্বদর...', translation:'নিশ্চয় আমি কুরআন অবতীর্ণ করেছি কদরের রাতে...', reference:'সূরা কদর ১-৫'},
  {title:'সূরা আল-বুরুজ (২)', phase:'shopother-purbe', arabic:'وَالسَّمَاءِ ذَاتِ الْبُرُوجِ', transliteration:'ওয়াস সামা-ই যাতিল বুরূজ...', translation:'শপথ বুরুজ বিশিষ্ট আকাশের... (পুনরায়)', reference:'সূরা বুরুজ ১-২২'},
];
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI);
  await Surah.deleteMany({});
  const ins = await Surah.insertMany(list);
  console.log('inserted surah', ins.length);
  await mongoose.disconnect();
})();
