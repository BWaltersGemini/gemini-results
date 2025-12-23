// src/App.jsx
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
import ResultsKiosk from './pages/ResultsKiosk';
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

// Layout wrapper to hide Navbar & Footer on kiosk routes
function Layout({ children }) {
  const location = useLocation();
  const isKiosk = location.pathname.startsWith('/kiosk');

  return (
    <>
      {!isKiosk && <Navbar />}
      <ScrollToTop />
      <AnalyticsTracker />
      <main className="flex-grow">{children}</main>
      {!isKiosk && <Footer />}
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

                {/* Kiosk Mode - full screen, no navbar/footer */}
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
            </Layout>
          </div>
        </Router>
      </RaceProvider>
    </QueryClientProvider>
  );
}