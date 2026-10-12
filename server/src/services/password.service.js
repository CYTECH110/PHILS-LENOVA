const bcrypt = require('bcrypt');

const COST = 12;

function hashPassword(password) {
  return bcrypt.hash(password, COST);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };
