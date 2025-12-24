// src/pages/ResultsKiosk.jsx
// FINAL – All Features: Correct Ordinals, Event Search, Email Opt-In, iPad Safe

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useContext } from 'react';
import { RaceContext } from '../context/RaceContext';
import QRCode from 'react-qr-code';
import { formatChronoTime } from '../utils/timeUtils';

export default function ResultsKiosk() {
  const navigate = useNavigate();
  const {
    events = [],
    results,
    selectedEvent,
    setSelectedEvent,
    masterGroups = {},
    eventLogos = {},
    loadingResults,
  } = useContext(RaceContext);

  const [stage, setStage] = useState('access-pin');
  const [accessPinInput, setAccessPinInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState([]);
  const [participant, setParticipant] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(null);

  // Email feature
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');

  // Event select search
  const [eventSearchTerm, setEventSearchTerm] = useState('');

  const AUTO_RESET_SECONDS = 12;
  const ACCESS_PIN = import.meta.env.VITE_KIOSK_ACCESS_PIN || 'gemini2025';

  const allParticipants = [
    ...(results?.finishers || []),
    ...(results?.nonFinishers || [])
  ];

  const getMasterKeyForEvent = () => {
    if (!selectedEvent || Object.keys(masterGroups).length === 0) return null;
    return Object.keys(masterGroups).find((key) =>
      masterGroups[key]?.includes(String(selectedEvent.id))
    );
  };

  const masterKey = getMasterKeyForEvent();
  const logoUrl = masterKey ? eventLogos[masterKey] || null : null;

  const getResultsUrl = () => {
    if (!masterKey || !selectedEvent?.start_time) return 'https://gemini-results.vercel.app/results';
    const year = new Date(selectedEvent.start_time * 1000).getFullYear();
    const slug = masterKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `https://gemini-results.vercel.app/results/${slug}/${year}`;
  };

  // Robust ordinal function – used everywhere
  const ordinal = (n) => {
    if (!n) return '—';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const getRaceStory = (splits = [], finalPlace) => {
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

  const getEventDisplayName = () => selectedEvent?.name || 'Race Results';

  const performSearch = (query) => {
    if (!query.trim()) {
      setMatches([]);
      setParticipant(null);
      return;
    }
    const term = query.trim();
    const lowerTerm = term.toLowerCase();

    const found = allParticipants.filter((r) => {
      if (r.bib && r.bib.toString() === term) return true;
      const fullName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
      return fullName.includes(lowerTerm);
    });

    if (found.length === 1) {
      setParticipant(found[0]);
      setMatches([]);
      setShowConfetti(true);
      startCountdown();
    } else if (found.length > 1) {
      setMatches(found);
      setParticipant(null);
      setCountdown(null);
    } else {
      setMatches([]);
      setParticipant('not-found');
      setCountdown(null);
    }
  };

  const selectParticipant = (p) => {
    setParticipant(p);
    setMatches([]);
    setShowConfetti(true);
    startCountdown();
  };

  // Countdown – paused when email form open
  useEffect(() => {
    if (countdown === null || showEmailForm) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          resetToSearch();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown, showEmailForm]);

  const startCountdown = () => {
    if (showEmailForm) return;
    setCountdown(AUTO_RESET_SECONDS);
  };

  const resetToSearch = () => {
    setParticipant(null);
    setMatches([]);
    setSearchTerm('');
    setShowConfetti(false);
    setCountdown(null);
    setShowEmailForm(false);
    setEmail('');
    setOptIn(false);
    setEmailStatus('');
    document.getElementById('kiosk-search-input')?.focus();
  };

  // Email sending with full branded template
  const sendEmail = async () => {
    if (!email || !optIn) return;

    setEmailStatus('sending');

    const fullName = `${participant.first_name} ${participant.last_name}`.trim() || 'Champion';
    const eventName = getEventDisplayName();
    const raceName = participant.race_name || eventName;
    const raceStory = getRaceStory(participant.splits || [], participant.place);

    const totalFinishers = allParticipants.length;
    const genderCount = allParticipants.filter(r => r.gender === participant.gender).length;
    const divisionCount = allParticipants.filter(r => r.age_group_name === participant.age_group_name).length;

    const baseUrl = window.location.origin;

    const brandedHtml = `
      <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; margin:0; padding:0;">
        <tr>
          <td align="center" style="padding:20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-collapse:collapse;">
              <!-- Logo Header -->
              <tr>
                <td align="center" style="padding:40px 20px 20px;">
                  <img src="${baseUrl}/GRR.png" alt="Gemini Race Results" width="220" style="display:block; max-width:100%; height:auto;" />
                </td>
              </tr>
              <!-- Hero Section -->
              <tr>
                <td align="center" style="background:#263238; color:#ffffff; padding:60px 20px;">
                  <h1 style="font-size:48px; font-weight:900; margin:0 0 20px; color:#ffffff; line-height:1.2;">CONGRATULATIONS!</h1>
                  <h2 style="font-size:36px; font-weight:700; margin:0 0 16px; color:#ffffff;">${fullName}</h2>
                  <p style="font-size:24px; margin:0 0 30px; color:#ffffff;">You conquered the ${raceName}!</p>
                  <p style="font-size:20px; margin:0 0 8px; color:#ffffff;">Official Chip Time</p>
                  <p style="font-size:56px; font-weight:900; margin:16px 0; color:#ffffff; line-height:1;">${formatChronoTime(participant.chip_time)}</p>
                  <p style="font-size:20px; margin:0; color:#ffffff;">Pace: ${participant.pace ? formatChronoTime(participant.pace) : '—'}</p>
                </td>
              </tr>
              <!-- Stats Section -->
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
                              <p style="font-size:48px; font-weight:900; color:#B22222; margin:0; line-height:1;">${ordinal(participant.place)}</p>
                              <p style="font-size:16px; color:#666; margin:5px 0 0;">of ${totalFinishers}</p>
                            </td>
                            <td align="center" width="33%" style="padding:15px;">
                              <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Gender</p>
                              <p style="font-size:48px; font-weight:900; color:#B22222; margin:0; line-height:1;">${ordinal(participant.gender_place)}</p>
                              <p style="font-size:16px; color:#666; margin:5px 0 0;">of ${genderCount}</p>
                            </td>
                            <td align="center" width="33%" style="padding:15px;">
                              <p style="font-size:18px; color:#263238; margin:0 0 10px; font-weight:600;">Division</p>
                              <p style="font-size:48px; font-weight:900; color:#B22222; margin:0; line-height:1;">${ordinal(participant.age_group_place)}</p>
                              <p style="font-size:16px; color:#666; margin:5px 0 0;">of ${divisionCount} (${participant.age_group_name || ''})</p>
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
          subject: `${fullName.split(' ')[0]}, You Absolutely Crushed ${eventName}!`,
          html: brandedHtml,
        }),
      });

      if (res.ok) {
        setEmailStatus('success');
        setTimeout(() => {
          resetToSearch();
        }, 3000);
      } else {
        setEmailStatus('error');
      }
    } catch (err) {
      console.error('Send failed:', err);
      setEmailStatus('error');
    }
  };

  useEffect(() => {
    if (stage === 'access-pin') document.getElementById('access-pin-input')?.focus();
    if (stage === 'kiosk') document.getElementById('kiosk-search-input')?.focus();
  }, [stage]);

  // Exit protection
  useEffect(() => {
    if (stage !== 'kiosk') return;

    const preventBack = (e) => {
      e.preventDefault();
      const confirmed = window.confirm('Are you sure you want to leave kiosk mode?');
      if (confirmed) {
        setStage('event-select');
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };

    const preventUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave kiosk mode?';
      return 'Are you sure you want to leave kiosk mode?';
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', preventBack);
    window.addEventListener('beforeunload', preventUnload);

    return () => {
      window.removeEventListener('popstate', preventBack);
      window.removeEventListener('beforeunload', preventUnload);
    };
  }, [stage]);

  // ====================== ACCESS PIN STAGE ======================
  if (stage === 'access-pin') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-brand-turquoise to-brand-turquoise/80 flex items-center justify-center p-8">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 max-w-md w-full text-center border-8 border-brand-turquoise">
          <h1 className="text-4xl font-black text-brand-dark mb-8">Timing Team Access</h1>
          <p className="text-xl text-text-muted mb-8">Enter Pin to Configure</p>
          <input
            id="access-pin-input"
            type="password"
            value={accessPinInput}
            onChange={(e) => setAccessPinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && accessPinInput === ACCESS_PIN) {
                setAccessPinInput('');
                setStage('event-select');
              }
            }}
            className="w-full text-5xl text-center tracking-widest px-8 py-6 border-8 border-brand-turquoise rounded-3xl mb-8 focus:outline-none focus:ring-8 focus:ring-brand-turquoise/30"
            autoFocus
          />
          <button
            onClick={() => {
              if (accessPinInput === ACCESS_PIN) {
                setAccessPinInput('');
                setStage('event-select');
              } else {
                alert('Incorrect Pin');
                setAccessPinInput('');
              }
            }}
            className="px-16 py-6 bg-brand-turquoise text-white text-3xl font-black rounded-full hover:scale-105 transition shadow-2xl"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  // ====================== EVENT SELECT STAGE WITH SEARCH ======================
  if (stage === 'event-select') {
    const sortedEvents = [...events]
      .sort((a, b) => (b.start_time || 0) - (a.start_time || 0))
      .filter((event) =>
        event.name?.toLowerCase().includes(eventSearchTerm.toLowerCase())
      );

    return (
      <div className="fixed inset-0 bg-bg-light flex flex-col">
        <div className="bg-brand-turquoise text-white p-6 text-center shadow-2xl">
          <h1 className="text-4xl font-black">Select Event</h1>
        </div>

        {/* Search Bar */}
        <div className="px-6 pt-6 pb-4">
          <input
            type="text"
            value={eventSearchTerm}
            onChange={(e) => setEventSearchTerm(e.target.value)}
            placeholder="Search events..."
            className="w-full text-2xl text-center bg-white text-brand-dark placeholder-text-muted border-6 border-brand-turquoise rounded-3xl py-6 px-8 focus:outline-none focus:ring-8 focus:ring-brand-turquoise/50 shadow-xl"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {sortedEvents.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-3xl text-brand-dark">
                {eventSearchTerm ? 'No events match your search' : 'No events loaded'}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 max-w-5xl mx-auto">
              {sortedEvents.map((event) => {
                const eventMasterKey = Object.keys(masterGroups).find((k) =>
                  masterGroups[k]?.includes(String(event.id))
                );
                const eventLogo = eventMasterKey ? eventLogos[eventMasterKey] : null;

                return (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setStage('kiosk');
                    }}
                    className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl hover:scale-105 transition-all border-4 border-brand-turquoise/30"
                  >
                    {eventLogo && (
                      <img src={eventLogo} alt="Logo" className="max-h-32 mx-auto mb-6 object-contain drop-shadow-md" />
                    )}
                    <h3 className="text-2xl font-black text-brand-dark mb-3">{event.name}</h3>
                    <p className="text-lg text-text-muted">
                      {new Date(event.start_time * 1000).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ====================== FULL KIOSK MODE ======================
  return (
    <>
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={400}
          gravity={0.12}
          colors={['#48D1CC', '#FFFFFF', '#B22222', '#FFD700']}
        />
      )}
      <div className="fixed inset-0 bg-gradient-to-br from-brand-turquoise to-brand-turquoise/90 flex flex-col items-center justify-start text-text-light pt-2 px-4 pb-4 overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-2 z-10 mt-12">
          {logoUrl && (
            <img src={logoUrl} alt="Event Logo" className="mx-auto max-h-32 mb-3 object-contain drop-shadow-xl" />
          )}
          <h1 className="text-4xl md:text-5xl font-black drop-shadow-2xl">
            {getEventDisplayName()}
          </h1>
          <p className="text-xl mt-1 opacity-90">Finish Line Kiosk</p>
        </div>

        {/* QR Code – Small & Top-Left */}
        {participant && typeof participant === 'object' && (
          <div className="fixed top-2 left-2 z-40 bg-white p-3 rounded-2xl shadow-2xl border-4 border-brand-turquoise">
            <div className="w-28 h-28">
              <QRCode
                value={getResultsUrl()}
                size={100}
                level="H"
                fgColor="#B22222"
                bgColor="#FFFFFF"
              />
            </div>
            <p className="text-xs text-center mt-1 text-brand-dark font-medium">Scan</p>
          </div>
        )}

        {/* Countdown */}
        {countdown !== null && !showEmailForm && (
          <div className="fixed top-4 right-4 text-3xl font-black bg-black/70 px-6 py-3 rounded-full shadow-2xl z-40">
            {countdown}s
          </div>
        )}

        {loadingResults && (
          <div className="text-4xl font-bold animate-pulse mt-16">Loading results...</div>
        )}

        {/* Search */}
        {!participant && matches.length === 0 && !loadingResults && (
          <div className="w-full max-w-3xl z-10 mt-6">
            <input
              id="kiosk-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch(searchTerm)}
              placeholder="Enter bib or last name"
              className="w-full text-5xl text-center bg-white text-brand-dark placeholder-text-muted border-6 border-brand-turquoise rounded-3xl py-10 px-8 focus:outline-none focus:ring-8 focus:ring-brand-turquoise/50 shadow-2xl"
              autoFocus
            />
            <div className="text-center mt-8">
              <button
                onClick={() => performSearch(searchTerm)}
                className="px-20 py-10 bg-white text-brand-turquoise text-5xl font-black rounded-full hover:scale-110 transition shadow-2xl"
              >
                GO!
              </button>
            </div>
          </div>
        )}

        {/* Multiple Matches – Shows Race Name */}
        {matches.length > 0 && (
          <div className="w-full max-w-4xl z-10 mt-6">
            <p className="text-4xl text-center mb-8 font-black drop-shadow-2xl">Tap Your Name</p>
            <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
              {matches.map((p, i) => (
                <button
                  key={i}
                  onClick={() => selectParticipant(p)}
                  className="bg-white/95 text-brand-dark rounded-3xl shadow-2xl p-10 hover:scale-105 transition border-6 border-brand-turquoise"
                >
                  <div className="text-5xl font-black mb-2">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-3xl text-brand-red font-bold mb-2">
                    Bib #{p.bib}
                  </div>
                  {p.race_name && (
                    <div className="text-2xl text-brand-turquoise font-medium">
                      {p.race_name}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="text-center mt-10">
              <button
                onClick={resetToSearch}
                className="px-16 py-6 bg-brand-dark text-white text-3xl font-black rounded-full hover:opacity-90 shadow-2xl"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Athlete Result Card – Shows Race Name + Correct Ordinals */}
        {participant && typeof participant === 'object' && (
          <div className="bg-white/96 backdrop-blur-xl text-brand-dark rounded-3xl shadow-2xl p-8 max-w-3xl w-full text-center border-6 border-brand-turquoise z-10 mt-4">
            <div className="text-7xl font-black text-brand-red mb-4 drop-shadow-lg">
              #{ordinal(participant.place || '—')}
            </div>

            <h2 className="text-4xl font-black mb-2">
              {participant.first_name} {participant.last_name}
            </h2>

            {participant.race_name && (
              <p className="text-2xl font-medium text-brand-turquoise mb-4">
                {participant.race_name}
              </p>
            )}

            <p className="text-2xl text-text-muted mb-6">Bib #{participant.bib}</p>

            <div className="grid grid-cols-2 gap-6 text-2xl mb-8">
              <div className="bg-brand-red/15 rounded-3xl py-6 shadow-lg">
                <div className="font-black text-brand-red text-4xl">
                  {formatChronoTime(participant.chip_time)}
                </div>
                <div className="text-text-muted mt-2 text-lg">Chip Time</div>
              </div>
              <div className="bg-brand-red/10 rounded-3xl py-6 shadow-lg">
                <div className="font-black text-brand-dark text-4xl">
                  {participant.pace ? formatChronoTime(participant.pace) : '—'}
                </div>
                <div className="text-text-muted mt-2 text-lg">Pace</div>
              </div>
            </div>

            <div className="text-xl space-y-3 mb-8">
              <p><strong>Gender Place:</strong> {ordinal(participant.gender_place)} {participant.gender}</p>
              {participant.age_group_place && (
                <p><strong>Division:</strong> {ordinal(participant.age_group_place)} in {participant.age_group_name}</p>
              )}
              {participant._status === 'DNF' && (
                <p className="text-brand-red font-bold text-3xl">Did Not Finish</p>
              )}
            </div>

            {/* Email My Stats – Inline */}
            <div className="mt-6">
              {!showEmailForm ? (
                <button
                  onClick={() => {
                    setShowEmailForm(true);
                    setCountdown(null);
                  }}
                  className="px-20 py-8 bg-brand-turquoise text-white text-3xl font-black rounded-full hover:scale-105 transition shadow-2xl"
                >
                  Email Me My Stats
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 w-full sm:max-w-md text-2xl text-center px-6 py-5 rounded-3xl border-4 border-brand-turquoise focus:outline-none focus:ring-4 focus:ring-brand-turquoise/50 bg-white"
                      autoFocus
                    />
                    <button
                      onClick={sendEmail}
                      disabled={!email || !optIn || emailStatus === 'sending'}
                      className="px-12 py-5 bg-brand-turquoise text-white text-2xl font-black rounded-full disabled:opacity-70 shadow-xl whitespace-nowrap"
                    >
                      {emailStatus === 'sending' ? 'Sending...' : 'Send Email'}
                    </button>
                  </div>

                  <label className="flex items-center justify-center gap-4 text-lg">
                    <input
                      type="checkbox"
                      checked={optIn}
                      onChange={(e) => setOptIn(e.target.checked)}
                      className="w-6 h-6 text-brand-turquoise rounded focus:ring-brand-turquoise"
                    />
                    <span>Yes, send me future race updates from Gemini Timing</span>
                  </label>

                  <div className="text-center">
                    <button
                      onClick={resetToSearch}
                      className="px-12 py-4 bg-brand-dark text-white text-xl font-black rounded-full shadow-xl"
                    >
                      Cancel
                    </button>
                  </div>

                  {emailStatus === 'success' && (
                    <p className="text-green-600 text-2xl font-bold animate-pulse">✓ Email sent! Returning to search...</p>
                  )}
                  {emailStatus === 'error' && (
                    <p className="text-brand-red text-2xl font-bold">✗ Send failed – try again</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Not Found */}
        {participant === 'not-found' && (
          <div className="text-center max-w-3xl z-10 mt-16">
            <div className="text-8xl mb-6">😅</div>
            <h2 className="text-5xl font-black mb-4 drop-shadow-2xl">
              No Results Found Yet
            </h2>
            <p className="text-3xl leading-relaxed mb-10 opacity-90">
              Results may still be syncing.<br />Ask timing staff for help.
            </p>
            <button
              onClick={resetToSearch}
              className="px-20 py-10 bg-white text-brand-turquoise text-5xl font-black rounded-full hover:scale-110 shadow-2xl"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </>
  );
}