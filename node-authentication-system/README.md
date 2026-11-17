# Node.js Authentication System (Express + MongoDB)

A ready-to-run backend authentication API with:

- Signup with email OTP verification
- Signin with JWT
- Resend OTP
- Forgot password with email OTP
- Verify reset OTP and issue a short-lived reset token
- Reset password
- MongoDB/Mongoose database
- Password hashing with bcrypt
- Hashed OTP/reset token storage
- Helmet, CORS, request size limit, and rate limiting

## 1. Requirements

- Node.js 18 or newer
- MongoDB Community Server running locally, or a MongoDB Atlas connection
- MongoDB Compass (optional, for viewing the database)
- SMTP email account for sending OTPs

## 2. Install

Open this project folder in VS Code terminal:

```bash
npm install
```

Copy `.env.example` to `.env` and update the values:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Windows CMD
copy .env.example .env
```

Set a long random `JWT_SECRET` (at least 32 characters).

### Gmail SMTP setup

For Gmail, enable 2-Step Verification in your Google account and create an **App Password**. Put that App Password in `MAIL_PASS`. Do not use your normal Gmail password. Keep `.env` private and never commit it.

For another SMTP provider, update `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, and `MAIL_PASS`.

## 3. Start MongoDB

Make sure the MongoDB service is running. The default URI is:

```text
mongodb://127.0.0.1:27017/authentication_system
```

Open MongoDB Compass and connect with the same URI. The `authentication_system` database and `users` collection will appear after the first signup inserts a user.

## 4. Run server

Development:

```bash
npm run dev
```

Normal:

```bash
npm start
```

API base URL: `http://localhost:5000`

Check `http://localhost:5000/` to confirm the server is running.

## 5. API endpoints

All requests use JSON (`Content-Type: application/json`).

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/auth/signup` | `{ "name":"Prince", "email":"prince@example.com", "password":"StrongPass123" }` |
| POST | `/api/auth/verify-otp` | `{ "email":"prince@example.com", "otp":"123456", "purpose":"signup" }` |
| POST | `/api/auth/signin` | `{ "email":"prince@example.com", "password":"StrongPass123" }` |
| POST | `/api/auth/forgot-password` | `{ "email":"prince@example.com" }` |
| POST | `/api/auth/verify-otp` | `{ "email":"prince@example.com", "otp":"123456", "purpose":"reset" }` |
| POST | `/api/auth/reset-password` | `{ "resetToken":"TOKEN_FROM_VERIFY_RESPONSE", "newPassword":"NewStrongPass123" }` |
| POST | `/api/auth/resend-otp` | `{ "email":"prince@example.com", "purpose":"signup" }` |

Passwords must be 8-72 characters. OTP expires after `OTP_EXPIRES_MINUTES` (default 5). Reset token expires after `RESET_TOKEN_EXPIRES_MINUTES` (default 10).

### Signup flow

1. Call `POST /signup`.
2. Check the email inbox for the 6-digit OTP.
3. Call `/verify-otp` with `purpose: "signup"`.
4. The response contains a JWT token and public user details.

### Signin flow

Call `/signin`. A verified account receives a JWT token.

### Forgot/reset password flow

1. Call `/forgot-password` with the account email.
2. Check email for OTP.
3. Call `/verify-otp` with `purpose: "reset"`.
4. Copy `resetToken` from the response.
5. Call `/reset-password` with that token and `newPassword`.

## 6. Test using Postman

For each request:
- Method: `POST`
- URL: `http://localhost:5000/api/auth/...`
- Header: `Content-Type: application/json`
- Body: `raw` -> `JSON`

Use your actual email address to receive the OTP. Never paste real passwords or OTPs into public screenshots.

## 7. MongoDB Compass

1. Open MongoDB Compass.
2. Paste `mongodb://127.0.0.1:27017` and click Connect.
3. After the first signup, open `authentication_system` -> `users`.
4. Password, OTP and reset token are stored as hashes; the raw OTP is only sent by email.

## Notes

- This is a backend API; it does not include frontend pages.
- If SMTP is not configured, signup/reset email delivery will fail. Configure the `.env` mail values before testing OTP.
- In production, use HTTPS, a strong unique JWT secret, a trusted CORS origin, and consider separate rate limits for OTP and password endpoints.
- Do not expose `.env`, tokens, OTPs, or database credentials in GitHub.
