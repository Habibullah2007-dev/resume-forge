import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Upload } from './pages/Upload';
import { Analyze } from './pages/Analyze';
import { Review } from './pages/Review';
import { Export } from './pages/Export';
import { Login } from './pages/Login';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Public auth route */}
            <Route path="login" element={<Login />} />

            {/* Protected routes */}
            <Route path="upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
            <Route path="analyze" element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
            <Route path="review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
            <Route path="export" element={<ProtectedRoute><Export /></ProtectedRoute>} />

            {/* Re-route index to upload */}
            <Route index element={<Navigate to="/upload" replace />} />
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
