// src/pages/participant/ResultCardPreviewModal.jsx
// SIMPLIFIED VERSION — No preview, just "Add photo → Download/Share"
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { formatChronoTime } from '../../utils/timeUtils';

export default function ResultCardPreviewModal({
  show,
  onClose,
  participant,
  selectedEvent,
  raceDisplayName,
  participantResultsUrl,
  results,
  userPhoto,
  triggerCamera,
  triggerGallery,
  removePhoto,
  masterLogo,
  bibLogo,
}) {
  const cardRef = useRef(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const overallTotal = results.finishers.length + results.nonFinishers.length;
  const genderTotal = results.finishers.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.finishers.filter(r => r.age_group_name === participant.age_group_name).length;

  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    return new Date(epoch * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const generateAndDownload = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 1080,
        height: 1080,
      });
      const link = document.createElement('a');
      link.download = `${participant.first_name}_${participant.last_name}_result.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('Failed to generate card. Please try again.');
    }
  };

  const shareCard = async () => {
    if (!cardRef.current) return generateAndDownload();
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2.5, useCORS: true, allowTaint: true, width: 1080, height: 1080 });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'result-card.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Race Result!',
            text: `I finished the ${raceDisplayName} in ${participant.chip_time}! 🏁\n${participantResultsUrl}`,
          });
        } else {
          generateAndDownload();
        }
      });
    } catch {
      generateAndDownload();
    }
  };

  if (!show) return null;

  return (
    <>
      {/* Hidden full-size card for html2canvas */}
      <div className="fixed -top-full opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center px-8 pt-6 pb-10"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-4 mb-6">
            {masterLogo ? (
              <img src={masterLogo} alt="Logo" className="max-w-full max-h-28 object-contain mx-auto" crossOrigin="anonymous" />
            ) : bibLogo ? (
              <img src={bibLogo} alt="Logo" className="max-w-full max-h-24 object-contain mx-auto" crossOrigin="anonymous" />
            ) : (
              <h2 className="text-4xl font-black text-brand-dark">{selectedEvent.name}</h2>
            )}
          </div>
          <p className="text-3xl font-black text-accent mb-2">{raceDisplayName}</p>
          <p className="text-2xl text-gray-300 mb-8">{formatDate(selectedEvent.start_time)}</p>

          <div className={`flex items-center justify-center gap-16 mb-8 ${!userPhoto ? 'flex-col gap-6' : ''}`}>
            {userPhoto && (
              <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-white shadow-2xl">
                <img src={userPhoto} alt="You" className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className={`font-black text-white drop-shadow-2xl leading-none ${userPhoto ? 'text-6xl' : 'text-7xl'}`}>
              {participant.first_name}<br />{participant.last_name}
            </h1>
          </div>

          <div className="mb-10">
            <p className="text-3xl text-gray-400 uppercase tracking-widest mb-3">Finish Time</p>
            <p className="text-9xl font-black text-[#FFD700] drop-shadow-2xl">{formatChronoTime(participant.chip_time)}</p>
          </div>

          <div className="grid grid-cols-3 gap-10 text-white w-full max-w-4xl mb-12">
            <div><p className="text-2xl text-gray-400 uppercase mb-2">Overall</p><p className="text-7xl font-bold text-[#FFD700]">{participant.place || '—'}</p><p className="text-xl text-gray-400 mt-2">of {overallTotal}</p></div>
            <div><p className="text-2xl text-gray-400 uppercase mb-2">Gender</p><p className="text-7xl font-bold text-[#FFD700]">{participant.gender_place || '—'}</p><p className="text-xl text-gray-400 mt-2">of {genderTotal}</p></div>
            <div><p className="text-2xl text-gray-400 uppercase mb-2">Division</p><p className="text-7xl font-bold text-[#FFD700]">{participant.age_group_place || '—'}</p><p className="text-xl text-gray-400 mt-2">of {divisionTotal}</p></div>
          </div>

          <p className="text-3xl text-white italic mt-auto mb-8">Find your next race at www.youkeepmoving.com</p>
        </div>
      </div>

      {/* Simple Modal */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-4xl text-gray-600 hover:text-gray-900">&times;</button>

          <h3 className="text-3xl font-bold text-center mb-8">Your Result Card 🎉</h3>

          <p className="text-xl text-center mb-10 text-gray-700">
            Add your photo, then download and share!
          </p>

          {/* Photo Section */}
          <div className="text-center mb-10">
            {userPhoto ? (
              <div className="mb-6">
                <img src={userPhoto} alt="Your finish" className="w-40 h-40 object-cover rounded-full mx-auto shadow-xl" />
                <button onClick={removePhoto} className="block mx-auto mt-4 text-red-600 underline">Remove Photo</button>
              </div>
            ) : (
              <div className="w-40 h-40 bg-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center text-5xl">📸</div>
            )}

            <div className="flex justify-center gap-4">
              <button onClick={triggerCamera} className="px-6 py-3 bg-brand-dark text-white font-bold rounded-full hover:opacity-90">
                📷 Take Photo
              </button>
              <button onClick={triggerGallery} className="px-6 py-3 bg-gray-700 text-white font-bold rounded-full hover:opacity-90">
                🖼️ From Gallery
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={generateAndDownload}
              className="px-8 py-4 bg-primary text-white font-bold text-lg rounded-full hover:opacity-90 shadow-lg"
            >
              {isMobile ? 'Save to Photos' : 'Download Card'}
            </button>
            <button
              onClick={shareCard}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-full hover:opacity-90 shadow-lg"
            >
              Share Card
            </button>
          </div>
        </div>
      </div>
    </>
  );
}