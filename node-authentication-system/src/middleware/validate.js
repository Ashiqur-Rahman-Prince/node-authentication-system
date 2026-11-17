function validateEmail(email) {
  return typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password) {
  return typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 72;
}

module.exports = { validateEmail, validatePassword };
