// src/pages/participant/EmailResultsForm.jsx
import { useState } from 'react';
import { formatChronoTime } from '../../utils/timeUtils';

export default function EmailResultsForm({
  show,
  onClose,
  participant,
  selectedEvent,
  raceDisplayName,
}) {
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');

  const ordinal = (n) => {
    if (!n) return '—';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const sendEmail = async () => {
    if (!email || !optIn) return;
    setEmailStatus('sending');

    const fullName = `${participant.first_name} ${participant.last_name}`.trim() || 'Champion';
    const eventName = selectedEvent.name;
    const totalFinishers = 1698; // You can pass this in props if needed
    const genderCount = 850; // Placeholder — ideally pass real numbers
    const divisionCount = 120; // Placeholder
    const raceStory = "Strong, steady performance throughout!"; // Could pass in if calculated

    const getResultsUrl = () => window.location.origin + '/results'; // Simplified

    const brandedHtml = `
      <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <tr>
          <td align="center" style="padding:20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-collapse:collapse;">
              <!-- Logo Header -->
              <tr>
                <td align="center" style="padding:40px 20px 20px;">
                  <img src="${window.location.origin}/GRR.png" alt="Gemini Race Results" width="220" style="display:block;" />
                </td>
              </tr>
              <!-- Hero -->
              <tr>
                <td align="center" style="background:#263238; color:#ffffff; padding:60px 20px;">
                  <h1 style="font-size:48px; font-weight:900; margin:0 0 20px;">CONGRATULATIONS!</h1>
                  <h2 style="font-size:36px; font-weight:700; margin:0 0 16px;">${fullName}</h2>
                  <p style="font-size:24px; margin:0 0 30px;">You conquered the ${raceName}!</p>
                  <p style="font-size:20px; margin:0 0 8px;">Official Chip Time</p>
                  <p style="font-size:56px; font-weight:900; margin:16px 0;">${formatChronoTime(participant.chip_time)}</p>
                  <p style="font-size:20px; margin:0;">Pace: ${participant.pace ? formatChronoTime(participant.pace) : '—'}</p>
                </td>
              </tr>
              <!-- Stats -->
              <tr>
                <td style="padding:50px 30px; background:#F0F8FF;">
                  <h3 style="font-size:28px; font-weight:800; color:#263238; text-align:center; margin:0 0 40px;">Your Race Highlights</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="33%" style="padding:15px;">
                        <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Overall</p>
                        <p style="font-size:48px; font-weight:900; color:#B22222; margin:0;">${ordinal(participant.place)}</p>
                        <p style="font-size:16px; color:#666; margin:5px 0 0;">of ${totalFinishers}</p>
                      </td>
                      <td align="center" width="33%" style="padding:15px;">
                        <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Gender</p>
                        <p style="font-size:48px; font-weight:900; color:#B22222; margin:0;">${ordinal(participant.gender_place)}</p>
                        <p style="font-size:16px; color:#666; margin:5px 0 0;">of ${genderCount}</p>
                      </td>
                      <td align="center" width="33%" style="padding:15px;">
                        <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Division</p>
                        <p style="font-size:48px; font-weight:900; color:#B22222; margin:0;">${ordinal(participant.age_group_place)}</p>
                        <p style="font-size:16px; color:#666; margin:5px 0 0;">of ${divisionCount} (${participant.age_group_name || ''})</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Race Story -->
              <tr>
                <td align="center" style="padding:40px 30px;">
                  <table width="100%" style="max-width:500px;">
                    <tr>
                      <td style="background:#ffffff; padding:40px; border-left:8px solid #B22222; box-shadow:0 4px 20px rgba(178,34,34,0.15);">
                        <p style="font-size:24px; font-weight:700; color:#263238; margin:0; line-height:1.5;">
                          ${raceStory}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- CTAs -->
              <tr>
                <td align="center" style="padding:40px 30px; background:#F0F8FF;">
                  <p style="margin:0 0 20px;">
                    <a href="${getResultsUrl()}" target="_blank" style="display:inline-block; background:#B22222; color:#ffffff; padding:16px 40px; text-decoration:none; font-weight:bold; font-size:20px; border-radius:8px;">
                      View Full Results →
                    </a>
                  </p>
                  <p style="margin:0;">
                    <a href="https://youkeepmoving.com/events" target="_blank" style="display:inline-block; background:#48D1CC; color:#263238; padding:16px 40px; text-decoration:none; font-weight:bold; font-size:20px; border-radius:8px;">
                      Find Your Next Race →
                    </a>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="background:#263238; color:#aaaaaa; padding:40px 20px;">
                  <p style="font-size:18px; margin:0 0 12px; color:#ffffff;">— The Gemini Timing Team</p>
                  <p style="margin:0;">
                    <a href="https://geminitiming.com" target="_blank" style="color:#48D1CC; font-size:16px; text-decoration:underline;">geminitiming.com</a>
                  </p>
                  <p style="font-size:12px; margin-top:20px; color:#94a3b8;">You received this because you participated in ${eventName}.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [email],
          subject: `${fullName.split(' ')[0]}, Your Official ${eventName} Results!`,
          html: brandedHtml,
        }),
      });
      if (res.ok) {
        setEmailStatus('success');
        setTimeout(onClose, 3000);
      } else {
        setEmailStatus('error');
      }
    } catch (err) {
      console.error('Send failed:', err);
      setEmailStatus('error');
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
        <h3 className="text-3xl font-bold text-center mb-6">Email My Results</h3>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full px-6 py-4 text-xl rounded-full border-2 border-gray-300 focus:border-primary focus:outline-none mb-6"
          autoFocus
        />
        <label className="flex items-center gap-4 text-lg mb-8">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="w-6 h-6 text-primary rounded focus:ring-primary"
          />
          <span>Yes, send me future race updates from Gemini Timing</span>
        </label>
        <div className="flex justify-center gap-6">
          <button
            onClick={sendEmail}
            disabled={!email || !optIn || emailStatus === 'sending'}
            className="px-12 py-5 bg-primary text-white font-bold text-xl rounded-full disabled:opacity-60 shadow-xl"
          >
            {emailStatus === 'sending' ? 'Sending...' : 'Send Results'}
          </button>
          <button
            onClick={onClose}
            className="px-12 py-5 bg-gray-500 text-white font-bold text-xl rounded-full hover:bg-gray-600 shadow-xl"
          >
            Cancel
          </button>
        </div>
        {emailStatus === 'success' && (
          <p className="text-green-600 text-2xl font-bold text-center mt-6">✓ Email sent!</p>
        )}
        {emailStatus === 'error' && (
          <p className="text-red-600 text-xl text-center mt-6">✗ Failed — try again</p>
        )}
      </div>
    </div>
  );
}