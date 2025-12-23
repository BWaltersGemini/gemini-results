// src/pages/ResultsKiosk.jsx
// Event-Specific Kiosk Mode — Locked to one event via URL
// Supports direct bib access and future per-event branding

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useContext } from 'react';
import { RaceContext } from '../context/RaceContext';

export default function ResultsKiosk() {
  const navigate = useNavigate();
  const location = useLocation();
  const { masterKey, year, bib } = useParams();

  const {
    events = [],
    results = [],
    selectedEvent,
    setSelectedEvent,
    masterGroups = {},
    editedEvents = {},
    eventLogos = {},
    loadingResults,
  } = useContext(RaceContext);

  const [searchTerm, setSearchTerm] = useState('');
  const [participant, setParticipant] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);

  const timeoutRef = useRef(null);
  const KIOSK_PIN = '2580'; // Change as needed
  const AUTO_RESET_SECONDS = 10;

  // Derive current event from URL params
  useEffect(() => {
    if (!masterKey || !year || events.length === 0 || Object.keys(masterGroups).length === 0) return;

    const urlSlug = masterKey.toLowerCase().replace(/_/g, '-');
    const storedMasterKey = Object.keys(masterGroups).find(
      (key) => key.toLowerCase().replace(/_/g, '-') === urlSlug
    );

    if (!storedMasterKey) {
      setParticipant('wrong-event');
      return;
    }

    const groupEventIds = masterGroups[storedMasterKey] || [];
    const targetEvent = events.find(
      (e) =>
        groupEventIds.includes(String(e.id)) &&
        new Date(e.start_time * 1000).getFullYear().toString() === year
    );

    if (targetEvent && targetEvent.id !== selectedEvent?.id) {
      setSelectedEvent(targetEvent);
    } else if (!targetEvent) {
      setParticipant('wrong-event');
    }
  }, [masterKey, year, events, masterGroups, selectedEvent, setSelectedEvent]);

  // If no event selected and not loading, show selector or error
  if (!selectedEvent && !loadingResults && (masterKey || year)) {
    return (
      <div className="fixed inset-0 bg-red-600 flex items-center justify-center text-white p-8">
        <div className="text-center">
          <h1 className="text-6xl font-black mb-8">Event Not Found</h1>
          <p className="text-4xl">Check the kiosk URL or contact timing staff.</p>
        </div>
      </div>
    );
  }

  const displayName = selectedEvent
    ? editedEvents[
        Object.keys(masterGroups).find((k) => masterGroups[k]?.includes(String(selectedEvent.id))) ||
          selectedEvent.id
      ]?.name || selectedEvent.name
    : 'Loading Event...';

  const logoUrl = selectedEvent
    ? eventLogos[
        Object.keys(masterGroups).find((k) => masterGroups[k]?.includes(String(selectedEvent.id))) ||
          selectedEvent.id
      ]
    : null;

  // Rest of your helpers (formatTime, formatPlace, etc.)
  const formatTime = (timeStr) => (timeStr?.trim() ? timeStr.trim() : '—');
  const formatPlace = (place) =>
    !place ? '—' : place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;

  const performSearch = (query) => {
    if (!query.trim()) {
      setParticipant(null);
      return;
    }

    const term = query.trim().toLowerCase();
    const found = results.find((r) => {
      const fullName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
      return r.bib?.toString() === term || fullName.includes(term);
    });

    if (found) {
      setParticipant(found);
      setShowConfetti(true);
      startCountdown();
    } else {
      setParticipant('not-found');
      startCountdown();
    }
  };

  const startCountdown = () => {
    setCountdown(AUTO_RESET_SECONDS);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

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
    setSearchTerm('');
    setShowConfetti(false);
    setCountdown(null);
    document.getElementById('kiosk-search-input')?.focus();
  };

  // Direct bib access
  useEffect(() => {
    if (bib && results.length > 0) {
      performSearch(bib);
    }
  }, [bib, results]);

  // Focus input on load
  useEffect(() => {
    document.getElementById('kiosk-search-input')?.focus();
  }, []);

  // Lock navigation with PIN (same as before)
  useEffect(() => {
    const handlePopState = (e) => {
      e.preventDefault();
      setShowPinModal(true);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handlePinSubmit = () => {
    if (pinInput === KIOSK_PIN) {
      setShowPinModal(false);
      setPinInput('');
      navigate(-1);
    } else {
      alert('Incorrect PIN');
      setPinInput('');
    }
  };

  // Block shortcuts
  useEffect(() => {
    const block = (e) => {
      if (e.key === 'Backspace' || (e.metaKey && e.key === 'r')) e.preventDefault();
    };
    window.addEventListener('keydown', block);
    return () => window.removeEventListener('keydown', block);
  }, []);

  return (
    <>
      {showConfetti && <Confetti recycle={false} numberOfPieces={400} gravity={0.15} />}

      <div className="fixed inset-0 bg-gradient-to-br from-gemini-blue to-gemini-blue/80 flex flex-col items-center justify-center text-white p-8">
        {/* Event Header */}
        <div className="text-center mb-12">
          {logoUrl && (
            <img src={logoUrl} alt="Event Logo" className="mx-auto max-h-40 mb-8 object-contain" />
          )}
          <h1 className="text-5xl md:text-7xl font-black drop-shadow-lg">{displayName}</h1>
          <p className="text-2xl md:text-3xl mt-4 opacity-90">Finish Line Kiosk</p>
        </div>

        {/* Loading or No Event */}
        {loadingResults && (
          <div className="text-6xl">Loading results...</div>
        )}

        {/* Search Screen */}
        {!participant && !loadingResults && selectedEvent && (
          <div className="w-full max-w-3xl">
            <p className="text-3xl md:text-4xl text-center mb-12 font-light">
              Search by Bib # or Last Name
            </p>
            <input
              id="kiosk-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch(searchTerm)}
              placeholder="Enter bib or name..."
              className="w-full text-6xl md:text-8xl text-center bg-white/20 backdrop-blur border-4 border-white/50 rounded-3xl py-12 px-8 text-white placeholder-white/60 focus:outline-none focus:border-white"
              autoFocus
            />
            <div className="text-center mt-12">
              <button
                onClick={() => performSearch(searchTerm)}
                className="px-16 py-8 bg-white text-gemini-blue text-5xl font-bold rounded-full hover:scale-105 transition shadow-2xl"
              >
                GO!
              </button>
            </div>
          </div>
        )}

        {/* Participant Found */}
        {participant && participant !== 'not-found' && participant !== 'wrong-event' && (
          // ... (same participant display as before)
          <div className="bg-white/95 backdrop-blur-xl text-gemini-dark-gray rounded-3xl shadow-2xl p-12 max-w-4xl w-full text-center">
            <div className="text-6xl md:text-8xl font-black text-gemini-blue mb-6">
              #{formatPlace(participant.place)}
            </div>
            <h2 className="text-5xl md:text-7xl font-bold mb-4">
              {participant.first_name} {participant.last_name}
            </h2>
            <p className="text-3xl md:text-4xl text-gray-600 mb-12">Bib #{participant.bib}</p>

            <div className="grid grid-cols-2 gap-12 text-3xl md:text-4xl mb-16">
              <div className="bg-gemini-blue/10 rounded-2xl py-8">
                <div className="font-black text-gemini-blue">{formatTime(participant.chip_time)}</div>
                <div className="text-gray-700 mt-2">Chip Time</div>
              </div>
              <div className="bg-gray-100 rounded-2xl py-8">
                <div className="font-black">{participant.pace || '—'}</div>
                <div className="text-gray-700 mt-2">Pace</div>
              </div>
            </div>

            <div className="text-3xl space-y-4">
              <p><strong>Gender:</strong> {formatPlace(participant.gender_place)} {participant.gender}</p>
              {participant.age_group_place && (
                <p><strong>Division:</strong> {formatPlace(participant.age_group_place)} in {participant.age_group_name}</p>
              )}
            </div>

            <div className="mt-16">
              <p className="text-3xl font-bold mb-8">Scan for Full Results</p>
              <div className="bg-gray-200 border-2 border-dashed rounded-xl w-64 h-64 mx-auto flex items-center justify-center text-6xl">
                📱
              </div>
              <p className="text-xl mt-8 text-gray-600">
                geminitiming.com/results
              </p>
            </div>

            {countdown !== null && (
              <div className="fixed bottom-16 left-1/2 -translate-x-1/2 text-5xl font-bold bg-black/70 px-12 py-8 rounded-full">
                Returning in {countdown}s
              </div>
            )}
          </div>
        )}

        {/* Not Found */}
        {participant === 'not-found' && (
          <div className="text-center">
            <div className="text-6xl mb-8">😅</div>
            <h2 className="text-5xl md:text-7xl font-bold mb-8">No Results Found Yet</h2>
            <p className="text-3xl md:text-4xl max-w-2xl mx-auto">
              Results may still be processing!<br />
              Please check with timing staff.
            </p>
            {countdown !== null && (
              <div className="fixed bottom-16 left-1/2 -translate-x-1/2 text-5xl font-bold bg-black/70 px-12 py-8 rounded-full">
                Returning in {countdown}s
              </div>
            )}
          </div>
        )}
      </div>

      {/* PIN Modal - unchanged */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-12 text-center">
            <h3 className="text-4xl font-bold text-gemini-dark-gray mb-8">Enter PIN to Exit</h3>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              className="text-6xl text-center tracking-widest px-8 py-6 border-4 border-gemini-blue rounded-2xl"
              autoFocus
            />
            <div className="mt-8 space-x-6">
              <button onClick={handlePinSubmit} className="px-12 py-6 bg-gemini-blue text-white text-3xl font-bold rounded-full">
                Submit
              </button>
              <button onClick={() => { setShowPinModal(false); setPinInput(''); }} className="px-12 py-6 bg-gray-300 text-gray-800 text-3xl font-bold rounded-full">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}