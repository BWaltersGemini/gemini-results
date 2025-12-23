// src/pages/admin/EmailCampaignsAdmin.jsx
import { useState, useEffect } from 'react';
import { fetchEvents, fetchResultsForEvent } from '../../api/chronotrackapi';
import { fetchEmailsForEntries } from '../../api/chronotrackAdminApi';
import { formatChronoTime } from '../../utils/timeUtils';

console.log('%c🟥 EMAIL CAMPAIGNS — FINAL: NEW RED/TURQUOISE PALETTE + ALL FEATURES', 'color: white; background: #B22222; font-size: 16px; padding: 8px; border-radius: 4px;');

const ordinal = (n) => {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const getRaceStory = (splits, finalPlace) => {
  if (!splits || splits.length === 0) return "Strong, steady performance throughout! 💪";
  const places = splits.map(s => s.place).filter(Boolean);
  if (places.length < 2) return "Strong, steady performance throughout! 💪";
  const firstPlace = places[0];
  const bestPlace = Math.min(...places);
  const worstPlace = Math.max(...places);
  if (finalPlace === 1 && firstPlace === 1) return "Wire-to-wire dominance — you led from start to finish! 🏆";
  if (finalPlace === 1 && firstPlace > 5) return "EPIC COMEBACK! You surged from mid-pack to take the win! 🔥";
  if (bestPlace === 1 && finalPlace > 3) return "You had the lead early but fought hard to the line — incredible effort!";
  if (worstPlace - bestPlace >= 20) return "A true rollercoaster — big moves throughout, but you never gave up!";
  if (finalPlace <= 3 && firstPlace > 10) return "Patient and powerful — you saved your best for the finish! 🚀";
  if (Math.abs(firstPlace - finalPlace) <= 3) return "Rock-solid consistency — you owned your pace all day!";
  return "Gritty, determined performance — you gave it everything! ❤️";
};

export default function EmailCampaignsAdmin() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [results, setResults] = useState([]);
  const [emailList, setEmailList] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [buildingList, setBuildingList] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, found: 0 });
  const [subject, setSubject] = useState('{{first_name}}, You Absolutely Crushed {{event_name}}!');
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Fetch ChronoTrack events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const allEvents = await fetchEvents();
        allEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
        setEvents(allEvents);
      } catch (err) {
        alert('Failed to load events');
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, []);

  // Fetch upcoming events from You Keep Moving (The Events Calendar)
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const res = await fetch('https://youkeepmoving.com/wp-json/tribe/events/v1/events?per_page=10&status=publish');
        if (!res.ok) throw new Error();
        const data = await res.json();
        const future = (data.events || [])
          .filter(ev => new Date(ev.start_date) > new Date())
          .slice(0, 4);
        setUpcomingEvents(future);
      } catch (err) {
        console.warn('Could not load upcoming events');
        setUpcomingEvents([]);
      }
    };
    fetchUpcoming();
  }, []);

  const handleSelectEvent = async (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    setSelectedEvent(event);
    setResults([]);
    setEmailList([]);
    setLoadingResults(true);
    try {
      const eventResults = await fetchResultsForEvent(eventId);
      const withEntry = eventResults.filter(r => r.entry_id);
      setResults(withEntry);
    } catch (err) {
      alert('Failed to load results');
    } finally {
      setLoadingResults(false);
    }
  };

  const handleBuildEmailList = async () => {
    if (results.length === 0) return;
    const entryIds = results.map(r => r.entry_id);
    setBuildingList(true);
    setProgress({ processed: 0, total: entryIds.length, found: 0 });
    try {
      const emails = await fetchEmailsForEntries(entryIds, (p, t, f) => setProgress({ processed: p, total: t, found: f }));
      setEmailList(emails);
      alert(`Found ${emails.length} valid emails!`);
    } catch (err) {
      alert('Error building list');
    } finally {
      setBuildingList(false);
    }
  };

  // Main email template with new palette
  const [html, setHtml] = useState(`<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; margin:0; padding:0;">
  <tr>
    <td align="center" style="padding:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-collapse:collapse;">
        
        <!-- Logo Header -->
        <tr>
          <td align="center" style="padding:40px 20px 20px;">
            <img src="{{base_url}}/GRR.png" alt="Gemini Race Results" width="220" style="display:block; max-width:100%; height:auto;" />
          </td>
        </tr>

        <!-- Hero Section -->
        <tr>
          <td align="center" style="background:#263238; color:#ffffff; padding:60px 20px;">
            <h1 style="font-size:48px; font-weight:900; margin:0 0 20px; color:#ffffff; line-height:1.2;">CONGRATULATIONS!</h1>
            <h2 style="font-size:36px; font-weight:700; margin:0 0 16px; color:#ffffff;">{{first_name}}</h2>
            <p style="font-size:24px; margin:0 0 30px; color:#ffffff;">You conquered the {{race_name}}!</p>
            <p style="font-size:20px; margin:0 0 8px; color:#ffffff;">Official Chip Time</p>
            <p style="font-size:56px; font-weight:900; margin:16px 0; color:#ffffff; line-height:1;">{{chip_time}}</p>
            <p style="font-size:20px; margin:0; color:#ffffff;">Pace: {{pace}}</p>
          </td>
        </tr>

        <!-- Stats Section with X/X -->
        <tr>
          <td style="padding:50px 30px; background:#F0F8FF;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <h3 style="font-size:28px; font-weight:800; color:#263238; margin:0 0 40px;">Your Race Highlights</h3>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" width="33%" style="padding:15px;">
                        <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Overall</p>
                        <p style="font-size:48px; font-weight:900; color:#B22222; margin:0; line-height:1;">{{place_ordinal}}</p>
                        <p style="font-size:16px; color:#666; margin:5px 0 0;">of {{total_finishers}}</p>
                      </td>
                      <td align="center" width="33%" style="padding:15px;">
                        <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Gender</p>
                        <p style="font-size:48px; font-weight:900; color:#B22222; margin:0; line-height:1;">{{gender_place_ordinal}}</p>
                        <p style="font-size:16px; color:#666; margin:5px 0 0;">of {{gender_count}}</p>
                      </td>
                      <td align="center" width="33%" style="padding:15px;">
                        <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Division</p>
                        <p style="font-size:48px; font-weight:900; color:#B22222; margin:0; line-height:1;">{{age_group_place_ordinal}}</p>
                        <p style="font-size:16px; color:#666; margin:5px 0 0;">of {{division_count}} ({{age_group_name}})</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Race Story -->
        <tr>
          <td align="center" style="padding:40px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;">
              <tr>
                <td style="background:#ffffff; padding:40px; border-left:8px solid #B22222; box-shadow:0 4px 20px rgba(178,34,34,0.15);">
                  <p style="font-size:24px; font-weight:700; color:#263238; margin:0; line-height:1.5;">
                    {{race_story}}
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
              <a href="https://geminitiming.com/results" target="_blank" style="display:inline-block; background:#B22222; color:#ffffff; padding:16px 40px; text-decoration:none; font-weight:bold; font-size:20px; border-radius:8px;">
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

        <!-- Upcoming Events -->
        <tr>
          <td style="padding:40px 30px; background:#ffffff;">
            <h3 style="font-size:20px; font-weight:700; color:#263238; text-align:center; margin:0 0 30px;">Upcoming Events from You Keep Moving</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              {{upcoming_events}}
            </table>
            <p style="text-align:center; margin-top:30px;">
              <a href="https://youkeepmoving.com/events" target="_blank" style="color:#48D1CC; font-size:16px; text-decoration:underline; font-weight:bold;">View Full Calendar →</a>
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
            <p style="font-size:12px; margin-top:20px; color:#94a3b8;">You received this because you participated in {{event_name}}.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`);

  const replacePlaceholders = (template, person, participant, event) => {
    if (!person || !participant || !event) return template;

    const raceStory = getRaceStory(participant.splits || [], participant.place);

    const cleanChipTime = formatChronoTime(participant.chip_time);
    const cleanPace = participant.pace ? formatChronoTime(participant.pace) : '—';

    const totalFinishers = results.length;
    const genderCount = results.filter(r => r.gender === participant.gender).length;
    const divisionCount = results.filter(r => r.age_group_name === participant.age_group_name).length;

    const upcomingHtml = upcomingEvents.length > 0
      ? upcomingEvents.map(ev => `
          <tr>
            <td style="padding:12px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F8FF; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                <tr>
                  ${ev.image?.url ? `<td width="100" style="padding:0;"><img src="${ev.image.url}" alt="${ev.title.rendered || ev.title}" width="100" style="display:block; height:auto;" /></td>` : ''}
                  <td style="padding:18px;">
                    <p style="font-size:16px; font-weight:700; color:#263238; margin:0 0 8px;">${ev.title.rendered || ev.title}</p>
                    <p style="font-size:14px; color:#666; margin:0;">${new Date(ev.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `).join('')
      : '<tr><td style="text-align:center; color:#999; padding:20px; font-style:italic;">No upcoming events at this time.</td></tr>';

    const baseUrl = window.location.origin;

    return template
      .replace(/{{base_url}}/g, baseUrl)
      .replace(/{{first_name}}/g, person.firstName || 'Champion')
      .replace(/{{place_ordinal}}/g, participant.place ? ordinal(participant.place) : '—')
      .replace(/{{gender_place_ordinal}}/g, participant.gender_place ? ordinal(participant.gender_place) : '—')
      .replace(/{{age_group_place_ordinal}}/g, participant.age_group_place ? ordinal(participant.age_group_place) : '—')
      .replace(/{{age_group_name}}/g, participant.age_group_name || '')
      .replace(/{{chip_time}}/g, cleanChipTime)
      .replace(/{{pace}}/g, cleanPace)
      .replace(/{{race_name}}/g, participant.race_name || event.name || 'the race')
      .replace(/{{event_name}}/g, event.name || 'this event')
      .replace(/{{race_story}}/g, raceStory)
      .replace(/{{total_finishers}}/g, totalFinishers || '—')
      .replace(/{{gender_count}}/g, genderCount || '—')
      .replace(/{{division_count}}/g, divisionCount || '—')
      .replace(/{{upcoming_events}}/g, upcomingHtml);
  };

  const sendTestEmail = async () => {
    const testEmail = prompt('Enter your email for testing:');
    if (!testEmail) return;
    setTestSending(true);
    try {
      const samplePerson = emailList[0] || { firstName: 'Test' };
      const sampleParticipant = results.find(r =>
        r.first_name?.toLowerCase().includes(samplePerson.firstName?.toLowerCase())
      ) || results[0] || {};
      const renderedHtml = replacePlaceholders(html, samplePerson, sampleParticipant, selectedEvent);
      await sendViaApi([testEmail], '[TEST] ' + subject, renderedHtml);
      alert('Test email sent! Check your inbox and spam folder.');
    } catch (err) {
      alert('Test failed: ' + err.message);
    } finally {
      setTestSending(false);
    }
  };

  const sendAllEmails = async () => {
    if (!confirm(`Send to all ${emailList.length} recipients? This cannot be undone.`)) return;
    setSending(true);
    let sent = 0;
    let failed = 0;
    try {
      for (const person of emailList) {
        const participant = results.find(r =>
          r.first_name?.toLowerCase() === person.firstName?.toLowerCase()
        ) || results[0] || {};
        const renderedHtml = replacePlaceholders(html, person, participant, selectedEvent);
        try {
          await sendViaApi([person.email], subject, renderedHtml);
          sent++;
        } catch (err) {
          console.error(`Failed for ${person.email}:`, err.message);
          failed++;
        }
      }
      alert(`Complete! Sent: ${sent}, Failed: ${failed}`);
    } catch (err) {
      alert('Bulk send failed');
    } finally {
      setSending(false);
    }
  };

  const sendViaApi = async (to, subject, html) => {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Send failed');
    }
    return res.json();
  };

  const formatDate = (epoch) => !epoch ? 'Date TBD' : new Date(epoch * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <section className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <div className="bg-red-100 border-2 border-red-600 rounded-xl p-8 text-center">
        <p className="text-red-800 font-black text-3xl">🟥 NEW BRAND COLORS LIVE</p>
        <p className="text-red-700 text-xl mt-3">Red #B22222 • Turquoise #48D1CC • Light #F0F8FF • Dark #263238</p>
      </div>

      <h2 className="text-5xl font-black text-center text-gray-800">Post-Race Email Campaigns</h2>

      {/* 1. Select Event */}
      <div className="bg-white rounded-3xl shadow-xl p-10">
        <h3 className="text-3xl font-bold mb-8">1. Select Event</h3>
        {loadingEvents ? (
          <p className="text-xl text-gray-600">Loading events...</p>
        ) : (
          <select
            value={selectedEvent?.id || ''}
            onChange={(e) => handleSelectEvent(e.target.value)}
            className="w-full max-w-2xl p-5 text-xl border-2 border-red-500 rounded-2xl focus:outline-none focus:border-red-600"
          >
            <option value="">— Choose an event —</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.name} — {formatDate(event.start_time)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 2. Build Email List */}
      {selectedEvent && (
        <div className="bg-white rounded-3xl shadow-xl p-10">
          <h3 className="text-3xl font-bold mb-8">2. Build Email List</h3>
          {loadingResults ? (
            <p className="text-xl text-gray-600">Loading results...</p>
          ) : (
            <>
              <p className="text-2xl mb-8">Found <strong>{results.length}</strong> finishers with registration data</p>
              <button
                onClick={handleBuildEmailList}
                disabled={buildingList}
                className="px-16 py-6 bg-red-600 text-white text-2xl font-bold rounded-full shadow-xl hover:bg-red-700 disabled:opacity-60 transition"
              >
                {buildingList ? 'Fetching Emails...' : 'Build Email List'}
              </button>
              {buildingList && (
                <div className="mt-8 p-8 bg-red-50 rounded-2xl border-2 border-red-300">
                  <p className="text-xl">Processed {progress.processed} of {progress.total}</p>
                  <p className="text-4xl font-black text-red-600 mt-4">Found {progress.found} emails</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. Template & Send */}
      {emailList.length > 0 && (
        <>
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <h3 className="text-3xl font-bold mb-6">Email Subject</h3>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-6 text-2xl font-bold border-2 border-red-500 rounded-2xl focus:outline-none focus:border-red-600"
              placeholder="Enter email subject..."
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Live Preview */}
            <div className="bg-white rounded-3xl shadow-xl p-10">
              <h3 className="text-3xl font-bold text-center mb-8">Live Preview</h3>
              <div
                className="border-4 border-red-200 rounded-2xl overflow-hidden"
                dangerouslySetInnerHTML={{
                  __html: replacePlaceholders(html, emailList[0] || {}, results[0] || {}, selectedEvent)
                }}
              />
            </div>

            {/* Send Panel */}
            <div className="bg-gradient-to-br from-red-600 to-red-500 rounded-3xl shadow-2xl p-10 text-white">
              <h3 className="text-4xl font-black text-center mb-8">Launch Campaign</h3>
              <p className="text-2xl text-center mb-12">Ready to send to <strong>{emailList.length}</strong> runners?</p>
              <div className="space-y-6">
                <button
                  onClick={sendTestEmail}
                  disabled={testSending}
                  className="w-full py-6 bg-white text-red-600 text-2xl font-black rounded-full shadow-xl hover:scale-105 transition disabled:opacity-60"
                >
                  {testSending ? 'Sending Test...' : 'Send Test Email'}
                </button>
                <button
                  onClick={sendAllEmails}
                  disabled={sending}
                  className="w-full py-8 bg-orange-500 text-white text-3xl font-black rounded-full shadow-2xl hover:scale-105 transition disabled:opacity-60"
                >
                  {sending ? 'Sending to All...' : 'Send to All Recipients'}
                </button>
              </div>
              <p className="text-center mt-8 text-lg opacity-90">
                Always send a test first!
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}