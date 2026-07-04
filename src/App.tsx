import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Upload } from './pages/Upload';
import { Analyze } from './pages/Analyze';
import { Review } from './pages/Review';
import { Export } from './pages/Export';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Re-route index to the upload step */}
          <Route index element={<Navigate to="/upload" replace />} />
          <Route path="upload" element={<Upload />} />
          <Route path="analyze" element={<Analyze />} />
          <Route path="review" element={<Review />} />
          <Route path="export" element={<Export />} />
          {/* Fallback to start if route is invalid */}
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
