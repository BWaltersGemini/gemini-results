// src/components/Navbar.jsx (Updated: Added Admin Login + Race Directors Hub)
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { RaceContext } from '../context/RaceContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    events = [],
    selectedEvent,
    setSelectedEvent,
    loading = true,
  } = useContext(RaceContext);

  const [searchTerm, setSearchTerm] = useState('');
  const [isListOpen, setIsListOpen] = useState(false);

  useEffect(() => {
    if (selectedEvent) {
      setSearchTerm(selectedEvent.name || '');
    }
  }, [selectedEvent]);

  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  const filtered = searchTerm
    ? sortedEvents.filter((event) =>
        event.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : sortedEvents;

  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    setSearchTerm(event.name || '');
    setIsListOpen(false);
    navigate('/results');
  };

  const handleInputFocus = () => setIsListOpen(true);

  const toggleDropdown = () => setIsListOpen((prev) => !prev);

  const handleToggleOpen = () => {
    if (!isListOpen) {
      setSearchTerm('');
    }
    toggleDropdown();
  };

  const handleResultsClick = (e) => {
    if (location.pathname === '/results') {
      e.preventDefault();
      setSelectedEvent(null);
      setSearchTerm('');
    }
  };

  return (
    <nav className="fixed top-0 w-full bg-white shadow-md z-50">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link to="/">
          <img src="/Gemini-Logo-Black.png" alt="Gemini Timing" className="h-10" />
        </Link>

        {/* Main Navigation */}
        <div className="flex items-center space-x-8">
          <Link
            to="/results"
            onClick={handleResultsClick}
            className="text-gray-700 hover:text-gemini-blue font-medium"
          >
            Results
          </Link>
          <Link to="/contact" className="text-gray-700 hover:text-gemini-blue font-medium">
            Contact
          </Link>

          {/* Admin & Race Director Links (subtle, right-aligned) */}
          <div className="flex items-center space-x-6 border-l border-gray-300 pl-8">
            <Link
              to="/admin"
              className="text-sm text-gray-600 hover:text-gemini-blue font-medium transition"
            >
              Admin Login
            </Link>
            <a
              href="https://youkeepmoving.com/race-directors" // Update with your actual URL
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-gemini-blue font-medium transition"
            >
              Race Directors Hub
            </a>
          </div>
        </div>
      </div>

      {/* Search Bar with Dropdown */}
      <div className="bg-white py-4 shadow-sm border-t">
        <div className="max-w-2xl mx-auto px-6 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsListOpen(true);
            }}
            onFocus={handleInputFocus}
            placeholder="Search Race Results..."
            className="w-full p-3 border border-gray-300 rounded-lg pr-12 focus:outline-none focus:ring-2 focus:ring-gemini-blue focus:border-transparent"
          />
          <button
            onClick={handleToggleOpen}
            className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gemini-blue text-2xl font-light"
            aria-label="Toggle event list"
          >
            {isListOpen ? '▲' : '▼'}
          </button>

          {/* Dropdown List */}
          {isListOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
              {loading ? (
                <div className="p-6 text-center text-gray-600">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gemini-blue"></div>
                  <p className="mt-2">Loading events...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-gray-600">
                  {searchTerm ? 'No events match your search' : 'No events available'}
                </div>
              ) : (
                filtered.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => handleEventSelect(event)}
                    className={`p-4 hover:bg-gemini-light-gray cursor-pointer border-b border-gray-100 last:border-0 transition ${
                      selectedEvent?.id === event.id ? 'bg-gemini-light-gray font-semibold' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{event.name}</span>
                      <span className="text-sm text-gray-500 ml-4">{event.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}