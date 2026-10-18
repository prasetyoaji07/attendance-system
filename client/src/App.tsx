import { Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* TODO: tambah route per fitur (login, jadwal, pengajuan, approval, dashboard) */}
    </Routes>
  );
}
