const nodemailer = require('nodemailer');
const env = require('../config/env');

let transport = null;

function mailer() {
  if (!env.mailEnabled) return null;
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transport;
}

async function send({ to, subject, text, html }) {
  const transporter = mailer();
  if (!transporter) {
    if (!env.isProduction && !env.isTest) console.log(`[лист для ${to}] ${subject}\n${text}`);
    return false;
  }
  await transporter.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, text, html });
  return true;
}

module.exports = { send };
