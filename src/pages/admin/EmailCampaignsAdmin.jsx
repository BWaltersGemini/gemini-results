// src/pages/admin/EmailCampaignsAdmin.jsx
import { useState, useEffect } from 'react';
import { fetchEvents } from '../../api/chronotrackapi';
import { fetchResultsForEvent } from '../../api/chronotrackapi';
import { fetchEmailsForEntries } from '../../api/chronotrackAdminApi';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Version banner
console.log('%c🟢 EMAIL CAMPAIGNS v4.2 — FINAL POLISHED & PERFECT', 'color: white; background: #dc2626; font-size: 16px; padding: 8px; border-radius: 4px;');

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
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [buildingList, setBuildingList] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, found: 0 });

  const [subject, setSubject] = useState('{{first_name}}, You Absolutely Crushed {{event_name}}! 🎉');
  const [html, setHtml] = useState(`
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
  <!-- Hero Section - Now visible on light background -->
  <div style="background: linear-gradient(135deg, #001f3f, #2563eb); color: white; padding: 80px 20px; text-align: center;">
    <h1 style="font-size: 64px; font-weight: 900; margin: 0; text-shadow: 0 6px 12px rgba(0,0,0,0.4);">CONGRATULATIONS!</h1>
    <h2 style="font-size: 56px; margin: 30px 0 20px; font-weight: 700;">{{first_name}}</h2>
    <p style="font-size: 32px; margin: 10px 0; opacity: 0.9;">You conquered the {{race_name}}!</p>
    <div style="margin: 60px 0;">
      <p style="font-size: 28px; margin: 0; opacity: 0.9;">Official Chip Time</p>
      <p style="font-size: 96px; font-weight: 900; margin: 20px 0; line-height: 1; text-shadow: 0 8px 16px rgba(0,0,0,0.5);">{{chip_time}}</p>
      <p style="font-size: 28px; margin: 0; opacity: 0.9;">Pace: {{pace}}</p>
    </div>
  </div>

  <!-- Logo -->
  <div style="text-align: center; padding: 50px 20px; background: white;">
    <img src="{{event_logo}}" alt="Gemini Timing" style="max-width: 350px; height: auto; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.1);" />
  </div>

  <!-- Stats Card - Framed and Centered -->
  <div style="padding: 50px 20px; background: #f8fafc;">
    <div style="background: white; border: 8px solid #2563eb; border-radius: 28px; padding: 50px; max-width: 560px; margin: 0 auto; box-shadow: 0 20px 40px rgba(37,99,235,0.2); text-align: center;">
      <h3 style="font-size: 36px; font-weight: 800; color: #001f3f; margin-bottom: 50px;">Your Race Highlights</h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px;">
        <div>
          <p style="font-size: 26px; color: #1e40af; margin: 0 0 20px; font-weight: 600;">Overall</p>
          <p style="font-size: 80px; font-weight: 900; color: #1e3a8a; margin: 0; line-height: 1;">{{place_ordinal}}</p>
        </div>
        <div>
          <p style="font-size: 26px; color: #92400e; margin: 0 0 20px; font-weight: 600;">Gender</p>
          <p style="font-size: 80px; font-weight: 900; color: #78350f; margin: 0; line-height: 1;">{{gender_place_ordinal}}</p>
        </div>
        <div>
          <p style="font-size: 26px; color: #4d7c0f; margin: 0 0 20px; font-weight: 600;">Division</p>
          <p style="font-size: 80px; font-weight: 900; color: #365314; margin: 0; line-height: 1;">{{age_group_place_ordinal}}</p>
          <p style="font-size: 24px; color: #4d7c0f; margin: 20px 0 0;">{{age_group_name}}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Race Story -->
  <div style="padding: 50px 20px; text-align: center; background: white;">
    <div style="background: linear-gradient(to right, #dbeafe, #fef3c7, #d9f99d); padding: 50px; border-radius: 28px; max-width: 520px; margin: 0 auto; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
      <p style="font-size: 36px; font-weight: 900; color: #1e3a8a; margin: 0; line-height: 1.5;">
        {{race_story}}
      </p>
    </div>
  </div>

  <!-- Splits Table -->
  {{splits_table}}

  <!-- Upcoming Events - Smaller and Lower Priority -->
  <div style="padding: 50px 20px; background: #f8fafc;">
    <h3 style="text-align: center; font-size: 28px; font-weight: 700; color: #001f3f; margin-bottom: 30px;">Your Next Challenge Awaits</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">
      {{upcoming_events}}
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 50px 20px; background: #001f3f; color: white;">
    <p style="font-size: 24px; margin: 0 0 15px;">— The Gemini Timing Team</p>
    <p style="margin: 0;">
      <a href="https://geminitiming.com" style="color: #60a5fa; font-size: 20px; text-decoration: none;">geminitiming.com</a>
    </p>
  </div>
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
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, []);

  useEffect(() => {
    const loadUpcoming = async () => {
      try {
        const res = await fetch('https://youkeepmoving.com/wp-json/tribe/events/v1/events?per_page=6&status=publish');
        const data = await res.json();
        const future = (data.events || [])
          .filter(e => new Date(e.start_date) > new Date())
          .slice(0, 3);
        setUpcomingEvents(future);
      } catch (err) {
        console.error('Failed to load upcoming events');
      }
    };
    loadUpcoming();
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

  const replacePlaceholders = (template, person, participant, event, splitsTable = '', upcomingCards = '') => {
    if (!person || !participant || !event) return template;

    const raceStory = getRaceStory(participant.splits || [], participant.place);

    return template
      .replace(/{{first_name}}/g, person.firstName || '')
      .replace(/{{place_ordinal}}/g, participant.place ? ordinal(participant.place) : '')
      .replace(/{{gender_place_ordinal}}/g, participant.gender_place ? ordinal(participant.gender_place) : '')
      .replace(/{{age_group_place_ordinal}}/g, participant.age_group_place ? ordinal(participant.age_group_place) : '')
      .replace(/{{age_group_name}}/g, participant.age_group_name || '')
      .replace(/{{chip_time}}/g, participant.chip_time || '')
      .replace(/{{pace}}/g, participant.pace || '')
      .replace(/{{race_name}}/g, participant.race_name || event.name || '')
      .replace(/{{event_name}}/g, event.name || '')
      .replace(/{{event_date}}/g, new Date(event.start_time * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
      .replace(/{{event_logo}}/g, '/GRR.png')
      .replace(/{{race_story}}/g, raceStory)
      .replace(/{{splits_table}}/g, splitsTable)
      .replace(/{{upcoming_events}}/g, upcomingCards);
  };

  const generateSplitsTable = (splits) => {
    if (!splits || splits.length === 0) return ''; // ← Completely hidden if no splits

    let table = `
    <div style="padding: 50px 20px; background: white;">
      <h3 style="text-align: center; font-size: 32px; font-weight: 800; color: #001f3f; margin-bottom: 40px;">Your Race Splits</h3>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
        <thead style="background: #001f3f; color: white;">
          <tr>
            <th style="padding: 25px; text-align: left; font-size: 20px;">Split</th>
            <th style="padding: 25px; text-align: center; font-size: 20px;">Time</th>
            <th style="padding: 25px; text-align: center; font-size: 20px;">Rank</th>
            <th style="padding: 25px; text-align: center; font-size: 20px;">Change</th>
            <th style="padding: 25px; text-align: center; font-size: 20px;">Pace</th>
          </tr>
        </thead>
        <tbody>`;

    splits.forEach((split, i, arr) => {
      const prevPlace = i > 0 ? arr[i - 1].place : null;
      let change = '';
      if (prevPlace && split.place) {
        const diff = prevPlace - split.place;
        if (diff > 0) change = `<span style="color: #16a34a; font-weight: bold; font-size: 28px;">↑${diff}</span>`;
        else if (diff < 0) change = `<span style="color: #dc2626; font-weight: bold; font-size: 28px;">↓${Math.abs(diff)}</span>`;
        else change = '<span style="color: #6b7280; font-size: 28px;">–</span>';
      }

      table += `
      <tr>
        <td style="padding: 25px; border-bottom: 1px solid #eee; font-size: 18px;">${split.name}</td>
        <td style="padding: 25px; border-bottom: 1px solid #eee; text-align: center; font-size: 18px;">${split.time || '—'}</td>
        <td style="padding: 25px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold; font-size: 18px;">${split.place ? `#${split.place}` : '—'}</td>
        <td style="padding: 25px; border-bottom: 1px solid #eee; text-align: center;">${change}</td>
        <td style="padding: 25px; border-bottom: 1px solid #eee; text-align: center; font-size: 18px;">${split.pace || '—'}</td>
      </tr>`;
    });

    table += `
      </tbody>
    </table>
    <p style="text-align: center; color: #666; margin-top: 30px; font-size: 16px;">
      ↑ Gained positions • ↓ Lost positions • – Held steady
    </p>
    </div>`;

    return table;
  };

  const generateUpcomingCards = () => {
    if (upcomingEvents.length === 0) {
      return '<p style="text-align: center; color: #666; font-size: 16px;">Check back soon for upcoming races!</p>';
    }

    return upcomingEvents.map(event => `
      <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
        ${event.image?.url ? `<img src="${event.image.url}" alt="${event.title.rendered}" style="width: 100%; height: 160px; object-cover;" />` : '<div style="height: 160px; background: #e5e7eb; display: flex; align-items: center; justify-content: center;"><p style="color: #9ca3af;">No Image</p></div>'}
        <div style="padding: 20px;">
          <h4 style="font-size: 18px; font-weight: bold; color: #001f3f; margin: 0 0 10px; line-clamp: 2;">${event.title.rendered || event.title}</h4>
          <p style="color: #6b7280; font-size: 16px; margin: 0 0 15px;">${new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <a href="${event.url}" target="_blank" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">Register →</a>
        </div>
      </div>
    `).join('');
  };

  const sendTestEmail = async () => {
    const testEmail = prompt('Enter your email for testing:');
    if (!testEmail) return;

    setTestSending(true);
    try {
      const samplePerson = emailList[0] || { firstName: 'Test' };
      const sampleParticipant = results[0] || {};
      const splitsTable = generateSplitsTable(sampleParticipant.splits || []);
      const upcomingCards = generateUpcomingCards();

      const renderedHtml = replacePlaceholders(html, samplePerson, sampleParticipant, selectedEvent, splitsTable, upcomingCards);

      await sendViaApi([testEmail], '[TEST] ' + subject, renderedHtml);
      alert('Test email sent! Check your inbox.');
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

    const upcomingCards = generateUpcomingCards();

    try {
      for (const person of emailList) {
        const participant = results.find(r =>
          r.first_name?.toLowerCase() === person.firstName?.toLowerCase()
        ) || results[0];

        const splitsTable = generateSplitsTable(participant.splits || []);
        const renderedHtml = replacePlaceholders(html, person, participant, selectedEvent, splitsTable, upcomingCards);

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
    <section className="space-y-12">
      <div className="bg-green-100 border-2 border-green-500 rounded-xl p-6 text-center">
        <p className="text-green-800 font-black text-2xl">🟢 FINAL v4.2 — BOLD, CLEAN, PERFECT</p>
        <p className="text-green-700 text-lg mt-2">Visible hero • First name only • GRR.png logo • Framed stats • No split filler • Subtle upcoming events</p>
      </div>

      <h2 className="text-5xl font-black text-gemini-dark-gray text-center mb-12">Post-Race Email Campaigns</h2>

      {/* Event Selection */}
      <div className="bg-white rounded-3xl shadow-2xl p-10">
        <h3 className="text-3xl font-bold mb-8">1. Select Event</h3>
        {loadingEvents ? <p className="text-xl">Loading events...</p> : (
          <select value={selectedEvent?.id || ''} onChange={(e) => handleSelectEvent(e.target.value)} className="w-full max-w-3xl p-5 border-2 border-gemini-blue rounded-2xl text-xl">
            <option value="">— Choose an event —</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.name} — {formatDate(event.start_time)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Build List */}
      {selectedEvent && (
        <div className="bg-white rounded-3xl shadow-2xl p-10">
          <h3 className="text-3xl font-bold mb-8">2. Build Email List</h3>
          {loadingResults ? <p className="text-xl">Loading results...</p> : (
            <>
              <p className="text-2xl mb-8">Found <strong>{results.length}</strong> finishers with registration data</p>
              <button onClick={handleBuildEmailList} disabled={buildingList} className="px-16 py-6 bg-gemini-blue text-white text-2xl font-black rounded-full shadow-2xl hover:scale-105 transition disabled:opacity-60">
                {buildingList ? 'Fetching...' : 'Build List'}
              </button>
              {buildingList && (
                <div className="mt-10 p-8 bg-gemini-blue/10 rounded-2xl border-2 border-gemini-blue">
                  <p className="text-xl">Checked {progress.processed} of {progress.total}</p>
                  <p className="text-4xl font-black text-gemini-blue mt-4">Found {progress.found} emails</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Template + Preview + Send */}
      {emailList.length > 0 && (
        <>
          <div className="bg-white rounded-3xl shadow-2xl p-10">
            <h3 className="text-3xl font-bold mb-8">3. Design Your Email</h3>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-6 border-2 border-gemini-blue rounded-2xl text-3xl font-bold mb-8"
            />
            <ReactQuill theme="snow" value={html} onChange={setHtml} style={{ height: '600px', marginBottom: '100px' }} />
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Live Preview */}
            <div className="bg-white rounded-3xl shadow-2xl p-10">
              <h3 className="text-3xl font-bold mb-8 text-center">Live Preview</h3>
              <div
                className="border-4 border-gemini-blue/20 rounded-3xl overflow-hidden"
                dangerouslySetInnerHTML={{
                  __html: replacePlaceholders(
                    html,
                    emailList[0] || {},
                    results[0] || {},
                    selectedEvent,
                    generateSplitsTable(results[0]?.splits || []),
                    generateUpcomingCards()
                  )
                }}
              />
            </div>

            {/* Send Panel */}
            <div className="bg-gradient-to-br from-gemini-blue to-[#80ccd6] rounded-3xl shadow-2xl p-10 text-white">
              <h3 className="text-4xl font-black mb-8 text-center">Launch Your Campaign</h3>
              <p className="text-2xl text-center mb-12">Ready to inspire <strong>{emailList.length}</strong> runners?</p>
              <div className="space-y-6">
                <button
                  onClick={sendTestEmail}
                  disabled={testSending}
                  className="w-full py-6 bg-white text-gemini-blue text-2xl font-black rounded-full hover:scale-105 transition shadow-2xl disabled:opacity-60"
                >
                  {testSending ? 'Sending Test...' : 'Send Test Email to Me'}
                </button>
                <button
                  onClick={sendAllEmails}
                  disabled={sending}
                  className="w-full py-8 bg-orange-500 text-white text-3xl font-black rounded-full hover:scale-105 transition shadow-2xl disabled:opacity-60"
                >
                  {sending ? 'Sending to All...' : 'Send to All Recipients'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}