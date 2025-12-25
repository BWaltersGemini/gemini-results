// src/pages/participant/ResultCardPreviewModal.jsx
// FINAL VERSION — Beautiful 1080x1080 Square Card Preview (Instagram Style)
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { formatChronoTime } from '../../utils/timeUtils';

export default function ResultCardPreviewModal({
  show,
  onClose,
  participant,
  selectedEvent,
  masterLogo,
  bibLogo,
  raceDisplayName,
  participantResultsUrl,
  results,
  userPhoto,
  triggerCamera,
  triggerGallery,
  removePhoto,
}) {
  const cardRef = useRef(null);
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const overallTotal = results.finishers.length + results.nonFinishers.length;
  const genderTotal = results.finishers.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.finishers.filter(r => r.age_group_name === participant.age_group_name).length;

  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const generateResultCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: 1080,
        height: 1080,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${participant.first_name}_${participant.last_name}_result.png`;
      link.href = image;
      link.click();
    } catch (err) {
      console.error('Card generation failed:', err);
      alert('Failed to generate card — please try again!');
    }
  };

  const shareResultCard = async () => {
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
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'result-card.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Race Result!',
            text: `I finished the ${raceDisplayName} in ${participant.chip_time}! 🏁\n\nFull results: ${participantResultsUrl}`,
          });
        } else {
          generateResultCard();
        }
      });
    } catch (err) {
      generateResultCard();
    }
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(participantResultsUrl);
    const text = encodeURIComponent(`I just finished the ${raceDisplayName} in ${participant.chip_time}! 🏁`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`Just finished the ${raceDisplayName} in ${participant.chip_time}! Overall: ${participant.place}, Gender: ${participant.gender_place}, Division: ${participant.age_group_place} 🏁\n\n${participantResultsUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareOnInstagram = () => {
    alert('Instagram sharing works best with the downloaded image! Save your card and post it directly in the app.');
  };

  if (!show) return null;

  return (
    <>
      {/* Hidden Full-Size 1080x1080 Card for Download/Share */}
      <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center px-12 pt-10 pb-16 overflow-hidden"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 mb-8">
            {masterLogo ? (
              <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-32 object-contain mx-auto" crossOrigin="anonymous" />
            ) : bibLogo ? (
              <img src={bibLogo} alt="Event Logo" className="max-w-full max-h-28 object-contain mx-auto" crossOrigin="anonymous" />
            ) : (
              <h2 className="text-5xl font-black text-brand-dark">{selectedEvent.name}</h2>
            )}
          </div>

          <p className="text-4xl font-black text-accent mb-3">{raceDisplayName}</p>
          <p className="text-3xl text-gray-300 mb-10">{formatDate(selectedEvent.start_time)}</p>

          <div className={`flex items-center justify-center gap-20 mb-12 ${!userPhoto ? 'flex-col gap-10' : ''}`}>
            {userPhoto && (
              <div className="w-80 h-80 rounded-full overflow-hidden border-12 border-white shadow-2xl">
                <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" crossOrigin="anonymous" />
              </div>
            )}
            <h1 className={`font-black text-white drop-shadow-2xl leading-tight ${userPhoto ? 'text-7xl' : 'text-9xl'}`}>
              {participant.first_name}<br />{participant.last_name}
            </h1>
          </div>

          <div className="mb-12">
            <p className="text-4xl text-gray-400 uppercase tracking-widest mb-4">Finish Time</p>
            <p className="text-10xl font-black text-[#FFD700] drop-shadow-2xl leading-none">
              {formatChronoTime(participant.chip_time)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-16 text-white w-full max-w-5xl mb-16">
            <div>
              <p className="text-3xl text-gray-400 uppercase mb-3">Overall</p>
              <p className="text-8xl font-bold text-[#FFD700] leading-none">{participant.place || '—'}</p>
              <p className="text-2xl text-gray-400 mt-3">of {overallTotal}</p>
            </div>
            <div>
              <p className="text-3xl text-gray-400 uppercase mb-3">Gender</p>
              <p className="text-8xl font-bold text-[#FFD700] leading-none">{participant.gender_place || '—'}</p>
              <p className="text-2xl text-gray-400 mt-3">of {genderTotal}</p>
            </div>
            <div>
              <p className="text-3xl text-gray-400 uppercase mb-3">Division</p>
              <p className="text-8xl font-bold text-[#FFD700] leading-none">{participant.age_group_place || '—'}</p>
              <p className="text-2xl text-gray-400 mt-3">of {divisionTotal}</p>
            </div>
          </div>

          <div className="absolute bottom-28 right-12">
            <p className="text-white text-2xl font-bold mb-4 text-right">View Full Results</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(participantResultsUrl)}&margin=10&color=263238&bgcolor=FFFFFF`}
              alt="QR Code"
              className="w-52 h-52 border-8 border-white rounded-3xl shadow-2xl"
              crossOrigin="anonymous"
            />
          </div>

          <p className="text-4xl text-white italic mt-auto">
            Find your next race at www.youkeepmoving.com
          </p>
        </div>
      </div>

      {/* Visible Modal — Beautiful Square Instagram-Style Preview */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-auto my-8 p-8 relative max-h-screen overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-4xl font-light hover:bg-gray-100 transition"
          >
            ×
          </button>

          <h3 className="text-4xl font-bold text-center text-brand-dark mb-10">Your Result Card 🎉</h3>

          {/* Square Phone Frame — Perfect for 1080x1080 */}
          <div className="flex justify-center mb-12">
            <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-300 w-96 h-96">
              {/* Notch + Status Bar (optional polish) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-2xl z-10"></div>

              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                  className="w-[1080px] h-[1080px] origin-center rounded-2xl overflow-hidden shadow-2xl"
                  style={{
                    transform: 'scale(0.355)',
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Live Preview Card (exact duplicate of hidden one) */}
                  <div className="w-full h-full bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center px-12 pt-10 pb-16">
                    <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 mb-8">
                      {masterLogo ? (
                        <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-32 object-contain mx-auto" />
                      ) : bibLogo ? (
                        <img src={bibLogo} alt="Event Logo" className="max-w-full max-h-28 object-contain mx-auto" />
                      ) : (
                        <h2 className="text-5xl font-black text-brand-dark">{selectedEvent.name}</h2>
                      )}
                    </div>

                    <p className="text-4xl font-black text-accent mb-3">{raceDisplayName}</p>
                    <p className="text-3xl text-gray-300 mb-10">{formatDate(selectedEvent.start_time)}</p>

                    <div className={`flex items-center justify-center gap-20 mb-12 ${!userPhoto ? 'flex-col gap-10' : ''}`}>
                      {userPhoto && (
                        <div className="w-80 h-80 rounded-full overflow-hidden border-12 border-white shadow-2xl">
                          <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <h1 className={`font-black text-white drop-shadow-2xl leading-tight ${userPhoto ? 'text-7xl' : 'text-9xl'}`}>
                        {participant.first_name}<br />{participant.last_name}
                      </h1>
                    </div>

                    <div className="mb-12">
                      <p className="text-4xl text-gray-400 uppercase tracking-widest mb-4">Finish Time</p>
                      <p className="text-10xl font-black text-[#FFD700] drop-shadow-2xl leading-none">
                        {formatChronoTime(participant.chip_time)}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-16 text-white w-full max-w-5xl mb-16">
                      <div><p className="text-3xl text-gray-400 uppercase mb-3">Overall</p><p className="text-8xl font-bold text-[#FFD700] leading-none">{participant.place || '—'}</p><p className="text-2xl text-gray-400 mt-3">of {overallTotal}</p></div>
                      <div><p className="text-3xl text-gray-400 uppercase mb-3">Gender</p><p className="text-8xl font-bold text-[#FFD700] leading-none">{participant.gender_place || '—'}</p><p className="text-2xl text-gray-400 mt-3">of {genderTotal}</p></div>
                      <div><p className="text-3xl text-gray-400 uppercase mb-3">Division</p><p className="text-8xl font-bold text-[#FFD700] leading-none">{participant.age_group_place || '—'}</p><p className="text-2xl text-gray-400 mt-3">of {divisionTotal}</p></div>
                    </div>

                    <div className="absolute bottom-28 right-12">
                      <p className="text-white text-2xl font-bold mb-4 text-right">View Full Results</p>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(participantResultsUrl)}&margin=10&color=263238&bgcolor=FFFFFF`}
                        alt="QR Code"
                        className="w-52 h-52 border-8 border-white rounded-3xl shadow-2xl"
                      />
                    </div>

                    <p className="text-4xl text-white italic mt-auto">
                      Find your next race at www.youkeepmoving.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="mb-12 text-center">
            <p className="text-3xl font-bold mb-8">📸 Add Your Finish Line Photo!</p>
            <div className="flex justify-center gap-8 mb-8">
              <button onClick={triggerCamera} className="px-10 py-5 bg-primary text-white font-bold text-xl rounded-full hover:bg-primary/90 transition shadow-lg">
                📷 Take Photo
              </button>
              <button onClick={triggerGallery} className="px-10 py-5 bg-brand-dark text-white font-bold text-xl rounded-full hover:bg-brand-dark/90 transition shadow-lg">
                🖼️ Choose from Gallery
              </button>
            </div>
            {userPhoto && (
              <div className="inline-block">
                <img src={userPhoto} alt="Your photo" className="w-40 h-40 object-cover rounded-full shadow-2xl border-4 border-white mb-4" />
                <button onClick={removePhoto} className="text-primary font-semibold underline">
                  Remove Photo
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-8 mb-12">
            <button onClick={generateResultCard} className="px-12 py-6 bg-primary text-white font-bold text-2xl rounded-full hover:bg-primary/90 transition shadow-2xl">
              {isMobileDevice ? 'Save to Photos' : 'Download Image'}
            </button>
            <button onClick={shareResultCard} className="px-12 py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-2xl rounded-full hover:opacity-90 transition shadow-2xl">
              Share Now
            </button>
          </div>

          {/* Social Share */}
          <div className="text-center">
            <p className="text-2xl font-bold text-brand-dark mb-6">Or Share Directly</p>
            <div className="flex justify-center gap-6 flex-wrap">
              <button onClick={shareOnFacebook} className="px-8 py-4 bg-[#1877F2] text-white font-bold text-lg rounded-full hover:opacity-90 flex items-center gap-3 shadow-lg">
                <span className="text-3xl">f</span> Facebook
              </button>
              <button onClick={shareOnX} className="px-8 py-4 bg-black text-white font-bold text-lg rounded-full hover:opacity-90 flex items-center gap-3 shadow-lg">
                <span className="text-3xl">𝕏</span> X
              </button>
              <button onClick={shareOnInstagram} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-full hover:opacity-90 flex items-center gap-3 shadow-lg">
                <span className="text-3xl">📸</span> Instagram
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}