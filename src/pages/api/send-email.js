// pages/api/send-email.js
// MAXIMUM DEBUG VERSION – will show exactly what Resend returns

export default async function handler(req, res) {
  console.log('=== [/api/send-email] NEW REQUEST START ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  console.log('Raw body (as received):', req.body);

  if (req.method !== 'POST') {
    console.log('Returning 405 - Method not allowed');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body || {};

  console.log('Parsed fields:');
  console.log(' - to:', to);
  console.log(' - subject:', subject);
  console.log(' - html length:', html?.length || 0);

  if (!to || !Array.isArray(to) || to.length === 0) {
    console.log('Validation failed: invalid "to"');
    return res.status(400).json({ error: 'Invalid or missing "to" array' });
  }
  if (!subject || !html) {
    console.log('Validation failed: missing subject or html');
    return res.status(400).json({ error: 'Missing subject or html' });
  }

  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.error('RESEND_API_KEY is MISSING on the server!');
    return res.status(500).json({ error: 'Server configuration error - no API key' });
  } else {
    console.log('RESEND_API_KEY is present (length:', resendKey.length, ')');
  }

  try {
    console.log('Calling Resend API...');
    const fetchResponse = await fetch('https://api.resend.com/emails', {
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

    console.log('Resend status code:', fetchResponse.status);
    console.log('Resend status text:', fetchResponse.statusText);
    console.log('Resend headers:', Object.fromEntries(fetchResponse.headers.entries()));

    // Read raw text FIRST – this is critical
    const rawText = await fetchResponse.text();
    console.log('Resend raw body (exact):', rawText || '(completely empty)');

    let parsedData = {};
    if (rawText) {
      try {
        parsedData = JSON.parse(rawText);
        console.log('Successfully parsed JSON:', parsedData);
      } catch (parseError) {
        console.error('JSON parse failed:', parseError.message);
        parsedData = { _raw_non_json: rawText };
      }
    } else {
      console.log('Resend returned NO body at all');
    }

    if (fetchResponse.ok) {
      console.log('SUCCESS! Email sent, ID:', parsedData.id);
      return res.status(200).json({ success: true, id: parsedData.id || 'sent' });
    } else {
      console.error('Resend rejected the request');
      return res.status(fetchResponse.status).json({
        error: parsedData.name || parsedData.message || 'Resend rejected request',
        details: parsedData,
      });
    }
  } catch (unexpectedError) {
    console.error('Unexpected exception in API route:', unexpectedError);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    console.log('=== [/api/send-email] REQUEST END ===');
  }
}

// DO NOT include bodyParser config — Vercel handles it automatically