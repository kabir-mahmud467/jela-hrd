const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

function securityMiddleware(app) {
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Vercel / proxy-এর পেছনে সঠিক client IP-এর জন্য (rate limit + IP ban এখান থেকে IP নেয়)

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' }
    })
  );

  // NOTE: mongoSanitize + hpp এখানে নয় — body parser-এর পরে sanitizeMiddleware
  // হিসেবে বসে (app.js দেখো)। আগে বসালে req.body তখনও undefined থাকে,
  // ফলে POST body sanitize হতো না।
}

// Body parser-এর পরে বসে — NoSQL injection + HPP প্রতিরোধ (body সহ)।
// Express 4-এ req.query writable, তাই সরাসরি assign নিরাপদ।
function sanitizeMiddleware(req, res, next) {
  try {
    mongoSanitize()(req, res, (err) => {
      if (err) return next(err);
      try {
        hpp()(req, res, next);
      } catch (e) {
        next(e);
      }
    });
  } catch (err) {
    next(err);
  }
}

// Rate limit ভাঙলে plain text নয় — সুন্দর 429 পেজ (+ DB-তে attack log)
function tooMany(req, res) {
  try {
    const { flagEvent } = require('./traffic');
    const ip = ((req.clientIp || req.ip || '') + '').replace(/^::ffff:/i, '');
    flagEvent({
      ip,
      kind: 'ratelimit',
      path: req.originalUrl || req.path,
      method: req.method,
      userAgent: req.get('user-agent') || '',
      status: 429
    });
  } catch {
    // logging ব্যর্থ হলেও 429 দেখাও
  }
  try {
    res.status(429).render('429', (rErr, html) => {
      if (rErr || !html) {
        if (!res.headersSent) res.status(429).send('অনেক বেশি রিকোয়েস্ট — কিছুক্ষণ পরে আবার চেষ্টা করুন।');
        return;
      }
      res.send(html);
    });
  } catch {
    if (!res.headersSent) res.status(429).send('অনেক বেশি রিকোয়েস্ট — কিছুক্ষণ পরে আবার চেষ্টা করুন।');
  }
}

// Global IP rate limit: প্রতি IP, 15 মিনিটে 300 req
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany
});

// Login brute-force প্রতিরোধ: প্রতি IP, 15 মিনিটে 10 বার (সফল লগিন গণনায় আসে না)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooMany
});

// Admin write (POST) — প্রতি IP, 1 মিনিটে 60 বার
const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany
});

module.exports = { securityMiddleware, sanitizeMiddleware, globalLimiter, loginLimiter, adminWriteLimiter };
