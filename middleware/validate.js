function str(v, max = 5000) {
  return (v ?? '').toString().trim().slice(0, max);
}

function isValidUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Admin ফর্ম validation — প্রশ্ন+উত্তরসহ সব মডেলের জন্য
function validateBody(kind, body) {
  const errors = [];
  const data = {};
  if (kind === 'question') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.question = str(body.question, 500);
    data.answer = str(body.answer, 5000);
    data.subject = str(body.subject, 100) || 'সাধারণ';
    data.chapter = str(body.chapter, 100);
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    if (data.question.length < 3) errors.push('প্রশ্ন কমপক্ষে ৩ অক্ষরের হতে হবে।');
    if (data.answer.length < 2) errors.push('উত্তর আবশ্যক।');
  } else if (kind === 'book') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.title = str(body.title, 300);
    data.author = str(body.author, 200);
    data.link = str(body.link, 2000);
    data.description = str(body.description, 2000);
    data.category = str(body.category, 100) || 'সাধারণ';
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    if (data.title.length < 2) errors.push('বইয়ের নাম আবশ্যক।');
    if (!isValidUrl(data.link)) errors.push('সঠিক লিংক দিন (http/https)।');
  } else if (kind === 'audiobook') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.title = str(body.title, 300);
    data.author = str(body.author, 200);
    data.audioLink = str(body.audioLink, 2000);
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    if (data.title.length < 2) errors.push('অডিওবুকের নাম আবশ্যক।');
    if (!isValidUrl(data.audioLink)) errors.push('সঠিক অডিও লিংক দিন (http/https)।');
  } else if (kind === 'note') {
    const NOTE_PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe'];
    const NOTE_VALUES = ['alochona', 'boi'];
    data.title = str(body.title, 300);
    data.content = str(body.content, 10000);
    data.category = str(body.category, 50) || 'alochona';
    if (!NOTE_VALUES.includes(data.category)) data.category = 'alochona';
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!NOTE_PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.content.length < 3) errors.push('নোটের বিস্তারিত আবশ্যক।');
  } else if (kind === 'dars') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.title = str(body.title, 300);
    data.content = str(body.content, 10000);
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    data.reference = str(body.reference, 300);
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.content.length < 3) errors.push('বিস্তারিত আবশ্যক।');
  } else if (kind === 'dua') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.title = str(body.title, 300);
    data.arabic = str(body.arabic, 2000);
    data.transliteration = str(body.transliteration, 2000);
    data.content = str(body.content, 10000);
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    data.reference = str(body.reference, 300);
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.content.length < 3) errors.push('অর্থ/ব্যাখ্যা আবশ্যক।');
  } else if (kind === 'ayathadith') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.title = str(body.title, 300);
    data.arabic = str(body.arabic, 2000);
    data.transliteration = str(body.transliteration, 2000);
    data.translation = str(body.translation, 10000);
    data.reference = str(body.reference, 300);
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    data.kind = str(body.kind, 20) || 'ayat';
    if (!['ayat','hadis'].includes(data.kind)) data.kind = 'ayat';
    data.topic = str(body.topic, 100);
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.translation.length < 3) errors.push('অর্থ আবশ্যক।');
  } else if (kind === 'surah') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.title = str(body.title, 200);
    data.arabic = str(body.arabic, 10000);
    data.transliteration = str(body.transliteration, 5000);
    data.translation = str(body.translation, 10000);
    data.reference = str(body.reference, 300);
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.translation.length < 3) errors.push('অর্থ আবশ্যক।');
  } else if (kind === 'bibidh') {
    const BIBIDH_VALUES = ['ilmul-quran','ilmul-hadis','ilmut-tajbid','masala-masayel','shane-nuzul','jiboni','dibosh','motobad','guruttopurno-ghotonaboli','jatiyo-antorjatik','onnanno-proshno','samprotik-proshno','likhito-porikkhar-proshno'];
    data.title = str(body.title, 300);
    data.content = str(body.content, 10000);
    data.category = str(body.category, 50) || 'ilmul-quran';
    if (!BIBIDH_VALUES.includes(data.category)) data.category = 'ilmul-quran';
    data.reference = str(body.reference, 300);
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.content.length < 3) errors.push('বিস্তারিত আবশ্যক।');
  } else if (kind === 'user') {
    data.username = str(body.username, 30).replace(/\s+/g, '');
    data.name = str(body.name, 100);
    data.phone = str(body.phone, 20);
    data.password = (body.password || '').toString().slice(0, 200);
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(data.username)) errors.push('ইউজারনেম ৩-৩০ অক্ষর (A-Z, 0-9, _, .) হতে হবে।');
    if (data.name.length < 2) errors.push('নাম আবশ্যক।');
    if (data.password.length < 4) errors.push('পাসওয়ার্ড কমপক্ষে ৪ অক্ষর হতে হবে।');
  }
  return { errors, data };
}

module.exports = { validateBody, isValidUrl };
