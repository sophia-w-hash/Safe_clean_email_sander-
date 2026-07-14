const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors()); // अगर आप किसी फ्रंटेंड से रिक्वेस्ट भेज रहे हैं

// Nodemailer Transporter सेटअप (High-Security & Reliable Settings)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: true, // पोर्ट 465 के लिए true (SSL)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    // स्पैम से बचने और बेहतर डिलीवरी के लिए TLS सेटिंग्स
    tls: {
        rejectUnauthorized: true 
    }
});

// ईमेल भेजने का API Route
app.post('/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;

    // बेसिक इनपुट वैलिडेशन (सुरक्षा के लिए)
    if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        const mailOptions = {
            from: `"Your App Name" <${process.env.SMTP_USER}>`, // प्रेषक का नाम और ईमेल
            to: to, // जिसे ईमेल भेजना है
            subject: subject, // विषय
            text: text, // प्लेन टेक्स्ट वर्जन
            html: html, // HTML वर्जन (अगर आप सुंदर ईमेल भेजना चाहते हैं)
            // स्पैम फिल्टर को पास करने के लिए Headers
            headers: {
                "X-Priority": "3",
                "X-MSMail-Priority": "Normal",
                "Importance": "Normal"
            }
        };

        // ईमेल भेजें
        const info = await transporter.sendMail(mailOptions);
        
        console.log("Email sent successfully: %s", info.messageId);
        return res.status(200).json({ success: true, message: "Email sent to inbox successfully!" });

    } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
});

// सर्वर चालू करें
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
