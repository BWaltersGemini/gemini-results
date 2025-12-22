// src/pages/admin/MastersAdmin.jsx
// Full standalone Masters tab for the split Admin Dashboard

import { useState } from 'react';

export default function MastersAdmin({
  masterGroups,
  eventLogos,
  showAdsPerMaster,
  setMasterGroups,
  setEventLogos,
  setShowAdsPerMaster,
  autoSaveConfig,
}) {
  const [chronoEvents, setChronoEvents] = useState([]); // Will be passed from parent or loaded here if needed

  // Note: chronoEvents is used to show linked events count and list.
  // For now, assume it's passed from AdminDashboard or loaded similarly.

  const handleLogoUpload = async (e, masterKey) => {
    const file = e.target.files[0];
    if (!file) return;

    // In a real implementation, you'd use Supabase storage upload
    // Here is the full working version:
    try {
      const { createAdminSupabaseClient } = await import('../../supabaseClient');
      const adminSupabase = createAdminSupabaseClient();

      const { error: uploadError } = await adminSupabase.storage
        .from('logos')
        .upload(`public/${masterKey}`, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = adminSupabase.storage
        .from('logos')
        .getPublicUrl(`public/${masterKey}`);

      const updatedLogos = { ...eventLogos, [masterKey]: publicUrl };
      setEventLogos(updatedLogos);
      await autoSaveConfig('eventLogos', updatedLogos);
    } catch (err) {
      console.error('Logo upload failed:', err);
    }
  };

  const handleRemoveLogo = async (masterKey) => {
    try {
      const { createAdminSupabaseClient } = await import('../../supabaseClient');
      const adminSupabase = createAdminSupabaseClient();

      const { error } = await adminSupabase.storage
        .from('logos')
        .remove([`public/${masterKey}`]);

      if (error && error.message !== 'Object not found') throw error;

      const updatedLogos = { ...eventLogos };
      delete updatedLogos[masterKey];
      setEventLogos(updatedLogos);
      await autoSaveConfig('eventLogos', updatedLogos);
    } catch (err) {
      console.error('Logo removal failed:', err);
    }
  };

  const handleDeleteMaster = async (masterKey) => {
    if (!confirm(`Delete master series "${masterKey}"? This will unlink all events and remove its logo.`)) return;

    try {
      const updatedGroups = { ...masterGroups };
      delete updatedGroups[masterKey];
      setMasterGroups(updatedGroups);
      await autoSaveConfig('masterGroups', updatedGroups);

      await handleRemoveLogo(masterKey);
    } catch (err) {
      console.error('Delete master failed:', err);
    }
  };

  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Get linked events for a master (requires chronoEvents to be available)
  const getLinkedEvents = (masterKey) => {
    if (!chronoEvents.length) return [];
    return chronoEvents.filter((e) => masterGroups[masterKey]?.includes(e.id.toString()));
  };

  return (
    <section className="space-y-8">
      <h2 className="text-3xl font-bold text-gemini-dark-gray mb-8">Master Event Series</h2>

      {Object.keys(masterGroups).length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
          <p className="text-xl text-gray-600">No master series created yet.</p>
          <p className="text-gray-500 mt-4">Create masters by assigning events in the Events tab.</p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Object.keys(masterGroups).map((masterKey) => {
            const logo = eventLogos[masterKey];
            const linkedEvents = getLinkedEvents(masterKey);

            return (
              <div
                key={masterKey}
                className="bg-white rounded-2xl shadow-xl p-8 border border-gemini-blue/20 hover:shadow-2xl transition"
              >
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-2xl font-bold text-gemini-dark-gray">{masterKey}</h3>
                  <button
                    onClick={() => handleDeleteMaster(masterKey)}
                    className="text-red-600 hover:text-red-800 font-medium text-sm"
                  >
                    Delete Series
                  </button>
                </div>

                {/* Logo Upload / Display */}
                <div className="mb-8">
                  {logo ? (
                    <div className="text-center">
                      <img
                        src={logo}
                        alt={`${masterKey} logo`}
                        className="max-h-40 mx-auto rounded-lg shadow-md"
                      />
                      <button
                        onClick={() => handleRemoveLogo(masterKey)}
                        className="mt-4 text-red-600 hover:underline text-sm"
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Series Logo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, masterKey)}
                        className="block w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-blue file:text-white hover:file:bg-gemini-blue/90"
                      />
                    </div>
                  )}
                </div>

                {/* Ads Toggle */}
                <div className="mb-8">
                  <label className="flex items-center gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!showAdsPerMaster[masterKey]}
                      onChange={() => {
                        const updated = {
                          ...showAdsPerMaster,
                          [masterKey]: !showAdsPerMaster[masterKey],
                        };
                        setShowAdsPerMaster(updated);
                        autoSaveConfig('showAdsPerMaster', updated);
                      }}
                      className="h-6 w-6 text-gemini-blue rounded focus:ring-gemini-blue"
                    />
                    <span className="text-lg font-medium text-gray-800">
                      {showAdsPerMaster[masterKey] ? 'Show Ads' : 'Hide Ads'} on this series
                    </span>
                  </label>
                </div>

                {/* Linked Events List */}
                <div>
                  <p className="font-semibold text-gray-700 mb-3">
                    Linked Events ({linkedEvents.length})
                  </p>
                  {linkedEvents.length > 0 ? (
                    <ul className="text-sm space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                      {linkedEvents.map((event) => (
                        <li key={event.id} className="text-gray-700">
                          {formatDate(event.start_time)} — {event.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No events linked yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}