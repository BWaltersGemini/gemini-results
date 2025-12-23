// pages/api/send-email.js
// Clean, working version for Vercel (no manual bodyParser)

export default async function handler(req, res) {
  console.log('[/api/send-email] Request received:', req.method);

  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body;

  console.log('Body received:', { to, subject, htmlLength: html?.length });

  if (!to || !Array.isArray(to) || to.length === 0 || !subject || !html) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.error('RESEND_API_KEY missing');
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

    const text = await response.text();
    console.log('Resend status:', response.status);
    console.log('Resend raw body:', text || '(empty)');

    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (response.ok) {
      console.log('Success! Email ID:', data.id);
      return res.status(200).json({ success: true, id: data.id });
    } else {
      console.error('Resend failed:', data);
      return res.status(response.status).json({ error: data.name || data.message || 'Send failed' });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// Remove the config block — Vercel handles body parsing automatically
// Do NOT include this:
// export const config = { api: { bodyParser: true } };