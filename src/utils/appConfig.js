// src/utils/appConfig.js (FINAL — Correct for jsonb column)
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
      hiddenRaces: {},
      hiddenEvents: [],
    };

    if (data && data.length > 0) {
      data.forEach(row => {
        // row.value is already a parsed JS object (jsonb → object/array)
        if (row.key in config) {
          config[row.key] = row.value || (Array.isArray(config[row.key]) ? [] : {});
        }
      });
    }

    console.log('[AppConfig] Fresh config loaded from Supabase:', Object.keys(config));
    return config;
  } catch (err) {
    console.error('[AppConfig] Failed to load config:', err);
    return {
      masterGroups: {},
      editedEvents: {},
      eventLogos: {},
      hiddenMasters: [],
      showAdsPerMaster: {},
      ads: [],
      hiddenRaces: {},
      hiddenEvents: [],
    };
  }
};