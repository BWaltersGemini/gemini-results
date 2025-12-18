// src/components/Footer.jsx
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gemini-dark-gray text-white py-12 mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h4 className="text-xl font-bold mb-4">Gemini Timing</h4>
            <p className="text-gemini-light-gray">
              Professional race timing and results for events of all sizes.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              to="/contact"
              onClick={() => window.scrollTo(0, 0)}
              className="block text-gemini-light-gray hover:text-white"
            >
              Contact Us
            </Link>

            <Link
              to="/admin"
              onClick={() => window.scrollTo(0, 0)}
              className="block text-gemini-light-gray hover:text-white"
            >
              Admin Login
            </Link>

            <Link
              to="/race-directors-hub"
              onClick={() => window.scrollTo(0, 0)}
              className="block text-gemini-light-gray hover:text-white"
            >
              Race Directors Hub (Coming Soon)
            </Link>
          </div>

          <div>
            <a
              href="https://youkeepmoving.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-gemini-light-gray hover:text-white mb-4"
            >
              Sign up for More Races
            </a>
            <p className="text-sm text-gemini-light-gray">
              © {new Date().getFullYear()} Gemini Timing. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}