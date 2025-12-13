// src/pages/Home.jsx (Final: Direct links + Upcoming Events tiles + safe dates)
import { useContext, useState, useEffect } from 'react';
import { RaceContext } from '../context/RaceContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Home() {
  const { events = [], loading, setSelectedEvent } = useContext(RaceContext);
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Safe date formatting (no timezone shift)
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const goToRaceResults = (event) => {
    setSelectedEvent(event);
    navigate('/results');
  };

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-20">
      {/* Hero */}
      <div className="relative h-[80vh] overflow-hidden">
        <video
          src="/eventvideo.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
          style={{ transform: `translateY(${scrollY * 0.5}px)` }}
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative max-w-7xl mx-auto px-6 pt-32 text-center text-white z-10">
          <img src="/Gemini-Logo-White.png" alt="Gemini Timing Logo" className="mx-auto mb-6 h-24 md:h-40" />
          <p className="text-2xl md:text-4xl font-light mb-8">Precision Race Timing & Event Production Since 2011</p>
          <p className="text-3xl md:text-5xl italic mb-12">“Flawless timing. Unforgettable races.”</p>
          <div className="flex flex-wrap justify-center gap-10 text-xl">
            <div>Trusted by 500+ Events</div>
            <div>150,000+ Runners Timed in 2025</div>
            <div>99.9% Accuracy Guarantee</div>
          </div>
        </div>
      </div>

      {/* Recent & Live Results */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-black text-gemini-dark-gray mb-4">
              Recent & Live Race Results
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Click any race to jump straight to its results
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-gemini-blue"></div>
              <p className="mt-6 text-2xl text-gray-700">Loading latest results...</p>
            </div>
          ) : recentEvents.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {recentEvents.map((event, index) => (
                <button
                  key={event.id}
                  onClick={() => goToRaceResults(event)}
                  className="group block w-full text-left bg-gradient-to-br from-gemini-blue to-gemini-dark-gray text-white rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 hover:shadow-3xl transition-all duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="p-10 relative">
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <span className="bg-gemini-red text-white px-5 py-2 rounded-full text-sm font-bold tracking-wider">
                          LIVE RESULTS
                        </span>
                        <span className="text-5xl opacity-30 group-hover:opacity-50 transition">
                          →
                        </span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-black mb-4 leading-tight group-hover:text-gemini-red transition">
                        {event.name}
                      </h3>
                      <p className="text-lg opacity-90 mb-6">
                        {formatDate(event.date)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium opacity-80">
                          Click for full results
                        </span>
                        <div className="bg-white/20 rounded-full p-3 group-hover:bg-white/30 transition">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-2xl text-gray-600">No recent races completed yet.</p>
            </div>
          )}

          <div className="text-center mt-20">
            <Link
              to="/results"
              className="inline-block bg-gemini-red text-white px-20 py-7 rounded-full text-3xl font-black hover:bg-gemini-red/90 shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              VIEW ALL RESULTS →
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming Events with Tiles */}
      <section className="py-20 bg-gemini-light-gray">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-8 text-gemini-dark-gray">Upcoming Events</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            Check out our full calendar of timed races across Southern California
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {upcomingEvents.length === 0 ? (
              <p className="col-span-3 text-gray-600">Loading upcoming events...</p>
            ) : (
              upcomingEvents.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition transform hover:-translate-y-2"
                >
                  {event.image?.url ? (
                    <img
                      src={event.image.url}
                      alt={event.title.rendered || event.title}
                      className="w-full h-56 object-cover"
                    />
                  ) : (
                    <div className="bg-gray-200 h-56 flex items-center justify-center">
                      <span className="text-gray-500 text-lg font-medium">Event Image</span>
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gemini-dark-gray mb-2 line-clamp-2">
                      {event.title.rendered || event.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {formatDate(event.start_date)}
                    </p>
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-gemini-blue text-white px-6 py-3 rounded-full font-bold hover:bg-gemini-blue/90 transition"
                    >
                      Learn More
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>

          <a
            href="https://youkeepmoving.com/events"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-gemini-red text-white px-12 py-5 rounded-full text-2xl font-bold hover:bg-gemini-red/90 transition"
          >
            View Full Event Calendar
          </a>
        </div>
      </section>

      {/* Footer CTA */}
      <div className="bg-gemini-dark-gray text-white py-20 text-center">
        <h2 className="text-5xl font-bold mb-10">Ready to Make Your Race Legendary?</h2>
        <div className="space-x-8">
          <Link to="/services" className="inline-block bg-gemini-blue px-12 py-6 rounded-full text-2xl font-bold hover:bg-gemini-blue/90 transition">
            Get Quote
          </Link>
          <Link to="/products" className="inline-block border-4 border-white px-12 py-6 rounded-full text-2xl font-bold hover:bg-white hover:text-gemini-dark-gray transition">
            Shop Gear
          </Link>
        </div>
        <p className="mt-12 text-xl">Serving Southern California & Beyond</p>
      </div>
    </div>
  );
}