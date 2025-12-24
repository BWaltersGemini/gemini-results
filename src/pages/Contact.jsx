// src/pages/Contact.jsx
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
    bibQuantity: '',
    medalQuantity: '',
    shirtQuantity: '',
    honeypot: '', // anti-spam
  });

  const [files, setFiles] = useState([]); // { name, base64 }
  const [status, setStatus] = useState(''); // '', 'sending', 'success', 'error'
  const [errorMsg, setErrorMsg] = useState('');

  // Parse URL params for deep links (e.g., ?type=results&bib=123)
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

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const promises = selectedFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target.result.split(',')[1]; // remove data:url prefix
          resolve({ filename: file.name, content: base64 });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(newFiles => {
      setFiles(prev => [...prev, ...newFiles]);
    });
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.honeypot) return; // bot

    setStatus('sending');
    setErrorMsg('');

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Contact Form <onboarding@resend.dev>', // Change to your verified domain email
          to: ['info@youkeepmoving.com'], // Your receiving email
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
Bib Quantity: ${formData.bibQuantity}
Medal Quantity: ${formData.medalQuantity}
Shirt Quantity: ${formData.shirtQuantity}
` : ''}

${inquiryType === 'services' ? `
Race Name: ${formData.raceName}
Expected Participants: ${formData.expectedParticipants}
Event Date: ${formData.eventDate}
` : ''}

Message:
${formData.message}

${files.length > 0 ? `Attachments: ${files.map(f => f.filename).join(', ')}` : ''}
          `.trim(),
          attachments: files,
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
    <div className="min-h-screen bg-gray-50 py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-center text-gemini-dark-gray mb-12">
          Contact Us
        </h1>

        <div className="bg-white rounded-3xl shadow-2xl p-10 md:p-16">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Honeypot */}
            <input type="text" name="honeypot" value={formData.honeypot} onChange={handleChange} className="hidden" />

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label className="block text-lg font-semibold text-gemini-dark-gray mb-2">Your Name *</label>
                <input required name="name" value={formData.name} onChange={handleChange}
                  className="w-full px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:border-gemini-blue" />
              </div>
              <div>
                <label className="block text-lg font-semibold text-gemini-dark-gray mb-2">Email *</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange}
                  className="w-full px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:border-gemini-blue" />
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gemini-dark-gray mb-2">Inquiry Type *</label>
              <select required value={inquiryType} onChange={(e) => setInquiryType(e.target.value)}
                className="w-full px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:border-gemini-blue">
                <option value="general">General Question</option>
                <option value="results">Question About My Results</option>
                <option value="timing">Race Timing Services</option>
                <option value="marketing">Marketing / Promotion</option>
                <option value="registration">Registration Services</option>
                <option value="apparel">Custom Bibs / Medals / Shirts</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Conditional: Results Question */}
            {inquiryType === 'results' && (
              <div className="space-y-6 p-6 bg-gemini-blue/5 rounded-2xl">
                <div>
                  <label className="block text-lg font-semibold mb-2">Event Name</label>
                  <input name="eventName" value={formData.eventName} onChange={handleChange}
                    className="w-full px-6 py-4 border border-gray-300 rounded-xl" />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-lg font-semibold mb-2">Bib Number</label>
                    <input name="bib" value={formData.bib} onChange={handleChange}
                      className="w-full px-6 py-4 border border-gray-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-lg font-semibold mb-2">Your Name (as registered)</label>
                    <input name="participantName" value={formData.participantName} onChange={handleChange}
                      className="w-full px-6 py-4 border border-gray-300 rounded-xl" />
                  </div>
                </div>
              </div>
            )}

            {/* Conditional: Apparel */}
            {inquiryType === 'apparel' && (
              <div className="space-y-6 p-6 bg-gemini-blue/5 rounded-2xl">
                <h3 className="text-2xl font-bold">Quantities</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-lg font-semibold mb-2">Custom Bibs</label>
                    <input type="number" min="0" name="bibQuantity" value={formData.bibQuantity} onChange={handleChange}
                      className="w-full px-6 py-4 border border-gray-300 rounded-xl" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-lg font-semibold mb-2">Finisher Medals</label>
                    <input type="number" min="0" name="medalQuantity" value={formData.medalQuantity} onChange={handleChange}
                      className="w-full px-6 py-4 border border-gray-300 rounded-xl" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-lg font-semibold mb-2">Event Shirts</label>
                    <input type="number" min="0" name="shirtQuantity" value={formData.shirtQuantity} onChange={handleChange}
                      className="w-full px-6 py-4 border border-gray-300 rounded-xl" placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-semibold mb-2">Upload Artwork (PDF, AI, PNG, etc.)</label>
                  <input type="file" multiple onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-blue file:text-white hover:file:bg-gemini-blue/90" />
                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((file, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-100 p-3 rounded-lg">
                          <span className="truncate">{file.filename}</span>
                          <button type="button" onClick={() => removeFile(i)} className="text-red-600 hover:underline">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conditional: Services */}
            {(inquiryType === 'timing' || inquiryType === 'marketing' || inquiryType === 'registration') && (
              <div className="space-y-6 p-6 bg-gemini-blue/5 rounded-2xl">
                <div>
                  <label className="block text-lg font-semibold mb-2">Race / Event Name</label>
                  <input name="raceName" value={formData.raceName} onChange={handleChange}
                    className="w-full px-6 py-4 border border-gray-300 rounded-xl" />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-lg font-semibold mb-2">Expected Participants</label>
                    <input type="number" min="0" name="expectedParticipants" value={formData.expectedParticipants} onChange={handleChange}
                      className="w-full px-6 py-4 border border-gray-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-lg font-semibold mb-2">Event Date (approx)</label>
                    <input type="date" name="eventDate" value={formData.eventDate} onChange={handleChange}
                      className="w-full px-6 py-4 border border-gray-300 rounded-xl" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-lg font-semibold text-gemini-dark-gray mb-2">Message *</label>
              <textarea required name="message" rows={8} value={formData.message} onChange={handleChange}
                className="w-full px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:border-gemini-blue resize-none" />
            </div>

            <div className="text-center">
              <button type="submit" disabled={status === 'sending'}
                className="px-16 py-6 bg-gemini-blue text-white text-2xl font-bold rounded-full hover:bg-gemini-blue/90 shadow-2xl transition disabled:opacity-70">
                {status === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
            </div>

            {status === 'success' && (
              <div className="text-center text-2xl font-bold text-green-600">
                Thank you! Your message has been sent. We'll get back to you soon.
              </div>
            )}
            {status === 'error' && (
              <div className="text-center text-2xl font-bold text-red-600">
                Error: {errorMsg}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}