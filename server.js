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

// SAFE SESSIONS: Added security attributes to prevent cookie theft
app.use(session({
  secret: process.env.SESSION_SECRET || 'fast-mailer-fallback-secure-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // production mein HTTPS mandatory hai
    httpOnly: true, // XSS attacks se session cookie protect karta hai
    sameSite: 'strict', // CSRF protection ke liye
    maxAge: 1000 * 60 * 60 * 8 // 8 Hours
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// Middleware to secure endpoints
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    return next();
  }
  return res.status(401).redirect('/');
}

app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) {
    return res.redirect('/launcher');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/launcher', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || 'y';
  const validPass = process.env.ADMIN_PASS || 'y';

  if (!username || !password) {
    return res.json({ success: false, message: 'Username and password are required' });
  }

  if (username === validUser && password === validPass) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Invalid username or password' });
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out' });
    }
    res.clearCookie('connect.sid'); // Session cookie ko browser se delete karna
    res.json({ success: true });
  });
});

// SECURE EMAIL DISPATCH: Basic validations and clean error handling
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;
  
  if (!gmailId || !appPassword || !to) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  // Simple validation to ensure email input is clean
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to) || !emailRegex.test(gmailId)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { 
      user: gmailId, 
      pass: appPassword 
    }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
      to,
      subject,
      text: messageBody
    });
    res.json({ success: true });
  } catch (err) {
    // Console log se client password leaks ko safety ke liye separate rakha hai
    console.error(`❌ Delivery failed to: ${to}`); 
    res.status(500).json({ success: false, message: 'Failed to send. Please check credentials or API limits.' });
  }
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer successfully running on port ${PORT}`));
