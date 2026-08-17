import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Alerts from './pages/Alerts';
import Decisions from './pages/Decisions';
import Machines from './pages/Machines';
import Bouncers from './pages/Bouncers';
import Allowlists from './pages/Allowlists';
import Metrics from './pages/Metrics';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/decisions" element={<Decisions />} />
        <Route path="/machines" element={<Machines />} />
        <Route path="/bouncers" element={<Bouncers />} />
        <Route path="/allowlists" element={<Allowlists />} />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="*" element={
          <div className="rounded-md border border-[#232334] bg-[#0f0f17] px-6 py-12 text-center">
            <h2 className="text-sm font-semibold tracking-tight text-white">Not found</h2>
            <p className="mono mt-2 text-xs text-zinc-500">That page doesn't exist.</p>
            <a href="/overview" className="mono mt-4 inline-flex min-h-[32px] items-center text-xs text-zinc-300 underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090f]">Back to overview</a>
          </div>
        } />
      </Route>
    </Routes>
  );
}
