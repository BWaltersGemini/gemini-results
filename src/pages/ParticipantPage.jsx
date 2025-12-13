// src/pages/ParticipantPage.jsx (updated with multiple variants, previews, and selection)
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';

export default function ParticipantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { participant, selectedMasterEvent, selectedYear, selectedEvent, eventLogos, results, ads, selectedMasterId } = location.state || {};
  const [previews, setPreviews] = useState([]); // Array of preview URLs for each variant
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0); // Index of selected variant

  const goBackToResults = () => {
    navigate(-1);
  };

  if (!participant) {
    return <p className="text-center text-xl text-gemini-red pt-40">No participant data available.</p>;
  }

  const overallTotal = results.length;
  const genderTotal = results.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.filter(r => r.age_group_name === participant.age_group_name).length;

  // Define certificate variants as an array of style configs
  const variants = [
    // Variant 1: Bold Badge Style (square for social)
    {
      containerStyle: {
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, #FFD700, #FF8C00)',
        padding: '40px',
        textAlign: 'center',
        position: 'relative',
        fontFamily: "'Arial Black', sans-serif",
        borderRadius: '50%',
        boxShadow: '0 0 20px rgba(255,165,0,0.5)'
      },
      watermarkStyle: {
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '40%',
        opacity: 0.8
      },
      contentStyle: {
        position: 'relative',
        zIndex: 1,
        marginTop: '150px'
      },
      content: (
        <>
          <h2 style={{ fontSize: '36px', color: '#FFFFFF', textShadow: '2px 2px 4px #000' }}>I Finished!</h2>
          <p style={{ fontSize: '28px', color: '#FFFFFF' }}>{participant.first_name} {participant.last_name}</p>
          <p style={{ fontSize: '20px', color: '#FFF' }}>{selectedEvent.name} - {selectedYear.formatted}</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#000' }}>Time: {participant.chip_time}</p>
          <p style={{ fontSize: '16px', color: '#FFF', marginTop: '20px' }}>#RaceFinisher #ProudMoment</p>
        </>
      )
    },
    // Variant 2: Story Card with Quote (vertical)
    {
      containerStyle: {
        width: '400px',
        height: '800px',
        background: 'linear-gradient(to bottom, #2196F3, #673AB7)',
        padding: '30px',
        textAlign: 'center',
        position: 'relative',
        fontFamily: "'Roboto', sans-serif",
        borderRadius: '20px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
      },
      watermarkStyle: {
        position: 'absolute',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '50%',
        opacity: 0.2
      },
      contentStyle: {
        position: 'relative',
        zIndex: 1
      },
      content: (
        <>
          <h2 style={{ fontSize: '32px', color: '#FFFFFF', marginBottom: '20px' }}>Epic Finish!</h2>
          <p style={{ fontSize: '26px', color: '#FFEB3B' }}>{participant.first_name} {participant.last_name}</p>
          <p style={{ fontSize: '18px', color: '#FFF' }}>{selectedEvent.name}</p>
          <p style={{ fontSize: '18px', color: '#FFF' }}>{selectedYear.formatted}</p>
          <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#FFEB3B' }}>Time: {participant.chip_time}</p>
          <p style={{ fontSize: '16px', color: '#FFF', fontStyle: 'italic', marginTop: '40px' }}>"The finish line is just the beginning of a whole new race."</p>
          <p style={{ fontSize: '14px', color: '#FFF', marginTop: '20px' }}>Share your story! #FinisherVibes</p>
        </>
      )
    },
    // Variant 3: Minimalist Share Card
    {
      containerStyle: {
        width: '600px',
        height: '600px',
        background: '#FFFFFF',
        padding: '50px',
        textAlign: 'center',
        position: 'relative',
        fontFamily: "'Montserrat', sans-serif",
        border: '3px solid #4CAF50',
        boxShadow: '0 0 10px rgba(76,175,80,0.4)',
        borderRadius: '10px'
      },
      watermarkStyle: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        maxWidth: '100px',
        opacity: 0.7
      },
      contentStyle: {
        position: 'relative',
        zIndex: 1,
        marginTop: '100px'
      },
      content: (
        <>
          <h2 style={{ fontSize: '40px', color: '#4CAF50', marginBottom: '20px' }}>Race Finisher 🏅</h2>
          <p style={{ fontSize: '30px', color: '#212121' }}>{participant.first_name} {participant.last_name}</p>
          <p style={{ fontSize: '20px', color: '#757575' }}>{selectedEvent.name} • {selectedYear.formatted}</p>
          <p style={{ fontSize: '26px', fontWeight: 'bold', color: '#4CAF50', marginTop: '20px' }}>Time: {participant.chip_time}</p>
          <p style={{ fontSize: '18px', color: '#757575', marginTop: '30px' }}>Proud Moment! Share with #MyRaceWin</p>
        </>
      )
    },
    // Variant 4: Fun Emoji Burst
    {
      containerStyle: {
        width: '500px',
        height: '500px',
        background: 'linear-gradient(to top, #FFEB3B, #FFC107)',
        padding: '30px',
        textAlign: 'center',
        position: 'relative',
        fontFamily: "'Comic Sans MS', cursive",
        borderRadius: '25px',
        boxShadow: '0 0 15px rgba(255,193,7,0.5)'
      },
      watermarkStyle: {
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '80px',
        opacity: 0.6
      },
      contentStyle: {
        position: 'relative',
        zIndex: 1
      },
      content: (
        <>
          <h2 style={{ fontSize: '38px', color: '#FFFFFF', marginBottom: '15px' }}>You Crushed It! 🎉🏃‍♂️</h2>
          <p style={{ fontSize: '28px', color: '#212121' }}>{participant.first_name} {participant.last_name}</p>
          <p style={{ fontSize: '18px', color: '#424242' }}>{selectedEvent.name}</p>
          <p style={{ fontSize: '18px', color: '#424242' }}>{selectedYear.formatted}</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF5722' }}>Time: {participant.chip_time} ⏱️</p>
          <p style={{ fontSize: '16px', color: '#FFF', marginTop: '25px' }}>Tag your crew! #RaceDayVibes</p>
        </>
      )
    },
    // Variant 5: Stats-Focused Infographic (landscape)
    {
      containerStyle: {
        width: '600px',
        height: '400px',
        background: '#F5F5F5',
        padding: '30px',
        textAlign: 'left',
        position: 'relative',
        fontFamily: "'Open Sans', sans-serif",
        borderRadius: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      },
      watermarkStyle: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        maxWidth: '80px',
        opacity: 0.8
      },
      contentStyle: {
        position: 'relative',
        zIndex: 1
      },
      content: (
        <>
          <h2 style={{ fontSize: '32px', color: '#2196F3', marginBottom: '15px' }}>Race Stats Card</h2>
          <p style={{ fontSize: '24px', color: '#333' }}>{participant.first_name} {participant.last_name}</p>
          <p style={{ fontSize: '16px', color: '#666' }}>{selectedEvent.name} • {selectedYear.formatted}</p>
          <div style={{ marginTop: '20px', fontSize: '18px', color: '#2196F3' }}>
            <p>Time: {participant.chip_time} 🏅</p>
            <p>Overall: {participant.place}/{overallTotal}</p>
            <p>Gender: {participant.gender_place}/{genderTotal}</p>
            <p>Division: {participant.age_group_place}/{divisionTotal}</p>
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '20px', textAlign: 'center' }}>Share your achievement! #FitnessGoals</p>
        </>
      )
    }
  ];

  useEffect(() => {
    const generatePreviews = async () => {
      const previewUrls = [];
      for (let i = 0; i < variants.length; i++) {
        const certificate = document.getElementById(`certificate-variant-${i}`);
        const canvas = await html2canvas(certificate, {
          scale: 1, // Lower scale for previews to improve performance
          onclone: (clonedDocument) => {
            clonedDocument.getElementById(`certificate-variant-${i}`).style.display = 'block';
          }
        });
        previewUrls.push(canvas.toDataURL('image/png'));
      }
      setPreviews(previewUrls);
    };
    setTimeout(generatePreviews, 0);
  }, [variants]);

  const shareCertificate = async () => {
    const selectedUrl = previews[selectedPreviewIndex];
    if (!selectedUrl) return;
  
    try {
      const response = await fetch(selectedUrl);
      const blob = await response.blob();
      const file = new File([blob], 'finishers-graphic.png', { type: 'image/png' });
    
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Finisher Graphic',
          text: `Check out my finisher graphic for ${selectedMasterEvent.name}!`,
          files: [file],
        });
      } else {
        downloadCertificate();
      }
    } catch (err) {
      console.error('Share failed:', err);
      downloadCertificate();
    }
  };
  const downloadCertificate = () => {
    const selectedUrl = previews[selectedPreviewIndex];
    if (!selectedUrl) return;
    const link = document.createElement('a');
    link.download = 'finishers-graphic.png';
    link.href = selectedUrl;
    link.click();
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">
        {/* Race Header */}
        <div className="text-center mb-8">
          <img
            src={eventLogos[selectedMasterId] || '/GRR.png'}
            alt="Race Logo"
            className="mx-auto max-h-24 mb-4 rounded-full shadow-md"
          />
          <h2 className="text-3xl font-bold text-gemini-dark-gray">{selectedMasterEvent.name}</h2>
          <p className="text-lg text-gray-600 italic">{selectedYear.formatted} - {selectedEvent.name}</p>
        </div>
        {/* Participant Name */}
        <h3 className="text-5xl font-extrabold mb-8 text-center text-gemini-blue drop-shadow-md">
          {participant.first_name} {participant.last_name}
        </h3>
        {/* BIB and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="flex justify-center">
            <div className="bg-gemini-blue/90 text-white border-4 border-gemini-dark-gray rounded-xl p-6 text-center w-64 h-48 flex flex-col justify-center items-center shadow-xl font-mono transform hover:scale-105 transition">
              <p className="text-sm uppercase tracking-wider font-bold mb-2">BIB</p>
              <p className="text-7xl font-black">{participant.bib || '—'}</p>
            </div>
          </div>
          <div className="bg-gemini-light-gray rounded-2xl p-6 shadow-md">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-lg">
              <dt className="font-semibold text-gemini-dark-gray">Time</dt>
              <dd className="font-bold text-gemini-blue">{participant.chip_time || '—'}</dd>
              <dt className="font-semibold text-gemini-dark-gray">Pace</dt>
              <dd className="font-bold text-gemini-blue">{participant.pace || '—'}</dd>
              <dt className="font-semibold text-gemini-dark-gray">Age</dt>
              <dd className="font-bold text-gemini-blue">{participant.age || '—'}</dd>
              <dt className="font-semibold text-gemini-dark-gray">Gender</dt>
              <dd className="font-bold text-gemini-blue">{participant.gender === 'M' ? 'Male' : 'Female'}</dd>
              <dt className="font-semibold text-gemini-dark-gray">Division</dt>
              <dd className="font-bold text-gemini-blue">{participant.age_group_name || '—'}</dd>
            </dl>
          </div>
        </div>
        {/* Placement */}
        <p className="text-center mb-12 text-2xl font-semibold text-gemini-blue bg-gemini-light-gray py-4 rounded-xl shadow-inner">
          {participant.place || '—'} / {overallTotal} Overall • {participant.gender_place || '—'} / {genderTotal} {participant.gender === 'M' ? 'Men' : 'Women'} • {participant.age_group_place || '—'} / {divisionTotal} {participant.age_group_name}
        </p>
        {/* Previews Section - Horizontal Scroll */}
        {previews.length > 0 ? (
          <div className="mt-4 mb-12 bg-gemini-light-gray rounded-2xl p-8 shadow-lg">
            <h4 className="text-2xl font-bold mb-4 text-center text-gemini-dark-gray">Choose Your Favorite Graphic</h4>
            <div className="flex overflow-x-auto space-x-6 pb-4 snap-x snap-mandatory"> {/* Horizontal scroll */}
              {previews.map((url, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 cursor-pointer snap-center ${selectedPreviewIndex === index ? 'border-4 border-gemini-blue shadow-xl' : 'border border-gray-300 shadow-md'} rounded-xl overflow-hidden transform hover:scale-105 transition`}
                  onClick={() => setSelectedPreviewIndex(index)}
                >
                  <img src={url} alt={`Graphic Variant ${index + 1}`} className="w-64 h-auto" /> {/* Adjust width for previews */}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-center text-gray-600 text-lg">Generating previews...</p>
        )}
        {/* Buttons */}
        <div className="flex flex-wrap justify-center gap-6 mt-8 mb-16">
          <button onClick={shareCertificate} className="bg-gemini-blue text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-gemini-blue/80 shadow-md transform hover:scale-105 transition">
            Share Selected
          </button>
          <button onClick={downloadCertificate} className="bg-green-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-green-700 shadow-md transform hover:scale-105 transition">
            Download Selected
          </button>
          <button onClick={goBackToResults} className="bg-gray-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-700 shadow-md transform hover:scale-105 transition">
            Back to Results
          </button>
        </div>
        {/* Advertisements */}
        <h3 className="text-3xl font-bold mb-6 text-center text-gemini-blue">Featured Sponsors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ads.map((ad, index) => (
            <img key={index} src={ad} alt={`Sponsor ${index + 1}`} className="w-full rounded-2xl shadow-md hover:shadow-xl transition" />
          ))}
        </div>
        {/* Hidden certificate templates - one for each variant */}
        {variants.map((variant, index) => (
          <div
            key={index}
            id={`certificate-variant-${index}`}
            style={{ ...variant.containerStyle, display: 'none' }}
          >
            {eventLogos[selectedMasterId] && (
              <img
                src={eventLogos[selectedMasterId]}
                alt="Race Logo Watermark"
                style={variant.watermarkStyle}
              />
            )}
            <div style={variant.contentStyle}>
              {variant.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}