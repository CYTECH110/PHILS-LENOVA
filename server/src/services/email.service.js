const nodemailer = require('nodemailer');
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  APP_BASE_URL,
  EMAIL_ENABLED
} = require('../config/env');

// A transport can be injected by tests so email can be asserted without SMTP.
let transportOverride = null;
let transporter = null;

function setEmailTransport(transport) {
  transportOverride = transport || null;
}

function getTransporter() {
  if (transportOverride) return transportOverride;
  if (!EMAIL_ENABLED) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char];
  });
}

// Best-effort send. Never throws into the request path: logs and returns null on failure.
async function sendEmail({ to, subject, text, html }) {
  const destination = typeof to === 'string' ? to.trim() : '';
  if (!destination) {
    console.log(`[email] skipped (no recipient): "${subject}"`);
    return null;
  }

  try {
    const transport = getTransporter();
    if (!transport) {
      console.log(`[email] skipped (delivery disabled): "${subject}" -> ${destination}`);
      return null;
    }
    const info = await transport.sendMail({ from: EMAIL_FROM, to: destination, subject, text, html });
    console.log(`[email] sent: "${subject}" -> ${destination}`);
    return info;
  } catch (error) {
    console.error(`[email] failed: "${subject}" -> ${destination}: ${error.message}`);
    return null;
  }
}

function buildResetLink(token) {
  const base = String(APP_BASE_URL || '').replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(user, token) {
  const to = user && user.email;
  if (!to) {
    console.log(`[email] skipped (user has no email): password reset for user ${user && user.id}`);
    return null;
  }

  const name = (user && (user.full_name || user.username)) || 'there';
  const link = buildResetLink(token);
  const subject = 'Reset your PHILS LEARNOVA password';
  const text = `Hello ${name},\n\nWe received a request to reset your password. This link is valid for 1 hour:\n${link}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = `<p>Hello ${escapeHtml(name)},</p><p>We received a request to reset your password. This link is valid for 1 hour:</p><p><a href="${escapeHtml(link)}">Reset your password</a></p><p>If you did not request this, you can safely ignore this email.</p>`;
  return sendEmail({ to, subject, text, html });
}

async function sendWelcomeEmail(user) {
  const to = user && user.email;
  if (!to) {
    console.log(`[email] skipped (user has no email): welcome for user ${user && user.username}`);
    return null;
  }

  const subject = 'Welcome to PHILS LEARNOVA!';
  const text = `Hello ${user.full_name},\n\nYour account has been successfully created. Your role is ${user.role}.\nPlease login with your username: ${user.username}.\n\nWelcome aboard!`;
  return sendEmail({ to, subject, text });
}

async function sendQuizSubmissionAlert(studentName, quizTitle, score, to) {
  const subject = `Quiz Submitted: ${quizTitle}`;
  const text = `Student ${studentName} has just submitted the quiz "${quizTitle}" with a score of ${score}.\n\nPlease review it in the dashboard.`;
  return sendEmail({ to: to || 'teacher@example.com', subject, text });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendQuizSubmissionAlert,
  buildResetLink,
  setEmailTransport
};
