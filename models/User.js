const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// App user — admin panel থেকে তৈরি (username + name + phone + password)।
// User /login দিয়ে লগিন করে, চেকলিস্ট অগ্রগতি DB-তে সেভ থাকে, admin দেখতে পারে।
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, maxlength: 30 },
  name: { type: String, default: '', trim: true, maxlength: 100 },
  phone: { type: String, default: '', trim: true, maxlength: 20 },
  password: { type: String, required: true }, // hashed
  progress: { type: mongoose.Schema.Types.Mixed, default: {} }, // { phase: { index: 1 } }
  apiToken: { type: String, default: '', index: true }, // app (offline reader) token login
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.issueToken = async function () {
  this.apiToken = crypto.randomBytes(32).toString('hex');
  this.updatedAt = new Date();
  await this.save();
  return this.apiToken;
};

userSchema.methods.publicJSON = function () {
  return {
    username: this.username,
    name: this.name || '',
    phone: this.phone || '',
    progress: this.progress || {},
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);
