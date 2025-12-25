// src/pages/director/AnalyticsPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { currentUser } = useDirector();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [stats, setStats] = useState(null);

  // Auth guard
  if (!currentUser) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <p className="text-2xl text-text-muted">Authenticating...</p>
        </div>
      </DirectorLayout>
    );
  }

  // Load director's events (same as hub)
  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        const { data: assignments } = await supabase
          .from('director_event_assignments')
          .select('event_id')
          .eq('user_id', currentUser.id);

        const assignedIds = assignments?.map(a => a.event_id) || [];

        if (assignedIds.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        // Fetch event details from chronotrack_results to get years
        const { data: results } = await supabase
          .from('chronotrack_results')
          .select('event_id, event_name')
          .in('event_id', assignedIds)
          .limit(1000);

        const uniqueEvents = [...new Set(results?.map(r => r.event_id))].map(id => {
          const sample = results.find(r => r.event_id === id);
          return { id, name: sample?.event_name || id };
        });

        setEvents(uniqueEvents.sort((a, b) => b.id.localeCompare(a.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [currentUser]);

  // Load stats for selected event
  useEffect(() => {
    if (!selectedEvent) return;

    const loadStats = async () => {
      const { data: finishers } = await supabase
        .from('chronotrack_results')
        .select('gender, age, chip_time, _status')
        .eq('event_id', selectedEvent.id);

      const total = finishers?.length || 0;
      const finished = finishers?.filter(r => r._status !== 'DNF' && r.chip_time).length || 0;
      const dnf = finishers?.filter(r => r._status === 'DNF').length || 0;

      const male = finishers?.filter(r => r.gender === 'M').length || 0;
      const female = finishers?.filter(r => r.gender === 'F').length || 0;

      const avgAge = finishers?.reduce((sum, r) => sum + (r.age || 0), 0) / total || 0;

      setStats({
        totalParticipants: total,
        finishers: finished,
        dnfRate: total ? ((dnf / total) * 100).toFixed(1) : 0,
        malePercentage: total ? ((male / total) * 100).toFixed(1) : 0,
        femalePercentage: total ? ((female / total) * 100).toFixed(1) : 0,
        averageAge: avgAge.toFixed(1),
      });
    };

    loadStats();
  }, [selectedEvent]);

  if (loading) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <p className="text-2xl text-text-muted">Loading analytics...</p>
        </div>
      </DirectorLayout>
    );
  }

  return (
    <DirectorLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-text-dark mb-8">Year-over-Year Analytics</h1>

        {events.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-8 text-center">
            <p className="text-xl text-yellow-800">
              No events available for analytics yet.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-12">
              <label className="text-xl font-semibold text-text-dark mb-4 block">
                Select Event for Detailed Stats
              </label>
              <select
                value={selectedEvent?.id || ''}
                onChange={(e) => setSelectedEvent(events.find(ev => ev.id === e.target.value) || null)}
                className="w-full md:w-96 p-4 border border-gray-300 rounded-xl text-lg focus:ring-4 focus:ring-accent/30"
              >
                <option value="">Choose an event...</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedEvent && stats && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h3 className="text-2xl font-bold text-primary mb-4">Total Participants</h3>
                  <p className="text-5xl font-black text-text-dark">{stats.totalParticipants}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h3 className="text-2xl font-bold text-green-600 mb-4">Finishers</h3>
                  <p className="text-5xl font-black text-text-dark">{stats.finishers}</p>
                  <p className="text-lg text-text-muted mt-2">
                    DNF Rate: {stats.dnfRate}%
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h3 className="text-2xl font-bold text-accent mb-4">Gender Split</h3>
                  <p className="text-4xl font-black text-text-dark">
                    {stats.malePercentage}% Male / {stats.femalePercentage}% Female
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 md:col-span-2 lg:col-span-3">
                  <h3 className="text-2xl font-bold text-primary mb-4">Average Participant Age</h3>
                  <p className="text-6xl font-black text-text-dark text-center">{stats.averageAge}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 md:col-span-2 lg:col-span-3">
                  <h3 className="text-2xl font-bold text-text-dark mb-4">Coming Soon</h3>
                  <p className="text-xl text-text-muted">
                    Year-over-year comparison charts, pace trends, and participation growth will be added in a future update.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DirectorLayout>
  );
}