import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification',
    html: `Your verification code is: <b>${otp}</b>`,
  };

  await transporter.sendMail(mailOptions);
};

export const sendBookingConfirmation = async (userEmail, speakerEmail, bookingDetails) => {
  const userMailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: 'Session Booking Confirmation',
    html: `Your session has been booked successfully for ${bookingDetails.date} at ${bookingDetails.time}`,
  };

  const speakerMailOptions = {
    from: process.env.EMAIL_USER,
    to: speakerEmail,
    subject: 'New Session Booking',
    html: `You have a new session booked for ${bookingDetails.date} at ${bookingDetails.time}`,
  };

  await Promise.all([
    transporter.sendMail(userMailOptions),
    transporter.sendMail(speakerMailOptions),
  ]);
};