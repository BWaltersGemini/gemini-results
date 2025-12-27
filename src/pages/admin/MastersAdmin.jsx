// src/pages/admin/MastersAdmin.jsx
// FIXED — Correct profiles table + always show Add Director dropdown + better UX
import { useState, useContext, useMemo, useEffect } from 'react';
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
  const [unlinkingEvent, setUnlinkingEvent] = useState(null);

  // Director state
  const [directors, setDirectors] = useState([]); // All directors
  const [assignments, setAssignments] = useState({}); // { masterKey: [user_id] }
  const [loadingDirectors, setLoadingDirectors] = useState(true);
  const [assigningTo, setAssigningTo] = useState(null);

  const adminSupabase = createAdminSupabaseClient();

  // Load directors (from correct 'profiles' table) and assignments
  useEffect(() => {
    const loadDirectorsAndAssignments = async () => {
      setLoadingDirectors(true);
      try {
        // === Fetch directors from 'profiles' table where role = 'director' ===
        const { data: profiles, error: profileError } = await adminSupabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'director'); // Only directors

        if (profileError) throw profileError;

        if (!profiles || profiles.length === 0) {
          console.warn('No directors found in profiles table with role="director"');
          setDirectors([]);
        } else {
          // Enrich with email from auth.users (optional but helpful)
          const userIds = profiles.map(p => p.id);
          const { data: users } = await adminSupabase.auth.admin.listUsers();
          const userMap = {};
          users.forEach(u => { userMap[u.id] = u.email; });

          setDirectors(profiles.map(p => ({
            id: p.id,
            name: p.full_name || 'Unnamed Director',
            email: userMap[p.id] || 'No email',
          })));
        }

        // Load current master assignments
        const { data: assigns } = await adminSupabase
          .from('director_master_assignments')
          .select('director_user_id, master_key');

        const assignMap = {};
        assigns?.forEach(a => {
          if (!assignMap[a.master_key]) assignMap[a.master_key] = [];
          assignMap[a.master_key].push(a.director_user_id);
        });
        setAssignments(assignMap);
      } catch (err) {
        console.error('Failed to load directors/assignments:', err);
        alert('Failed to load directors. Check console.');
        setDirectors([]);
      } finally {
        setLoadingDirectors(false);
      }
    };

    loadDirectorsAndAssignments();
  }, []);

  const filteredMasters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return Object.keys(masterGroups);
    return Object.keys(masterGroups).filter((masterKey) =>
      masterKey.toLowerCase().includes(term)
    );
  }, [masterGroups, searchTerm]);

  const getLinkedEvents = (masterKey) => {
    const eventIds = masterGroups[masterKey] || [];
    return events
      .filter((e) => eventIds.includes(String(e.id)))
      .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
  };

  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Logo handlers (unchanged)
  const handleLogoUpload = async (e, masterKey) => { /* ... same as before ... */ };
  const handleRemoveLogo = async (masterKey) => { /* ... same as before ... */ };

  // Master delete
  const handleDeleteMaster = async (masterKey) => { /* ... same as before ... */ };

  // Unlink individual event
  const handleUnlinkEvent = async (masterKey, eventId) => { /* ... same as before ... */ };

  // Director assignment
  const toggleDirectorAssignment = async (masterKey, directorId) => { /* ... same as before ... */ };

  const getAssignedDirectors = (masterKey) => {
    const ids = assignments[masterKey] || [];
    return directors.filter(d => ids.includes(d.id));
  };

  // Always return all directors — even if assigned (so you can re-add)
  const getAvailableDirectorsForDropdown = () => directors;

  return (
    <section className="space-y-8">
      {/* Header */}
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

      {/* Loading */}
      {eventsLoading || loadingDirectors ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-primary"></div>
          <p className="mt-6 text-xl text-gray-600">Loading masters and directors...</p>
        </div>
      ) : filteredMasters.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-2xl border border-primary/10">
          <p className="text-2xl text-brand-dark">
            {searchTerm ? 'No master series match your search.' : 'No master series created yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {filteredMasters.map((masterKey) => {
            const logo = eventLogos[masterKey];
            const linkedEvents = getLinkedEvents(masterKey);
            const assigned = getAssignedDirectors(masterKey);
            const availableForDropdown = getAvailableDirectorsForDropdown();

            return (
              <div
                key={masterKey}
                className="bg-white rounded-3xl shadow-2xl p-10 border-2 border-primary/20 hover:shadow-3xl hover:border-primary/40 transition-all duration-300"
              >
                {/* Title + Delete */}
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

                {/* Logo */}
                <div className="mb-10 text-center">
                  {logo ? (
                    <div>
                      <img src={logo} alt="Logo" className="max-h-52 mx-auto rounded-2xl shadow-xl object-contain" />
                      <button onClick={() => handleRemoveLogo(masterKey)} className="mt-6 text-red-600 hover:underline">
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
                        className="block w-full text-sm file:mr-6 file:py-4 file:px-10 file:rounded-full file:bg-accent file:text-brand-dark"
                      />
                      {uploadingLogoFor === masterKey && <p className="mt-4 text-primary">Uploading...</p>}
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
                        const updated = { ...showAdsPerMaster, [masterKey]: !showAdsPerMaster[masterKey] };
                        setShowAdsPerMaster(updated);
                        await autoSaveConfig('showAdsPerMaster', updated);
                      }}
                      className="h-8 w-8 text-accent rounded"
                    />
                    <span className="text-xl font-bold">Show Ads on Series</span>
                  </label>
                </div>

                {/* Director Assignments */}
                <div className="mb-10">
                  <h4 className="text-xl font-bold text-brand-dark mb-4">
                    Assigned Directors ({assigned.length})
                  </h4>

                  {assigned.length > 0 ? (
                    <div className="space-y-3 mb-6">
                      {assigned.map(dir => (
                        <div key={dir.id} className="flex justify-between items-center bg-gray-100 rounded-xl px-4 py-3">
                          <div>
                            <p className="font-medium">{dir.name}</p>
                            <p className="text-sm text-gray-600">{dir.email}</p>
                          </div>
                          <button
                            onClick={() => toggleDirectorAssignment(masterKey, dir.id)}
                            disabled={assigningTo === masterKey}
                            className="text-red-600 hover:text-red-700 font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic mb-6">No directors assigned</p>
                  )}

                  {/* Always show dropdown — even if all assigned */}
                  {directors.length > 0 ? (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          toggleDirectorAssignment(masterKey, e.target.value);
                          e.target.value = ''; // Reset
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:outline-none"
                      disabled={assigningTo === masterKey}
                    >
                      <option value="">+ Add a Director...</option>
                      {availableForDropdown.map(dir => (
                        <option key={dir.id} value={dir.id}>
                          {dir.name} ({dir.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-500 italic">No directors available to assign</p>
                  )}
                </div>

                {/* Linked Events with Remove */}
                <div>
                  <p className="text-xl font-bold text-brand-dark mb-4">
                    Linked Events ({linkedEvents.length})
                  </p>
                  {linkedEvents.length > 0 ? (
                    <ul className="text-base space-y-3 max-h-80 overflow-y-auto border-2 border-primary/10 rounded-2xl p-5 bg-brand-light/30">
                      {linkedEvents.map((event) => {
                        const isUnlinking = unlinkingEvent?.masterKey === masterKey && unlinkingEvent?.eventId === event.id;
                        return (
                          <li key={event.id} className="flex justify-between items-center text-brand-dark font-medium">
                            <span>
                              {formatDate(event.start_time)} — {event.name}
                            </span>
                            <button
                              onClick={() => handleUnlinkEvent(masterKey, event.id)}
                              disabled={isUnlinking}
                              className="text-red-600 hover:text-red-700 text-sm font-bold disabled:opacity-50"
                            >
                              {isUnlinking ? 'Removing...' : 'Remove'}
                            </button>
                          </li>
                        );
                      })}
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