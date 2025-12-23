// api/ga4-report.js
// Secure serverless endpoint to fetch live GA4 data

import { BetaAnalyticsDataClient } from '@google-analytics/data';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  try {
    // Load credentials from Vercel env var
    const credentials = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON);

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials,
    });

    const propertyId = '517128409'; // ← Your real Property ID

    // === Report 1: Sessions & Users by Year ===
    const [yearlyReport] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2022-01-01', endDate: 'today' }],
      dimensions: [{ name: 'year' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
      ],
    });

    const yearlyData = {};
    yearlyReport.rows?.forEach((row) => {
      const year = row.dimensionValues[0].value;
      yearlyData[year] = {
        sessions: parseInt(row.metricValues[0].value || '0'),
        users: parseInt(row.metricValues[1].value || '0'),
      };
    });

    // === Report 2: Upcoming Event Clicks ===
    // Assumes you fire a custom event called 'upcoming_event_click'
    // If not set up yet, this will return 0 — we can add it later
    const [clickReport] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2022-01-01', endDate: 'today' }],
      dimensions: [{ name: 'year' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'upcoming_event_click', matchType: 'EXACT' },
        },
      },
    });

    clickReport.rows?.forEach((row) => {
      const year = row.dimensionValues[0].value;
      if (!yearlyData[year]) yearlyData[year] = { sessions: 0, users: 0 };
      yearlyData[year].eventClicks = parseInt(row.metricValues[0].value || '0');
    });

    // === Report 3: Top Pages (All Time) ===
    const [pageReport] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 8,
    });

    const topPages = pageReport.rows?.map((row) => ({
      path: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value || '0'),
    })) || [];

    res.status(200).json({ yearly: yearlyData, topPages });
  } catch (error) {
    console.error('GA4 API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch GA4 data', details: error.message });
  }
}

// Needed for async external API calls
export const config = {
  api: {
    externalResolver: true,
  },
};