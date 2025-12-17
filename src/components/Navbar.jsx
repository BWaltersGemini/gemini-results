// src/components/Navbar.jsx (FINAL — Master Events dropdown, robust slug matching)
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const masterGroups = JSON.parse(localStorage.getItem('masterGroups')) || {};
  const editedEvents = JSON.parse(localStorage.getItem('editedEvents')) || {};

  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Normalize for lookup
  const normalizeKey = (key) => key.toLowerCase().replace(/ /g, '-');

  useEffect(() => {
    if (selectedEvent) {
      setSearchTerm(selectedEvent.name || '');
    }
  }, [selectedEvent]);

  // Build master event list with robust matching
  const masterEventList = Object.keys(masterGroups).map(storedKey => {
    const displayName = editedEvents[storedKey]?.name || storedKey;
    const eventIds = masterGroups[storedKey];
    const masterEvents = events.filter(e => eventIds.includes(e.id));

    if (masterEvents.length === 0) return null;

    const latestEvent = masterEvents.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const masterSlug = slugify(storedKey); // Use stored key for consistent slug
    const year = latestEvent.date.split('-')[0];

    return {
      storedKey,
      displayName,
      masterSlug,
      year,
      latestEvent,
    };
  }).filter(Boolean);

  const filteredMasters = searchTerm
    ? masterEventList.filter(m => 
        m.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : masterEventList;

  const handleMasterSelect = (master) => {
    const event = master.latestEvent;
    setSelectedEvent(event);
    navigate(`/results/${master.masterSlug}/${master.year}`);
    setSearchTerm(master.displayName);
    setIsListOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleInputFocus = () => setIsListOpen(true);
  const toggleDropdown = () => setIsListOpen(prev => !prev);
  const handleToggleOpen = () => {
    if (!isListOpen) setSearchTerm('');
    toggleDropdown();
  };

  const handleResultsClick = (e) => {
    if (location.pathname.startsWith('/results')) {
      e.preventDefault();
      setSelectedEvent(null);
      setSearchTerm('');
      navigate('/results');
    }
  };

  const closeAll = () => {
    setIsListOpen(false);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 w-full bg-white shadow-md z-50">
      <div className="px-4 py-3 flex items-center justify-between">
        <Link to="/" onClick={closeAll}>
          <img src="/Gemini-Logo-Black.png" alt="Gemini Timing" className="h-9" />
        </Link>

        <div className="hidden md:flex items-center space-x-8">
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
          <div className="flex items-center space-x-6 border-l border-gray-300 pl-8">
            <Link to="/admin" className="text-sm text-gray-600 hover:text-gemini-blue font-medium">
              Admin Login
            </Link>
            <a
              href="https://youkeepmoving.com/race-directors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-gemini-blue font-medium"
            >
              Race Directors Hub
            </a>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-3xl text-gray-700 focus:outline-none"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className="bg-white py-3 border-t border-gray-200">
        <div className="px-4 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsListOpen(true);
            }}
            onFocus={handleInputFocus}
            placeholder="Search Race Results..."
            className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
          />
          <button
            onClick={handleToggleOpen}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gemini-blue text-2xl"
          >
            {isListOpen ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {isListOpen && (
        <div className="absolute left-0 right-0 top-full bg-white border-t border-gray-200 shadow-xl max-h-96 overflow-y-auto z-40">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gemini-blue"></div>
              <p className="mt-4 text-gray-600">Loading events...</p>
            </div>
          ) : filteredMasters.length === 0 ? (
            <p className="p-8 text-center text-gray-600">
              {searchTerm ? 'No master events match your search' : 'No master events available'}
            </p>
          ) : (
            filteredMasters.map(master => (
              <div
                key={master.storedKey}
                onClick={() => handleMasterSelect(master)}
                className={`p-4 cursor-pointer border-b border-gray-100 last:border-0 transition hover:bg-gemini-light-gray
                  ${selectedEvent && masterGroups[master.storedKey]?.includes(selectedEvent.id)
                    ? 'bg-gemini-blue/10 font-bold text-gemini-blue border-l-4 border-gemini-blue'
                    : 'text-gray-900'
                  }`}
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <span className="font-medium text-base md:text-lg truncate">
                    {master.displayName}
                  </span>
                  <span className="text-sm text-gray-500 mt-1 md:mt-0 md:ml-4">
                    Latest: {master.year}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-40 md:hidden overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold">Menu</h3>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-3xl text-gray-700">✕</button>
              </div>
              <div className="space-y-6">
                <Link
                  to="/results"
                  onClick={(e) => {
                    handleResultsClick(e);
                    setIsMobileMenuOpen(false);
                  }}
                  className="block text-lg font-medium text-gray-700 hover:text-gemini-blue"
                >
                  {selectedEvent ? '← All Results' : 'Results'}
                </Link>
                <Link to="/contact" onClick={() => setIsMobileMenuOpen(false)} className="block text-lg font-medium text-gray-700 hover:text-gemini-blue">
                  Contact
                </Link>
                <div className="pt-6 border-t border-gray-300">
                  <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="block text-base text-gray-600 hover:text-gemini-blue py-2">
                    Admin Login
                  </Link>
                  <a href="https://youkeepmoving.com/race-directors" target="_blank" rel="noopener noreferrer"
                    className="block text-base text-gray-600 hover:text-gemini-blue py-2">
                    Race Directors Hub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}