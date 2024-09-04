const nodemailer=require('nodemailer')
const dotenv=require('dotenv').config();
const mailHelper=async(option)=>{
    // const transporter = nodemailer.createTransport({
    //     host: process.env.SMTP_HOST,
    //     port: process.env.SMTP_PORT,
    //     secure: false, // Use `true` for port 465, `false` for all other ports
    //     auth: {
    //       user: process.env.SMTP_USER,
    //       pass: process.env.SMTP_PASS,
    //     },
    //   });
    
    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
          user: "lijons13@gmail.com",
          pass: "olwz yonf nzpi tjzv",
        },
      });
       const message={
        from: 'lijons13@gmail.com', // sender address
        to: option.email, // list of receivers
        subject: option.subject, // Subject line
        text: option.message
      }
      await transporter.sendMail(message);
}

module.exports=mailHelper;