// src/pages/admin/EmailCampaignsAdmin.jsx
import { useState, useEffect } from 'react';
import { fetchEvents } from '../../api/chronotrackapi';
import { fetchResultsForEvent } from '../../api/chronotrackapi';
import { fetchEmailsForEntries } from '../../api/chronotrackAdminApi';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Version banner
console.log('%c🟢 EMAIL CAMPAIGNS v3.0 — FULL EDITOR + SEND LIVE', 'color: white; background: #7c3aed; font-size: 16px; padding: 8px; border-radius: 4px;');

const ordinal = (n) => {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

  // Template
  const [subject, setSubject] = useState('Congratulations on your race!');
  const [html, setHtml] = useState(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563eb;">Hi {{first_name}},</h2>
      <p>Congratulations on your outstanding performance at <strong>{{event_name}}</strong>!</p>
      <p style="font-size: 18px;">
        You finished <strong>{{place_ordinal}}</strong> in the {{race_name}} with a chip time of <strong>{{chip_time}}</strong>!
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <img src="{{event_logo}}" alt="Event Logo" style="max-width: 300px; height: auto; border-radius: 8px;" />
      </div>
      <p>We're so proud of you — keep moving!</p>
      <hr style="border: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 16px;"><strong>Upcoming Events You Might Love:</strong></p>
      <p style="color: #666;">(Coming soon — smart recommendations based on your race distance and location)</p>
      <p style="margin-top: 40px; color: #666; font-size: 14px;">
        — The Gemini Timing Team<br>
        <a href="https://geminitiming.com" style="color: #2563eb;">geminitiming.com</a>
      </p>
    </div>
  `);

  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const allEvents = await fetchEvents();
        allEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
        setEvents(allEvents);
      } catch (err) {
        alert('Failed to load events');
        console.error(err);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
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

  const replacePlaceholders = (template, person, participant, event) => {
    if (!person || !participant || !event) return template;

    const logo = eventLogos?.[event.id] || '';

    return template
      .replace(/{{first_name}}/g, person.firstName || '')
      .replace(/{{full_name}}/g, person.fullName || '')
      .replace(/{{place_ordinal}}/g, participant.place ? ordinal(participant.place) : '')
      .replace(/{{chip_time}}/g, participant.chip_time || '')
      .replace(/{{pace}}/g, participant.pace || '')
      .replace(/{{race_name}}/g, participant.race_name || event.name || '')
      .replace(/{{event_name}}/g, event.name || '')
      .replace(/{{event_date}}/g, new Date(event.start_time * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
      .replace(/{{event_logo}}/g, logo || 'https://via.placeholder.com/300x100?text=Event+Logo');
  };

  const sendTestEmail = async () => {
    const testEmail = prompt('Enter your email for testing:');
    if (!testEmail) return;

    const resendKey = import.meta.env.VITE_RESEND_API_KEY;
    if (!resendKey) {
      alert('Missing VITE_RESEND_API_KEY');
      return;
    }

    setTestSending(true);
    try {
      const samplePerson = emailList[0] || { firstName: 'Test', fullName: 'Test User', email: testEmail };
      const sampleParticipant = results[0] || {};

      const renderedHtml = replacePlaceholders(html, samplePerson, sampleParticipant, selectedEvent);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Gemini Timing <results@geminitiming.com>',
          to: [testEmail],
          subject: '[TEST] ' + subject,
          html: renderedHtml,
        }),
      });

      if (res.ok) {
        alert('Test email sent! Check your inbox.');
      } else {
        const data = await res.json();
        alert('Test failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Test send failed');
      console.error(err);
    } finally {
      setTestSending(false);
    }
  };

  const sendAllEmails = async () => {
    if (!confirm(`Send to all ${emailList.length} recipients? This cannot be undone.`)) return;

    const resendKey = import.meta.env.VITE_RESEND_API_KEY;
    if (!resendKey) {
      alert('Missing API key');
      return;
    }

    setSending(true);
    let sent = 0;
    let failed = 0;

    try {
      for (const person of emailList) {
        const participant = results.find(r =>
          r.first_name?.toLowerCase() === person.firstName?.toLowerCase() &&
          r.last_name?.toLowerCase() === person.lastName?.toLowerCase()
        ) || results[0];

        const renderedHtml = replacePlaceholders(html, person, participant, selectedEvent);

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Gemini Timing <results@geminitiming.com>',
            to: [person.email],
            subject,
            html: renderedHtml,
          }),
        });

        if (res.ok) sent++;
        else failed++;
      }

      alert(`Complete! Sent: ${sent}, Failed: ${failed}`);
    } catch (err) {
      alert('Send failed');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (epoch) => !epoch ? 'Date TBD' : new Date(epoch * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <section className="space-y-12">
      <div className="bg-purple-100 border-2 border-purple-500 rounded-xl p-4 text-center">
        <p className="text-purple-800 font-bold text-lg">🟣 Email Campaigns v3.0 — Full Editor + Send</p>
      </div>

      <h2 className="text-4xl font-bold text-gemini-dark-gray mb-8">Email Campaigns</h2>

      {/* 1. Select Event */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h3 className="text-2xl font-bold mb-6">1. Select Event</h3>
        {loadingEvents ? <p>Loading...</p> : (
          <select value={selectedEvent?.id || ''} onChange={(e) => handleSelectEvent(e.target.value)} className="w-full max-w-2xl p-4 border rounded-xl text-lg">
            <option value="">— Choose an event —</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name} — {formatDate(event.start_time)}</option>
            ))}
          </select>
        )}
      </div>

      {/* 2. Build List */}
      {selectedEvent && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-2xl font-bold mb-6">2. Build Email List</h3>
          {loadingResults ? <p>Loading...</p> : (
            <>
              <p className="text-xl mb-6">{results.length} participants with registration data</p>
              <button onClick={handleBuildEmailList} disabled={buildingList} className="px-12 py-5 bg-gemini-blue text-white font-bold rounded-full shadow-xl disabled:opacity-60">
                {buildingList ? 'Fetching...' : 'Build List'}
              </button>
              {buildingList && (
                <div className="mt-6 p-6 bg-gemini-blue/10 rounded-xl">
                  <p>Checked {progress.processed}/{progress.total}</p>
                  <p className="text-2xl font-bold text-gemini-blue mt-2">Found {progress.found} emails</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. Template Editor + Preview + Send */}
      {emailList.length > 0 && (
        <>
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold mb-6">3. Email Template</h3>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email Subject"
              className="w-full p-4 border rounded-xl text-xl mb-6"
            />
            <ReactQuill theme="snow" value={html} onChange={setHtml} style={{ height: '500px', marginBottom: '80px' }} />
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Preview */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-bold mb-6">Live Preview</h3>
              {results.length > 0 && (
                <div
                  className="border rounded-xl p-6 bg-gray-50 prose max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: replacePlaceholders(html, emailList[0], results[0], selectedEvent)
                  }}
                />
              )}
            </div>

            {/* Send Controls */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-bold mb-6">Send Emails</h3>
              <p className="text-xl mb-8">Ready to send to <strong>{emailList.length}</strong> participants</p>
              <button
                onClick={sendTestEmail}
                disabled={testSending}
                className="w-full mb-4 py-4 bg-orange-600 text-white font-bold rounded-full hover:bg-orange-700 disabled:opacity-60"
              >
                {testSending ? 'Sending Test...' : 'Send Test Email to Me'}
              </button>
              <button
                onClick={sendAllEmails}
                disabled={sending}
                className="w-full py-6 bg-green-600 text-white text-2xl font-bold rounded-full hover:bg-green-700 disabled:opacity-60 shadow-2xl"
              >
                {sending ? 'Sending All...' : 'Send to All Recipients'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}