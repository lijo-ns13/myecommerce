// mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // or another email service provider
    auth: {
        user: "lijons13@gmail.com",
        pass: "olwz yonf nzpi tjzv",
      },
});

const sendEmail = (to, subject, text) => {
    const mailOptions = {
        from: 'lijons13@gmail.com',
        to,
        subject,
        text
    };

    return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
