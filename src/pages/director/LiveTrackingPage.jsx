// src/pages/director/LiveTrackingPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLiveTrackingData } from '../../api/director/rd_chronotrackapi';
import { useDirector } from '../../context/DirectorContext';
import DirectorLayout from './DirectorLayout';

export default function LiveTrackingPage() {
  const navigate = useNavigate();
  const { selectedEventId, currentUser } = useDirector();

  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  if (!currentUser) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <p className="text-2xl text-text-muted">Authenticating...</p>
        </div>
      </DirectorLayout>
    );
  }

  if (!selectedEventId) {
    navigate('/race-directors-hub');
    return null;
  }

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLiveTrackingData(selectedEventId);
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
    const interval = setInterval(loadData, 60000); // Every minute
    return () => clearInterval(interval);
  }, [selectedEventId]);

  return (
    <DirectorLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-text-dark">Live Athlete Tracking</h1>
          <button
            onClick={() => navigate('/race-directors-hub')}
            className="text-accent font-semibold hover:underline"
          >
            ← Back to Hub
          </button>
        </div>

        {loading && !trackingData && (
          <p className="text-center text-xl text-text-muted">Loading live data...</p>
        )}
        {error && <p className="text-red-600 text-center mb-6">{error}</p>}

        {trackingData && (
          <>
            <p className="text-right text-text-muted mb-8">
              Last updated: {lastRefresh?.toLocaleTimeString()}
            </p>

            {/* === OVERALL EVENT STATS === */}
            <h2 className="text-3xl font-bold text-text-dark mb-8">Overall Event Progress</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-accent">{trackingData.overall.started}</p>
                <p className="text-xl text-text-muted mt-2">Started</p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-green-600">{trackingData.overall.finished}</p>
                <p className="text-xl text-text-muted mt-2">Finished</p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-orange-600">{trackingData.overall.stillOnCourse}</p>
                <p className="text-xl text-text-muted mt-2">Still on Course</p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                <p className="text-5xl font-black text-text-muted">{trackingData.overall.yetToStart}</p>
                <p className="text-xl text-text-muted mt-2">Yet to Start</p>
              </div>
            </div>

            {/* === PER-RACE BREAKDOWN === */}
            <h2 className="text-3xl font-bold text-text-dark mb-8">Progress by Race</h2>
            <div className="space-y-12">
              {trackingData.races.map((race) => (
                <div key={race.raceId} className="bg-white rounded-2xl shadow-xl p-8">
                  <h3 className="text-2xl font-bold text-primary mb-6">{race.raceName}</h3>
                  
                  {/* Race Counters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-accent">{race.started}</p>
                      <p className="text-text-muted">Started</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{race.finished}</p>
                      <p className="text-text-muted">Finished</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-600">{race.stillOnCourse}</p>
                      <p className="text-text-muted">On Course</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-text-muted">{race.total - race.started}</p>
                      <p className="text-text-muted">Yet to Start</p>
                    </div>
                  </div>

                  {/* Race-Specific Splits */}
                  <div className="space-y-6">
                    {race.splitProgress.map((split) => (
                      <div key={split.name}>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-lg font-semibold">{split.name}</h4>
                          <span className="text-text-muted">
                            {split.passed} / {race.total} ({Math.round(split.percentage)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-8">
                          <div
                            className="bg-primary h-8 rounded-full transition-all duration-1000"
                            style={{ width: `${split.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Final Push Alert */}
            {trackingData.overall.stillOnCourse < 50 && trackingData.overall.stillOnCourse > 0 && (
              <div className="mt-12 bg-yellow-100 border-2 border-yellow-400 rounded-2xl p-8 text-center">
                <p className="text-3xl font-bold text-yellow-800">
                  Only {trackingData.overall.stillOnCourse} runners left across all races!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </DirectorLayout>
  );
}