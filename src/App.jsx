// src/App.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RaceProvider } from './context/RaceContext';
import { DirectorProvider } from './context/DirectorContext';
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
import ResultsKiosk from './pages/ResultsKiosk';

// Director Pages (protected)
import DirectorLogin from './pages/director/DirectorLogin';
import RaceDirectorsHub from './pages/director/RaceDirectorsHub';
import LiveTrackingPage from './pages/director/LiveTrackingPage';
import AwardsPage from './pages/director/AwardsPage';
import AnalyticsPage from './pages/director/AnalyticsPage';

// Public Awards Views (no login required)
import AwardsAnnouncerView from './pages/public/AwardsAnnouncerView';
import AwardsTableView from './pages/public/AwardsTableView';

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

ReactGA.initialize('G-3Y6ME9XWPR');

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

// Layout wrapper to hide Navbar & Footer on kiosk, director, and public awards routes
function Layout({ children }) {
  const location = useLocation();
  const isKiosk = location.pathname.startsWith('/kiosk');
  const isDirectorArea = location.pathname.startsWith('/race-directors-hub');
  const isPublicAwards =
    location.pathname.startsWith('/awards-announcer') ||
    location.pathname.startsWith('/awards-table');

  const hideNavFooter = isKiosk || isDirectorArea || isPublicAwards;

  return (
    <>
      {!hideNavFooter && <Navbar />}
      <ScrollToTop />
      <AnalyticsTracker />
      <main className="flex-grow">{children}</main>
      {!hideNavFooter && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RaceProvider>
        <Router>
          <div className="min-h-screen flex flex-col">
            <Layout>
              <Routes>
                {/* Public Pages */}
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

                {/* Kiosk Mode */}
                <Route path="/kiosk" element={<ResultsKiosk />} />

                {/* Director Login (public) */}
                <Route path="/director-login" element={<DirectorLogin />} />

                {/* === PROTECTED DIRECTOR HUB === */}
                <Route
                  path="/race-directors-hub/*"
                  element={
                    <DirectorProvider>
                      <Routes>
                        <Route index element={<RaceDirectorsHub />} />
                        <Route path="live-tracking" element={<LiveTrackingPage />} />
                        <Route path="awards" element={<AwardsPage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        {/* Add more director sub-routes here in the future */}
                      </Routes>
                    </DirectorProvider>
                  }
                />

                {/* === PUBLIC AWARDS VIEWS (No Login Required) === */}
                <Route path="/awards-announcer/:eventId" element={<AwardsAnnouncerView />} />
                <Route path="/awards-table/:eventId" element={<AwardsTableView />} />
              </Routes>
            </Layout>
          </div>
        </Router>
      </RaceProvider>
    </QueryClientProvider>
  );
}