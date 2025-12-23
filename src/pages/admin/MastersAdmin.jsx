// src/pages/admin/MastersAdmin.jsx (FINAL — New Red/Turquoise Brand Palette)
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { createAdminSupabaseClient } from '../../supabaseClient';

export default function MastersAdmin({
  masterGroups,
  eventLogos,
  showAdsPerMaster,
  setMasterGroups,
  setEventLogos,
  setShowAdsPerMaster,
  autoSaveConfig,
}) {
  const [chronoEvents, setChronoEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const adminSupabase = createAdminSupabaseClient();

  // Load all events to display linked ones
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('chronotrack_events')
          .select('id, name, start_time')
          .order('start_time', { ascending: false });
        if (error) throw error;
        setChronoEvents(data || []);
      } catch (err) {
        console.error('Failed to load events for Masters tab:', err);
      }
    };
    loadEvents();
  }, []);

  // Logo upload
  const handleLogoUpload = async (e, masterKey) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
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

  // Remove logo
  const handleRemoveLogo = async (masterKey) => {
    try {
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

  // Delete entire master series
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

  // Format date helper
  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Get linked events for a master
  const getLinkedEvents = (masterKey) => {
    return chronoEvents.filter((e) => masterGroups[masterKey]?.includes(e.id.toString()));
  };

  // Filter masters by search term
  const filteredMasters = Object.keys(masterGroups).filter((masterKey) =>
    masterKey.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <h2 className="text-4xl font-black text-brand-dark">Master Event Series</h2>

        {/* Search Bar */}
        <div className="w-full sm:w-96">
          <input
            type="text"
            placeholder="Search master series..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-8 py-5 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>
      </div>

      {filteredMasters.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-2xl border border-primary/10">
          <p className="text-2xl text-brand-dark">
            {searchTerm ? 'No master series match your search.' : 'No master series created yet.'}
          </p>
          {!searchTerm && (
            <p className="text-lg text-gray-500 mt-6">
              Create masters by assigning events in the Events tab.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {filteredMasters.map((masterKey) => {
            const logo = eventLogos[masterKey];
            const linkedEvents = getLinkedEvents(masterKey);

            return (
              <div
                key={masterKey}
                className="bg-white rounded-3xl shadow-2xl p-10 border-2 border-primary/20 hover:shadow-3xl hover:border-primary/40 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-8">
                  <h3 className="text-3xl font-black text-brand-dark">{masterKey}</h3>
                  <button
                    onClick={() => handleDeleteMaster(masterKey)}
                    className="text-red-600 hover:text-red-700 font-bold text-sm transition"
                  >
                    Delete Series
                  </button>
                </div>

                {/* Logo Section */}
                <div className="mb-10 text-center">
                  {logo ? (
                    <div>
                      <img
                        src={logo}
                        alt={`${masterKey} logo`}
                        className="max-h-52 mx-auto rounded-2xl shadow-xl border border-primary/10"
                      />
                      <button
                        onClick={() => handleRemoveLogo(masterKey)}
                        className="mt-6 text-red-600 hover:underline font-medium"
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xl font-bold text-brand-dark mb-4">
                        Upload Series Logo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, masterKey)}
                        className="block w-full text-sm text-gray-700 file:mr-6 file:py-4 file:px-10 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-accent file:text-brand-dark hover:file:bg-accent/90 transition"
                      />
                    </div>
                  )}
                </div>

                {/* Ads Toggle */}
                <div className="mb-10">
                  <label className="flex items-center gap-6 cursor-pointer">
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
                      className="h-8 w-8 text-accent rounded focus:ring-accent/30"
                    />
                    <span className="text-xl font-bold text-brand-dark">
                      {showAdsPerMaster[masterKey] ? 'Show Ads' : 'Hide Ads'} on this series
                    </span>
                  </label>
                </div>

                {/* Linked Events */}
                <div>
                  <p className="text-xl font-bold text-brand-dark mb-4">
                    Linked Events ({linkedEvents.length})
                  </p>
                  {linkedEvents.length > 0 ? (
                    <ul className="text-base space-y-3 max-h-80 overflow-y-auto border-2 border-primary/10 rounded-2xl p-5 bg-brand-light/30">
                      {linkedEvents.map((event) => (
                        <li key={event.id} className="text-brand-dark font-medium">
                          {formatDate(event.start_time)} — {event.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic text-lg">No events linked yet.</p>
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