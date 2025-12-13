// src/components/Navbar.jsx (MOBILE-OPTIMIZED: Touch-friendly search dropdown + responsive layout)

import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useContext, useState, useEffect, useRef } from 'react';
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
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (selectedEvent) {
      setSearchTerm(selectedEvent.name || '');
    } else {
      setSearchTerm('');
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

  const handleInputFocus = () => {
    setIsListOpen(true);
  };

  const toggleDropdown = () => {
    setIsListOpen((prev) => !prev);
    if (!isListOpen) {
      setSearchTerm('');
      inputRef.current?.focus();
    }
  };

  const handleResultsClick = (e) => {
    if (location.pathname === '/results') {
      e.preventDefault();
      setSelectedEvent(null);
      setSearchTerm('');
      setIsListOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 w-full bg-white shadow-md z-50">
      {/* Top Bar */}
      <div className="px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex-shrink-0">
          <img src="/Gemini-Logo-Black.png" alt="Gemini Timing" className="h-9" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <Link
            to="/results"
            onClick={handleResultsClick}
            className="text-gray-700 hover:text-gemini-blue font-medium transition"
          >
            Results
          </Link>
          <Link to="/contact" className="text-gray-700 hover:text-gemini-blue font-medium transition">
            Contact
          </Link>
          <div className="flex items-center space-x-6 border-l border-gray-300 pl-8">
            <Link to="/admin" className="text-sm text-gray-600 hover:text-gemini-blue transition">
              Admin Login
            </Link>
            <a
              href="https://youkeepmoving.com/race-directors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-gemini-blue transition"
            >
              Race Directors Hub
            </a>
          </div>
        </div>

        {/* Mobile Hamburger - Optional (you can add a menu later) */}
        <div className="md:hidden">
          {/* Placeholder for future mobile menu button */}
        </div>
      </div>

      {/* Search Bar - Full width on mobile */}
      <div className="bg-white py-3 border-t border-gray-200">
        <div className="px-4 relative" ref={dropdownRef}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsListOpen(true);
              }}
              onFocus={handleInputFocus}
              placeholder="Search Race Results..."
              className="w-full px-4 py-4 pr-14 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-gemini-blue/30 focus:border-gemini-blue transition"
            />
            <button
              onClick={toggleDropdown}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gemini-blue text-3xl font-light"
              aria-label="Toggle search dropdown"
            >
              {isListOpen ? '▲' : '▼'}
            </button>
          </div>

          {/* Dropdown List - Mobile Optimized */}
          {isListOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-4 border-gemini-blue"></div>
                  <p className="mt-4 text-gray-600">Loading events...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  <p className="text-lg">
                    {searchTerm ? 'No races match your search' : 'No races available'}
                  </p>
                </div>
              ) : (
                <div>
                  {filtered.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      className={`px-6 py-5 border-b border-gray-100 last:border-0 cursor-pointer transition ${
                        selectedEvent?.id === event.id
                          ? 'bg-gemini-blue/10 font-semibold'
                          : 'hover:bg-gemini-light-gray'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-lg font-medium text-gemini-dark-gray">{event.name}</span>
                        <span className="text-sm text-gray-500 mt-1">{event.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}