// src/pages/admin/PerformanceAdmin.jsx (FINAL — New Red/Turquoise Brand Palette)
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { createAdminSupabaseClient } from '../../supabaseClient';

export default function PerformanceAdmin({ masterGroups }) {
  const [yearlyEvents, setYearlyEvents] = useState([]);
  const [yearlyParticipants, setYearlyParticipants] = useState([]);
  const [masterSeriesData, setMasterSeriesData] = useState({});
  const [selectedMaster, setSelectedMaster] = useState('');
  const [gaSessions, setGaSessions] = useState([]);
  const [gaUsers, setGaUsers] = useState([]);
  const [gaEventClicks, setGaEventClicks] = useState([]);
  const [gaTopPages, setGaTopPages] = useState([]);
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

      // === 1. INTERNAL DATA: Events & Participants (2018+) ===
      const { data: events } = await supabase
        .from('chronotrack_events')
        .select('id, name, start_time')
        .gte('start_time', Math.floor(Date.parse('2018-01-01') / 1000));

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

      const years = Object.keys(eventsByYear).map(Number).sort((a, b) => a - b);
      setYearlyEvents(years.map((y) => ({ year: y, count: eventsByYear[y] || 0 })));
      setYearlyParticipants(years.map((y) => ({ year: y, count: participantsByYear[y] || 0 })));

      // === 2. MASTER SERIES ANNUAL BREAKDOWN ===
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

          const { count } = await adminSupabase
            .from('chronotrack_results')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id);

          yearly[year].participants = count || 0;

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

      if (Object.keys(seriesData).length > 0 && !selectedMaster) {
        setSelectedMaster(Object.keys(seriesData)[0]);
      }

      // === 3. LIVE GA4 DATA ===
      try {
        const gaRes = await fetch('/api/ga4-report');
        if (gaRes.ok) {
          const { yearly, topPages } = await gaRes.json();
          const gaYears = Object.keys(yearly).map(Number).sort((a, b) => a - b);

          setGaSessions(gaYears.map((y) => ({ year: y, count: yearly[y]?.sessions || 0 })));
          setGaUsers(gaYears.map((y) => ({ year: y, count: yearly[y]?.users || 0 })));
          setGaEventClicks(gaYears.map((y) => ({ year: y, count: yearly[y]?.eventClicks || 0 })));

          const friendlyNames = {
            '/': 'Home Page',
            '/results': 'All Results',
            '/results/*': 'Results Pages',
            '/participant': 'Participant Detail',
            '/services': 'Services',
            '/products': 'Products',
            '/contact': 'Contact',
          };

          setGaTopPages(
            topPages.map((p) => ({
              name: friendlyNames[p.path] || p.path.slice(1).replace(/-/g, ' ').replace(/\//g, ' › ') || 'Other',
              path: p.path,
              views: p.views,
            }))
          );
        } else {
          console.warn('GA4 API returned error:', await gaRes.text());
        }
      } catch (err) {
        console.error('GA4 fetch error:', err);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Performance data load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [masterGroups]);

  const selectedData = selectedMaster ? masterSeriesData[selectedMaster] || [] : [];
  const topPerformer = selectedData.reduce(
    (best, curr) => (curr.participants > (best?.participants || 0) ? curr : best),
    null
  );

  if (loading && !refreshing) {
    return (
      <div className="text-center py-32">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
        <p className="text-3xl text-brand-dark">Loading performance data (2018–present + live GA4 traffic)...</p>
      </div>
    );
  }

  return (
    <section className="space-y-16">
      {/* Header with Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <h2 className="text-5xl font-black text-brand-dark">Performance Dashboard</h2>
        <button
          onClick={() => fetchAllData(true)}
          disabled={refreshing}
          className="px-10 py-5 bg-primary text-white text-2xl font-black rounded-full hover:bg-primary/90 shadow-2xl transition flex items-center gap-4"
        >
          {refreshing ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
              Refreshing...
            </>
          ) : (
            <>↻ Refresh All Data</>
          )}
        </button>
      </div>

      {lastUpdated && (
        <p className="text-center text-gray-500 italic text-lg">
          Last updated: {lastUpdated.toLocaleString()}
        </p>
      )}

      {/* LIVE GA4: Website Sessions */}
      <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/10">
        <h3 className="text-4xl font-black text-brand-dark mb-12 text-center">
          Website Sessions (Live from Google Analytics)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {gaSessions.map((item, i) => {
            const prev = gaSessions[i - 1];
            const change = prev ? item.count - prev.count : null;
            const pct = prev && prev.count > 0 ? ((change / prev.count) * 100).toFixed(1) : null;
            return (
              <div
                key={item.year}
                className={`text-center p-10 rounded-3xl border-4 transition-all shadow-lg ${
                  item.year === 2025
                    ? 'border-primary bg-primary/10 scale-110'
                    : 'border-gray-200 bg-brand-light'
                }`}
              >
                <div className="text-6xl font-black text-brand-dark">{item.count.toLocaleString()}</div>
                <div className="text-3xl font-bold mt-6">{item.year}</div>
                {change !== null && (
                  <div className={`mt-8 text-3xl font-black ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change.toLocaleString()} ({pct}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LIVE GA4: Website Users */}
      <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/10">
        <h3 className="text-4xl font-black text-brand-dark mb-12 text-center">
          Website Users (Live from Google Analytics)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {gaUsers.map((item, i) => {
            const prev = gaUsers[i - 1];
            const change = prev ? item.count - prev.count : null;
            const pct = prev && prev.count > 0 ? ((change / prev.count) * 100).toFixed(1) : null;
            return (
              <div
                key={item.year}
                className={`text-center p-10 rounded-3xl border-4 transition-all shadow-lg ${
                  item.year === 2025
                    ? 'border-primary bg-primary/10 scale-110'
                    : 'border-gray-200 bg-brand-light'
                }`}
              >
                <div className="text-6xl font-black text-brand-dark">{item.count.toLocaleString()}</div>
                <div className="text-3xl font-bold mt-6">{item.year}</div>
                {change !== null && (
                  <div className={`mt-8 text-3xl font-black ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change.toLocaleString()} ({pct}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LIVE GA4: Upcoming Event Clicks */}
      <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/10">
        <h3 className="text-4xl font-black text-brand-dark mb-12 text-center">
          Clicks to Upcoming Events (youkeepmoving.com) — Live GA4
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {gaEventClicks.map((item, i) => {
            const prev = gaEventClicks[i - 1];
            const change = prev ? item.count - prev.count : null;
            const pct = prev && prev.count > 0 ? ((change / prev.count) * 100).toFixed(1) : null;
            return (
              <div
                key={item.year}
                className={`text-center p-10 rounded-3xl border-4 transition-all shadow-lg ${
                  item.year === 2025
                    ? 'border-primary bg-primary/10 scale-110'
                    : 'border-gray-200 bg-brand-light'
                }`}
              >
                <div className="text-6xl font-black text-accent">{item.count.toLocaleString()}</div>
                <div className="text-3xl font-bold mt-6">{item.year}</div>
                {change !== null && (
                  <div className={`mt-8 text-3xl font-black ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change} ({pct}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LIVE GA4: Top Pages */}
      <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/10">
        <h3 className="text-4xl font-black text-brand-dark mb-12 text-center">
          Top Pages (All Time Page Views — Live GA4)
        </h3>
        <div className="space-y-6">
          {gaTopPages
            .sort((a, b) => b.views - a.views)
            .map((page, index) => (
              <div
                key={page.path}
                className="flex items-center justify-between p-8 bg-brand-light rounded-2xl hover:bg-primary/10 transition shadow-md"
              >
                <div className="flex items-center gap-8">
                  <div className="text-4xl font-black text-gray-400">#{index + 1}</div>
                  <div>
                    <div className="text-3xl font-black text-brand-dark">{page.name}</div>
                    <div className="text-xl text-gray-600">{page.path}</div>
                  </div>
                </div>
                <div className="text-5xl font-black text-primary">
                  {page.views.toLocaleString()}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Internal: Events Timed YoY */}
      <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/10">
        <h3 className="text-4xl font-black text-brand-dark mb-12 text-center">
          Total Events Timed (2018–Present)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10">
          {yearlyEvents.map((item, i) => {
            const prev = yearlyEvents[i - 1];
            const change = prev ? item.count - prev.count : null;
            const pct = prev && prev.count > 0 ? ((change / prev.count) * 100).toFixed(1) : null;
            return (
              <div
                key={item.year}
                className={`text-center p-10 rounded-3xl border-4 transition-all shadow-lg ${
                  item.year === 2025
                    ? 'border-primary bg-primary/10 scale-110'
                    : 'border-gray-200 bg-brand-light'
                }`}
              >
                <div className="text-6xl font-black text-brand-dark">{item.count}</div>
                <div className="text-3xl font-bold mt-6">{item.year}</div>
                {change !== null && (
                  <div className={`mt-8 text-3xl font-black ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change} ({pct}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Internal: Participants Timed YoY */}
      <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/10">
        <h3 className="text-4xl font-black text-brand-dark mb-12 text-center">
          Total Participants Timed (2018–Present)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10">
          {yearlyParticipants.map((item, i) => {
            const prev = yearlyParticipants[i - 1];
            const change = prev ? item.count - prev.count : null;
            const pct = prev && prev.count > 0 ? ((change / prev.count) * 100).toFixed(1) : null;
            return (
              <div
                key={item.year}
                className={`text-center p-10 rounded-3xl border-4 transition-all shadow-lg ${
                  item.year === 2025
                    ? 'border-primary bg-primary/10 scale-110'
                    : 'border-gray-200 bg-brand-light'
                }`}
              >
                <div className="text-6xl font-black text-brand-dark">
                  {item.count.toLocaleString()}
                </div>
                <div className="text-3xl font-bold mt-6">{item.year}</div>
                {change !== null && (
                  <div className={`mt-8 text-3xl font-black ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
        <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/10">
          <h3 className="text-4xl font-black text-brand-dark mb-12 text-center">
            Master Series Annual Performance
          </h3>

          <div className="max-w-2xl mx-auto mb-12">
            <label className="block text-2xl font-bold text-brand-dark mb-6 text-center">
              Select a Master Series
            </label>
            <select
              value={selectedMaster}
              onChange={(e) => setSelectedMaster(e.target.value)}
              className="w-full px-8 py-6 text-2xl border-4 border-primary rounded-2xl focus:outline-none focus:ring-8 focus:ring-primary/20 bg-white shadow-xl"
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
                <div className="text-center mb-12">
                  <p className="text-4xl font-black text-primary">
                    🏆 Top Performer: {topPerformer.year} — {topPerformer.participants.toLocaleString()} participants
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-primary/10">
                    <tr>
                      <th className="px-10 py-8 text-2xl font-black text-brand-dark rounded-tl-2xl">Year</th>
                      <th className="px-10 py-8 text-2xl font-black text-brand-dark">Event Name</th>
                      <th className="px-10 py-8 text-2xl font-black text-brand-dark">Participants</th>
                      <th className="px-10 py-8 text-2xl font-black text-brand-dark">Races Offered</th>
                      <th className="px-10 py-8 text-2xl font-black text-brand-dark rounded-tr-2xl">YoY Growth</th>
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
                          className={`border-b-4 border-primary/10 hover:bg-primary/5 transition ${
                            item.year === topPerformer?.year ? 'bg-primary/10 font-bold' : ''
                          }`}
                        >
                          <td className="px-10 py-8 text-2xl font-bold text-brand-dark">{item.year}</td>
                          <td className="px-10 py-8 text-xl text-brand-dark">{item.eventName}</td>
                          <td className="px-10 py-8 text-2xl font-black text-primary">
                            {item.participants.toLocaleString()}
                          </td>
                          <td className="px-10 py-8 text-xl text-brand-dark">{item.races}</td>
                          <td className="px-10 py-8">
                            {growth !== null && (
                              <span className={`text-2xl font-black ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            <p className="text-center text-2xl text-gray-600 py-16">
              No historical data available for this series (2018–present).
            </p>
          )}
        </div>
      )}

      <div className="text-center text-gray-500 italic text-lg">
        Internal data: 2018–present | Website traffic: Live from Google Analytics 4
      </div>
    </section>
  );
}