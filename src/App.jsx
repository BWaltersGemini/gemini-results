// src/App.jsx (UPDATED — Nested routes for master/year/race/bib)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RaceProvider } from './context/RaceContext';
import Navbar from './components/Navbar';
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
      staleTime: 60 * 60 * 1000, // Cache for 1 hour by default
      cacheTime: Infinity, // Keep cache indefinitely until invalidated
      retry: 3, // Retry failed fetches
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <RaceProvider>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/products" element={<Products />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/:masterKey/:year" element={<ResultsPage />} />
            <Route path="/results/:masterKey/:year/:raceSlug" element={<ResultsPage />} />
            <Route path="/results/:masterKey/:year/:raceSlug/bib/:bib" element={<ParticipantPage />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/participant" element={<ParticipantPage />} />
            <Route path="/master-events" element={<MasterEvents />} />
          </Routes>
        </RaceProvider>
      </Router>
    </QueryClientProvider>
  );
}