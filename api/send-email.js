// pages/api/send-email.js
// Final working version for Vercel

export default async function handler(req, res) {
  console.log('=== [/api/send-email] REQUEST START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // req.headers is a plain object in Vercel
  console.log('Headers:', req.headers);

  if (req.method !== 'POST') {
    console.log('Invalid method');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body || {};

  console.log('Body:', { to, subject, htmlLength: html?.length || 0 });

  if (!to || !Array.isArray(to) || to.length === 0 || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.error('RESEND_API_KEY missing');
    return res.status(500).json({ error: 'Server config error' });
  }

  console.log('Calling Resend...');

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

    console.log('Resend status:', response.status);

    const rawText = await response.text();
    console.log('Resend raw body:', rawText || '(empty)');

    let data = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { raw: rawText };
      }
    }

    if (response.ok) {
      console.log('SUCCESS! Email sent:', data.id);
      return res.status(200).json({ success: true, id: data.id });
    } else {
      console.error('Resend error:', data);
      return res.status(response.status).json({ error: data.name || data.message || 'Send failed' });
    }
  } catch (err) {
    console.error('Send error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}