// src/pages/ResultsKiosk.jsx
// Final Kiosk Mode: Access Pin → Event Select → Set Exit Pin → Full Touch-Friendly Kiosk

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { useContext } from 'react';
import { RaceContext } from '../context/RaceContext';

export default function ResultsKiosk() {
  const navigate = useNavigate();

  const {
    events = [],
    results = [],
    selectedEvent,
    setSelectedEvent,
    eventLogos = {},
    loadingResults,
  } = useContext(RaceContext);

  const [stage, setStage] = useState('access-pin');
  const [accessPinInput, setAccessPinInput] = useState('');
  const [exitPin, setExitPin] = useState('');
  const [exitPinConfirm, setExitPinConfirm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [participant, setParticipant] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [showExitPinModal, setShowExitPinModal] = useState(false);
  const [exitPinInput, setExitPinInput] = useState('');

  const timeoutRef = useRef(null);
  const AUTO_RESET_SECONDS = 10;

  const ACCESS_PIN = import.meta.env.VITE_KIOSK_ACCESS_PIN || 'gemini2025';

  // Restore session on refresh
  useEffect(() => {
    const stored = sessionStorage.getItem('kioskExitPin');
    if (stored && selectedEvent) {
      setExitPin(stored);
      setStage('kiosk');
    }
  }, [selectedEvent]);

  // Debug logs
  useEffect(() => {
    console.log('[Kiosk] Events:', events.length);
    console.log('[Kiosk] Results:', results.length);
    console.log('[Kiosk] Selected Event:', selectedEvent?.name || 'none');
    console.log('[Kiosk] Stage:', stage);
  }, [events, results, selectedEvent, stage]);

  const formatTime = (timeStr) => (timeStr?.trim() ? timeStr.trim() : '—');
  const formatPlace = (place) =>
    !place ? '—' : place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;

  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    return new Date(epoch * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getEventDisplayName = () => selectedEvent?.name || 'Race Results';
  const logoUrl = selectedEvent ? eventLogos[selectedEvent.id] || null : null;

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

  // Auto-focus inputs
  useEffect(() => {
    if (stage === 'access-pin') document.getElementById('access-pin-input')?.focus();
    if (stage === 'kiosk') document.getElementById('kiosk-search-input')?.focus();
  }, [stage]);

  // Prevent navigation without PIN
  useEffect(() => {
    if (stage !== 'kiosk') return;
    const handlePopState = (e) => {
      e.preventDefault();
      setShowExitPinModal(true);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [stage]);

  const handleExitPinSubmit = () => {
    if (exitPinInput === exitPin) {
      sessionStorage.removeItem('kioskExitPin');
      setStage('access-pin');
      setSelectedEvent(null);
      setExitPin('');
      setShowExitPinModal(false);
      setExitPinInput('');
      navigate('/kiosk');
    } else {
      alert('Incorrect PIN');
      setExitPinInput('');
    }
  };

  // Block common refresh shortcuts
  useEffect(() => {
    if (stage !== 'kiosk') return;
    const block = (e) => {
      if (e.key === 'F5' || e.key === 'Backspace' || (e.metaKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', block);
    return () => window.removeEventListener('keydown', block);
  }, [stage]);

  // === RENDER STAGES ===

  // 1. Access Pin (smaller, touch-friendly)
  if (stage === 'access-pin') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gemini-blue to-gemini-blue/80 flex items-center justify-center p-8">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-12 max-w-sm w-full text-center">
          <h1 className="text-4xl font-black text-gemini-dark-gray mb-8">
            Timing Team Access
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            Enter Access Pin to configure kiosk
          </p>
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
            className="w-full text-5xl text-center tracking-widest px-8 py-6 border-4 border-gemini-blue rounded-2xl mb-8"
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
            className="px-14 py-6 bg-gemini-blue text-white text-3xl font-bold rounded-full hover:scale-105 transition shadow-xl"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  // 2. Event Select
  if (stage === 'event-select') {
    const sortedEvents = [...events].sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col">
        <div className="bg-gemini-blue text-white p-8 text-center">
          <h1 className="text-4xl font-bold">Select Event for Kiosk</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          {sortedEvents.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-3xl text-gray-600">No events loaded yet.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              {sortedEvents.map((event) => {
                const count = results.filter((r) => r.event_id === event.id).length;
                const logo = eventLogos[event.id];
                return (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setStage('set-exit-pin');
                    }}
                    className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl hover:scale-105 transition text-left"
                  >
                    {logo && <img src={logo} alt="Logo" className="max-h-32 mx-auto mb-6 object-contain" />}
                    <h3 className="text-2xl font-bold text-gemini-dark-gray mb-3">{event.name}</h3>
                    <p className="text-xl text-gray-600 mb-2">{formatDate(event.start_time)}</p>
                    <p className="text-lg font-medium text-gemini-blue">
                      {count > 0 ? `${count} ${count === 1 ? 'finisher' : 'finishers'}` : 'Results loading...'}
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

  // 3. Set Exit Pin (smaller)
  if (stage === 'set-exit-pin') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gemini-blue to-gemini-blue/80 flex items-center justify-center p-8">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-12 max-w-sm w-full text-center">
          <h1 className="text-4xl font-black text-gemini-dark-gray mb-8">Lock This iPad</h1>
          <p className="text-xl text-gray-700 mb-8">
            Create a 4-digit PIN to exit kiosk mode later
          </p>
          <input
            type="password"
            placeholder="Enter PIN"
            value={exitPin}
            onChange={(e) => setExitPin(e.target.value.slice(0, 4))}
            className="w-full text-5xl text-center tracking-widest px-8 py-6 border-4 border-gemini-blue rounded-2xl mb-6"
            autoFocus
          />
          <input
            type="password"
            placeholder="Confirm PIN"
            value={exitPinConfirm}
            onChange={(e) => setExitPinConfirm(e.target.value.slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && exitPin === exitPinConfirm && exitPin.length === 4) {
                sessionStorage.setItem('kioskExitPin', exitPin);
                setStage('kiosk');
              }
            }}
            className="w-full text-5xl text-center tracking-widest px-8 py-6 border-4 border-gemini-blue rounded-2xl mb-8"
          />
          <button
            onClick={() => {
              if (exitPin === exitPinConfirm && exitPin.length === 4) {
                sessionStorage.setItem('kioskExitPin', exitPin);
                setStage('kiosk');
              } else {
                alert('PINs must match and be 4 digits');
              }
            }}
            className="px-14 py-6 bg-gemini-blue text-white text-3xl font-bold rounded-full hover:scale-105 transition shadow-xl"
          >
            Start Kiosk
          </button>
        </div>
      </div>
    );
  }

  // 4. Full Kiosk Mode — optimized for iPad
  return (
    <>
      {showConfetti && <Confetti recycle={false} numberOfPieces={400} gravity={0.15} />}

      <div className="fixed inset-0 bg-gradient-to-br from-gemini-blue to-gemini-blue/80 flex flex-col items-center justify-center text-white p-8">
        <div className="text-center mb-10">
          {logoUrl && (
            <img src={logoUrl} alt="Event Logo" className="mx-auto max-h-36 mb-6 object-contain drop-shadow-2xl" />
          )}
          <h1 className="text-5xl md:text-6xl font-black drop-shadow-lg">{getEventDisplayName()}</h1>
          <p className="text-2xl md:text-3xl mt-3 opacity-90">Finish Line Kiosk</p>
        </div>

        {loadingResults && <div className="text-5xl animate-pulse">Loading results...</div>}

        {!participant && !loadingResults && (
          <div className="w-full max-w-2xl">
            <p className="text-3xl text-center mb-8 font-light">
              Search by Bib # or Last Name
            </p>
            <input
              id="kiosk-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch(searchTerm)}
              placeholder="Enter bib or name..."
              className="w-full text-5xl md:text-7xl text-center bg-white/20 backdrop-blur border-4 border-white/50 rounded-3xl py-10 px-8 text-white placeholder-white/60 focus:outline-none focus:border-white"
              autoFocus
            />
            <div className="text-center mt-10">
              <button
                onClick={() => performSearch(searchTerm)}
                className="px-14 py-6 bg-white text-gemini-blue text-4xl font-bold rounded-full hover:scale-105 transition shadow-xl"
              >
                GO!
              </button>
            </div>
          </div>
        )}

        {participant && typeof participant === 'object' && (
          <div className="bg-white/95 backdrop-blur-xl text-gemini-dark-gray rounded-3xl shadow-2xl p-8 max-w-2xl w-full text-center">
            <div className="text-5xl md:text-7xl font-black text-gemini-blue mb-4">
              #{formatPlace(participant.place)}
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-4">
              {participant.first_name} {participant.last_name}
            </h2>
            <p className="text-2xl md:text-3xl text-gray-600 mb-10">Bib #{participant.bib}</p>

            <div className="grid grid-cols-2 gap-8 text-2xl md:text-3xl mb-12">
              <div className="bg-gemini-blue/10 rounded-2xl py-6">
                <div className="font-black text-gemini-blue">{formatTime(participant.chip_time)}</div>
                <div className="text-gray-700 mt-2 text-lg">Chip Time</div>
              </div>
              <div className="bg-gray-100 rounded-2xl py-6">
                <div className="font-black">{participant.pace || '—'}</div>
                <div className="text-gray-700 mt-2 text-lg">Pace</div>
              </div>
            </div>

            <div className="text-2xl md:text-3xl space-y-4 mb-12">
              <p><strong>Gender Place:</strong> {formatPlace(participant.gender_place)} {participant.gender}</p>
              {participant.age_group_place && (
                <p><strong>Division:</strong> {formatPlace(participant.age_group_place)} in {participant.age_group_name}</p>
              )}
            </div>

            <div>
              <p className="text-2xl font-bold mb-6">Scan for Full Results</p>
              <div className="bg-gray-200 border-2 border-dashed rounded-xl w-48 h-48 mx-auto flex items-center justify-center text-5xl">
                📱
              </div>
              <p className="text-lg mt-6 text-gray-600">
                gemini-results.vercel.app/results
              </p>
            </div>

            {countdown !== null && (
              <div className="fixed bottom-12 left-1/2 -translate-x-1/2 text-5xl font-bold bg-black/70 px-10 py-6 rounded-full">
                Returning in {countdown}s
              </div>
            )}
          </div>
        )}

        {participant === 'not-found' && (
          <div className="text-center">
            <div className="text-6xl mb-8">😅</div>
            <h2 className="text-5xl md:text-7xl font-bold mb-8">No Results Found Yet</h2>
            <p className="text-3xl md:text-4xl max-w-2xl mx-auto leading-relaxed">
              Results may still be syncing!<br />
              Please check with timing staff nearby.
            </p>
            {countdown !== null && (
              <div className="fixed bottom-12 left-1/2 -translate-x-1/2 text-5xl font-bold bg-black/70 px-10 py-6 rounded-full">
                Returning in {countdown}s
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exit PIN Modal */}
      {showExitPinModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-12 text-center max-w-sm">
            <h3 className="text-4xl font-bold text-gemini-dark-gray mb-8">Enter Exit PIN</h3>
            <input
              type="password"
              value={exitPinInput}
              onChange={(e) => setExitPinInput(e.target.value.slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && handleExitPinSubmit()}
              className="text-5xl text-center tracking-widest px-8 py-6 border-4 border-gemini-blue rounded-2xl mb-8"
              autoFocus
            />
            <div className="space-x-6">
              <button
                onClick={handleExitPinSubmit}
                className="px-12 py-6 bg-gemini-blue text-white text-3xl font-bold rounded-full"
              >
                Exit Kiosk
              </button>
              <button
                onClick={() => {
                  setShowExitPinModal(false);
                  setExitPinInput('');
                }}
                className="px-12 py-6 bg-gray-300 text-gray-800 text-3xl font-bold rounded-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}