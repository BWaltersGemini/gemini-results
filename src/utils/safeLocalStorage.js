// src/utils/safeLocalStorage.js
export const getItem = (key, fallback = {}) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.warn(`Failed to parse localStorage item: ${key}`, err);
    return fallback;
  }
};

export const setItem = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to set localStorage item: ${key}`, err);
  }
};