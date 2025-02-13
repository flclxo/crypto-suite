// login.js
import React, { useState } from 'react';
import './Auth.css';
import { Link, useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async(e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://localhost:5001/login', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ username, password }),
      });

      if(response.ok) {
        const data = await response.json();
        localStorage.setItem("authenticated", "true");
        localStorage.setItem("token", data.token);
        // redirect to dashboard after login
        navigate('/dashboard');
      } else {
        const errorMsg = await response.json();
        console.error('Login failed:', errorMsg.error);
        setError(errorMsg.error || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Error:', error.message);
      setError('An error occurred. Please try again later.');
    }
  };

  return (
    <section>
      <h1>Login</h1>
      <form id="loginForm" onSubmit={handleLogin}>
        {error && <p className="error">{error}</p>}
        <div>
          <input
            type="text"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            required
            placeholder="Username"
          />
        </div>

        <div>
          <input
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
            placeholder="Password"
          />
        </div>

        <div id="login">
          <button type="submit">Submit</button>
        </div>
      </form>
      <Link to="/signup">Create Account</Link>
    </section>
  );
}

export default Login;
