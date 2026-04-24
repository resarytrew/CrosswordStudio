import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { CafeProvider } from './contexts/CafeContext';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Solver } from './pages/Solver';
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
      <AuthProvider>
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
                <Route path="/play/:id" element={<Solver />} />
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
        </CafeProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;