import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <span className="text-xl font-bold text-slate-900">Balito</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Shift handover,
            <br />
            <span className="text-blue-600">simplified.</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            Log status, flag issues, and hand over to the next shift. Built for small factories, workshops, and 24/7 operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
            >
              Start for Free
            </Link>
            <Link
              href="#features"
              className="border border-slate-300 text-slate-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-slate-50 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Preview Mockup */}
        <div className="mt-20 w-full max-w-4xl">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 bg-slate-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-slate-500 mb-2">Current Shift</div>
                  <div className="text-2xl font-bold text-slate-900">Day Shift</div>
                  <div className="text-sm text-slate-600 mt-1">8:00 AM - 4:00 PM</div>
                </div>
                <div className="col-span-2 bg-slate-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-slate-500 mb-2">Latest Handover</div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-start gap-2">
                      <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded">Urgent</span>
                      <p className="text-slate-700">Machine #3 showing unusual vibration. Maintenance scheduled for tomorrow.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Everything you need for smooth shift changes
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Easy Notes</h3>
              <p className="text-slate-600">Log what happened during your shift in seconds. Rich text with priorities.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚨</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Issue Flags</h3>
              <p className="text-slate-600">Mark urgent issues that need immediate attention. Never miss critical handovers.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Team Access</h3>
              <p className="text-slate-600">Everyone on the team sees the same info. No more lost paper notes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200">
        <div className="max-w-5xl mx-auto text-center text-slate-500 text-sm">
          &copy; 2024 Balito. Built for shift teams.
        </div>
      </footer>
    </div>
  );
}
