// src/pages/admin/MastersAdmin.jsx
// FINAL — Fully fixed: correct profiles table, listUsers handling, always-show dropdown + unlink events
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
  const [directors, setDirectors] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loadingDirectors, setLoadingDirectors] = useState(true);
  const [assigningTo, setAssigningTo] = useState(null);

  const adminSupabase = createAdminSupabaseClient();

  // Load directors (from profiles where role='director') and assignments
  useEffect(() => {
    const loadDirectorsAndAssignments = async () => {
      setLoadingDirectors(true);
      try {
        // 1. Load directors from profiles table
        const { data: profiles, error: profileError } = await adminSupabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'director');

        if (profileError) throw profileError;

        let directorList = [];
        if (profiles && profiles.length > 0) {
          // 2. Get emails from auth.users
          const { data: authData, error: authError } = await adminSupabase.auth.admin.listUsers();
          if (authError) throw authError;

          const userMap = {};
          authData.users.forEach(u => {
            userMap[u.id] = u.email || 'No email';
          });

          directorList = profiles.map(p => ({
            id: p.id,
            name: p.full_name || 'Unnamed Director',
            email: userMap[p.id] || 'No email',
          }));
        } else {
          console.warn('No users with role="director" found in profiles table');
        }

        setDirectors(directorList);

        // 3. Load master assignments
        const { data: assigns, error: assignError } = await adminSupabase
          .from('director_master_assignments')
          .select('director_user_id, master_key');

        if (assignError) throw assignError;

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

  // Logo handlers
  const handleLogoUpload = async (e, masterKey) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogoFor(masterKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${masterKey}.${fileExt}`;
      const { error: uploadError } = await adminSupabase.storage
        .from('logos')
        .upload(`public/${fileName}`, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = adminSupabase.storage
        .from('logos')
        .getPublicUrl(`public/${fileName}`);
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
      const updatedLogos = { ...eventLogos, [masterKey]: cacheBustedUrl };
      setEventLogos(updatedLogos);
      await autoSaveConfig('eventLogos', updatedLogos);
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert('Failed to upload logo.');
    } finally {
      setUploadingLogoFor(null);
    }
  };

  const handleRemoveLogo = async (masterKey) => {
    if (!confirm('Remove logo?')) return;
    try {
      const possible = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
      await Promise.allSettled(
        possible.map(ext => adminSupabase.storage.from('logos').remove([`public/${masterKey}.${ext}`]))
      );
      const updated = { ...eventLogos };
      delete updated[masterKey];
      setEventLogos(updated);
      await autoSaveConfig('eventLogos', updated);
    } catch (err) {
      console.error('Remove logo failed:', err);
    }
  };

  // Delete master series
  const handleDeleteMaster = async (masterKey) => {
    const linkedCount = getLinkedEvents(masterKey).length;
    if (!confirm(`Delete "${masterKey}"? ${linkedCount > 0 ? `This will unlink ${linkedCount} events.` : ''}`)) return;
    setDeletingMaster(masterKey);
    try {
      const updated = { ...masterGroups };
      delete updated[masterKey];
      setMasterGroups(updated);
      await autoSaveConfig('masterGroups', updated);
      await handleRemoveLogo(masterKey);
      await adminSupabase
        .from('director_master_assignments')
        .delete()
        .eq('master_key', masterKey);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete series.');
    } finally {
      setDeletingMaster(null);
    }
  };

  // Unlink individual event
  const handleUnlinkEvent = async (masterKey, eventId) => {
    if (!confirm('Remove this event from the series?')) return;
    setUnlinkingEvent({ masterKey, eventId });
    try {
      const updatedGroups = { ...masterGroups };
      updatedGroups[masterKey] = updatedGroups[masterKey].filter(id => id !== String(eventId));
      setMasterGroups(updatedGroups);
      await autoSaveConfig('masterGroups', updatedGroups);
    } catch (err) {
      console.error('Failed to unlink event:', err);
      alert('Failed to remove event.');
    } finally {
      setUnlinkingEvent(null);
    }
  };

  // Director assignment toggle
  const toggleDirectorAssignment = async (masterKey, directorId) => {
    setAssigningTo(masterKey);
    try {
      const current = assignments[masterKey] || [];
      if (current.includes(directorId)) {
        await adminSupabase
          .from('director_master_assignments')
          .delete()
          .eq('director_user_id', directorId)
          .eq('master_key', masterKey);
        setAssignments(prev => ({
          ...prev,
          [masterKey]: prev[masterKey].filter(id => id !== directorId)
        }));
      } else {
        await adminSupabase
          .from('director_master_assignments')
          .insert({ director_user_id: directorId, master_key: masterKey });
        setAssignments(prev => ({
          ...prev,
          [masterKey]: [...(prev[masterKey] || []), directorId]
        }));
      }
    } catch (err) {
      console.error('Assignment update failed:', err);
      alert('Failed to update access.');
    } finally {
      setAssigningTo(null);
    }
  };

  const getAssignedDirectors = (masterKey) => {
    const ids = assignments[masterKey] || [];
    return directors.filter(d => ids.includes(d.id));
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

                  {/* Always visible dropdown */}
                  {directors.length > 0 ? (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          toggleDirectorAssignment(masterKey, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:outline-none"
                      disabled={assigningTo === masterKey}
                    >
                      <option value="">+ Add a Director...</option>
                      {directors.map(dir => (
                        <option key={dir.id} value={dir.id}>
                          {dir.name} ({dir.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-500 italic">No directors found (check role='director' in profiles)</p>
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