// src/components/Footer.jsx (FINAL — New Red/Turquoise Brand Palette)
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-brand-dark text-white py-12 mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          {/* Company Info */}
          <div>
            <h4 className="text-2xl font-black mb-4 text-white">Gemini Timing</h4>
            <p className="text-gray-300 leading-relaxed">
              Professional race timing and results for events of all sizes.<br />
              Serving Southern California since 2011.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="space-y-4">
            <Link
              to="/contact"
              onClick={() => window.scrollTo(0, 0)}
              className="block text-gray-300 hover:text-accent font-medium transition"
            >
              Contact Us
            </Link>
            <Link
              to="/admin"
              onClick={() => window.scrollTo(0, 0)}
              className="block text-gray-300 hover:text-accent font-medium transition"
            >
              Admin Login
            </Link>
            <Link
              to="/race-directors-hub"
              onClick={() => window.scrollTo(0, 0)}
              className="block text-gray-300 hover:text-accent font-medium transition"
            >
              Race Directors Hub (Coming Soon)
            </Link>
          </div>

          {/* External & Copyright */}
          <div>
            <a
              href="https://youkeepmoving.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xl font-bold text-accent hover:text-accent/80 mb-6 transition"
            >
              Sign up for More Races →
            </a>
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} Gemini Timing. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}