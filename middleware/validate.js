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
  } else if (kind === 'note') {
    const PHASE_VALUES = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    data.title = str(body.title, 300);
    data.subject = str(body.subject, 100) || 'সাধারণ';
    data.content = str(body.content, 10000);
    data.phase = str(body.phase, 50) || 'abedonpotrer-purbe';
    if (!PHASE_VALUES.includes(data.phase)) data.phase = 'abedonpotrer-purbe';
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.content.length < 3) errors.push('নোটের বিস্তারিত আবশ্যক।');
  } else if (kind === 'dars') {
    const DARS_VALUES = ['darsul-quran', 'darsul-hadis', 'masnun-dua'];
    data.title = str(body.title, 300);
    data.content = str(body.content, 10000);
    data.kind = str(body.kind, 50) || 'darsul-quran';
    if (!DARS_VALUES.includes(data.kind)) data.kind = 'darsul-quran';
    data.reference = str(body.reference, 300);
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.content.length < 3) errors.push('বিস্তারিত আবশ্যক।');
  } else if (kind === 'important') {
    data.title = str(body.title, 300);
    data.description = str(body.description, 5000);
    data.category = str(body.category, 100) || 'সাধারণ';
    data.isPinned = !!body.isPinned;
    if (data.title.length < 2) errors.push('শিরোনাম আবশ্যক।');
    if (data.description.length < 3) errors.push('বিবরণ আবশ্যক।');
  }
  return { errors, data };
}

module.exports = { validateBody, isValidUrl };
