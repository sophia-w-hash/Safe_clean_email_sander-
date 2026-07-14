const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

// public फोल्डर की HTML फाइलों को सर्व करने के लिए
app.use(express.static(path.join(__dirname, 'public')));

// मुख्य URL पर सीधे launcher.html ओपन होगा
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// हाई-इनबॉक्स डिलीवरी SMTP ट्रांसपोर्टर
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: true
    }
});

// मल्टीपल ईमेल भेजने का API रूट
app.post('/send-bulk-emails', async (req, res) => {
    const { emails, subject, text, html } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0 || !subject) {
        return res.status(400).json({ success: false, message: "Invalid Inputs or Missing Fields!" });
    }

    // खाली या इनवैलिड ईमेल को हटाना Filter करना
    const validEmails = emails.filter(email => email && email.trim() !== "");

    if (validEmails.length === 0) {
        return res.status(400).json({ success: false, message: "No valid email addresses provided!" });
    }

    try {
        // सभी 6 ईमेल्स को एक साथ (Parallel) भेजने के लिए Promises का इस्तेमाल
        const emailPromises = validEmails.map(toEmail => {
            const mailOptions = {
                from: `"Support Team" <${process.env.SMTP_USER}>`,
                to: toEmail.trim(),
                subject: subject,
                text: text,
                html: html,
                headers: {
                    "X-Priority": "3",
                    "X-MSMail-Priority": "Normal",
                    "Importance": "Normal"
                }
            };
            return transporter.sendMail(mailOptions);
        });

        // सब ईमेल एक साथ फायर होंगे
        await Promise.all(emailPromises);
        
        console.log(`Successfully sent ${validEmails.length} emails directly to inbox.`);
        return res.status(200).json({ success: true, message: `All ${validEmails.length} emails sent successfully!` });

    } catch (error) {
        console.error("Bulk Email Error:", error);
        return res.status(500).json({ success: false, message: "Failed to send some or all emails", error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`6-Email Launcher running on port ${PORT}`);
});
