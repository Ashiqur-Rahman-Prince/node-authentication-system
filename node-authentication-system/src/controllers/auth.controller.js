const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createOtp, hashValue, createResetToken } = require("../utils/security");
const { sendOtpEmail } = require("../utils/email");
const { validateEmail, validatePassword } = require("../middleware/validate");

const otpMinutes = Number(process.env.OTP_EXPIRES_MINUTES || 5);
const resetMinutes = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES || 10);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createJwt(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified
  };
}

exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name must be at least 2 characters." });
    }
    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, message: "Password must be 8-72 characters long." });
    }

    let user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (user && user.isVerified) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = createOtp();
    const otpHash = hashValue(otp);
    const otpExpiresAt = new Date(Date.now() + otpMinutes * 60 * 1000);

    if (!user) {
      user = new User({
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        isVerified: false
      });
    } else {
      user.name = String(name).trim();
      user.password = hashedPassword;
    }

    user.otpHash = otpHash;
    user.otpPurpose = "signup";
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    await sendOtpEmail(normalizedEmail, otp, "signup");

    return res.status(201).json({
      success: true,
      message: "Account created. Check your email for the verification code.",
      email: normalizedEmail
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { otp, purpose = "signup" } = req.body;

    if (!validateEmail(email) || !/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({ success: false, message: "A valid email and 6-digit OTP are required." });
    }
    if (!["signup", "reset"].includes(purpose)) {
      return res.status(400).json({ success: false, message: "Invalid OTP purpose." });
    }

    const user = await User.findOne({ email })
      .select("+otpHash +otpPurpose +otpExpiresAt");

    if (!user || !user.otpHash || user.otpPurpose !== purpose ||
        !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now() ||
        hashValue(String(otp)) !== user.otpHash) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code." });
    }

    user.otpHash = undefined;
    user.otpPurpose = undefined;
    user.otpExpiresAt = undefined;

    if (purpose === "signup") {
      user.isVerified = true;
      await user.save();
      const token = createJwt(user);
      return res.status(200).json({
        success: true,
        message: "Email verified successfully.",
        token,
        user: publicUser(user)
      });
    }

    const resetToken = createResetToken();
    user.resetTokenHash = hashValue(resetToken);
    user.resetTokenExpiresAt = new Date(Date.now() + resetMinutes * 60 * 1000);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified. Use the reset token to set a new password.",
      resetToken,
      expiresInMinutes: resetMinutes
    });
  } catch (error) {
    next(error);
  }
};

exports.signin = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!validateEmail(email) || typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, message: "Valid email and password are required." });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "Please verify your email before signing in." });
    }

    const token = createJwt(user);
    return res.status(200).json({
      success: true,
      message: "Signed in successfully.",
      token,
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const user = await User.findOne({ email });
    // Same response whether the account exists or not, to reduce account enumeration.
    if (user && user.isVerified) {
      const otp = createOtp();
      user.otpHash = hashValue(otp);
      user.otpPurpose = "reset";
      user.otpExpiresAt = new Date(Date.now() + otpMinutes * 60 * 1000);
      user.resetTokenHash = undefined;
      user.resetTokenExpiresAt = undefined;
      await user.save();
      await sendOtpEmail(email, otp, "reset");
    }

    return res.status(200).json({
      success: true,
      message: "If an eligible account exists, a password reset code has been sent."
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (typeof resetToken !== "string" || resetToken.length < 32) {
      return res.status(400).json({ success: false, message: "A valid reset token is required." });
    }
    if (!validatePassword(newPassword)) {
      return res.status(400).json({ success: false, message: "New password must be 8-72 characters long." });
    }

    const user = await User.findOne({
      resetTokenHash: hashValue(resetToken),
      resetTokenExpiresAt: { $gt: new Date() }
    }).select("+resetTokenHash +resetTokenExpiresAt");

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token. Request a new code." });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    user.otpHash = undefined;
    user.otpPurpose = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    next(error);
  }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose || "signup";

    if (!validateEmail(email) || !["signup", "reset"].includes(purpose)) {
      return res.status(400).json({ success: false, message: "Valid email and OTP purpose are required." });
    }

    const user = await User.findOne({ email });
    if (!user || (purpose === "signup" && user.isVerified) ||
        (purpose === "reset" && !user.isVerified)) {
      return res.status(200).json({ success: true, message: "If the account is eligible, a new code has been sent." });
    }

    const otp = createOtp();
    user.otpHash = hashValue(otp);
    user.otpPurpose = purpose;
    user.otpExpiresAt = new Date(Date.now() + otpMinutes * 60 * 1000);
    await user.save();
    await sendOtpEmail(email, otp, purpose);

    return res.status(200).json({ success: true, message: "A new verification code has been sent." });
  } catch (error) {
    next(error);
  }
};
