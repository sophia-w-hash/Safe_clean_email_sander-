const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// 🔐 Credentials directly here (replace with your own)
const ADMIN_USER = "yourAdminUsername";
const ADMIN_PASS = "yourAdminPassword";
const SESSION_SECRET = "fast-mailer-secret-2024";
const GMAIL_ID = "yourgmail@gmail.com";
const GMAIL_APP_PASSWORD = "your16digitAppPassword";

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
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
  if (username === #### && password === ####) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Invalid username or password' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, subject, messageBody, to } = req.body;
  if (!to || !subject || !messageBody)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { 
      user: GMAIL_ID, 
      pass: GMAIL_APP_PASSWORD 
    }
  });

  try {
    await transporter.sendMail({
      from: senderName 
        ? `"${senderName}" <${GMAIL_ID}>` 
        : GMAIL_ID,
      to,
      subject,
      text: messageBody
    });
    res.json({ success: true, message: 'Email sent successfully!' });
  } catch (err) {
    console.error(`❌ Error sending to ${to}:`, err.message);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
