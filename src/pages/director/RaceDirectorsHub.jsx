// src/pages/director/RaceDirectorsHub.jsx
// FINAL — Fixed 403 + "r is not a function" + resilient loading
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
  } = useDirector();

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        // Use expanded events from context if available (includes master series)
        if (expandedAssignedEvents.length > 0) {
          eventIdsToShow = expandedAssignedEvents;
        } else if (assignedEvents.length > 0) {
          // Fallback to direct assignments
          eventIdsToShow = assignedEvents;
        } else {
          // No access at all
          setAllEvents([]);
          setLoading(false);
          return;
        }

        // Fetch event details
        const { data: eventData, error: fetchError } = await supabase
          .from('chronotrack_events')
          .select('id, name, start_time')
          .in('id', eventIdsToShow);

        if (fetchError) {
          console.error('Failed to fetch event details:', fetchError);
          throw fetchError;
        }

        const sorted = (eventData || [])
          .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

        setAllEvents(sorted);

        // Auto-select most recent if none selected
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