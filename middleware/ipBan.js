const mongoose = require('mongoose');
const Ban = require('../models/Ban');

// IP normalize: ::ffff:127.0.0.1 -> 127.0.0.1 (IPv4-mapped IPv6)
function normIp(ip) {
  return (ip || '').toString().trim().replace(/^::ffff:/i, '');
}

function envBans() {
  return (process.env.BANNED_IPS || '')
    .split(',')
    .map(s => normIp(s))
    .filter(Boolean);
}

// DB hit কমাতে 60s in-memory cache; DB down থাকলে fail-open (শুধু env list)
let cache = { at: 0, set: new Set() };
const TTL = 60 * 1000;

async function bannedSet() {
  const now = Date.now();
  if (now - cache.at < TTL) return cache.set;
  const set = new Set(envBans());
  if (mongoose.connection.readyState === 1) {
    try {
      const bans = await Ban.find().select('ip').lean();
      bans.forEach(b => { if (b.ip) set.add(normIp(b.ip)); });
    } catch {
      // DB error → env list দিয়েই চলো
    }
  }
  cache = { at: now, set };
  return set;
}

function clearBanCache() {
  cache.at = 0;
}

// সব route-এর আগে বসে; ব্যানড IP → 403 পেজ
async function ipBanCheck(req, res, next) {
  req.clientIp = normIp(req.ip);
  try {
    const set = await bannedSet();
    if (set.has(req.clientIp)) {
      try {
        const { flagEvent } = require('./traffic');
        flagEvent({
          ip: req.clientIp,
          kind: 'banned-hit',
          path: req.originalUrl || req.path,
          method: req.method,
          userAgent: req.get('user-agent') || '',
          status: 403
        });
      } catch {
        // ignore
      }
      return res.status(403).render('403', { ip: req.clientIp });
    }
  } catch {
    // fail-open: চেক ব্যর্থ হলে request আটকিও না
  }
  next();
}

module.exports = { ipBanCheck, clearBanCache, normIp };
