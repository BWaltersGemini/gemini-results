// src/components/QuoteForm.jsx
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import emailjs from 'emailjs-com';
import ReCAPTCHA from 'react-google-recaptcha';

export default function QuoteForm() {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [estimate, setEstimate] = useState(null);
  const [success, setSuccess] = useState(false);
  const [captcha, setCaptcha] = useState(null);

  const calculate = (data) => {
    let total = 0;
    const runners = parseInt(data.participants) || 0;

    if (data.shirtsQty > 0) {
      const price = data.shirtType === 'driFit' ? 14 : data.shirtType === 'blend' ? 11 : 9;
      total += data.shirtsQty * price;
    }
    if (data.medalsQty > 0) {
      const price = data.medalSize === '5' ? 7.5 : data.medalSize === '4' ? 5.5 : 4.5;
      total += data.medalsQty * price;
    }
    if (data.printSqFt) total += parseFloat(data.printSqFt) * 4.25;

    const base = { triathlon:1800, mudrun:1500, swim:1200, paddle:1200, run:900, other:900 }[data.eventType || 'run'];
    total += base + runners * 1.75;

    if (data.sound) total += 450;
    if (data.arch) total += 350;
    if (data.truss30) total += 1200;
    if (data.truss15) total += 750;
    if (data.dataFeed) total += 200;
    if (data.checkIn) total += 600;
    if (data.tracking) total += runners * 4;

    return Math.round(total);
  };

  const onSubmit = (data) => {
    if (!captcha) return alert('Please complete the reCAPTCHA');
    const total = calculate(data);
    setEstimate(total);
    data.estimate = total;

    emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', { ...data, 'g-recaptcha-response': captcha }, 'YOUR_USER_ID')
      .then(() => { setSuccess(true); reset(); setCaptcha(null); })
      .catch(() => alert('Failed – check console'));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl mx-auto bg-white p-10 rounded-2xl shadow-2xl space-y-10">
      <h2 className="text-4xl font-bold text-center text-gemini-dark-gray">Get Your Custom Quote</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <input {...register('eventName', { required: true })} placeholder="Event Name *" className="p-4 border rounded-lg" />
        <input {...register('email', { required: true, pattern: /^\S+@\S+$/i })} placeholder="Your Email *" className="p-4 border rounded-lg" />
        <input {...register('eventDate', { required: true })} type="date" className="p-4 border rounded-lg" />
        <input {...register('eventWebsite')} placeholder="Event Website (optional)" className="p-4 border rounded-lg" />
      </div>

      <input {...register('participants', { required: true })} type="number" placeholder="Expected Participants *" className="w-full p-4 border rounded-lg" />

      <select {...register('eventType', { required: true })} className="w-full p-4 border rounded-lg">
        <option value="run">Run / Walk</option>
        <option value="triathlon">Triathlon</option>
        <option value="mudrun">Mud Run / OCR</option>
        <option value="swim">Open Water Swim</option>
        <option value="paddle">Paddleboard / SUP</option>
        <option value="other">Other</option>
      </select>

      <div className="border-t pt-8">
        <h3 className="text-2xl font-bold mb-4">Shirts (optional)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input {...register('shirtsQty')} type="number" placeholder="Quantity" className="p-4 border rounded-lg" />
          <select {...register('shirtType')} className="p-4 border rounded-lg">
            <option value="cotton">Cotton – $9</option>
            <option value="blend">Poly Blend – $11</option>
            <option value="driFit">Dri-Fit – $14</option>
          </select>
        </div>
      </div>

      <div className="border-t pt-8">
        <h3 className="text-2xl font-bold mb-4">Finisher Medals (optional)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input {...register('medalsQty')} type="number" placeholder="Quantity" className="p-4 border rounded-lg" />
          <select {...register('medalSize')} className="p-4 border rounded-lg">
            <option value="3">3″ – $4.50</option>
            <option value="4">4″ – $5.50</option>
            <option value="5">5″ – $7.50</option>
          </select>
        </div>
      </div>

      <div className="border-t pt-8">
        <h3 className="text-2xl font-bold mb-4">Printing</h3>
        <input {...register('printSqFt')} type="number" step="0.1" placeholder="Total square footage (optional)" className="w-full p-4 border rounded-lg" />
      </div>

      <div className="border-t pt-8">
        <h3 className="text-2xl font-bold mb-4">Timing Add-ons</h3>
        <div className="grid md:grid-cols-2 gap-4 text-lg">
          <label><input type="checkbox" {...register('sound')} className="mr-2" /> Sound System (+$450)</label>
          <label><input type="checkbox" {...register('arch')} className="mr-2" /> Inflatable Arch (+$350)</label>
          <label><input type="checkbox" {...register('truss30')} className="mr-2" /> 30' Truss (+$1200)</label>
          <label><input type="checkbox" {...register('truss15')} className="mr-2" /> 15' Truss (+$750)</label>
          <label><input type="checkbox" {...register('dataFeed')} className="mr-2" /> Live Announcer Feed (+$200)</label>
          <label><input type="checkbox" {...register('tracking')} className="mr-2" /> Athlete Tracking ($4/runner)</label>
          <label><input type="checkbox" {...register('checkIn')} className="mr-2" /> Pre-Race Check-in (+$600)</label>
        </div>
      </div>

      <div className="flex justify-center my-8">
        <ReCAPTCHA sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" onChange={setCaptcha} />
      </div>

      <button type="submit" className="w-full bg-gemini-red text-white py-6 rounded-full text-2xl font-bold hover:bg-gemini-red/90">
        Send Quote Request → See Estimate
      </button>

      {estimate !== null && <div className="text-center text-4xl font-bold text-gemini-blue mt-10">Estimated Total: ${estimate.toLocaleString()}</div>}
      {success && <p className="text-center text-green-600 text-xl mt-6">Quote sent! We'll contact you soon.</p>}
    </form>
  );
}