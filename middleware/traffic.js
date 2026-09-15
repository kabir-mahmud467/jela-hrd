const mongoose = require('mongoose');
const SecurityEvent = require('../models/SecurityEvent');

// In-memory rolling traffic counters (per IP). Normal views are counted here only —
// DB writes happen ONLY for flagged (suspicious) events so Mongo isn't spammed.
const hits = new Map(); // ip -> { count, firstSeen, lastSeen, paths: Map, uas: Set }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_IPS = 2000;

function prune() {
  const now = Date.now();
  for (const [ip, rec] of hits) {
    if (now - rec.lastSeen > WINDOW_MS) hits.delete(ip);
  }
  // Memory cap: drop oldest
  if (hits.size > MAX_IPS) {
    const sorted = [...hits.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (let i = 0; i < sorted.length - MAX_IPS; i++) hits.delete(sorted[i][0]);
  }
}

setInterval(prune, 60 * 1000).unref();

function recordRequest(req) {
  try {
    const ip = (req.clientIp || req.ip || '').toString().replace(/^::ffff:/i, '') || 'unknown';
    if (ip === 'unknown') return;
    const now = Date.now();
    let rec = hits.get(ip);
    if (!rec || now - rec.lastSeen > WINDOW_MS) {
      rec = { count: 0, firstSeen: now, lastSeen: now, paths: new Map(), uas: new Set() };
      hits.set(ip, rec);
    }
    rec.count += 1;
    rec.lastSeen = now;
    const p = `${req.method} ${req.path}`;
    rec.paths.set(p, (rec.paths.get(p) || 0) + 1);
    const ua = (req.get('user-agent') || '').slice(0, 120);
    if (ua) rec.uas.add(ua);
  } catch {
    // never break requests
  }
}

// Fire-and-forget DB flag (suspicious only). Never await in middleware.
function flagEvent({ ip, kind, path = '', method = 'GET', userAgent = '', status = 0 }) {
  try {
    if (!ip || mongoose.connection.readyState !== 1) return;
    if (!['ratelimit', 'login-fail', 'banned-hit', 'notfound', 'flood', 'admin-write'].includes(kind)) return;
    SecurityEvent.create({
      ip: String(ip).slice(0, 100),
      kind,
      path: String(path).slice(0, 500),
      method: String(method).slice(0, 10),
      userAgent: String(userAgent).slice(0, 500),
      status
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// Top talkers in current 15-min window (for /admin/security live view)
function getTopIps(limit = 50) {
  prune();
  return [...hits.entries()]
    .map(([ip, rec]) => ({
      ip,
      count: rec.count,
      firstSeen: rec.firstSeen,
      lastSeen: rec.lastSeen,
      topPath: [...rec.paths.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      paths: rec.paths.size,
      ua: [...rec.uas][0] || ''
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function trafficMiddleware(req, res, next) {
  recordRequest(req);
  next();
}

module.exports = { trafficMiddleware, recordRequest, flagEvent, getTopIps };
