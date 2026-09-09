const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fast-mailer-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  res.redirect('/');
}

app.get('/', (req, res) => {
  if (req.session?.loggedIn) return res.redirect('/launcher');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/launcher', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || '@@';
  const validPass = process.env.ADMIN_PASS || '@@';
  if (username === validUser && password === validPass) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Invalid username or password' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

// Bulk email API (Sequential Processing Fix)
app.post('/api/send-bulk-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, recipients } = req.body;

  if (!gmailId || !appPassword || !recipients || !subject || !messageBody) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // App Password Formatting (Spaces remove karna necessary hai)
  const cleanAppPassword = appPassword.replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // TLS/SSL
    auth: { 
      user: gmailId.trim(), 
      pass: cleanAppPassword 
    }
  });

  // Step 1: Verification Check
  try {
    await transporter.verify();
  } catch (verifyError) {
    console.error("SMTP Auth Failed:", verifyError.message);
    return res.json({
      success: false,
      message: `Authentication Failed: ${verifyError.message}. Check App Password & 2FA.`
    });
  }

  const emailList = Array.isArray(recipients) 
    ? recipients 
    : recipients.split('\n').map(e => e.trim()).filter(e => e.length > 0);

  const results = [];

  // Step 2: Loop execution (One by One)
  for (let i = 0; i < emailList.length; i++) {
    const to = emailList[i];
    try {
      await transporter.sendMail({
        from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
        to: to,
        subject: subject,
        text: messageBody // Clean plain text for standard inboxing
      });

      console.log(`✅ Sent to ${to}`);
      results.push({ to, success: true });
    } catch (err) {
      console.error(`❌ Failed to send to ${to}:`, err.message);
      results.push({ to, success: false, error: err.message });
    }

    // Delay between emails to avoid rate limits
    if (i < emailList.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 Seconds gap
    }
  }

  res.json({ success: true, results });
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
