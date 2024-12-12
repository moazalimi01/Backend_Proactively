import express from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from project root
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Client ID:', process.env.GOOGLE_CLIENT_ID);
console.log('Redirect URI:', process.env.GOOGLE_REDIRECT_URI);

const app = express();
const PORT = 3001;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `http://localhost:${PORT}/oauth2callback`
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.events'
];

app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  console.log('Refresh Token:', tokens.refresh_token);
  res.send('You can close this window now.');
  process.exit();
});

app.listen(PORT, () => {
  console.log(`Visit http://localhost:${PORT}/auth to get refresh token`);
});