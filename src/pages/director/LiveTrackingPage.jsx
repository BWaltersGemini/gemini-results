// src/pages/director/LiveTrackingPage.jsx
// FINAL — Enhanced with manual trigger, better UX, and robust caching

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function LiveTrackingPage() {
  const navigate = useNavigate();
  const [trackingData, setTrackingData] = useState(null);
  const [eventName, setEventName] = useState('Loading event...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Extract eventId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('eventId');

  // Helper: Format relative time (e.g., "2 minutes ago")
  const formatRelativeTime = (date) => {
    if (!date) return 'never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  // Load cached data from Supabase
  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: sbError } = await supabase
        .from('live_tracking_cache')
        .select('data, last_updated, fetch_status')
        .eq('event_id', eventId)
        .maybeSingle();

      if (sbError && sbError.code !== 'PGRST116') { // Ignore "no rows" error
        throw sbError;
      }

      if (!data || !data.data) {
        setError('No live data available yet — background update in progress...');
        setTrackingData(null);
        setLastRefresh(null);
        setEventName(`Event ID ${eventId}`);
      } else {
        setTrackingData(data.data);
        setLastRefresh(new Date(data.last_updated));
        setEventName(data.data.eventName || `Event ID ${eventId}`);

        if (data.fetch_status === 'in_progress') {
          setError('Updating live data...');
        } else if (data.fetch_status === 'failed') {
          setError('Last update failed — will retry automatically');
        } else {
          setError('');
        }
      }
    } catch (err) {
      setError('Failed to load live tracking data');
      console.error('[LiveTracking] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual trigger: Call Edge Function to force update
  const triggerUpdate = async () => {
    if (!eventId || updating) return;
    setUpdating(true);
    setError('Triggering live update...');

    try {
      const functionUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/live-tracking-updater?eventId=${eventId}`;
      const response = await fetch(functionUrl);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Update failed');
      }

      const result = await response.json();
      console.log('[LiveTracking] Manual update triggered:', result);
      setError('Update triggered — refreshing in 10 seconds...');
      
      // Force reload after delay
      setTimeout(loadData, 10000);
    } catch (err) {
      setError(`Failed to trigger update: ${err.message}`);
      console.error('[LiveTracking] Trigger error:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    if (!eventId) return;
    loadData();

    if (autoRefresh) {
      const interval = setInterval(loadData, 15000); // Every 15s
      return () => clearInterval(interval);
    }
  }, [eventId, autoRefresh]);

  // No eventId
  if (!eventId) {
    return (
      <div className="min-h-screen bg-bg-light flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl font-black text-text-dark mb-8">Live Athlete Tracking</h1>
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
      {/* Fixed Top Bar */}
      <div className="fixed top-0 left-0 right-0 bg-accent text-text-dark shadow-2xl z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black flex items-center gap-4">
              {eventName}
              <span className="text-primary animate-pulse text-4xl">LIVE</span>
            </h1>
            <p className="text-lg opacity-80 mt-2">Event ID: {eventId}</p>
          </div>

          <div className="flex flex-col gap-4 text-lg">
            <div className={loading ? 'animate-pulse' : ''}>
              Last updated: <span className="font-bold">{lastRefresh ? formatRelativeTime(lastRefresh) : '—'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-6">
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
                className="px-6 py-3 bg-gray-700 text-white rounded-full font-bold hover:bg-gray-600 disabled:opacity-50 transition"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>

              <button
                onClick={triggerUpdate}
                disabled={updating}
                className="px-8 py-3 bg-primary text-white rounded-full font-bold hover:bg-brand-red/90 disabled:opacity-50 transition shadow-lg"
              >
                {updating ? 'Triggering...' : 'Force Update Now'}
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

        {loading && !trackingData && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
            <p className="text-2xl mt-8 text-text-muted">Loading live tracking data...</p>
          </div>
        )}

        {trackingData && (
          <>
            {/* Overall Progress */}
            <section className="mb-20">
              <h2 className="text-4xl md:text-6xl font-black text-center text-text-dark mb-12">
                Overall Race Progress
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
                  <p className="text-6xl md:text-7xl font-black text-primary">
                    {trackingData.overall.totalParticipants.toLocaleString()}
                  </p>
                  <p className="text-3xl text-text-muted mt-6 font-bold">Total Athletes</p>
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
                  <p className="text-6xl md:text-7xl font-black text-blue-600">
                    {trackingData.overall.started.toLocaleString()}
                  </p>
                  <p className="text-3xl text-text-muted mt-6 font-bold">Started</p>
                </div>
              </div>
            </section>

            {/* Per-Race Breakdown */}
            <section>
              <h2 className="text-4xl md:text-6xl font-black text-center text-text-dark mb-16">
                Progress by Race
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                {trackingData.races.map((race) => (
                  <div key={race.raceId} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-accent to-brand-turquoise text-text-dark py-8 px-12">
                      <h3 className="text-4xl font-black">{race.raceName}</h3>
                      <p className="text-2xl opacity-90 mt-3">
                        Total: {race.total.toLocaleString()} athletes
                      </p>
                    </div>
                    <div className="p-12">
                      <div className="grid grid-cols-3 gap-8 mb-12 text-center">
                        <div>
                          <p className="text-5xl font-black text-green-600">{race.finished}</p>
                          <p className="text-xl text-text-muted mt-4">Finished</p>
                        </div>
                        <div>
                          <p className="text-5xl font-black text-orange-600">{race.stillOnCourse}</p>
                          <p className="text-xl text-text-muted mt-4">On Course</p>
                        </div>
                        <div>
                          <p className="text-5xl font-black text-blue-600">{race.started}</p>
                          <p className="text-xl text-text-muted mt-4">Started</p>
                        </div>
                      </div>

                      {race.splitProgress.length > 0 && (
                        <div className="space-y-8">
                          <h4 className="text-3xl font-bold text-center mb-6">Split Progress</h4>
                          {race.splitProgress.map((split) => (
                            <div key={split.name} className="space-y-2">
                              <div className="flex justify-between text-lg font-medium">
                                <span>{split.name}</span>
                                <span>{split.percentage}% ({split.passed}/{race.total})</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-12 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-accent to-brand-turquoise h-full rounded-full transition-all duration-1000 ease-out"
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

            {/* Final Push Alert */}
            {trackingData.overall.stillOnCourse > 0 && trackingData.overall.stillOnCourse <= 30 && (
              <div className="mt-24 bg-gradient-to-r from-red-600 to-brand-red text-white rounded-3xl shadow-2xl p-16 text-center animate-pulse">
                <p className="text-7xl md:text-9xl font-black">
                  ONLY {trackingData.overall.stillOnCourse} LEFT ON COURSE!
                </p>
                <p className="text-4xl md:text-5xl mt-8 font-bold">
                  Final push — prepare awards and finish line!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}