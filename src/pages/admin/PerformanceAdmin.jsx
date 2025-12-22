// src/pages/admin/PerformanceAdmin.jsx
// Updated: Full historical YoY for Events, Participants, and any Master Series

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { createAdminSupabaseClient } from '../../supabaseClient';

export default function PerformanceAdmin({ masterGroups }) {
  const [yearlyEvents, setYearlyEvents] = useState([]);
  const [yearlyParticipants, setYearlyParticipants] = useState([]);
  const [masterSeriesData, setMasterSeriesData] = useState({});
  const [selectedMaster, setSelectedMaster] = useState('');
  const [loading, setLoading] = useState(true);

  const adminSupabase = createAdminSupabaseClient();

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        // Fetch all events
        const { data: events } = await supabase
          .from('chronotrack_events')
          .select('id, name, start_time');

        // Group by year: Events count
        const eventsByYear = {};
        events.forEach((e) => {
          if (!e.start_time) return;
          const year = new Date(e.start_time * 1000).getFullYear();
          eventsByYear[year] = (eventsByYear[year] || 0) + 1;
        });

        // Group by year: Participants count
        const participantsByYear = {};
        for (const event of events) {
          const year = new Date(event.start_time * 1000).getFullYear();
          const { count } = await adminSupabase
            .from('chronotrack_results')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id);
          participantsByYear[year] = (participantsByYear[year] || 0) + (count || 0);
        }

        const allYears = [...new Set([...Object.keys(eventsByYear), ...Object.keys(participantsByYear)])]
          .map(Number)
          .sort((a, b) => a - b);

        setYearlyEvents(allYears.map((y) => ({ year: y, count: eventsByYear[y] || 0 })));
        setYearlyParticipants(allYears.map((y) => ({ year: y, count: participantsByYear[y] || 0 })));

        // Precompute data for ALL master series
        const seriesData = {};
        for (const [masterKey, eventIds] of Object.entries(masterGroups || {})) {
          const linkedEvents = events.filter((e) => eventIds.includes(e.id.toString()));
          const yearly = {};

          for (const event of linkedEvents) {
            const year = new Date(event.start_time * 1000).getFullYear();
            if (!yearly[year]) yearly[year] = { participants: 0, races: new Set() };

            // Participants
            const { count } = await adminSupabase
              .from('chronotrack_results')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id);
            yearly[year].participants += count || 0;

            // Unique races
            const { data: results } = await adminSupabase
              .from('chronotrack_results')
              .select('race_name')
              .eq('event_id', event.id);
            results.forEach((r) => {
              if (r.race_name) yearly[year].races.add(r.race_name.trim());
            });
            yearly[year].raceCount = yearly[year].races.size;
          }

          seriesData[masterKey] = Object.keys(yearly)
            .map(Number)
            .sort((a, b) => a - b)
            .map((y) => ({
              year: y,
              participants: yearly[y].participants,
              races: yearly[y].raceCount,
            }));
        }

        setMasterSeriesData(seriesData);

        // Auto-select first master if available
        if (Object.keys(seriesData).length > 0) {
          setSelectedMaster(Object.keys(seriesData)[0]);
        }
      } catch (err) {
        console.error('Failed to load performance data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [masterGroups]);

  const selectedData = selectedMaster ? masterSeriesData[selectedMaster] || [] : [];

  if (loading) {
    return (
      <div className="text-center py-32">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-gemini-blue"></div>
        <p className="mt-8 text-2xl text-gray-600">Loading historical performance data...</p>
      </div>
    );
  }

  return (
    <section className="space-y-16">
      <h2 className="text-5xl font-bold text-gemini-dark-gray text-center">Performance & Growth Analytics</h2>

      {/* Total Events Timed YoY */}
      <div className="bg-white rounded-3xl shadow-2xl p-12">
        <h3 className="text-3xl font-bold text-gemini-dark-gray mb-10 text-center">
          Total Events Timed — Year over Year
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {yearlyEvents.map((item, i) => {
            const prev = yearlyEvents[i - 1];
            const change = prev ? item.count - prev.count : null;
            const pct = prev && prev.count > 0 ? ((change / prev.count) * 100).toFixed(1) : null;

            return (
              <div
                key={item.year}
                className={`text-center p-8 rounded-3xl border-4 transition-all ${
                  item.year === 2025
                    ? 'border-gemini-blue bg-gemini-blue/10 scale-110 shadow-xl'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="text-5xl font-black text-gemini-dark-gray">{item.count}</div>
                <div className="text-2xl font-bold mt-4">{item.year}</div>
                {change !== null && (
                  <div className={`mt-6 text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change} ({pct}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Total Participants Timed YoY */}
      <div className="bg-white rounded-3xl shadow-2xl p-12">
        <h3 className="text-3xl font-bold text-gemini-dark-gray mb-10 text-center">
          Total Participants Timed — Year over Year
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {yearlyParticipants.map((item, i) => {
            const prev = yearlyParticipants[i - 1];
            const change = prev ? item.count - prev.count : null;
            const pct = prev && prev.count > 0 ? ((change / prev.count) * 100).toFixed(1) : null;

            return (
              <div
                key={item.year}
                className={`text-center p-8 rounded-3xl border-4 transition-all ${
                  item.year === 2025
                    ? 'border-gemini-blue bg-gemini-blue/10 scale-110 shadow-xl'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="text-5xl font-black text-gemini-dark-gray">
                  {item.count.toLocaleString()}
                </div>
                <div className="text-2xl font-bold mt-4">{item.year}</div>
                {change !== null && (
                  <div className={`mt-6 text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change.toLocaleString()} ({pct}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Master Series Historical Comparison */}
      {Object.keys(masterGroups || {}).length > 0 && (
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h3 className="text-3xl font-bold text-gemini-dark-gray mb-10 text-center">
            Master Series Historical Growth
          </h3>

          {/* Master Selector */}
          <div className="max-w-md mx-auto mb-12">
            <label className="block text-xl font-semibold text-gray-700 mb-4 text-center">
              Select a Master Series
            </label>
            <select
              value={selectedMaster}
              onChange={(e) => setSelectedMaster(e.target.value)}
              className="w-full px-6 py-4 text-xl border-2 border-gemini-blue rounded-2xl focus:outline-none focus:ring-4 focus:ring-gemini-blue/30"
            >
              {Object.keys(masterGroups).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          {selectedData.length > 0 && (
            <div className="grid md:grid-cols-2 gap-12">
              {/* Participants Over Time */}
              <div className="bg-gradient-to-br from-gemini-blue/10 to-gemini-blue/5 rounded-3xl p-10 border border-gemini-blue/30">
                <h4 className="text-2xl font-bold text-center mb-8">Participants per Year</h4>
                <div className="space-y-6">
                  {selectedData.map((item, i) => {
                    const prev = selectedData[i - 1];
                    const change = prev ? item.participants - prev.participants : null;
                    const pct = prev && prev.participants > 0 ? ((change / prev.participants) * 100).toFixed(1) : null;

                    return (
                      <div
                        key={item.year}
                        className={`p-6 rounded-2xl text-center ${
                          item.year === 2025 ? 'bg-gemini-blue/20 border-4 border-gemini-blue' : 'bg-white'
                        }`}
                      >
                        <div className="text-4xl font-black">{item.participants.toLocaleString()}</div>
                        <div className="text-2xl font-bold mt-3">{item.year}</div>
                        {change !== null && (
                          <div className={`mt-4 text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change > 0 ? '+' : ''}{change.toLocaleString()} ({pct}%)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Races Offered Over Time */}
              <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-3xl p-10 border border-purple-300">
                <h4 className="text-2xl font-bold text-center mb-8">Races Offered per Year</h4>
                <div className="space-y-6">
                  {selectedData.map((item, i) => {
                    const prev = selectedData[i - 1];
                    const change = prev ? item.races - prev.races : null;

                    return (
                      <div
                        key={item.year}
                        className={`p-6 rounded-2xl text-center ${
                          item.year === 2025 ? 'bg-purple-200 border-4 border-purple-500' : 'bg-white'
                        }`}
                      >
                        <div className="text-4xl font-black text-purple-700">{item.races}</div>
                        <div className="text-2xl font-bold mt-3">{item.year}</div>
                        {change !== null && (
                          <div className={`mt-4 text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change > 0 ? '+' : ''}{change}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-center text-gray-500 italic text-lg">
        All data pulled from full historical records in Supabase • Updated {new Date().toLocaleDateString()}
      </div>
    </section>
  );
}