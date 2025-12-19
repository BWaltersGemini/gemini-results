// src/utils/timeUtils.js (UPDATED — Added clean time formatter)
export const parseChipTime = (timeStr) => {
  if (!timeStr || timeStr.trim() === '') return Infinity;

  const trimmed = timeStr.trim();
  const parts = trimmed.split(':').map(parseFloat);

  if (parts.length === 3) {
    // H:MM:SS or H:MM:SS.t
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    // MM:SS or MM:SS.t
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    // SS or SS.t
    return parts[0];
  }

  return Infinity;
};

/**
 * Format ChronoTrack time string to HH:MM:SS.s with no leading zeros
 * Examples:
 *   "1:23:45.678" → "1:23:45.6"
 *   "59:59.123"   → "59:59.1"
 *   "12:15.550"   → "12:15.5"
 *   "5.300"       → "5.3"
 *   "0:05:30.000" → "5:30.0"
 */
export const formatChronoTime = (timeStr) => {
  if (!timeStr || timeStr.trim() === '' || timeStr === '—') return '—';

  const trimmed = timeStr.trim();
  let [timePart, decimal = ''] = trimmed.split('.');
  const parts = timePart.split(':').map(p => parseInt(p, 10));

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    [hours, minutes, seconds] = parts;
  } else if (parts.length === 2) {
    [minutes, seconds] = parts;
  } else if (parts.length === 1) {
    seconds = parts[0];
  }

  const formattedParts = [];

  // Only include hours if > 0
  if (hours > 0) {
    formattedParts.push(hours);
  }

  // Minutes: always 2 digits if hours present, otherwise no leading zero
  if (hours > 0 || minutes > 0) {
    formattedParts.push(minutes.toString().padStart(2, '0'));
  }

  // Seconds: always 2 digits, plus one decimal if present
  const secsInteger = seconds.toString().padStart(2, '0');
  const decimalPart = decimal ? `.${decimal.charAt(0)}` : '';
  formattedParts.push(secsInteger + decimalPart);

  return formattedParts.join(':');
};