const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware Setups
app.use(express.json());
app.use(cors());

// Static Files Serve करना (ताकि public फोल्डर की HTML फाइलें काम करें)
app.use(express.static(path.join(__dirname, 'public')));

// मुख्य रूट खोलते ही सीधे launcher.html ओपन होगा
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// ईमेल के लिए हाई-सिक्योरिटी SMTP ट्रांसपोर्टर
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, 
    auth: {
        user: process.env.SMTP_USER, // Render environment variable से आएगा
        pass: process.env.SMTP_PASS, // Render environment variable से आएगा
    },
    tls: {
        rejectUnauthorized: true // इनबॉक्स डिलीवरी और एंटी-स्पैम के लिए
    }
});

// ईमेल भेजने वाला API API URL
app.post('/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ success: false, message: "ज़रूरी फील्ड्स खाली हैं!" });
    }

    try {
        const mailOptions = {
            from: `"Support Team" <${process.env.SMTP_USER}>`,
            to: to,
            subject: subject,
            text: text, // एंटी-स्पैम के लिए टेक्स्ट बैकअप जरूरी है
            html: html, // सुन्दर टेम्पलेट के लिए HTML
            headers: {
                "X-Priority": "3",
                "X-MSMail-Priority": "Normal",
                "Importance": "Normal"
            }
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email Sent Successfully! ID:", info.messageId);
        return res.status(200).json({ success: true, message: "ईमेल सीधे इनबॉक्स में भेज दिया गया है!" });

    } catch (error) {
        console.error("Email Error:", error);
        return res.status(500).json({ success: false, message: "ईमेल भेजने में विफल", error: error.message });
    }
});

// सर्वर पोर्ट लिस्नर
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server launched and running on port ${PORT}`);
});
