import QuoteForm from '../components/QuoteForm'; // We'll create this next

export default function Services() {
  return (
    <div className="min-h-screen bg-gemini-light-gray pt-20 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-5xl font-bold text-center mb-16 text-gemini-dark-gray">Get a Custom Quote</h1>
        <QuoteForm />
      </div>
    </div>
  );
}