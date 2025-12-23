// src/App.jsx (UPDATED — With GA4 tracking + ScrollToTop + Kiosk Mode routes)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RaceProvider } from './context/RaceContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Services from './pages/Services';
import Products from './pages/Products';
import ResultsPage from './pages/ResultsPage';
import Contact from './pages/Contact';
import AdminDashboard from './pages/admin/AdminDashboard';
import ParticipantPage from './pages/ParticipantPage';
import MasterEvents from './pages/MasterEvents';
import ResultsKiosk from './pages/ResultsKiosk'; // ← NEW: Kiosk Mode

// Import react-ga4 for Google Analytics 4
import ReactGA from 'react-ga4';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000,
      cacheTime: Infinity,
      retry: 3,
    },
  },
});

// Initialize GA4 once (replace with your actual Measurement ID if different)
ReactGA.initialize('G-3Y6ME9XWPR');

// Component to track page views on route changes
function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    ReactGA.send({
      hitType: 'pageview',
      page: location.pathname + location.search,
      title: document.title,
    });
  }, [location]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RaceProvider>
        <Router>
          <div className="min-h-screen flex flex-col">
            <Navbar />

            {/* Ensures scroll to top on navigation */}
            <ScrollToTop />

            {/* Tracks page views on every route change */}
            <AnalyticsTracker />

            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/products" element={<Products />} />
                <Route path="/contact" element={<Contact />} />

                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/master-events" element={<MasterEvents />} />

                {/* Standard Results Pages */}
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/results/:masterKey/:year" element={<ResultsPage />} />
                <Route path="/results/:masterKey/:year/:raceSlug" element={<ResultsPage />} />
                <Route
                  path="/results/:masterKey/:year/:raceSlug/bib/:bib"
                  element={<ParticipantPage />}
                />
                <Route path="/participant" element={<ParticipantPage />} />

                {/* Kiosk Mode — Event-Specific */}
                <Route path="/kiosk/:masterKey/:year" element={<ResultsKiosk />} />
                <Route path="/kiosk/:masterKey/:year/bib/:bib" element={<ResultsKiosk />} />

                {/* Optional: Generic kiosk fallback (shows error if no event matched) */}
                <Route path="/kiosk" element={<ResultsKiosk />} />

                <Route
                  path="/race-directors-hub"
                  element={
                    <div className="py-32 text-center">
                      <h1 className="text-4xl font-bold text-gemini-dark-gray mb-4">
                        Race Directors Hub
                      </h1>
                      <p className="text-xl text-gray-600">Coming Soon!</p>
                    </div>
                  }
                />
              </Routes>
            </main>

            <Footer />
          </div>
        </Router>
      </RaceProvider>
    </QueryClientProvider>
  );
}