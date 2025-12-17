// src/utils/appConfig.js
import { supabase } from '../supabaseClient';

let configCache = null;
let configPromise = null;

export const loadAppConfig = async () => {
  // Return cached config if already loaded
  if (configCache) {
    return configCache;
  }

  // Prevent duplicate concurrent fetches
  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value');

      if (error) {
        throw error;
      }

      const config = {
        masterGroups: {},
        editedEvents: {},
        eventLogos: {},
        hiddenMasters: [],
        showAdsPerMaster: {},
        ads: [],
      };

      if (data && data.length > 0) {
        data.forEach(row => {
          if (row.key in config) {
            config[row.key] = row.value;
          }
        });
      }

      console.log('[AppConfig] Loaded from Supabase:', Object.keys(config));
      configCache = config;
      return config;
    } catch (err) {
      console.warn('[AppConfig] Failed to load from Supabase, using defaults:', err);
      return {
        masterGroups: {},
        editedEvents: {},
        eventLogos: {},
        hiddenMasters: [],
        showAdsPerMaster: {},
        ads: [],
      };
    } finally {
      configPromise = null;
    }
  })();

  return configPromise;
};