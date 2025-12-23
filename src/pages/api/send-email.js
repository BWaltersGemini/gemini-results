// pages/api/send-email.js
// Enhanced with detailed logging to debug "Unexpected end of JSON input"

export default async function handler(req, res) {
  console.log('[/api/send-email] Request received:', req.method);

  if (req.method !== 'POST') {
    console.log('[/api/send-email] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[/api/send-email] Request body:', req.body);

  const { to, subject, html } = req.body;

  if (!to || !Array.isArray(to) || to.length === 0) {
    console.log('[/api/send-email] Invalid "to" field:', to);
    return res.status(400).json({ error: 'Invalid or missing "to" array' });
  }

  if (!subject || !html) {
    console.log('[/api/send-email] Missing subject or html');
    return res.status(400).json({ error: 'Missing subject or html' });
  }

  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.error('[/api/send-email] RESEND_API_KEY is missing on server!');
    return res.status(500).json({ error: 'Server configuration error - missing API key' });
  }

  console.log('[/api/send-email] Sending to:', to);
  console.log('[/api/send-email] Subject:', subject);
  console.log('[/api/send-email] HTML length:', html.length);

  try {
    console.log('[/api/send-email] Calling Resend API...');

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

    console.log('[/api/send-email] Resend response status:', response.status);
    console.log('[/api/send-email] Resend response headers:', Object.fromEntries(response.headers.entries()));

    // Read raw text first — this is key to debugging empty responses
    const rawText = await response.text();
    console.log('[/api/send-email] Raw response body:', rawText || '(empty)');

    let data = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
        console.log('[/api/send-email] Parsed JSON:', data);
      } catch (parseErr) {
        console.error('[/api/send-email] Failed to parse JSON:', parseErr);
        data = { raw: rawText };
      }
    } else {
      console.log('[/api/send-email] Response body is empty');
    }

    if (response.ok) {
      console.log('[/api/send-email] Email sent successfully! ID:', data.id);
      return res.status(200).json({ success: true, id: data.id || 'sent' });
    } else {
      console.error('[/api/send-email] Resend rejected request:', response.status, data);
      return res.status(response.status).json({
        error: data.name || data.message || 'Failed to send email',
        details: data,
      });
    }
  } catch (err) {
    console.error('[/api/send-email] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};