// src/pages/Home.jsx (Updated – Fixed invalid date for upcoming events)
import { useContext, useState, useEffect } from 'react';
import { RaceContext } from '../context/RaceContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Home() {
  const { events = [], loading, setSelectedEvent } = useContext(RaceContext);
  const navigate = useNavigate();

  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Fetch upcoming events from You Keep Moving
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

  // Sort ChronoTrack events: most recent first
  const sortedEvents = [...events].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentEvents = sortedEvents.filter(e => new Date(e.date) <= new Date()).slice(0, 6);

  // Safe date formatting for ChronoTrack events (YYYY-MM-DD)
  const formatChronoDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Safe date formatting for Tribe Events API (ISO with timezone)
  const formatTribeDate = (isoStr) => {
    if (!isoStr) return 'Date TBD';
    try {
      // Remove Z or offset and parse
      const cleaned = isoStr.replace('Z', '').replace(/([+-]\d{2}:\d{2})$/, '');
      const date = new Date(cleaned);
      if (isNaN(date.getTime())) return 'Date TBD';
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return 'Date TBD';
    }
  };

  const goToRaceResults = (event) => {
    setSelectedEvent(event);
    navigate('/results');
  };

  return (
    <div className="min-h-screen bg-white">

      {/* Hero – Full-screen video background */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <video
          src="/eventvideo.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
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
            <Link
              to="/results"
              className="px-10 py-4 bg-white text-gemini-dark-gray font-medium text-lg rounded-full hover:bg-gray-100 transition"
            >
              View Results
            </Link>
            <Link
              to="/services"
              className="px-10 py-4 border-2 border-white text-white font-medium text-lg rounded-full hover:bg-white/10 transition"
            >
              Get a Quote
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Results */}
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
        ) : recentEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => goToRaceResults(event)}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-gemini-blue transition-all duration-300 text-left"
              >
                <div className="p-8">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gemini-blue">
                      Live Results
                    </span>
                    <span className="text-2xl text-gray-300 group-hover:text-gemini-blue transition">
                      →
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gemini-dark-gray mb-2 line-clamp-2">
                    {event.name}
                  </h3>
                  <p className="text-gray-600 mb-6">{formatChronoDate(event.date)}</p>
                  <div className="flex items-center text-gemini-blue font-medium">
                    View Results
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-600 text-lg">No recent races available.</p>
        )}

        <div className="text-center mt-16">
          <Link
            to="/results"
            className="inline-block px-12 py-4 border-2 border-gemini-dark-gray text-gemini-dark-gray font-medium text-lg rounded-full hover:bg-gemini-dark-gray hover:text-white transition"
          >
            All Results →
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