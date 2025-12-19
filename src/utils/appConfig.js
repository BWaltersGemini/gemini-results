// src/utils/appConfig.js (FINAL — Fresh Load from Supabase, No Caching)
import { supabase } from '../supabaseClient';

export const loadAppConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value');

    if (error) throw error;

    const config = {
      masterGroups: {},
      editedEvents: {},
      eventLogos: {},
      hiddenMasters: [],
      showAdsPerMaster: {},
      ads: [],
      hiddenRaces: {}, // Added for completeness (used in ResultsPage)
    };

    if (data && data.length > 0) {
      data.forEach(row => {
        try {
          // Parse JSON values
          config[row.key] = JSON.parse(row.value);
        } catch (e) {
          console.warn(`[AppConfig] Failed to parse JSON for key ${row.key}:`, e);
          config[row.key] = row.value; // Fallback to raw value
        }
      });
    }

    console.log('[AppConfig] Fresh config loaded from Supabase:', Object.keys(config));
    return config;
  } catch (err) {
    console.error('[AppConfig] Failed to load config from Supabase:', err);
    // Return defaults on error
    return {
      masterGroups: {},
      editedEvents: {},
      eventLogos: {},
      hiddenMasters: [],
      showAdsPerMaster: {},
      ads: [],
      hiddenRaces: {},
    };
  }
};