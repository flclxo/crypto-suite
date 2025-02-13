// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import SignUp from './SignUp';
import Login from './Login';
import Dashboard from './Dashboard'; 

const App = () => {
  const isAuthenticated = localStorage.getItem('authenticated') === 'true';

  return (
    <Router>
      <Routes>
        {/* redirect root path to /signup */}
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        {/* alll route to redirect to SignUp */}
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </Router>
  );
};

export default App;

