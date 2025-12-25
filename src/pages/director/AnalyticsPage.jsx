// src/pages/director/AnalyticsPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'; // ← Correct import (with the dot)

import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { currentUser } = useDirector();

  const [events, setEvents] = useState([]); // All assigned events with metadata
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [yearlyStats, setYearlyStats] = useState([]);

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

  // Load all assigned events with proper names and years
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

        // Fetch real event metadata from chronotrack_events
        const { data: eventData } = await supabase
          .from('chronotrack_events')
          .select('id, name, start_time')
          .in('id', assignedIds);

        const formattedEvents = eventData
          .map(ev => ({
            id: ev.id,
            name: ev.name.trim(),
            year: ev.start_time ? new Date(ev.start_time * 1000).getFullYear() : 'Unknown',
          }))
          .sort((a, b) => b.year - a.year); // Newest first

        setEvents(formattedEvents);

        // Auto-select most recent
        if (formattedEvents.length > 0) {
          setSelectedEvent(formattedEvents[0]);
        }
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [currentUser]);

  // Compute year-over-year stats
  useEffect(() => {
    if (events.length === 0) {
      setYearlyStats([]);
      return;
    }

    const computeStats = async () => {
      const stats = [];

      for (const event of events) {
        const { data: results } = await supabase
          .from('chronotrack_results')
          .select('gender, age, chip_time, _status, race_name')
          .eq('event_id', event.id);

        const total = results?.length || 0;
        const finished = results?.filter(r => r._status !== 'DNF' && r.chip_time).length || 0;
        const male = results?.filter(r => r.gender === 'M').length || 0;
        const female = results?.filter(r => r.gender === 'F').length || 0;
        const ages = results?.map(r => r.age || 0).filter(a => a > 0) || [];
        const avgAge = ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : 0;

        stats.push({
          year: event.year,
          eventName: event.name,
          total,
          finished,
          finishRate: total ? ((finished / total) * 100).toFixed(1) : 0,
          malePct: total ? ((male / total) * 100).toFixed(1) : 0,
          femalePct: total ? ((female / total) * 100).toFixed(1) : 0,
          avgAge,
        });
      }

      // Sort by year ascending for charts
      setYearlyStats(stats.sort((a, b) => a.year - b.year));
    };

    computeStats();
  }, [events]);

  // Chart configurations
  const participationData = {
    labels: yearlyStats.map(s => s.year),
    datasets: [
      {
        label: 'Total Participants',
        data: yearlyStats.map(s => s.total),
        backgroundColor: '#B22222',
      },
    ],
  };

  const finishRateData = {
    labels: yearlyStats.map(s => s.year),
    datasets: [
      {
        label: 'Finish Rate %',
        data: yearlyStats.map(s => s.finishRate),
        borderColor: '#48D1CC',
        backgroundColor: 'rgba(72, 209, 204, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const genderData = {
    labels: ['Male', 'Female'],
    datasets: yearlyStats.map((s, i) => ({
      label: s.year,
      data: [s.malePct, s.femalePct],
      backgroundColor: i % 2 === 0 ? '#B22222' : '#48D1CC',
    })),
  };

  const ageData = {
    labels: yearlyStats.map(s => s.year),
    datasets: [
      {
        label: 'Average Age',
        data: yearlyStats.map(s => s.avgAge),
        borderColor: '#263238',
        backgroundColor: 'rgba(38, 50, 56, 0.2)',
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
    maintainAspectRatio: false,
  };

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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-text-dark">Year-over-Year Analytics</h1>
          <button
            onClick={() => navigate('/race-directors-hub')}
            className="text-accent font-semibold hover:underline"
          >
            ← Back to Hub
          </button>
        </div>

        {events.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-8 text-center">
            <p className="text-xl text-yellow-800">
              No events available for analytics yet.
            </p>
          </div>
        ) : (
          <>
            {/* Event Selector */}
            <div className="mb-12">
              <label className="text-xl font-semibold text-text-dark mb-4 block">
                Current Event
              </label>
              <select
                value={selectedEvent?.id || ''}
                onChange={(e) => {
                  const ev = events.find(e => e.id === e.target.value);
                  setSelectedEvent(ev || null);
                }}
                className="w-full md:w-96 p-4 border border-gray-300 rounded-xl text-lg focus:ring-4 focus:ring-accent/30"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({event.year})
                  </option>
                ))}
              </select>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-primary mb-6">Participation Growth</h3>
                <div className="h-80">
                  <Bar data={participationData} options={chartOptions} />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-accent mb-6">Finish Rate Trend</h3>
                <div className="h-80">
                  <Line data={finishRateData} options={chartOptions} />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-primary mb-6">Gender Distribution by Year</h3>
                <div className="h-80">
                  <Doughnut data={genderData} options={{ ...chartOptions, plugins: { legend: { position: 'right' } } }} />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-text-dark mb-6">Average Participant Age</h3>
                <div className="h-80">
                  <Line data={ageData} options={chartOptions} />
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            {selectedEvent && (
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                  <p className="text-5xl font-black text-primary">
                    {yearlyStats.find(s => s.year === selectedEvent.year)?.total || 0}
                  </p>
                  <p className="text-xl text-text-muted mt-4">Total Participants ({selectedEvent.year})</p>
                </div>
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                  <p className="text-5xl font-black text-green-600">
                    {yearlyStats.find(s => s.year === selectedEvent.year)?.finishRate || 0}%
                  </p>
                  <p className="text-xl text-text-muted mt-4">Finish Rate ({selectedEvent.year})</p>
                </div>
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                  <p className="text-5xl font-black text-accent">
                    {yearlyStats.find(s => s.year === selectedEvent.year)?.avgAge || 0}
                  </p>
                  <p className="text-xl text-text-muted mt-4">Avg Age ({selectedEvent.year})</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DirectorLayout>
  );
}