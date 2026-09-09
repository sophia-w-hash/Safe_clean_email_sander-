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

// Bulk Email API
app.post('/api/send-bulk-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, recipients } = req.body;

  if (!gmailId || !appPassword || !recipients || !subject || !messageBody) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  // App Password Formatting (Space Removal)
  const cleanAppPass = appPassword.trim().replace(/\s+/g, '');
  const cleanGmail = gmailId.trim();

  // Create Standard Transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS
    auth: {
      user: cleanGmail,
      pass: cleanAppPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify SMTP Connection First
  try {
    await transporter.verify();
  } catch (authError) {
    console.error("Gmail Auth Failed:", authError.message);
    return res.json({
      success: false,
      results: recipients.map(to => ({
        to,
        success: false,
        error: `Gmail Auth Error: ${authError.message}. Please complete DisplayUnlockCaptcha.`
      }))
    });
  }

  const results = [];
  const emailList = Array.isArray(recipients) ? recipients : [recipients];

  for (let i = 0; i < emailList.length; i++) {
    const to = emailList[i].trim();
    if (!to) continue;

    try {
      await transporter.sendMail({
        from: senderName ? `"${senderName}" <${cleanGmail}>` : cleanGmail,
        to: to,
        subject: subject,
        text: messageBody
      });
      results.push({ to, success: true });
    } catch (err) {
      results.push({ to, success: false, error: err.message });
    }

    if (i < emailList.length - 1) {
      await new Promise(r => setTimeout(r, 2000)); // 2-second delay
    }
  }

  res.json({ success: true, results });
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
