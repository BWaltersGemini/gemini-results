// pages/api/send-email.js
import { NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.error('Resend API key missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Gemini Timing <results@geminitiming.com>',
        to,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, data });
    } else {
      console.error('Resend error:', data);
      return res.status(400).json({ error: data });
    }
  } catch (err) {
    console.error('Send failed:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}