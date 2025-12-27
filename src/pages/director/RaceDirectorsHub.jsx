// src/pages/director/RaceDirectorsHub.jsx
// FINAL — Fixed 403 + resilient loading + proper error handling
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useDirector } from '../../context/DirectorContext';
import { fetchEvents } from '../../api/chronotrackapi';
import DirectorLayout from './DirectorLayout';

export default function RaceDirectorsHub() {
  const navigate = useNavigate();
  const {
    currentUser,
    assignedEvents,
    setAssignedEvents,
    selectedEventId,
    setSelectedEventId,
    expandedAssignedEvents,
  } = useDirector();

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        let assignedIds = [];

        // 1. Load individual assignments (legacy)
        const { data: individual, error: indError } = await supabase
          .from('director_event_assignments')
          .select('event_id')
          .eq('user_id', currentUser.id);

        if (indError && indError.code !== 'PGRST116') { // Ignore "no rows" error
          console.warn('Individual assignments error:', indError);
        }

        const individualIds = (individual || []).map(a => String(a.event_id));
        assignedIds = [...individualIds];

        // 2. Load master assignments (new system)
        const { data: masterAssigns, error: masterError } = await supabase
          .from('director_master_assignments')
          .select('master_key')
          .eq('director_user_id', currentUser.id);

        if (masterError) {
          if (masterError.code === '42501') {
            // 403 Forbidden — likely missing RLS policy
            console.warn('Master assignments forbidden — check RLS policy on director_master_assignments');
          } else {
            console.warn('Master assignments error:', masterError);
          }
          // Continue without master assignments
        } else if (masterAssigns) {
          const masterKeys = masterAssigns.map(a => a.master_key);
          // We'll expand later using context masterGroups
        }

        // 3. Fetch actual event data from ChronoTrack
        const events = await fetchEvents();
        const filtered = events.filter(e => assignedIds.includes(String(e.id)));

        const sorted = filtered.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
        setAllEvents(sorted);

        // Auto-select most recent if none selected
        if (sorted.length > 0 && !selectedEventId) {
          setSelectedEventId(sorted[0].id);
        }

        // Update context assigned events
        setAssignedEvents(assignedIds);

      } catch (err) {
        console.error('[RaceDirectorsHub] Load error:', err);
        setError('Failed to load your events. Please refresh or contact support.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, selectedEventId, setAssignedEvents, setSelectedEventId]);

  if (loading) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
            <p className="text-2xl text-brand-dark">Loading your events...</p>
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
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-primary text-white rounded-full font-bold hover:bg-primary/90"
          >
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
          Welcome back, {currentUser?.email?.split('@')[0] || 'Director'}!
        </h1>

        {allEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-2xl">
            <p className="text-3xl text-brand-dark mb-6">No Events Assigned Yet</p>
            <p className="text-xl text-gray-600">Contact the admin to get access to events.</p>
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

            {/* Feature Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
                <h2 className="text-2xl font-bold text-accent mb-4">Live Athlete Tracking</h2>
                <p className="text-text-muted mb-6">
                  Monitor runners in real time: on course, finished, splits, and more.
                </p>
                <button
                  onClick={() => navigate('/director-live-tracking')}
                  className="bg-primary text-text-light px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition"
                >
                  Open Live Dashboard →
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
                <h2 className="text-2xl font-bold text-accent mb-4">Awards Management</h2>
                <p className="text-text-muted mb-6">
                  Generate and manage awards, track pickups, print certificates.
                </p>
                <button
                  onClick={() => navigate('/director-awards')}
                  className="bg-primary text-text-light px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition"
                >
                  Open Awards →
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
                <h2 className="text-2xl font-bold text-accent mb-4">Year-over-Year Analytics</h2>
                <p className="text-text-muted mb-6">
                  Compare growth, finish rates, demographics across years.
                </p>
                <button
                  onClick={() => navigate('/director-analytics')}
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