// src/pages/Home.jsx (FINAL — Animated stats with base + fetched totals)
import { useContext, useState, useEffect } from 'react';
import { RaceContext } from '../context/RaceContext';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Home() {
  const {
    events = [],
    loading,
  } = useContext(RaceContext);
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Base numbers (your established history before digital tracking)
  const BASE_ATHLETES = 750000;
  const BASE_RACES = 700;

  // Fetched current totals
  const [fetchedAthletes, setFetchedAthletes] = useState(0);
  const [displayAthletes, setDisplayAthletes] = useState(0);
  const [displayRaces, setDisplayRaces] = useState(0);

  const totalRacesTimed = BASE_RACES + events.length;

  // Fetch global published athletes count
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

  const finalAthletes = BASE_ATHLETES + fetchedAthletes;

  // Animated count-up effect
  useEffect(() => {
    if (loading) return;

    const duration = 3000; // 3 seconds
    const steps = 60; // ~60 FPS
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

  const masterGroups = JSON.parse(localStorage.getItem('masterGroups')) || {};
  const editedEvents = JSON.parse(localStorage.getItem('editedEvents')) || {};
  const eventLogos = JSON.parse(localStorage.getItem('eventLogos')) || {};

  const slugify = (text) => {
    if (!text) return 'overall';
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  // Fetch upcoming events
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const response = await fetch('https://youkeepmoving.com/wp-json/tribe/events/v1/events?per_page=9&status=publish');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        const futureEvents = (data.events || [])
          .filter(event => new Date(event.start_date) > new Date())
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        setUpcomingEvents(futureEvents);
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

  // Master event tiles (top 3 most recent)
  const masterEventTiles = Object.keys(masterGroups)
    .map(storedKey => {
      const displayName = editedEvents[storedKey]?.name || storedKey;
      const eventIds = masterGroups[storedKey] || [];
      const masterEvents = events.filter(e => eventIds.includes(e.id.toString()));
      if (masterEvents.length === 0) return null;
      const latestEvent = masterEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0))[0];
      const logo = eventLogos[latestEvent.id] || eventLogos[storedKey];
      const masterSlug = slugify(storedKey);
      const year = getYearFromEvent(latestEvent);
      return {
        storedKey,
        displayName,
        logo,
        dateEpoch: latestEvent.start_time,
        masterSlug,
        year,
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  const handleMasterClick = (masterSlug, year) => {
    navigate(`/results/${masterSlug}/${year}`);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <video src="/eventvideo.mp4" autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <img src="/Gemini-Logo-White.png" alt="Gemini Timing" className="h-20 md:h-32 mx-auto mb-8" />
          <h1 className="text-4xl md:text-6xl font-light text-white tracking-wider mb-4">
            Precision Timing. Unforgettable Races.
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light tracking-wide mb-12">
            Serving Southern California since 2011
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link to="/results" className="px-10 py-4 bg-white text-gemini-dark-gray font-medium text-lg rounded-full hover:bg-gray-100 transition">
              View Results
            </Link>
            <Link to="/services" className="px-10 py-4 border-2 border-white text-white font-medium text-lg rounded-full hover:bg-white/10 transition">
              Get a Quote
            </Link>
          </div>
        </div>
      </section>

      {/* Experience Stats — Animated Count-Up */}
      <section className="py-16 md:py-24 bg-gemini-light-gray">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gemini-dark-gray mb-12">
            Our Experience in Numbers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-10 transform hover:scale-105 transition duration-300">
              <p className="text-5xl md:text-7xl lg:text-8xl font-black text-gemini-blue mb-4 leading-tight">
                {displayAthletes.toLocaleString()}+
              </p>
              <p className="text-xl md:text-2xl font-semibold text-gemini-dark-gray">
                Athletes Timed
              </p>
            </div>
            <div className="bg-white rounded-3xl shadow-2xl p-10 transform hover:scale-105 transition duration-300">
              <p className="text-5xl md:text-7xl lg:text-8xl font-black text-gemini-blue mb-4 leading-tight">
                {displayRaces.toLocaleString()}+
              </p>
              <p className="text-xl md:text-2xl font-semibold text-gemini-dark-gray">
                Races Timed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Master Events */}
      <section className="py-20 md:py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gemini-dark-gray mb-4">
            Recent & Live Results
          </h2>
          <div className="w-24 h-1 bg-gemini-blue mx-auto"></div>
        </div>
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-gemini-blue"></div>
            <p className="mt-6 text-xl text-gray-600">Loading results...</p>
          </div>
        ) : masterEventTiles.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">No master events configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {masterEventTiles.map(master => (
              <button
                key={master.storedKey}
                onClick={() => handleMasterClick(master.masterSlug, master.year)}
                className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                <div className="h-72 bg-gray-50 flex items-center justify-center p-8">
                  {master.logo ? (
                    <img src={master.logo} alt={master.displayName} className="max-h-56 max-w-full object-contain" />
                  ) : (
                    <span className="text-9xl text-gray-300 group-hover:text-gemini-blue transition">🏁</span>
                  )}
                </div>
                <div className="p-10 text-center">
                  <h3 className="text-2xl md:text-3xl font-bold text-gemini-dark-gray mb-4 group-hover:text-gemini-blue transition">
                    {master.displayName}
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Latest: {formatChronoDate(master.dateEpoch)}
                  </p>
                  <span className="text-gemini-blue font-bold group-hover:underline">
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
            className="inline-block px-12 py-4 border-2 border-gemini-dark-gray text-gemini-dark-gray font-medium text-lg rounded-full hover:bg-gemini-dark-gray hover:text-white transition"
          >
            View All Results →
          </Link>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="py-20 md:py-32 bg-gray-50 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gemini-dark-gray mb-4">
            Upcoming Events
          </h2>
          <div className="w-24 h-1 bg-gemini-blue mx-auto mb-12"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {upcomingEvents.length === 0 ? (
              <p className="col-span-3 text-gray-600">Loading upcoming events...</p>
            ) : (
              upcomingEvents.slice(0, 6).map((event) => (
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
                    <div className="bg-gray-200 h-64 flex items-center justify-center">
                      <span className="text-gray-500 font-medium">No Image</span>
                    </div>
                  )}
                  <div className="p-8">
                    <h3 className="text-xl font-semibold text-gemini-dark-gray mb-2 line-clamp-2">
                      {event.title.rendered || event.title}
                    </h3>
                    <p className="text-gray-600 mb-4">{formatTribeDate(event.start_date)}</p>
                    <span className="text-gemini-blue font-medium group-hover:underline">
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
            className="inline-block px-12 py-4 bg-gemini-blue text-white font-medium text-lg rounded-full hover:bg-gemini-blue/90 transition"
          >
            Full Event Calendar →
          </a>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 md:py-32 bg-gemini-dark-gray text-white text-center px-6">
        <h2 className="text-4xl md:text-5xl font-bold mb-8">
          Ready to Elevate Your Race?
        </h2>
        <div className="flex flex-col sm:flex-row gap-8 justify-center items-center max-w-3xl mx-auto">
          <Link
            to="/services"
            className="px-12 py-5 bg-white text-gemini-dark-gray font-semibold text-xl rounded-full hover:bg-gray-100 transition"
          >
            Request Timing Services
          </Link>
          <Link
            to="/products"
            className="px-12 py-5 border-2 border-white text-white font-semibold text-xl rounded-full hover:bg-white hover:text-gemini-dark-gray transition"
          >
            Shop Race Gear
          </Link>
        </div>
      </section>
    </div>
  );
}