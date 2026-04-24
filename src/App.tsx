import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Solver } from './pages/Solver';
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
          </Routes>
        </Layout>
      </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
