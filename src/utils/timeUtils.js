// src/utils/timeUtils.js
/**
 * Parse chip_time string (e.g., "59:59", "1:23:45", "1:23:45.6") into seconds (float)
 * Returns Infinity if invalid
 */
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