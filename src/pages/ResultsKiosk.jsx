// src/pages/ResultsKiosk.jsx
// FINAL – iPad Optimized + White Search Field + Inline Placeholder + Formatted Times + Reliable Exit Protection

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useContext } from 'react';
import { RaceContext } from '../context/RaceContext';
import QRCode from 'react-qr-code';
import { formatChronoTime } from '../utils/timeUtils'; // ← NEW IMPORT

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

  const formatPlace = (place) =>
    !place ? '—' : place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;

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

  const startCountdown = () => {
    setCountdown(AUTO_RESET_SECONDS);
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
  };

  const resetToSearch = () => {
    setParticipant(null);
    setMatches([]);
    setSearchTerm('');
    setShowConfetti(false);
    setCountdown(null);
    document.getElementById('kiosk-search-input')?.focus();
  };

  useEffect(() => {
    if (stage === 'access-pin') document.getElementById('access-pin-input')?.focus();
    if (stage === 'kiosk') document.getElementById('kiosk-search-input')?.focus();
  }, [stage]);

  // === Reliable Exit Protection ===
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

  // === ACCESS PIN STAGE ===
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

  // === EVENT SELECT STAGE ===
  if (stage === 'event-select') {
    const sortedEvents = [...events].sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
    return (
      <div className="fixed inset-0 bg-bg-light flex flex-col">
        <div className="bg-brand-turquoise text-white p-6 text-center shadow-2xl">
          <h1 className="text-4xl font-black">Select Event</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {sortedEvents.length === 0 ? (
            <p className="text-3xl text-center text-brand-dark py-20">No events loaded</p>
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

  // === FULL KIOSK MODE ===
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
      <div className="fixed inset-0 bg-gradient-to-br from-brand-turquoise to-brand-turquoise/90 flex flex-col items-center justify-start text-text-light pt-8 px-6 pb-12 overflow-hidden">
        {/* Header */}
        <div className="text-center mb-6 z-10">
          {logoUrl && (
            <img src={logoUrl} alt="Event Logo" className="mx-auto max-h-40 mb-4 object-contain drop-shadow-xl" />
          )}
          <h1 className="text-5xl md:text-6xl font-black drop-shadow-2xl">
            {getEventDisplayName()}
          </h1>
          <p className="text-2xl mt-2 opacity-90">Finish Line Kiosk</p>
        </div>

        {/* Countdown */}
        {countdown !== null && (
          <div className="fixed top-6 right-6 text-4xl font-black bg-black/70 px-8 py-4 rounded-full shadow-2xl z-20">
            {countdown}s
          </div>
        )}

        {loadingResults && (
          <div className="text-5xl font-bold animate-pulse mt-20">Loading results...</div>
        )}

        {/* Search – White Background + Placeholder Only */}
        {!participant && matches.length === 0 && !loadingResults && (
          <div className="w-full max-w-3xl z-10 mt-8">
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
            <div className="text-center mt-10">
              <button
                onClick={() => performSearch(searchTerm)}
                className="px-20 py-10 bg-white text-brand-turquoise text-5xl font-black rounded-full hover:scale-110 transition shadow-2xl"
              >
                GO!
              </button>
            </div>
          </div>
        )}

        {/* Multiple Matches */}
        {matches.length > 0 && (
          <div className="w-full max-w-4xl z-10 mt-8">
            <p className="text-4xl text-center mb-10 font-black drop-shadow-2xl">Tap Your Name</p>
            <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
              {matches.map((p, i) => (
                <button
                  key={i}
                  onClick={() => selectParticipant(p)}
                  className="bg-white/95 text-brand-dark rounded-3xl shadow-2xl p-10 hover:scale-105 transition border-6 border-brand-turquoise"
                >
                  <div className="text-5xl font-black mb-4">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-4xl text-brand-red font-bold">
                    Bib #{p.bib}
                  </div>
                </button>
              ))}
            </div>
            <div className="text-center mt-12">
              <button
                onClick={resetToSearch}
                className="px-16 py-6 bg-brand-dark text-white text-3xl font-black rounded-full hover:opacity-90 shadow-2xl"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Athlete Result Card */}
        {participant && typeof participant === 'object' && (
          <div className="bg-white/96 backdrop-blur-xl text-brand-dark rounded-3xl shadow-2xl p-10 max-w-3xl w-full text-center border-6 border-brand-turquoise z-10 mt-4">
            {/* Overall Place */}
            <div className="text-8xl font-black text-brand-red mb-4 drop-shadow-lg">
              #{formatPlace(participant.place || '—')}
            </div>

            {/* Name */}
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              {participant.first_name} {participant.last_name}
            </h2>
            <p className="text-2xl text-text-muted mb-8">Bib #{participant.bib}</p>

            {/* Time Boxes – Chip Time in Red */}
            <div className="grid grid-cols-2 gap-8 text-2xl mb-10">
              <div className="bg-brand-red/15 rounded-3xl py-8 shadow-lg">
                <div className="font-black text-brand-red text-5xl">
                  {formatChronoTime(participant.chip_time)}
                </div>
                <div className="text-text-muted mt-2 text-lg">Chip Time</div>
              </div>
              <div className="bg-brand-red/10 rounded-3xl py-8 shadow-lg">
                <div className="font-black text-brand-dark text-5xl">
                  {participant.pace ? formatChronoTime(participant.pace) : '—'}
                </div>
                <div className="text-text-muted mt-2 text-lg">Pace</div>
              </div>
            </div>

            {/* Division / Gender */}
            <div className="text-2xl space-y-4 mb-10">
              <p><strong>Gender Place:</strong> {formatPlace(participant.gender_place)} {participant.gender}</p>
              {participant.age_group_place && (
                <p><strong>Division:</strong> {formatPlace(participant.age_group_place)} in {participant.age_group_name}</p>
              )}
              {participant._status === 'DNF' && (
                <p className="text-brand-red font-bold text-3xl">Did Not Finish</p>
              )}
            </div>

            {/* QR Code */}
            <div className="mx-auto max-w-md mt-8">
              <p className="text-2xl font-black mb-6">Scan for Full Results</p>
              <div className="mx-auto w-80 h-80 bg-white p-10 rounded-3xl shadow-2xl border-8 border-brand-turquoise">
                <QRCode
                  value={getResultsUrl()}
                  size={272}
                  level="H"
                  fgColor="#B22222"
                  bgColor="#FFFFFF"
                />
              </div>
              <p className="text-lg mt-6 text-text-light/90">Use your phone camera</p>
            </div>
          </div>
        )}

        {/* Not Found */}
        {participant === 'not-found' && (
          <div className="text-center max-w-3xl z-10 mt-20">
            <div className="text-8xl mb-8">😅</div>
            <h2 className="text-5xl font-black mb-6 drop-shadow-2xl">
              No Results Found Yet
            </h2>
            <p className="text-3xl leading-relaxed mb-12 opacity-90">
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