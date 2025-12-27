// src/pages/director/LiveTrackingPage.jsx
// UPDATED: Uses cached data from Supabase for instant, reliable load

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; // ← Your existing client

export default function LiveTrackingPage() {
  const navigate = useNavigate();
  const [trackingData, setTrackingData] = useState<any>(null);
  const [eventName, setEventName] = useState('Loading event...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Extract eventId from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');

  // Fetch event name (unchanged — still direct API for name only)
  useEffect(() => {
    if (!eventId) return;

    const fetchEventName = async () => {
      try {
        const response = await fetch(
          `https://api.chronotrack.com/api/event/${eventId}?format=json&client_id=${import.meta.env.VITE_CHRONOTRACK_CLIENT_ID}&user_id=${import.meta.env.VITE_CHRONOTRACK_USER}&user_pass=${import.meta.env.VITE_CHRONOTRACK_PASS}`
        );
        const data = await response.json();
        const name = data.event?.event_name || `Event ID ${eventId}`;
        setEventName(name);
      } catch (err) {
        console.warn('[LiveTracking] Failed to fetch event name:', err);
        setEventName(`Event ID ${eventId}`);
      }
    };

    fetchEventName();
  }, [eventId]);

  // Load cached live data from Supabase
  const loadData = async () => {
    if (!eventId) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: supabaseError } = await supabase
        .from('live_tracking_cache')
        .select('data, last_updated, fetch_status')
        .eq('event_id', eventId)
        .single();

      if (supabaseError || !data) {
        throw supabaseError || new Error('No cached data found');
      }

      if (data.fetch_status === 'in_progress') {
        setError('Updating live data...');
      } else if (data.fetch_status === 'failed') {
        setError('Last update failed — retrying soon');
      } else {
        setError('');
      }

      setTrackingData(data.data);
      setLastRefresh(new Date(data.last_updated));
    } catch (err: any) {
      setError('No live data yet — background update in progress...');
      console.error('[LiveTracking] Cache load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load + polling
  useEffect(() => {
    if (!eventId) return;

    loadData();

    if (autoRefresh) {
      const interval = setInterval(loadData, 15000); // Every 15 seconds — feels real-time
      return () => clearInterval(interval);
    }
  }, [eventId, autoRefresh]);

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // No eventId provided
  if (!eventId) {
    return (
      <div className="min-h-screen bg-bg-light flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl font-black text-text-dark mb-8">
          Live Athlete Tracking
        </h1>
        <p className="text-2xl text-text-muted mb-8 max-w-2xl">
          No event selected. Add <code className="bg-gray-200 px-4 py-2 rounded-lg font-mono text-lg">?eventId=XXXX</code> to the URL.
        </p>
        <button
          onClick={() => navigate('/race-directors-hub')}
          className="px-10 py-5 bg-primary text-text-light text-xl font-bold rounded-full hover:bg-brand-red/90 transition shadow-xl"
        >
          ← Back to Director Hub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light">
      {/* Fixed Top Control Bar */}
      <div className="fixed top-0 left-0 right-0 bg-accent text-text-dark shadow-2xl z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-4xl font-black flex items-center gap-4">
              {eventName}
              <span className="text-primary animate-pulse text-3xl">LIVE</span>
            </h1>
            <p className="text-lg opacity-80 mt-1">Event ID: {eventId}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 text-lg">
            <div className={loading ? 'animate-pulse' : ''}>
              Last update: <span className="font-bold">{formatTime(lastRefresh)}</span>
              {loading && ' (refreshing...)'}
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-6 h-6 text-primary rounded focus:ring-primary"
                />
                <span className="font-medium">Auto-refresh (15s)</span>
              </label>
              <button
                onClick={loadData}
                disabled={loading}
                className="px-8 py-3 bg-primary text-text-light rounded-full font-bold hover:bg-brand-red/90 disabled:opacity-50 transition shadow-lg"
              >
                {loading ? 'Refreshing...' : 'Refresh Now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-40 pb-20 px-6 max-w-7xl mx-auto">
        {error && (
          <div className="bg-yellow-100 border-2 border-yellow-500 text-yellow-800 px-10 py-6 rounded-3xl text-center text-xl font-bold mb-10 shadow-xl">
            {error}
          </div>
        )}

        {trackingData && (
          <>
            {/* OVERALL PROGRESS */}
            <section className="mb-20">
              <h2 className="text-4xl md:text-6xl font-black text-center text-text-dark mb-12">
                Overall Race Progress
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
                  <p className="text-6xl md:text-7xl font-black text-primary">
                    {trackingData.overall.started.toLocaleString()}
                  </p>
                  <p className="text-3xl text-text-muted mt-6 font-bold">Started</p>
                </div>
                <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
                  <p className="text-6xl md:text-7xl font-black text-green-600">
                    {trackingData.overall.finished.toLocaleString()}
                  </p>
                  <p className="text-3xl text-text-muted mt-6 font-bold">Finished</p>
                </div>
                <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
                  <p className="text-6xl md:text-7xl font-black text-orange-600 animate-pulse">
                    {trackingData.overall.stillOnCourse.toLocaleString()}
                  </p>
                  <p className="text-3xl text-text-muted mt-6 font-bold">On Course</p>
                </div>
                <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
                  <p className="text-6xl md:text-7xl font-black text-text-muted">
                    {trackingData.overall.yetToStart.toLocaleString()}
                  </p>
                  <p className="text-3xl text-text-muted mt-6 font-bold">Yet to Start</p>
                </div>
              </div>
            </section>

            {/* PER-RACE BREAKDOWN */}
            <section>
              <h2 className="text-4xl md:text-6xl font-black text-center text-text-dark mb-16">
                Progress by Race
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                {trackingData.races.map((race: any) => (
                  <div key={race.raceId} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-accent to-brand-turquoise text-text-dark py-8 px-12">
                      <h3 className="text-4xl font-black">{race.raceName}</h3>
                      <p className="text-2xl opacity-90 mt-3">
                        Total Entrants: {race.total.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-12">
                      <div className="grid grid-cols-2 gap-12 mb-12 text-center">
                        <div>
                          <p className="text-5xl md:text-6xl font-black text-green-600">{race.finished}</p>
                          <p className="text-2xl text-text-muted mt-4">Finished</p>
                        </div>
                        <div>
                          <p className="text-5xl md:text-6xl font-black text-orange-600">{race.stillOnCourse}</p>
                          <p className="text-2xl text-text-muted mt-4">On Course</p>
                        </div>
                      </div>

                      {/* Split Progress Bars */}
                      {race.splitProgress.length > 0 && (
                        <div className="space-y-10">
                          <h4 className="text-3xl font-bold text-text-dark text-center mb-8">
                            Split Progress
                          </h4>
                          {race.splitProgress.map((split: any) => (
                            <div key={split.name} className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xl font-semibold">{split.name}</span>
                                <span className="text-xl font-medium text-text-muted">
                                  {split.passed} / {race.total} ({split.percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-14 overflow-hidden shadow-inner">
                                <div
                                  className="bg-gradient-to-r from-accent to-brand-turquoise h-full rounded-full transition-all duration-1500 ease-out shadow-lg"
                                  style={{ width: `${split.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Critical Final Push Alert */}
            {trackingData.overall.stillOnCourse > 0 && trackingData.overall.stillOnCourse <= 20 && (
              <div className="mt-24 bg-gradient-to-r from-primary to-brand-red text-text-light rounded-3xl shadow-2xl p-16 text-center">
                <p className="text-7xl md:text-9xl font-black animate-pulse">
                  ONLY {trackingData.overall.stillOnCourse} ATHLETES REMAIN!
                </p>
                <p className="text-4xl md:text-5xl mt-8 font-bold">
                  Prepare awards, announcer, and finish line crew!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}