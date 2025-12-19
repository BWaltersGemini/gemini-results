// src/utils/appConfig.js (FINAL — Safe JSON Parse + No Cache)
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
        let parsed;
        try {
          parsed = JSON.parse(row.value);
        } catch (e) {
          console.warn(`[AppConfig] Invalid JSON in DB for key "${row.key}":`, row.value);
          parsed = {}; // or [] depending on expected type
        }
        if (row.key in config) {
          config[row.key] = parsed;
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