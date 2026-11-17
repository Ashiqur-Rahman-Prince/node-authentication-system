const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otpHash: {
    type: String,
    select: false
  },
  otpPurpose: {
    type: String,
    enum: ["signup", "reset"],
    select: false
  },
  otpExpiresAt: {
    type: Date,
    select: false
  },
  resetTokenHash: {
    type: String,
    select: false
  },
  resetTokenExpiresAt: {
    type: Date,
    select: false
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
