// src/components/ManageWebsite.jsx (new component for Manage Website section)
import { useState } from 'react';

export default function ManageWebsite({ adsByType, setAdsByType, apiFrequencies, setApiFrequencies, quoteRequests, handleFileUpload, handleRemoveAd, handleFrequencyChange, handleSaveChanges }) {
  return (
    <section className="mb-12 bg-white rounded-2xl p-8 shadow-lg">
      <h2 className="text-4xl font-bold mb-8 text-center">Manage Website</h2>
      {/* Add Ads by Type */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Add Ads (Multiple per Type)</h3>
        {['running', 'multisport', 'brand'].map(type => (
          <div key={type} className="mb-4">
            <label className="block mb-2 capitalize">{type} Ad:</label>
            <input type="file" onChange={(e) => handleFileUpload(e, 'ad')} data-ad-type={type} accept="image/*" />
            <div className="flex flex-wrap gap-4 mt-2">
              {(adsByType[type] || []).map((ad, index) => (
                <div key={index} className="relative">
                  <img src={ad} alt={`${type} Ad ${index}`} className="w-32 h-auto" />
                  <button onClick={() => handleRemoveAd(type, index)} className="absolute top-0 right-0 bg-red-500 text-white px-2 py-1 rounded">X</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* API Frequencies */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">API Call Frequencies (minutes)</h3>
        <div className="flex gap-4">
          <div>
            <label>RunSignup:</label>
            <input
              type="number"
              value={apiFrequencies.runsignup}
              onChange={(e) => handleFrequencyChange('runsignup', e.target.value)}
              className="ml-2 p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label>YouKeepMoving:</label>
            <input
              type="number"
              value={apiFrequencies.youkeepmoving}
              onChange={(e) => handleFrequencyChange('youkeepmoving', e.target.value)}
              className="ml-2 p-2 border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>
      {/* Quote Requests Log */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Quote Requests Log</h3>
        {quoteRequests.length > 0 ? (
          <ul className="list-disc pl-6">
            {quoteRequests.map((req, index) => (
              <li key={index} className="mb-2">
                <pre>{JSON.stringify(req, null, 2)}</pre>
              </li>
            ))}
          </ul>
        ) : (
          <p>No quote requests submitted yet.</p>
        )}
      </div>
      <button onClick={handleSaveChanges} className="mt-4 bg-gemini-blue text-white px-6 py-3 rounded-xl hover:bg-gemini-blue/90">
        Save Changes
      </button>
    </section>
  );
}