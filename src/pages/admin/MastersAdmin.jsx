// src/pages/admin/MastersAdmin.jsx
// FULLY FIXED & IMPROVED — December 2025
// • Uses fresh events from RaceContext (no duplicate Supabase fetch)
// • Proper loading/error states
// • Cache-busted logo URLs after upload
// • Better UX feedback (loading spinners, success messages)
// • Safer delete with full confirmation
// • Optimized search (case-insensitive + trim)

import { useState, useContext, useMemo } from 'react';
import { RaceContext } from '../../context/RaceContext';
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
  const { events = [], loading: eventsLoading } = useContext(RaceContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingLogoFor, setUploadingLogoFor] = useState(null);
  const [deletingMaster, setDeletingMaster] = useState(null);

  const adminSupabase = createAdminSupabaseClient();

  // Memoized filtered masters for performance
  const filteredMasters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return Object.keys(masterGroups);

    return Object.keys(masterGroups).filter((masterKey) =>
      masterKey.toLowerCase().includes(term)
    );
  }, [masterGroups, searchTerm]);

  // Get linked events for a master (from fresh events in context)
  const getLinkedEvents = (masterKey) => {
    const eventIds = masterGroups[masterKey] || [];
    return events
      .filter((e) => eventIds.includes(String(e.id)))
      .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
  };

  // Format date helper
  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Logo upload with cache busting
  const handleLogoUpload = async (e, masterKey) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingLogoFor(masterKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${masterKey}.${fileExt}`;

      const { error: uploadError } = await adminSupabase.storage
        .from('logos')
        .upload(`public/${fileName}`, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Generate cache-busted URL
      const { data: { publicUrl } } = adminSupabase.storage
        .from('logos')
        .getPublicUrl(`public/${fileName}`);

      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      const updatedLogos = { ...eventLogos, [masterKey]: cacheBustedUrl };
      setEventLogos(updatedLogos);
      await autoSaveConfig('eventLogos', updatedLogos);
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert('Failed to upload logo. Check console.');
    } finally {
      setUploadingLogoFor(null);
    }
  };

  // Remove logo
  const handleRemoveLogo = async (masterKey) => {
    if (!confirm('Remove logo for this series?')) return;

    try {
      // Try to remove all possible extensions
      const possibleExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
      const removePromises = possibleExtensions.map(ext =>
        adminSupabase.storage.from('logos').remove([`public/${masterKey}.${ext}`])
      );
      await Promise.allSettled(removePromises);

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
    const linkedCount = getLinkedEvents(masterKey).length;
    const confirmMsg = linkedCount > 0
      ? `Delete "${masterKey}"?\nThis will unlink ${linkedCount} event(s) and remove its logo. This cannot be undone.`
      : `Delete "${masterKey}"? This will remove the series and its logo.`;

    if (!confirm(confirmMsg)) return;

    setDeletingMaster(masterKey);
    try {
      const updatedGroups = { ...masterGroups };
      delete updatedGroups[masterKey];
      setMasterGroups(updatedGroups);
      await autoSaveConfig('masterGroups', updatedGroups);

      // Also remove logo
      await handleRemoveLogo(masterKey);
    } catch (err) {
      console.error('Delete master failed:', err);
      alert('Failed to delete series.');
    } finally {
      setDeletingMaster(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <h2 className="text-4xl font-black text-brand-dark">Master Event Series</h2>
        <div className="w-full sm:w-96">
          <input
            type="text"
            placeholder="Search master series..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-8 py-5 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition"
          />
        </div>
      </div>

      {eventsLoading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-primary"></div>
          <p className="mt-6 text-xl text-gray-600">Loading events...</p>
        </div>
      ) : filteredMasters.length === 0 ? (
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
                  <h3 className="text-3xl font-black text-brand-dark break-words">{masterKey}</h3>
                  <button
                    onClick={() => handleDeleteMaster(masterKey)}
                    disabled={deletingMaster === masterKey}
                    className="text-red-600 hover:text-red-700 font-bold text-sm transition disabled:opacity-50"
                  >
                    {deletingMaster === masterKey ? 'Deleting...' : 'Delete Series'}
                  </button>
                </div>

                {/* Logo Section */}
                <div className="mb-10 text-center">
                  {logo ? (
                    <div>
                      <img
                        src={logo}
                        alt={`${masterKey} logo`}
                        className="max-h-52 mx-auto rounded-2xl shadow-xl border border-primary/10 object-contain"
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
                      <label className="block text-xl font-bold text-brand-dark mb-4 cursor-pointer">
                        Upload Series Logo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, masterKey)}
                        disabled={uploadingLogoFor === masterKey}
                        className="block w-full text-sm text-gray-700 file:mr-6 file:py-4 file:px-10 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-accent file:text-brand-dark hover:file:bg-accent/90 transition disabled:opacity-50"
                      />
                      {uploadingLogoFor === masterKey && (
                        <p className="mt-4 text-primary font-medium">Uploading...</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Ads Toggle */}
                <div className="mb-10">
                  <label className="flex items-center gap-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!showAdsPerMaster[masterKey]}
                      onChange={async () => {
                        const updated = {
                          ...showAdsPerMaster,
                          [masterKey]: !showAdsPerMaster[masterKey],
                        };
                        setShowAdsPerMaster(updated);
                        await autoSaveConfig('showAdsPerMaster', updated);
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