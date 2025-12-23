// pages/api/send-email.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body;

  if (!Array.isArray(to) || to.length === 0 || !subject || !html) {
    return res.status(400).json({ error: 'Invalid or missing fields: to (array), subject, html' });
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

    // Always try to parse JSON, even on error
    let data;
    const text = await response.text(); // Get raw text in case JSON is invalid
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (response.ok) {
      console.log('Email sent:', data.id);
      return res.status(200).json({ success: true, id: data.id || 'sent' });
    } else {
      console.error('Resend error:', response.status, data);
      return res.status(response.status).json({
        error: data.name || data.message || 'Failed to send email',
        details: data,
      });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};