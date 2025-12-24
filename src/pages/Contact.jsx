// src/pages/Contact.jsx
// FULLY RESTYLED — December 2025 Rebrand Compliant
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { RaceContext } from '../context/RaceContext';

export default function Contact() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedEvent } = useContext(RaceContext);

  const initialData = location.state || {};
  const [inquiryType, setInquiryType] = useState(initialData.inquiryType || 'general');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    bib: initialData.bib || '',
    participantName: initialData.participantName || '',
    eventName: initialData.eventName || selectedEvent?.name || '',
    raceName: '',
    expectedParticipants: '',
    eventDate: '',
    raceUrl: '',
    bibQuantity: '',
    medalQuantity: '',
    shirtQuantity: '',
    honeypot: '',
  });

  const [files, setFiles] = useState({
    bibs: [],
    medals: [],
    shirts: [],
  });

  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    if (type === 'results') {
      setInquiryType('results');
      setFormData(prev => ({
        ...prev,
        eventName: params.get('event') || prev.eventName,
        bib: params.get('bib') || prev.bib,
        participantName: params.get('name') || prev.participantName,
      }));
    }
  }, [location]);

  const handleFileChange = (category, e) => {
    const selectedFiles = Array.from(e.target.files);
    const promises = selectedFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target.result.split(',')[1];
          resolve({ filename: file.name, content: base64 });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(newFiles => {
      setFiles(prev => ({
        ...prev,
        [category]: [...prev[category], ...newFiles]
      }));
    });
  };

  const removeFile = (category, index) => {
    setFiles(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.honeypot) return;

    setStatus('sending');
    setErrorMsg('');

    const allAttachments = [
      ...files.bibs.map(f => ({ ...f, filename: `bib_${f.filename}` })),
      ...files.medals.map(f => ({ ...f, filename: `medal_${f.filename}` })),
      ...files.shirts.map(f => ({ ...f, filename: `shirt_${f.filename}` }))
    ];

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Contact Form <onboarding@resend.dev>',
          to: ['info@youkeepmoving.com'],
          reply_to: formData.email,
          subject: `[YKM Inquiry] ${inquiryType === 'results' ? 'Results Question' : inquiryType.charAt(0).toUpperCase() + inquiryType.slice(1)} - ${formData.name}`,
          text: `
Name: ${formData.name}
Email: ${formData.email}
Inquiry Type: ${inquiryType}

${inquiryType === 'results' ? `
Event: ${formData.eventName}
Bib: ${formData.bib}
Participant Name: ${formData.participantName}
` : ''}

${inquiryType === 'apparel' ? `
Bib Quantity: ${formData.bibQuantity || '0'}
Medal Quantity: ${formData.medalQuantity || '0'}
Shirt Quantity: ${formData.shirtQuantity || '0'}
` : ''}

${['timing', 'marketing', 'registration'].includes(inquiryType) ? `
Race Name: ${formData.raceName}
Expected Participants: ${formData.expectedParticipants}
Event Date: ${formData.eventDate}
Race Website/URL: ${formData.raceUrl}
` : ''}

Message:
${formData.message}

${allAttachments.length > 0 ? `Attachments: ${allAttachments.map(f => f.filename).join(', ')}` : 'No attachments'}
          `.trim(),
          attachments: allAttachments.length > 0 ? allAttachments : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to send');
      }

      setStatus('success');
      setTimeout(() => navigate('/'), 5000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen bg-brand-light py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-black text-brand-dark text-center mb-12">
          Contact Us
        </h1>

        <div className="bg-white rounded-3xl shadow-2xl p-10 md:p-16 border border-primary/20">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Honeypot */}
            <input type="text" name="honeypot" value={formData.honeypot} onChange={handleChange} className="hidden" />

            {/* Name & Email */}
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xl font-bold text-brand-dark mb-3">Your Name *</label>
                <input
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full focus:outline-none focus:border-primary transition"
                />
              </div>
              <div>
                <label className="block text-xl font-bold text-brand-dark mb-3">Email *</label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full focus:outline-none focus:border-primary transition"
                />
              </div>
            </div>

            {/* Inquiry Type */}
            <div>
              <label className="block text-xl font-bold text-brand-dark mb-3">What can we help you with? *</label>
              <select
                required
                value={inquiryType}
                onChange={(e) => setInquiryType(e.target.value)}
                className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full focus:outline-none focus:border-primary transition bg-white"
              >
                <option value="general">General Question</option>
                <option value="results">Question About My Results</option>
                <option value="timing">Race Timing Services</option>
                <option value="marketing">Marketing / Promotion</option>
                <option value="registration">Registration Services</option>
                <option value="apparel">Custom Bibs / Medals / Shirts</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Results Question */}
            {inquiryType === 'results' && (
              <div className="p-8 bg-primary/5 rounded-3xl border border-primary/20">
                <h3 className="text-2xl font-bold text-brand-dark mb-6">Results Inquiry Details</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Event Name</label>
                    <input
                      name="eventName"
                      value={formData.eventName}
                      onChange={handleChange}
                      className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-lg font-bold text-brand-dark mb-3">Bib Number</label>
                      <input
                        name="bib"
                        value={formData.bib}
                        onChange={handleChange}
                        className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full"
                      />
                    </div>
                    <div>
                      <label className="block text-lg font-bold text-brand-dark mb-3">Your Name (as registered)</label>
                      <input
                        name="participantName"
                        value={formData.participantName}
                        onChange={handleChange}
                        className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Services Inquiries */}
            {['timing', 'marketing', 'registration'].includes(inquiryType) && (
              <div className="p-8 bg-primary/5 rounded-3xl border border-primary/20">
                <h3 className="text-2xl font-bold text-brand-dark mb-6">Event Details</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Race / Event Name</label>
                    <input
                      name="raceName"
                      value={formData.raceName}
                      onChange={handleChange}
                      className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Race Website / Registration URL</label>
                    <input
                      type="url"
                      name="raceUrl"
                      value={formData.raceUrl}
                      onChange={handleChange}
                      placeholder="https://..."
                      className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-lg font-bold text-brand-dark mb-3">Expected Participants</label>
                      <input
                        type="number"
                        min="0"
                        name="expectedParticipants"
                        value={formData.expectedParticipants}
                        onChange={handleChange}
                        className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full"
                      />
                    </div>
                    <div>
                      <label className="block text-lg font-bold text-brand-dark mb-3">Event Date (approx)</label>
                      <input
                        type="date"
                        name="eventDate"
                        value={formData.eventDate}
                        onChange={handleChange}
                        className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Apparel */}
            {inquiryType === 'apparel' && (
              <div className="p-8 bg-primary/5 rounded-3xl border border-primary/20">
                <h3 className="text-2xl font-bold text-brand-dark mb-6">Custom Item Order</h3>

                <div className="grid md:grid-cols-3 gap-8 mb-10">
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Custom Bibs</label>
                    <input
                      type="number"
                      min="0"
                      name="bibQuantity"
                      value={formData.bibQuantity}
                      onChange={handleChange}
                      placeholder="0"
                      className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Finisher Medals</label>
                    <input
                      type="number"
                      min="0"
                      name="medalQuantity"
                      value={formData.medalQuantity}
                      onChange={handleChange}
                      placeholder="0"
                      className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Event Shirts</label>
                    <input
                      type="number"
                      min="0"
                      name="shirtQuantity"
                      value={formData.shirtQuantity}
                      onChange={handleChange}
                      placeholder="0"
                      className="w-full px-8 py-5 text-lg border-2 border-gray-200 rounded-full text-center"
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Bibs Artwork (PDF, AI, PNG, etc.)</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileChange('bibs', e)}
                      className="block w-full text-sm text-brand-dark file:mr-6 file:py-4 file:px-8 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-accent file:text-brand-dark hover:file:bg-accent/90 transition"
                    />
                    {files.bibs.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {files.bibs.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-100 p-4 rounded-xl">
                            <span className="text-sm truncate">{file.filename}</span>
                            <button type="button" onClick={() => removeFile('bibs', i)} className="text-primary hover:underline text-sm font-bold">Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Medals Artwork</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileChange('medals', e)}
                      className="block w-full text-sm text-brand-dark file:mr-6 file:py-4 file:px-8 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-accent file:text-brand-dark hover:file:bg-accent/90 transition"
                    />
                    {files.medals.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {files.medals.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-100 p-4 rounded-xl">
                            <span className="text-sm truncate">{file.filename}</span>
                            <button type="button" onClick={() => removeFile('medals', i)} className="text-primary hover:underline text-sm font-bold">Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-3">Shirts Artwork</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileChange('shirts', e)}
                      className="block w-full text-sm text-brand-dark file:mr-6 file:py-4 file:px-8 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-accent file:text-brand-dark hover:file:bg-accent/90 transition"
                    />
                    {files.shirts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {files.shirts.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-100 p-4 rounded-xl">
                            <span className="text-sm truncate">{file.filename}</span>
                            <button type="button" onClick={() => removeFile('shirts', i)} className="text-primary hover:underline text-sm font-bold">Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-center text-brand-dark italic mt-8 text-lg">
                  Don’t have artwork ready? No problem — we offer professional graphic design services. Just describe your vision!
                </p>
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-xl font-bold text-brand-dark mb-3">Your Message *</label>
              <textarea
                required
                name="message"
                rows={8}
                value={formData.message}
                onChange={handleChange}
                className="w-full px-8 py-6 text-lg border-2 border-gray-200 rounded-3xl focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Submit */}
            <div className="text-center pt-6">
              <button
                type="submit"
                disabled={status === 'sending'}
                className="px-20 py-7 bg-primary text-white text-3xl font-black rounded-full hover:bg-primary/90 shadow-2xl transition disabled:opacity-70 transform hover:scale-105"
              >
                {status === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
            </div>

            {/* Status */}
            {status === 'success' && (
              <div className="text-center text-3xl font-bold text-green-600 animate-pulse">
                Thank you! Your message has been sent. We'll reply soon.
              </div>
            )}
            {status === 'error' && (
              <div className="text-center text-3xl font-bold text-primary">
                Error: {errorMsg}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}