import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Alerts from './pages/Alerts';
import Decisions from './pages/Decisions';
import Machines from './pages/Machines';
import Bouncers from './pages/Bouncers';
import Allowlists from './pages/Allowlists';

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
        <Route path="*" element={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h2 className="text-xl font-bold">Page Not Found</h2>
            <p className="text-muted-foreground mt-2">The page you're looking for doesn't exist.</p>
            <a href="/overview" className="mt-4 text-primary underline">Go to Overview</a>
          </div>
        } />
      </Route>
    </Routes>
  );
}
