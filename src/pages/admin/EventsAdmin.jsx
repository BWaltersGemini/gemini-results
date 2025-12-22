// src/pages/admin/EventsAdmin.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { createAdminSupabaseClient } from '../../supabaseClient';
import { fetchEvents as fetchChronoEvents, fetchResultsForEvent } from '../../api/chronotrackapi';
import axios from 'axios';

export default function EventsAdmin({
  masterGroups,
  editedEvents,
  hiddenRaces,
  eventLogos,
  liveAutoFetchPerEvent,
  setMasterGroups,
  setEditedEvents,
  setHiddenRaces,
  setLiveAutoFetchPerEvent,
  autoSaveConfig,
}) {
  const [chronoEvents, setChronoEvents] = useState([]);
  const [participantCounts, setParticipantCounts] = useState({});
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [refreshingEvent, setRefreshingEvent] = useState(null);
  const [fetchingEvents, setFetchingEvents] = useState(false);
  const [updatingEndTime, setUpdatingEndTime] = useState(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [hideMasteredEvents, setHideMasteredEvents] = useState(true);

  const adminSupabase = createAdminSupabaseClient();

  // Load events & counts
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data } = await supabase.from('chronotrack_events').select('*').order('start_time', { ascending: false });
        setChronoEvents(data || []);

        const counts = {};
        for (const event of data || []) {
          const { count } = await adminSupabase.from('chronotrack_results').select('id', { count: 'exact', head: true }).eq('event_id', event.id);
          counts[event.id] = count || 0;
        }
        setParticipantCounts(counts);
      } catch (err) {
        console.error('Load failed:', err);
      }
    };
    loadData();
  }, []);

  // All your handlers go here (fetchLatestFromChronoTrack, refreshAndPublishResults, assignToMaster, etc.)
  // Paste all the handler functions from your original AdminPage here

  const formatDate = (epoch) => /* same as before */;
  const formatDateTime = (epoch) => /* same as before */;

  const groupEventsByYearMonth = () => { /* same as before */ };
  const groupedEvents = groupEventsByYearMonth();

  const getCurrentMasterForEvent = (eventId) => { /* same */ };
  const displayedEvents = hideMasteredEvents ? chronoEvents.filter(e => !getCurrentMasterForEvent(e.id)) : chronoEvents;

  return (
    <section className="space-y-8">
      {/* Header with buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-gemini-dark-gray">Events ({displayedEvents.length} shown)</h2>
        {/* Buttons: hide mastered, refresh, publish all */}
      </div>

      {/* Year/Month Accordion - same structure as before */}
      {/* Paste the full accordion JSX here */}
    </section>
  );
}