// src/pages/director/LiveTrackingPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchLiveTrackingData } from '../../api/director/rd_chronotrackapi';
import { useDirector } from '../../context/DirectorContext';
import DirectorLayout from './DirectorLayout';

export default function LiveTrackingPage() {
  const { eventId } = useParams();
  const { selectedEventId } = useDirector();
  const navigate = useNavigate();

  const activeEventId = eventId || selectedEventId;

  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = async () => {
    if (!activeEventId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchLiveTrackingData(activeEventId);
      setTrackingData(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load live data. Retrying...');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, [activeEventId]);

  if (!activeEventId) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-2xl text-gray-600">No event selected. Please go back to the hub.</p>
        </div>
      </DirectorLayout>
    );
  }

  return (
    <DirectorLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gemini-dark-gray">Live Athlete Tracking</h1>
          <button
            onClick={() => navigate('/race-directors-hub')}
            className="text-gemini-blue font-semibold hover:underline"
          >
            ← Back to Hub
          </button>
        </div>

        {loading && !trackingData && (
          <p className="text-center text-xl text-gray-600">Loading live data...</p>
        )}

        {error && <p className="text-red-600 text-center mb-6">{error}</p>}

        {trackingData && (
          <>
            <p className="text-right text-gray-600 mb-6">
              Last updated: {lastRefresh?.toLocaleTimeString()}
            </p>

            {/* Main Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-gemini-blue">{trackingData.started}</p>
                <p className="text-xl text-gray-700 mt-2">Started</p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-green-600">{trackingData.finished}</p>
                <p className="text-xl text-gray-700 mt-2">Finished</p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-orange-600">{trackingData.stillOnCourse}</p>
                <p className="text-xl text-gray-700 mt-2">Still on Course</p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-gray-600">{trackingData.yetToStart}</p>
                <p className="text-xl text-gray-700 mt-2">Yet to Start</p>
              </div>
            </div>

            {/* Split Progress */}
            <h2 className="text-3xl font-bold text-gemini-dark-gray mb-6">Split Progress</h2>
            <div className="space-y-6">
              {trackingData.splitProgress.map((split) => (
                <div key={split.name} className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold">{split.name}</h3>
                    <span className="text-lg text-gray-700">
                      {split.passed} / {trackingData.totalParticipants} ({Math.round(split.percentage)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className="bg-gemini-blue h-8 rounded-full transition-all duration-1000"
                      style={{ width: `${split.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {trackingData.stillOnCourse < 50 && trackingData.stillOnCourse > 0 && (
              <div className="mt-12 bg-yellow-100 border-2 border-yellow-400 rounded-2xl p-8 text-center">
                <p className="text-3xl font-bold text-yellow-800">
                  Only {trackingData.stillOnCourse} runners left on course!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </DirectorLayout>
  );
}