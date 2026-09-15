const mongoose = require('mongoose');

// Suspicious/attack traffic log. TTL 30 days so collection can't grow forever.
// Only flagged events are persisted (rate-limit hits, failed logins, ban hits,
// 404 floods) — normal page views stay in memory only (middleware/traffic.js).
const securityEventSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, trim: true, maxlength: 100, index: true },
    kind: {
      type: String,
      required: true,
      enum: ['ratelimit', 'login-fail', 'banned-hit', 'notfound', 'flood', 'admin-write'],
      index: true
    },
    path: { type: String, default: '', trim: true, maxlength: 500 },
    method: { type: String, default: 'GET', trim: true, maxlength: 10 },
    userAgent: { type: String, default: '', trim: true, maxlength: 500 },
    status: { type: Number, default: 0 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

securityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
