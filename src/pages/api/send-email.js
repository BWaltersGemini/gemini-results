// pages/api/send-email.js
// Secure serverless endpoint for sending emails via Resend

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Parse body
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // Use server-only env var
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.error('RESEND_API_KEY missing on server');
    res.status(500).json({ error: 'Server configuration error' });
    return;
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
      console.log('Email sent:', data.id);
      res.status(200).json({ success: true, id: data.id });
    } else {
      console.error('Resend error:', data);
      res.status(response.status).json({ error: data.name || 'Send failed' });
    }
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Important for Vercel
export const config = {
  api: {
    bodyParser: true,
  },
};