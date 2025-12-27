// src/pages/director/RaceDirectorsHub.jsx
// FINAL — Superadmin Awards Visibility Panel added
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useDirector } from '../../context/DirectorContext';
import DirectorLayout from './DirectorLayout';

export default function RaceDirectorsHub() {
  const navigate = useNavigate();
  const {
    currentUser,
    assignedEvents = [],
    expandedAssignedEvents = [],
    selectedEventId,
    setSelectedEventId,
    selectedEventName = 'No Event Selected',
    isSuperAdmin,
  } = useDirector();

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Superadmin: Awards visibility settings
  const [awardSettings, setAwardSettings] = useState({
    event_visible: true,
    race_visibility: {}, // { "5K": true, "Half Marathon": false }
  });
  const [races, setRaces] = useState([]); // Unique race names for current event
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        let eventIdsToShow = [];

        if (expandedAssignedEvents.length > 0) {
          eventIdsToShow = expandedAssignedEvents;
        } else if (assignedEvents.length > 0) {
          eventIdsToShow = assignedEvents;
        } else {
          setAllEvents([]);
          setLoading(false);
          return;
        }

        const { data: eventData, error: fetchError } = await supabase
          .from('chronotrack_events')
          .select('id, name, start_time')
          .in('id', eventIdsToShow);

        if (fetchError) throw fetchError;

        const sorted = (eventData || [])
          .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

        setAllEvents(sorted);

        if (sorted.length > 0 && !selectedEventId) {
          setSelectedEventId(String(sorted[0].id));
        }
      } catch (err) {
        console.error('[RaceDirectorsHub] Load error:', err);
        setError('Failed to load your events. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, assignedEvents, expandedAssignedEvents, selectedEventId, setSelectedEventId]);

  // Superadmin: Load awards visibility + races for current event
  useEffect(() => {
    if (!isSuperAdmin || !selectedEventId) {
      setLoadingSettings(false);
      return;
    }

    const loadSettingsAndRaces = async () => {
      setLoadingSettings(true);
      try {
        // Load visibility settings
        const { data: visData } = await supabase
          .from('event_results_visibility')
          .select('event_visible, race_visibility')
          .eq('event_id', selectedEventId)
          .single();

        setAwardSettings({
          event_visible: visData?.event_visible ?? true,
          race_visibility: visData?.race_visibility || {},
        });

        // Load unique race names for this event
        const { data: results } = await supabase
          .from('chronotrack_results')
          .select('race_name')
          .eq('event_id', selectedEventId);

        const uniqueRaces = [...new Set(results?.map(r => r.race_name).filter(Boolean))];
        setRaces(uniqueRaces);
      } catch (err) {
        console.warn('Failed to load visibility/races:', err);
        setAwardSettings({ event_visible: true, race_visibility: {} });
        setRaces([]);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettingsAndRaces();
  }, [isSuperAdmin, selectedEventId]);

  const saveAwardSettings = async (settings) => {
    try {
      await supabase
        .from('event_results_visibility')
        .upsert({
          event_id: selectedEventId,
          event_visible: settings.event_visible,
          race_visibility: settings.race_visibility,
        });
    } catch (err) {
      console.error('Failed to save visibility:', err);
      alert('Failed to update visibility.');
    }
  };

  if (loading) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
            <p className="text-2xl text-brand-dark">Loading your hub...</p>
          </div>
        </div>
      </DirectorLayout>
    );
  }

  if (error) {
    return (
      <DirectorLayout>
        <div className="max-w-4xl mx-auto text-center py-20">
          <p className="text-2xl text-red-600 mb-8">{error}</p>
          <button onClick={() => window.location.reload()} className="px-8 py-4 bg-primary text-white rounded-full font-bold hover:bg-primary/90">
            Retry
          </button>
        </div>
      </DirectorLayout>
    );
  }

  const selectedEvent = allEvents.find(e => String(e.id) === String(selectedEventId));

  return (
    <DirectorLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-black text-brand-dark mb-12 text-center">
          Welcome back!
        </h1>

        {allEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-2xl">
            <p className="text-3xl text-brand-dark mb-6">No Events Assigned</p>
            <p className="text-xl text-gray-600">Contact the admin for access.</p>
          </div>
        ) : (
          <>
            {selectedEvent && (
              <div className="bg-white rounded-3xl shadow-2xl p-10 mb-12 text-center">
                <h2 className="text-4xl font-black text-primary mb-4">
                  {selectedEvent.name}
                </h2>
                <p className="text-2xl text-gray-600">
                  {new Date(selectedEvent.start_time * 1000).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}

            {/* Superadmin Awards Visibility Panel */}
            {isSuperAdmin && selectedEvent && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-8 mb-12">
                <h2 className="text-3xl font-bold text-brand-dark mb-6">
                  🔐 Superadmin: Awards Visibility Control
                </h2>
                <p className="text-lg text-gray-700 mb-6">
                  Hide awards until ready. Regular directors cannot see this panel.
                </p>

                {loadingSettings ? (
                  <p>Loading settings...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Global Event Toggle */}
                    <label className="flex items-center justify-between bg-white rounded-xl px-6 py-4 shadow">
                      <span className="text-lg font-medium">Show All Awards for Event</span>
                      <input
                        type="checkbox"
                        checked={awardSettings.event_visible}
                        onChange={async (e) => {
                          const updated = { ...awardSettings, event_visible: e.target.checked };
                          setAwardSettings(updated);
                          await saveAwardSettings(updated);
                        }}
                        className="h-8 w-8 text-primary rounded focus:ring-primary"
                      />
                    </label>

                    {/* Per-Race Toggles */}
                    {races.length > 0 && (
                      <div className="bg-white rounded-xl p-6 shadow">
                        <p className="text-sm font-medium text-gray-600 mb-4">Per-Race Visibility</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {races.map(race => {
                            const isVisible = awardSettings.race_visibility?.[race] ?? true;
                            return (
                              <label key={race} className="flex items-center justify-between">
                                <span className="text-base">{race}</span>
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={async (e) => {
                                    const updatedRaceVis = {
                                      ...(awardSettings.race_visibility || {}),
                                      [race]: e.target.checked,
                                    };
                                    const updated = {
                                      ...awardSettings,
                                      race_visibility: updatedRaceVis,
                                    };
                                    setAwardSettings(updated);
                                    await saveAwardSettings(updated);
                                  }}
                                  className="h-6 w-6 text-primary rounded focus:ring-primary"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Feature Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
                <h2 className="text-2xl font-bold text-accent mb-4">Live Athlete Tracking</h2>
                <p className="text-text-muted mb-6">
                  Real-time monitoring of runners on course.
                </p>
                <button
                  onClick={() => navigate('live-tracking')}
                  disabled={!selectedEventId}
                  className="bg-primary text-text-light px-6 py-3 rounded-full font-bold hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  Open Dashboard →
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
                <h2 className="text-2xl font-bold text-accent mb-4">Awards Management</h2>
                <p className="text-text-muted mb-6">
                  Generate and track awards pickup.
                </p>
                <button
                  onClick={() => navigate('awards')}
                  className="bg-primary text-text-light px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition"
                >
                  Open Awards →
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
                <h2 className="text-2xl font-bold text-accent mb-4">Year-over-Year Analytics</h2>
                <p className="text-text-muted mb-6">
                  Compare participation and performance trends.
                </p>
                <button
                  onClick={() => navigate('analytics')}
                  className="bg-primary text-text-light px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition"
                >
                  Open Analytics →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DirectorLayout>
  );
}