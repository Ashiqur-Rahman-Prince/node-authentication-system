const crypto = require("crypto");

function createOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { createOtp, hashValue, createResetToken };
