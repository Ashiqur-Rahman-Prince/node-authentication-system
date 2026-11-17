const nodemailer = require("nodemailer");

function getTransporter() {
  const required = ["MAIL_HOST", "MAIL_PORT", "MAIL_USER", "MAIL_PASS"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Email configuration missing: ${missing.join(", ")}`);
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: String(process.env.MAIL_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });
}

async function sendOtpEmail(email, otp, purpose) {
  const transporter = getTransporter();
  const isSignup = purpose === "signup";
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: email,
    subject: isSignup ? "Verify your email address" : "Password reset verification code",
    text: `Your verification code is ${otp}. It expires in ${process.env.OTP_EXPIRES_MINUTES || 5} minutes. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2>${isSignup ? "Verify your email" : "Reset your password"}</h2>
        <p>Your one-time verification code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f3f4f6;text-align:center;border-radius:8px">${otp}</div>
        <p>This code expires in ${process.env.OTP_EXPIRES_MINUTES || 5} minutes. Do not share it with anyone.</p>
      </div>`
  });
}

module.exports = { sendOtpEmail };
