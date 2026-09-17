const fs = require('fs');
const path = require('path');

// CSS/JS cache-busting version: file mtimes + package version.
// Query string ?v= changes whenever CSS or JS changes, so browsers fetch fresh files
// even though express.static sends `Cache-Control: max-age=1d`.
let cached = { at: 0, ver: '1' };
const TTL = 5000;

function compute() {
  try {
    const css = path.join(__dirname, '..', 'public', 'css', 'style.css');
    const theme = path.join(__dirname, '..', 'public', 'css', 'theme.css');
    const js = path.join(__dirname, '..', 'public', 'js', 'main.js');
    const bijoy = path.join(__dirname, '..', 'lib', 'bijoy-converter.js');
    const adminBijoy = path.join(__dirname, '..', 'public', 'js', 'admin-bijoy.js');
    const bnFormat = path.join(__dirname, '..', 'lib', 'bn-format.js');
    const adminFormat = path.join(__dirname, '..', 'public', 'js', 'admin-format.js');
    const pkg = path.join(__dirname, '..', 'package.json');
    const mt = (p) => {
      try {
        return Math.floor(fs.statSync(p).mtimeMs / 1000);
      } catch {
        return 0;
      }
    };
    let pkgVer = '1';
    try {
      pkgVer = require('../package.json').version || '1';
    } catch {
      // ignore
    }
    return `${pkgVer}.${mt(css)}.${mt(theme)}.${mt(js)}.${mt(bijoy)}.${mt(adminBijoy)}.${mt(bnFormat)}.${mt(adminFormat)}`;
  } catch {
    return String(Date.now());
  }
}

function getAssetVer() {
  const now = Date.now();
  if (now - cached.at < TTL) return cached.ver;
  cached = { at: now, ver: compute() };
  return cached.ver;
}

module.exports = { getAssetVer };
