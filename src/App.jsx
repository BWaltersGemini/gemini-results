// src/App.jsx (UPDATED — With ScrollToTop for smooth navigation)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RaceProvider } from './context/RaceContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';  // ← Add this
import Home from './pages/Home';
import Services from './pages/Services';
import Products from './pages/Products';
import ResultsPage from './pages/ResultsPage';
import Contact from './pages/Contact';
import AdminPage from './pages/AdminPage';
import ParticipantPage from './pages/ParticipantPage';
import MasterEvents from './pages/MasterEvents';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000,
      cacheTime: Infinity,
      retry: 3,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RaceProvider>
        <Router>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            
            {/* This ensures scroll to top on every navigation */}
            <ScrollToTop />

            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/products" element={<Products />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/master-events" element={<MasterEvents />} />

                <Route path="/results" element={<ResultsPage />} />
                <Route path="/results/:masterKey/:year" element={<ResultsPage />} />
                <Route path="/results/:masterKey/:year/:raceSlug" element={<ResultsPage />} />

                <Route
                  path="/results/:masterKey/:year/:raceSlug/bib/:bib"
                  element={<ParticipantPage />}
                />

                <Route path="/participant" element={<ParticipantPage />} />

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