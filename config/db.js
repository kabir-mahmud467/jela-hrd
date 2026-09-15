const mongoose = require('mongoose');

// Fail fast when DB is down instead of hanging each request for 10s.
mongoose.set('bufferTimeoutMS', 3000);

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. .env / Vercel env এ সেট করুন।');
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000, // DB down থাকলে ৩০সে ঝুলে না থেকে ৫সে-এ fail
        connectTimeoutMS: 5000
      })
      .then(m => m)
      .catch(err => {
        cached.promise = null; // পরের request আবার retry করতে পারবে
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
