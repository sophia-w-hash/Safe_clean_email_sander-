const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SAFE SESSIONS
app.use(session({
  secret: 'fast-mailer-secure-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Local host par bina HTTPS ke chalane ke liye false rakha hai
    httpOnly: true, 
    sameSite: 'strict', 
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

  // FIXXED: Directly using your original default credentials 'y' and 'y'
  const validUser = 'y';
  const validPass = 'y';

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
    res.clearCookie('connect.sid'); 
    res.json({ success: true });
  });
});

// SECURE EMAIL DISPATCH (Same exact speed & batch logic)
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;
  
  if (!gmailId || !appPassword || !to) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

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
    console.error(`❌ Delivery failed to: ${to}`); 
    res.status(500).json({ success: false, message: 'Failed to send. Please check credentials or API limits.' });
  }
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer successfully running on port ${PORT}`));
