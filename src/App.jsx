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
import ParticipantPage from './pages/participant/ParticipantPage';
import MasterEvents from './pages/MasterEvents';
import ResultsKiosk from './pages/ResultsKiosk';

// Director Pages
import DirectorLogin from './pages/director/DirectorLogin';
import RaceDirectorsHub from './pages/director/RaceDirectorsHub';
import LiveTrackingPage from './pages/director/LiveTrackingPage'; // Reusable for both contexts
import AwardsPage from './pages/director/AwardsPage';
import AnalyticsPage from './pages/director/AnalyticsPage';

// Public Awards Views
import AwardsAnnouncerView from './pages/public/AwardsAnnouncerView';
import AwardsTableView from './pages/public/AwardsTableView';

import ReactGA from 'react-ga4';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000, // 1 hour
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

// Layout wrapper: hides Navbar & Footer on specific routes
function Layout({ children }) {
  const location = useLocation();

  const isKiosk = location.pathname.startsWith('/kiosk');
  const isDirectorArea = location.pathname.startsWith('/race-directors-hub');
  const isPublicAwards =
    location.pathname.startsWith('/awards-announcer') ||
    location.pathname.startsWith('/awards-table');
  const isLiveTrackingPublic = location.pathname.startsWith('/live-tracking');

  const hideNavFooter = isKiosk || isDirectorArea || isPublicAwards || isLiveTrackingPublic;

  return (
    <>
      {!hideNavFooter && <Navbar />}
      <ScrollToTop />
      <AnalyticsTracker />
      <main className="flex-grow min-h-screen">{children}</main>
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
                {/* === PUBLIC PAGES === */}
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/products" element={<Products />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/master-events" element={<MasterEvents />} />

                {/* === RESULTS PAGES === */}
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/results/:masterKey/:year" element={<ResultsPage />} />
                <Route path="/results/:masterKey/:year/:raceSlug" element={<ResultsPage />} />
                <Route
                  path="/results/:masterKey/:year/:raceSlug/bib/:bib"
                  element={<ParticipantPage />}
                />
                <Route path="/participant" element={<ParticipantPage />} />

                {/* === KIOSK MODE === */}
                <Route path="/kiosk" element={<ResultsKiosk />} />

                {/* === PUBLIC LIVE TRACKING (No Login Required) === */}
                <Route path="/live-tracking" element={<LiveTrackingPage />} />
                <Route path="/live-tracking/:masterKey/:year" element={<LiveTrackingPage />} />

                {/* === DIRECTOR LOGIN (Public Access) === */}
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
                        {/* Add more protected director routes here */}
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