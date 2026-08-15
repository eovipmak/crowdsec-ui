import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        {/* task-10 adds: /overview /alerts /decisions /machines /bouncers /allowlists */}
        <Route path="*" element={<div className="p-8">Page not found</div>} />
      </Route>
    </Routes>
  );
}
