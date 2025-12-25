// src/pages/Home.jsx
// UPDATED — December 2025
// • Homepage now ONLY shows visible master series
// • One tile per master, using the most recent linked event
// • Sorted by latest event date
// • Standalone events and hidden masters are excluded
// • Upcoming events limited to 3
// • CTA buttons updated
import { useContext, useState, useEffect } from 'react';
import { RaceContext } from '../context/RaceContext';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Home() {
  const {
    events = [],
    loading,
    setSelectedEvent,
    masterGroups = {},
    editedEvents = {},
    eventLogos = {},
    hiddenMasters = [],
  } = useContext(RaceContext);
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Base numbers + fetched athletes
  const BASE_ATHLETES = 750000;
  const BASE_RACES = 700;
  const [fetchedAthletes, setFetchedAthletes] = useState(0);
  const [displayAthletes, setDisplayAthletes] = useState(0);
  const [displayRaces, setDisplayRaces] = useState(0);

  // Fetch global athletes count
  useEffect(() => {
    const fetchGlobalAthletes = async () => {
      try {
        const { count, error } = await supabase
          .from('chronotrack_results')
          .select('*', { count: 'exact', head: true });
        if (error) throw error;
        setFetchedAthletes(count || 0);
      } catch (err) {
        console.error('Failed to fetch global athletes count:', err);
        setFetchedAthletes(0);
      }
    };
    fetchGlobalAthletes();
  }, []);

  const totalRacesTimed = BASE_RACES + events.length;
  const finalAthletes = BASE_ATHLETES + fetchedAthletes;

  // Animated counters
  useEffect(() => {
    if (loading) return;
    const duration = 3000;
    const steps = 60;
    const interval = duration / steps;
    let currentAthletes = 0;
    let currentRaces = 0;
    const athletesStep = finalAthletes / steps;
    const racesStep = totalRacesTimed / steps;
    const timer = setInterval(() => {
      currentAthletes += athletesStep;
      currentRaces += racesStep;
      if (currentAthletes >= finalAthletes && currentRaces >= totalRacesTimed) {
        setDisplayAthletes(finalAthletes);
        setDisplayRaces(totalRacesTimed);
        clearInterval(timer);
      } else {
        setDisplayAthletes(Math.floor(currentAthletes));
        setDisplayRaces(Math.floor(currentRaces));
      }
    }, interval);
    return () => clearInterval(timer);
  }, [finalAthletes, totalRacesTimed, loading]);

  // Upcoming events from You Keep Moving — limited to 3
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const response = await fetch('https://youkeepmoving.com/wp-json/tribe/events/v1/events?per_page=9&status=publish');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        const futureEvents = (data.events || [])
          .filter(event => new Date(event.start_date) > new Date())
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        setUpcomingEvents(futureEvents.slice(0, 3)); // ← Only top 3
      } catch (err) {
        console.error('Failed to fetch upcoming events:', err);
        setUpcomingEvents([]);
      }
    };
    fetchUpcomingEvents();
  }, []);

  const formatChronoDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getYearFromEvent = (event) => {
    if (!event?.start_time) return null;
    return new Date(event.start_time * 1000).getFullYear().toString();
  };

  const formatTribeDate = (isoStr) => {
    if (!isoStr) return 'Date TBD';
    try {
      const cleaned = isoStr.replace('Z', '').replace(/([+-]\d{2}:\d{2})$/, '');
      const date = new Date(cleaned);
      if (isNaN(date.getTime())) return 'Date TBD';
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return 'Date TBD';
    }
  };

  // === ONLY VISIBLE MASTER SERIES, SORTED BY MOST RECENT EVENT ===
  const masterSeriesTiles = Object.keys(masterGroups)
    .filter(masterKey => !hiddenMasters.includes(masterKey))
    .map(masterKey => {
      const eventIds = masterGroups[masterKey] || [];
      const linkedEvents = events
        .filter(e => eventIds.includes(String(e.id)))
        .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
      if (linkedEvents.length === 0) return null;
      const latestEvent = linkedEvents[0];
      const displayName = editedEvents[masterKey]?.name || masterKey;
      const logo = eventLogos[masterKey] || null;
      return {
        masterKey,
        displayName,
        latestEvent,
        logo,
        latestDate: latestEvent.start_time,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.latestDate || 0) - (a.latestDate || 0))
    .slice(0, 3);

  const handleMasterClick = (masterTile) => {
    setSelectedEvent(masterTile.latestEvent);
    const year = getYearFromEvent(masterTile.latestEvent);
    navigate(`/results/${masterTile.masterKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${year}`);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <video src="/eventvideo.mp4" autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <img src="/Gemini-Logo-White.png" alt="Gemini Timing" className="h-20 md:h-32 mx-auto mb-8" />
          <h1 className="text-4xl md:text-6xl font-light text-white tracking-wider mb-4">
            Precision Timing. Unforgettable Races.
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light tracking-wide mb-12">
            Serving Southern California since 2011
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link
              to="/results"
              className="px-10 py-4 bg-white text-brand-dark font-bold text-lg rounded-full hover:bg-gray-100 transition shadow-xl"
            >
              View Results
            </Link>
            <Link
              to="/services"
              className="px-10 py-4 border-2 border-white text-white font-bold text-lg rounded-full hover:bg-white/10 backdrop-blur-sm transition"
            >
              Get a Quote
            </Link>
          </div>
        </div>
      </section>

      {/* Experience Stats */}
      <section className="py-16 md:py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-12">
            Our Experience in Numbers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-10 transform hover:scale-105 transition duration-300">
              <p className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-primary mb-4 leading-tight">
                {displayAthletes.toLocaleString()}
              </p>
              <p className="text-lg sm:text-xl md:text-2xl font-semibold text-brand-dark">
                Athletes Timed
              </p>
            </div>
            <div className="bg-white rounded-3xl shadow-2xl p-10 transform hover:scale-105 transition duration-300">
              <p className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-primary mb-4 leading-tight">
                {displayRaces.toLocaleString()}
              </p>
              <p className="text-lg sm:text-xl md:text-2xl font-semibold text-brand-dark">
                Races Timed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Master Series */}
      <section className="py-20 md:py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-brand-dark mb-4">
            Recent Series Results
          </h2>
          <div className="w-24 h-1 bg-primary mx-auto"></div>
        </div>
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-primary"></div>
            <p className="mt-6 text-xl text-gray-600">Loading series...</p>
          </div>
        ) : masterSeriesTiles.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">No active series available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {masterSeriesTiles.map(tile => (
              <button
                key={tile.masterKey}
                onClick={() => handleMasterClick(tile)}
                className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary/30"
              >
                <div className="h-72 bg-brand-light flex items-center justify-center p-8">
                  {tile.logo ? (
                    <img src={tile.logo} alt={tile.displayName} className="max-h-56 max-w-full object-contain" />
                  ) : (
                    <span className="text-9xl text-gray-300 group-hover:text-primary transition">🏁</span>
                  )}
                </div>
                <div className="p-10 text-center">
                  <h3 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4 group-hover:text-primary transition">
                    {tile.displayName}
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    {formatChronoDate(tile.latestEvent.start_time)}
                  </p>
                  <span className="text-primary font-bold group-hover:underline">
                    View Results →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="text-center mt-16">
          <Link
            to="/results"
            className="inline-block px-12 py-4 border-2 border-brand-dark text-brand-dark font-bold text-lg rounded-full hover:bg-brand-dark hover:text-white transition shadow-lg"
          >
            View All Results →
          </Link>
        </div>
      </section>

      {/* Upcoming Events — Now only 3 */}
      <section className="py-20 md:py-32 bg-gray-50 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-brand-dark mb-4">
            Upcoming Events
          </h2>
          <div className="w-24 h-1 bg-primary mx-auto mb-12"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {upcomingEvents.length === 0 ? (
              <p className="col-span-3 text-gray-600">Loading upcoming events...</p>
            ) : (
              upcomingEvents.map((event) => ( // ← Removed .slice(0, 6) → now shows only the 3 fetched
                <a
                  key={event.id}
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition"
                >
                  {event.image?.url ? (
                    <img
                      src={event.image.url}
                      alt={event.title.rendered || event.title}
                      className="w-full h-64 object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="bg-brand-light h-64 flex items-center justify-center">
                      <span className="text-gray-500 font-medium">No Image</span>
                    </div>
                  )}
                  <div className="p-8">
                    <h3 className="text-xl font-semibold text-brand-dark mb-2 line-clamp-2">
                      {event.title.rendered || event.title}
                    </h3>
                    <p className="text-gray-600 mb-4">{formatTribeDate(event.start_date)}</p>
                    <span className="text-accent font-bold group-hover:underline">
                      Learn More →
                    </span>
                  </div>
                </a>
              ))
            )}
          </div>
          <a
            href="https://youkeepmoving.com/events"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-12 py-4 bg-accent text-brand-dark font-bold text-lg rounded-full hover:bg-accent/90 transition shadow-xl"
          >
            Full Event Calendar →
          </a>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 md:py-32 bg-brand-dark text-white text-center px-6">
        <h2 className="text-4xl md:text-5xl font-bold mb-8">
          Ready to Elevate Your Race?
        </h2>
        <div className="flex flex-col sm:flex-row gap-8 justify-center items-center max-w-3xl mx-auto">
          <Link
            to="/contact"
            className="px-12 py-5 bg-white text-brand-dark font-bold text-xl rounded-full hover:bg-gray-100 transition shadow-xl"
          >
            Get Timing & Results Services
          </Link>
        </div>
      </section>
    </div>
  );
}