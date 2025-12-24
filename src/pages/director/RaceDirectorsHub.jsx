// src/pages/director/RaceDirectorsHub.jsx
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
    setCurrentUser,
    assignedEvents,
    setAssignedEvents,
    selectedEventId,
    setSelectedEventId,
  } = useDirector();

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check auth + load profile
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/director-login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .single();

      if (profileError || profile?.role !== 'director') {
        await supabase.auth.signOut();
        navigate('/director-login');
        return;
      }

      setCurrentUser({ ...session.user, profile });
    };

    checkAuth();
  }, [navigate, setCurrentUser]);

  // Load assigned events + all ChronoTrack events for display
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const { data: assignments, error: assignError } = await supabase
          .from('director_event_assignments')
          .select('event_id')
          .eq('user_id', currentUser.id);

        if (assignError) throw assignError;

        const assignedIds = assignments?.map(a => a.event_id) || [];

        if (assignedIds.length === 0) {
          setAssignedEvents([]);
          setAllEvents([]);
          setLoading(false);
          return;
        }

        setAssignedEvents(assignedIds);

        const events = await fetchEvents();
        const filtered = events.filter(e => assignedIds.includes(e.id));

        const sorted = filtered.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

        setAllEvents(sorted);

        if (!selectedEventId && sorted.length > 0) {
          setSelectedEventId(sorted[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load your events. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, selectedEventId, setSelectedEventId, setAssignedEvents]);

  const selectedEvent = allEvents.find(e => e.id === selectedEventId);

  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    return new Date(epoch * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Loading state — now correctly wrapped
  if (loading) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <p className="text-2xl text-gray-600">Loading your dashboard...</p>
        </div>
      </DirectorLayout>
    );
  }

  return (
    <DirectorLayout>
      <div className="max-w-7xl mx-auto">
        {error && <p className="text-red-600 text-center mb-8">{error}</p>}

        {/* Event Selector */}
        {allEvents.length > 0 ? (
          <div className="mb-12">
            <label className="text-xl font-semibold text-gemini-dark-gray mb-4 block">
              Select Event
            </label>
            <select
              value={selectedEventId || ''}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full md:w-96 p-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-gemini-blue/30"
            >
              {allEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} — {formatDate(event.start_time)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-8 text-center mb-12">
            <p className="text-xl text-yellow-800">
              No events assigned to your account yet.
            </p>
            <p className="mt-4 text-gray-600">
              Contact support to get your races linked.
            </p>
          </div>
        )}

        {/* Dashboard Grid */}
        {selectedEvent && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Live Tracking Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
              <h2 className="text-2xl font-bold text-gemini-blue mb-4">Live Athlete Tracking</h2>
              <p className="text-gray-600 mb-6">
                Monitor runners on course in real time: started, finished, between splits, and more.
              </p>
              <button
                onClick={() => navigate(`/director-live-tracking/${selectedEventId}`)}
                className="bg-gemini-blue text-white px-6 py-3 rounded-full font-bold hover:bg-gemini-blue/90 transition"
              >
                Open Live Dashboard →
              </button>
            </div>

            {/* Awards Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
              <h2 className="text-2xl font-bold text-gemini-blue mb-4">Awards Management</h2>
              <p className="text-gray-600 mb-6">
                Generate, customize, and distribute awards and certificates.
              </p>
              <button className="bg-gemini-blue text-white px-6 py-3 rounded-full font-bold hover:bg-gemini-blue/90 transition opacity-50 cursor-not-allowed">
                Coming Soon
              </button>
            </div>

            {/* Analytics Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">
              <h2 className="text-2xl font-bold text-gemini-blue mb-4">Year-over-Year Stats</h2>
              <p className="text-gray-600 mb-6">
                Compare participation, finish rates, and performance across years.
              </p>
              <button className="bg-gemini-blue text-white px-6 py-3 rounded-full font-bold hover:bg-gemini-blue/90 transition opacity-50 cursor-not-allowed">
                Coming Soon
              </button>
            </div>
          </div>
        )}
      </div>
    </DirectorLayout>
  );
}