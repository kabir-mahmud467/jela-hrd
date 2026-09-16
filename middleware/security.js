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

  // NoSQL injection প্রতিরোধ
  app.use(mongoSanitize());

  // HTTP Parameter Pollution প্রতিরোধ
  app.use(hpp());

  // JSON/URL body সাইজ সীমা
  // (app.js এ express.json({limit}) ব্যবহার হবে)
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
  res.status(429).render('429');
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

module.exports = { securityMiddleware, globalLimiter, loginLimiter, adminWriteLimiter };
