// src/pages/ResultsKiosk.jsx
// FINAL – December 2025 Rebrand + Compatible with new RaceContext (finishers/nonFinishers)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useContext } from 'react';
import { RaceContext } from '../context/RaceContext';
import QRCode from 'react-qr-code';

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

  const AUTO_RESET_SECONDS = 10;
  const ACCESS_PIN = import.meta.env.VITE_KIOSK_ACCESS_PIN || 'gemini2025';

  // Combine finishers + non-finishers for search
  const allParticipants = [
    ...(results?.finishers || []),
    ...(results?.nonFinishers || [])
  ];

  // Master logo
  const getMasterKeyForEvent = () => {
    if (!selectedEvent || Object.keys(masterGroups).length === 0) return null;
    return Object.keys(masterGroups).find((key) =>
      masterGroups[key]?.includes(String(selectedEvent.id))
    );
  };

  const masterKey = getMasterKeyForEvent();
  const logoUrl = masterKey ? eventLogos[masterKey] || null : null;

  // QR Code URL
  const getResultsUrl = () => {
    if (!masterKey || !selectedEvent?.start_time) return 'https://gemini-results.vercel.app/results';
    const year = new Date(selectedEvent.start_time * 1000).getFullYear();
    const slug = masterKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `https://gemini-results.vercel.app/results/${slug}/${year}`;
  };

  const formatTime = (timeStr) => (timeStr?.trim() ? timeStr.trim() : '—');
  const formatPlace = (place) =>
    !place ? '—' : place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;

  const getEventDisplayName = () => selectedEvent?.name || 'Race Results';

  // Search
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

  // === ACCESS PIN STAGE ===
  if (stage === 'access-pin') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-brand-red to-brand-red/80 flex items-center justify-center p-8">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 max-w-lg w-full text-center border-8 border-white">
          <h1 className="text-5xl font-black text-brand-dark mb-10">Timing Team Access</h1>
          <p className="text-2xl text-text-muted mb-10">Enter Access Pin to configure kiosk</p>
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
            className="w-full text-6xl text-center tracking-widest px-10 py-8 border-8 border-brand-red rounded-3xl mb-10 focus:outline-none focus:ring-8 focus:ring-brand-red/30"
            autoFocus
          />
          <button
            onClick={() => {
              if (accessPinInput === ACCESS_PIN) {
                setAccessPinInput('');
                setStage('event-select');
              } else {
                alert('Incorrect Access Pin');
                setAccessPinInput('');
              }
            }}
            className="px-20 py-8 bg-brand-red text-white text-4xl font-black rounded-full hover:scale-110 transition shadow-2xl"
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
        <div className="bg-brand-red text-white p-10 text-center shadow-2xl">
          <h1 className="text-5xl font-black">Select Event for Kiosk</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-10">
          {sortedEvents.length === 0 ? (
            <div className="text-center py-32">
              <p className="text-4xl text-brand-dark">No events loaded yet.</p>
            </div>
          ) : (
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
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
                    className="bg-white rounded-3xl shadow-2xl p-12 hover:shadow-3xl hover:scale-105 transition-all duration-300 border-8 border-brand-turquoise/30"
                  >
                    {eventLogo && (
                      <img
                        src={eventLogo}
                        alt="Event Logo"
                        className="max-h-40 mx-auto mb-8 object-contain drop-shadow-2xl"
                      />
                    )}
                    <h3 className="text-3xl font-black text-brand-dark mb-6">{event.name}</h3>
                    <p className="text-2xl text-text-muted mb-6">
                      {new Date(event.start_time * 1000).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xl font-bold text-brand-red">
                      Tap to Load Results
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
          numberOfPieces={600}
          gravity={0.15}
          colors={['#B22222', '#48D1CC', '#FFFFFF', '#FFD700']}
        />
      )}
      <div className="fixed inset-0 bg-gradient-to-br from-brand-red to-brand-red/90 flex flex-col items-center justify-center text-text-light p-8 relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-12 z-10">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Event Logo"
              className="mx-auto max-h-56 mb-10 object-contain drop-shadow-2xl"
            />
          )}
          <h1 className="text-6xl md:text-8xl font-black drop-shadow-2xl">
            {getEventDisplayName()}
          </h1>
          <p className="text-3xl md:text-4xl mt-4 opacity-90">Finish Line Kiosk</p>
        </div>

        {/* Countdown */}
        {countdown !== null && (
          <div className="fixed top-12 right-12 text-5xl font-black bg-black/70 px-12 py-6 rounded-full shadow-2xl z-20">
            Returning in {countdown}s
          </div>
        )}

        {loadingResults && (
          <div className="text-6xl font-bold animate-pulse">Loading results...</div>
        )}

        {/* Search Input */}
        {!participant && matches.length === 0 && !loadingResults && (
          <div className="w-full max-w-4xl z-10">
            <p className="text-4xl md:text-5xl text-center mb-12 font-light drop-shadow-lg">
              Search by Bib # or Last Name
            </p>
            <input
              id="kiosk-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch(searchTerm)}
              placeholder="Enter bib or name..."
              className="w-full text-6xl md:text-8xl text-center bg-white/20 backdrop-blur-xl border-8 border-white/60 rounded-3xl py-12 px-12 placeholder-white/70 focus:outline-none focus:border-white focus:ring-8 focus:ring-white/30 shadow-2xl"
              autoFocus
            />
            <div className="text-center mt-16">
              <button
                onClick={() => performSearch(searchTerm)}
                className="px-24 py-12 bg-white text-brand-red text-6xl font-black rounded-full hover:scale-110 transition shadow-2xl"
              >
                GO!
              </button>
            </div>
          </div>
        )}

        {/* Multiple Matches */}
        {matches.length > 0 && (
          <div className="w-full max-w-5xl z-10">
            <p className="text-5xl md:text-6xl text-center mb-16 font-black drop-shadow-2xl">
              Tap Your Name Below
            </p>
            <div className="grid gap-12 md:grid-cols-2">
              {matches.map((p, i) => (
                <button
                  key={i}
                  onClick={() => selectParticipant(p)}
                  className="bg-white/95 backdrop-blur-xl text-brand-dark rounded-3xl shadow-2xl p-16 hover:scale-110 transition-all duration-300 border-8 border-brand-turquoise"
                >
                  <div className="text-6xl md:text-7xl font-black mb-6">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-5xl md:text-6xl text-brand-red font-black">
                    Bib #{p.bib}
                  </div>
                  <div className="mt-12 text-3xl text-text-muted flex items-center justify-center gap-6">
                    Tap here <span className="text-6xl">→</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="text-center mt-20">
              <button
                onClick={resetToSearch}
                className="px-20 py-8 bg-brand-dark text-white text-4xl font-black rounded-full hover:opacity-90 transition shadow-2xl"
              >
                ← Back to Search
              </button>
            </div>
          </div>
        )}

        {/* Participant Result Card */}
        {participant && typeof participant === 'object' && (
          <div className="bg-white/96 backdrop-blur-2xl text-brand-dark rounded-3xl shadow-2xl p-12 max-w-4xl w-full text-center border-8 border-brand-turquoise z-10">
            <div className="text-8xl md:text-9xl font-black text-brand-red mb-8 drop-shadow-2xl">
              #{formatPlace(participant.place || '—')}
            </div>
            <h2 className="text-5xl md:text-7xl font-black mb-6">
              {participant.first_name} {participant.last_name}
            </h2>
            <p className="text-3xl md:text-4xl text-text-muted mb-12">Bib #{participant.bib}</p>

            <div className="grid grid-cols-2 gap-12 text-3xl md:text-4xl mb-16">
              <div className="bg-brand-red/10 rounded-3xl py-10 shadow-xl">
                <div className="font-black text-brand-red text-5xl md:text-6xl">
                  {formatTime(participant.chip_time)}
                </div>
                <div className="text-text-muted mt-4 text-xl">Chip Time</div>
              </div>
              <div className="bg-brand-turquoise/10 rounded-3xl py-10 shadow-xl">
                <div className="font-black text-brand-dark text-5xl md:text-6xl">
                  {participant.pace || '—'}
                </div>
                <div className="text-text-muted mt-4 text-xl">Pace</div>
              </div>
            </div>

            <div className="text-3xl md:text-4xl space-y-6 mb-16">
              <p>
                <strong>Gender Place:</strong> {formatPlace(participant.gender_place)} {participant.gender}
              </p>
              {participant.age_group_place && (
                <p>
                  <strong>Division:</strong> {formatPlace(participant.age_group_place)} in {participant.age_group_name}
                </p>
              )}
              {participant._status === 'DNF' && (
                <p className="text-brand-red font-bold text-5xl">Did Not Finish</p>
              )}
            </div>

            {/* QR Code */}
            <div className="mb-12">
              <p className="text-3xl font-black mb-8">Scan for Full Results</p>
              <div className="mx-auto w-72 h-72 bg-white p-10 rounded-3xl shadow-2xl border-8 border-brand-turquoise/50">
                <QRCode value={getResultsUrl()} size={256} level="H" fgColor="#B22222" />
              </div>
              <p className="text-2xl mt-8 text-text-light/90">Scan with your phone</p>
            </div>
          </div>
        )}

        {/* Not Found */}
        {participant === 'not-found' && (
          <div className="text-center max-w-4xl z-10">
            <div className="text-9xl mb-12">😅</div>
            <h2 className="text-6xl md:text-8xl font-black mb-10 drop-shadow-2xl">
              No Results Found Yet
            </h2>
            <p className="text-4xl md:text-5xl leading-relaxed mb-16 opacity-90">
              Results may still be syncing!<br />
              Please check with timing staff nearby.
            </p>
            <button
              onClick={resetToSearch}
              className="px-24 py-12 bg-white text-brand-red text-6xl font-black rounded-full hover:scale-110 transition shadow-2xl"
            >
              Search Again
            </button>
          </div>
        )}
      </div>
    </>
  );
}