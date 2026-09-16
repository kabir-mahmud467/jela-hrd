require('dotenv').config();
const mongoose = require('mongoose');
const AyatHadith = require('../models/AyatHadith');
const checklist = require('../config/checklist');
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI);
  await AyatHadith.deleteMany({});
  const items=[];
  for(const phase of Object.keys(checklist)){
    for(const it of checklist[phase]){
      if(it.c.includes('আয়াত') || it.c.includes('আয়াত') || it.c.includes('হাদিস')){
        const isHadis = it.c.includes('হাদিস');
        const kind = isHadis ? 'hadis' : 'ayat';
        // use topic as the category without count
        const topic = it.c.replace(/\(.*\)/,'').trim();
        items.push({
          title: it.t,
          arabic: isHadis ? 'قَالَ رَسُولُ اللَّهِ ﷺ' : 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
          transliteration: isHadis ? 'Qala Rasulullahi ﷺ' : 'Bismillahir Rahmanir Rahim',
          translation: it.t + ' — এই বিষয়ে কুরআন/হাদিস মুখস্থ করতে হবে। বিস্তারিত অর্থ ও ব্যাখ্যা অ্যাডমিন থেকে যোগ করা যাবে।',
          reference: isHadis ? 'হাদিস গ্রন্থ' : 'কুরআন',
          phase,
          kind,
          topic
        });
      }
    }
  }
  const ins = await AyatHadith.insertMany(items);
  console.log('inserted', ins.length);
  console.log(await AyatHadith.aggregate([{$group:{_id:{phase:'$phase',kind:'$kind'},count:{$sum:1}}}]));
  await mongoose.disconnect();
})();
