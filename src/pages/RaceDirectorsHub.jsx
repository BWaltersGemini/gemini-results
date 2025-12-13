// src/pages/RaceDirectorsHub.jsx
import { Link } from 'react-router-dom';

export default function RaceDirectorsHub() {
  return (
    <div className="min-h-screen bg-gemini-light-gray pt-40 py-16">
      <div className="max-w-6xl mx-auto px-6">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gemini-dark-gray mb-4">Race Directors Hub</h1>
          <p className="text-xl text-gray-600">Your all-in-one resource for flawless events. Get quotes, tools, and more.</p>
        </div>

        {/* Quick Quote Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-3xl font-bold mb-6 text-center text-gemini-blue">Get a Custom Quote</h2>
          {/* Add form here – use React Hook Form or similar */}
          <form>
            <input type="text" placeholder="Your Name" className="w-full p-3 mb-4 border rounded" />
            <input type="email" placeholder="Email" className="w-full p-3 mb-4 border rounded" />
            <select className="w-full p-3 mb-4 border rounded">
              <option>Service: Timing</option>
              <option>Shirts</option>
              <option>Medals</option>
              <option>Printing</option>
            </select>
            <button type="submit" className="bg-gemini-blue text-white px-6 py-3 rounded-full w-full">Submit Quote Request</button>
          </form>
        </div>

        {/* Services Grid */}
        <h2 className="text-4xl font-bold text-center mb-8 text-gemini-dark-gray">Our Services</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {['Chip Timing & Live Results', 'Custom Race Shirts', 'Finisher Medals', 'Printed Materials & Signage'].map((service) => (
            <div key={service} className="bg-white p-6 rounded-xl shadow-md text-center">
              <h3 className="text-xl font-bold text-gemini-red mb-2">{service}</h3>
              <p className="text-gray-600 mb-4">High-quality, customizable options for your event.</p>
              <Link to="/services" className="text-gemini-blue font-semibold">Get Quote</Link>
            </div>
          ))}
        </div>

        {/* Resources Section */}
        <h2 className="text-4xl font-bold text-center mb-8 text-gemini-dark-gray">Free Tools & Resources</h2>
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gemini-light-gray p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-2">Race Planning Checklist</h3>
            <p>Download our free PDF guide.</p>
            <a href="/downloads/checklist.pdf" className="text-gemini-blue">Download</a>
          </div>
          {/* Add more resources */}
        </div>

        {/* CTA to YouKeepMoving */}
        <div className="text-center bg-gemini-blue text-white p-8 rounded-2xl">
          <h2 className="text-3xl font-bold mb-4">Promote Your Event</h2>
          <p className="mb-6">Once set up with Gemini, list your race on YouKeepMoving.com for maximum exposure.</p>
          <a href="https://youkeepmoving.com/?utm_source=geminitiming" className="bg-white text-gemini-blue px-8 py-4 rounded-full font-bold">List Your Event Now</a>
        </div>
      </div>
    </div>
  );
}