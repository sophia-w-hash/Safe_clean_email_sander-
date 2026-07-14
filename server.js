const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');
const crypto     = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'fast-mailer-secure-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, 
    httpOnly: true, 
    sameSite: 'lax', 
    maxAge: 1000 * 60 * 60 * 8
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
  if (username === 'y' && password === 'y') {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Invalid credentials' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid'); 
    res.json({ success: true });
  });
});

// 🔥 ANTI-SPAM FILTER BYPASS ENGINE
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to, extraLink, linkLabel } = req.body;
  
  if (!gmailId || !appPassword || !to) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  // 🛠️ TECHNIQUE 1: UNIQUE EMAIL FINGERPRINT (Bypasses Duplicate Content Filters)
  const uniqueToken = crypto.randomBytes(4).toString('hex').toUpperCase(); // Example: A7B2
  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  // Dynamic Subject Decoration (Google algorithm reads this as a fresh email thread)
  const dynamicSubject = `${subject} [Ref: #${uniqueToken}]`;

  // 🛠️ TECHNIQUE 2: NATURAL PLAIN-HTML HYBRID LAYOUT
  let htmlContent = messageBody.replace(/\n/g, '<br>'); 
  
  if (extraLink && extraLink.trim() !== '') {
    const label = linkLabel && linkLabel.trim() !== '' ? linkLabel : 'Click Here to Verify';
    htmlContent += `<br><br><p style="margin:10px 0;"><a href="${extraLink}" style="color:#1a73e8;text-decoration:underline;font-weight:600;font-size:14px;">${label}</a></p>`;
  }

  // 12-Word Transactional Best Footer (Tells Gmail this is an authorized system alert)
  htmlContent += `
    <br><br>
    <hr style="border:none;border-top:1px solid #f1f3f4;margin:15px 0;">
    <p style="font-size:11px;color:#70757a;font-family:Roboto,Helvetica,Arial,sans-serif;margin:0;line-height:1.4;">
      Sent securely via FastMailer System. Secure transit hash verified at ${timestamp} (${uniqueToken}).
    </p>
  `;

  // 🛠️ TECHNIQUE 3: REAL-USER EMAIL HEADERS IMITATION
  const randomMessageId = `<${crypto.randomBytes(16).toString('hex')}@mail.gmail.com>`;

  const mailOptions = {
    from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
    to,
    subject: dynamicSubject,
    text: `${messageBody}\n\n[Ref ID: ${uniqueToken}]`, // Backup text version
    html: htmlContent,
    headers: {
      'Message-ID': randomMessageId,
      'X-Mailer': 'Nodemailer/Gmail-Client',
      'MIME-Version': '1.0',
      'X-Priority': '3', 
      'Importance': 'Normal',
      'X-Auto-Response-Suppress': 'OOF, AutoReply' // Stops auto-responders from flagging it
    }
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Delivery Error: ${to}`, err.message);
    res.status(500).json({ success: false, message: 'Delivery failed' });
  }
});

app.listen(PORT, () => console.log(`🚀 Advanced Anti-Spam Mailer running on port ${PORT}`));
