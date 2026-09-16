const { exec } = require('child_process');

const suspiciousPatterns = /\.(php|asp|aspx|jsp|cgi)$|wp-admin|wp-content|wp-includes|phpinfo|adminer|\.env$/i;

const offenders = new Map(); // IP -> { count, firstSeen }
const BLOCK_THRESHOLD = 5;
const BLOCK_WINDOW_MS = 10 * 60 * 1000; // 10 min

function banIP(ip) {
  const cmd = `netsh advfirewall firewall add rule name="Block_${ip}" dir=in action=block remoteip=${ip}`;
  exec(cmd, (err) => {
    if (err) console.error('Erreur ban IP:', err);
    else console.log(`IP bannie au niveau pare-feu: ${ip}`);
  });
}

function blockScanners(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;

  if (suspiciousPatterns.test(req.path)) {
    const entry = offenders.get(ip) || { count: 0, firstSeen: Date.now() };
    entry.count++;

    if (Date.now() - entry.firstSeen > BLOCK_WINDOW_MS) {
      entry.count = 1;
      entry.firstSeen = Date.now();
    }

    offenders.set(ip, entry);

    if (entry.count >= BLOCK_THRESHOLD) {
      banIP(ip)
      console.warn(`IP bloquée pour scan: ${ip}`);
    }

    return res.status(404).end(); // reste discret, pas de 403 qui confirme le blocage
  }

  next();
}

module.exports = blockScanners;