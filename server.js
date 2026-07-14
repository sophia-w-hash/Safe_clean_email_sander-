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

// FIXED: EMAIL DISPATCH WITHOUT TOUCHING SUBJECT
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to, extraLink, linkLabel } = req.body;
  
  if (!gmailId || !appPassword || !to) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  // HTML Layout 
  let htmlContent = messageBody.replace(/\n/g, '<br>'); 
  
  if (extraLink && extraLink.trim() !== '') {
    const label = linkLabel && linkLabel.trim() !== '' ? linkLabel : 'Visit Website';
    htmlContent += `<br><br><p style="margin:10px 0;"><a href="${extraLink}" style="color:#1a73e8;text-decoration:underline;font-weight:600;font-size:14px;">${label}</a></p>`;
  }

  // Pure 12-Word Standard Small Footer
  htmlContent += `
    <br><br>
    <hr style="border:none;border-top:1px solid #f1f3f4;margin:15px 0;">
    <p style="font-size:11px;color:#70757a;font-family:sans-serif;margin:0;line-height:1.4;">
      Sent securely via FastMailer. Please do not reply directly to this email.
    </p>
  `;

  // Background Custom ID (Bina subject ya body ko ganda kiye, backend server optimization ke liye)
  const randomMessageId = `<${crypto.randomBytes(16).toString('hex')}@mail.gmail.com>`;

  const mailOptions = {
    from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
    to,
    subject: subject, // FIXED: Ekdum clean, wahi subject jo aapne likha hai!
    text: `${messageBody}\n\n---\nSent securely via FastMailer. Please do not reply directly to this email.`, 
    html: htmlContent,
    headers: {
      'Message-ID': randomMessageId,
      'X-Mailer': 'FastMailerClient',
      'MIME-Version': '1.0',
      'X-Priority': '3', 
      'Importance': 'Normal'
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

app.listen(PORT, () => console.log(`🚀 Mailer running successfully on port ${PORT}`));
