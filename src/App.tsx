import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { CafeProvider } from './contexts/CafeContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Solver } from './pages/Solver';
import { PuzzleShare } from './pages/PuzzleShare';
import { WordArtExport } from './pages/WordArt';
import { Layout } from './components/Layout';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
};

function App() {
  return (
    <LanguageProvider>
      <HelmetProvider>
        <AuthProvider>
          <ConfirmProvider>
            <CafeProvider>
              <Router>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route
                      path="/editor/:id"
                      element={
                        <ProtectedRoute>
                          <Editor />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/play/:slugOrId" element={<Solver />} />
                    <Route path="/p/:slugOrId" element={<PuzzleShare />} />
                    <Route
                      path="/wordart/:id"
                      element={
                        <ProtectedRoute>
                          <WordArtExport />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </Layout>
              </Router>
              <Toaster richColors closeButton position="top-center" theme="dark" />
            </CafeProvider>
          </ConfirmProvider>
        </AuthProvider>
      </HelmetProvider>
    </LanguageProvider>
  );
}

export default App;
