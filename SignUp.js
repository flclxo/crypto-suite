// Signup.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // reset error
    try {
      const response = await fetch('http://localhost:5001/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        console.log("Successfully created account");
        alert('Account created successfully! Please log in.');
        navigate('/login');
      } else {
        const errorData = await response.json();
        console.error('Signup failed:', errorData.error);
        setError(errorData.error || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup failed:', error.message);
      setError('An error occurred. Please try again later.');
    }
  };

  return (
    <section>
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Create Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Sign Up</button>
      </form>
      <Link to="/login">Back to Login Page</Link>
    </section>
  );
};

export default Signup;
