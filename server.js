const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SAFE SESSIONS Config
app.use(session({
  secret: 'fast-mailer-secure-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, 
    httpOnly: true, 
    sameSite: 'lax', 
    maxAge: 1000 * 60 * 60 * 8 // 8 Hours
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

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

// SECURE EMAIL DISPATCH WITH AUTO FOOTER
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to, extraLink, linkLabel } = req.body;
  
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

  // HTML Body Generation with Clean Footer and Link
  let htmlContent = messageBody.replace(/\n/g, '<br>'); 
  
  // 1. Check if Extra Link is present
  if (extraLink && extraLink.trim() !== '') {
    const label = linkLabel && linkLabel.trim() !== '' ? linkLabel : 'Visit Website';
    htmlContent += `<br><br><p style="margin:10px 0;"><a href="${extraLink}" target="_blank" style="color:#667eea;text-decoration:underline;font-weight:600;font-size:14px;">${label}</a></p>`;
  }

  // 2. Beautiful & Clean 12-Word Footer (Inbox Friendly)
  htmlContent += `
    <br><br>
    <hr style="border:none;border-top:1px solid #eee;margin:15px 0;">
    <p style="font-size:11px;color:#999;font-family:sans-serif;margin:0;line-height:1.4;">
      Sent securely via FastMailer. Please do not reply directly to this email.
    </p>
  `;

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
      to,
      subject,
      text: `${messageBody}\n\n---\nSent securely via FastMailer. Please do not reply directly to this email.`, // Plain text backup
      html: htmlContent // Clean styled HTML layout
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Delivery failed to: ${to}`); 
    res.status(500).json({ success: false, message: 'Failed to send.' });
  }
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer successfully running on port ${PORT}`));
