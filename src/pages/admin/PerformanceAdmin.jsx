// src/pages/admin/PerformanceAdmin.jsx
// Full Performance Dashboard: Internal Growth (2018+) + Master Series Annual + Cached + Refresh

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { createAdminSupabaseClient } from '../../supabaseClient';

export default function PerformanceAdmin({ masterGroups }) {
  const [yearlyEvents, setYearlyEvents] = useState([]); // { year, count }
  const [yearlyParticipants, setYearlyParticipants] = useState([]); // { year, count }
  const [masterSeriesData, setMasterSeriesData] = useState({}); // { masterKey: [ {year, eventName, participants, races} ] }
  const [selectedMaster, setSelectedMaster] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const adminSupabase = createAdminSupabaseClient();

  const fetchAllData = async (forceRefresh = false) => {
    if (!forceRefresh && lastUpdated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setRefreshing(forceRefresh);

      // Fetch all events (2018 onward)
      const { data: events } = await supabase
        .from('chronotrack_events')
        .select('id, name, start_time')
        .gte('start_time', Math.floor(Date.parse('2018-01-01') / 1000));

      // Total Events & Participants per Year
      const eventsByYear = {};
      const participantsByYear = {};

      for (const event of events || []) {
        const year = new Date(event.start_time * 1000).getFullYear();
        if (year < 2018) continue;

        eventsByYear[year] = (eventsByYear[year] || 0) + 1;

        const { count } = await adminSupabase
          .from('chronotrack_results')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', event.id);

        participantsByYear[year] = (participantsByYear[year] || 0) + (count || 0);
      }

      const years = Object.keys(eventsByYear)
        .map(Number)
        .sort((a, b) => a - b);

      setYearlyEvents(years.map((y) => ({ year: y, count: eventsByYear[y] || 0 })));
      setYearlyParticipants(years.map((y) => ({ year: y, count: participantsByYear[y] || 0 })));

      // Master Series Annual Breakdown
      const seriesData = {};
      for (const [masterKey, eventIds] of Object.entries(masterGroups || {})) {
        const linkedEvents = events.filter((e) => eventIds.includes(e.id.toString()));
        const yearly = {};

        for (const event of linkedEvents) {
          const year = new Date(event.start_time * 1000).getFullYear();
          if (year < 2018) continue;

          if (!yearly[year]) {
            yearly[year] = {
              eventName: event.name,
              participants: 0,
              races: new Set(),
            };
          }

          // Participants
          const { count } = await adminSupabase
            .from('chronotrack_results')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id);
          yearly[year].participants = count || 0;

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

        const sorted = Object.keys(yearly)
          .map(Number)
          .sort((a, b) => a - b)
          .map((y) => ({
            year: y,
            eventName: yearly[y].eventName,
            participants: yearly[y].participants,
            races: yearly[y].raceCount,
          }));

        seriesData[masterKey] = sorted;
      }

      setMasterSeriesData(seriesData);

      // Auto-select first master
      if (Object.keys(seriesData).length > 0 && !selectedMaster) {
        setSelectedMaster(Object.keys(seriesData)[0]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load performance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [masterGroups]);

  const selectedData = selectedMaster ? masterSeriesData[selectedMaster] || [] : [];

  // Find top performer year
  const topPerformer = selectedData.reduce(
    (best, curr) => (curr.participants > (best?.participants || 0) ? curr : best),
    null
  );

  if (loading && !refreshing) {
    return (
      <div className="text-center py-32">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-gemini-blue"></div>
        <p className="mt-8 text-2xl text-gray-600">Loading performance data (2018–present)...</p>
      </div>
    );
  }

  return (
    <section className="space-y-16">
      {/* Header with Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <h2 className="text-5xl font-bold text-gemini-dark-gray">Performance & Growth Analytics</h2>
        <button
          onClick={() => fetchAllData(true)}
          disabled={refreshing}
          className="px-8 py-4 bg-gemini-blue text-white text-xl font-bold rounded-full hover:bg-gemini-blue/90 shadow-xl transition flex items-center gap-3"
        >
          {refreshing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Refreshing...
            </>
          ) : (
            <>↻ Refresh Data</>
          )}
        </button>
      </div>

      {lastUpdated && (
        <p className="text-center text-gray-500 italic text-lg">
          Data last updated: {lastUpdated.toLocaleString()}
        </p>
      )}

      {/* Total Events Timed YoY */}
      <div className="bg-white rounded-3xl shadow-2xl p-12">
        <h3 className="text-3xl font-bold text-gemini-dark-gray mb-10 text-center">
          Total Events Timed (2018–Present)
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
          Total Participants Timed (2018–Present)
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

      {/* Master Series Annual Performance */}
      {Object.keys(masterGroups || {}).length > 0 && (
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h3 className="text-3xl font-bold text-gemini-dark-gray mb-10 text-center">
            Master Series Annual Performance
          </h3>

          <div className="max-w-md mx-auto mb-12">
            <label className="block text-xl font-semibold text-gray-700 mb-4 text-center">
              Select a Master Series
            </label>
            <select
              value={selectedMaster}
              onChange={(e) => setSelectedMaster(e.target.value)}
              className="w-full px-6 py-4 text-xl border-2 border-gemini-blue rounded-2xl focus:outline-none focus:ring-4 focus:ring-gemini-blue/30"
            >
              <option value="">-- Select Series --</option>
              {Object.keys(masterGroups).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          {selectedMaster && selectedData.length > 0 && (
            <>
              {topPerformer && (
                <div className="text-center mb-10">
                  <p className="text-3xl font-bold text-gemini-blue">
                    🏆 Top Performer: {topPerformer.year} — {topPerformer.participants.toLocaleString()} participants
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gemini-blue/10">
                    <tr>
                      <th className="px-8 py-6 text-lg font-bold text-gemini-dark-gray rounded-tl-2xl">Year</th>
                      <th className="px-8 py-6 text-lg font-bold text-gemini-dark-gray">Event Name</th>
                      <th className="px-8 py-6 text-lg font-bold text-gemini-dark-gray">Participants</th>
                      <th className="px-8 py-6 text-lg font-bold text-gemini-dark-gray">Races Offered</th>
                      <th className="px-8 py-6 text-lg font-bold text-gemini-dark-gray rounded-tr-2xl">YoY Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedData.map((item, i) => {
                      const prev = selectedData[i - 1];
                      const growth = prev
                        ? ((item.participants - prev.participants) / prev.participants * 100).toFixed(1)
                        : null;

                      return (
                        <tr
                          key={item.year}
                          className={`border-b border-gray-200 hover:bg-gemini-blue/5 transition ${
                            item.year === topPerformer?.year ? 'bg-gemini-blue/10 font-bold' : ''
                          }`}
                        >
                          <td className="px-8 py-6 text-xl">{item.year}</td>
                          <td className="px-8 py-6">{item.eventName}</td>
                          <td className="px-8 py-6 text-lg font-semibold">
                            {item.participants.toLocaleString()}
                          </td>
                          <td className="px-8 py-6">{item.races}</td>
                          <td className="px-8 py-6">
                            {growth !== null && (
                              <span className={`text-lg font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {growth > 0 ? '+' : ''}{growth}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {selectedMaster && selectedData.length === 0 && (
            <p className="text-center text-xl text-gray-600 py-12">
              No historical data available for this series (2018–present).
            </p>
          )}
        </div>
      )}

      <div className="text-center text-gray-500 italic text-lg">
        All data from January 1, 2018 onward • Goal: +10% YoY growth in events & participants
      </div>
    </section>
  );
}