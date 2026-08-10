import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import logoImg from '../logo/logoo2.png';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('Manager@Rsaconstruction.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="toggle-row" style={{ justifyContent: 'flex-end', marginBottom: 0 }}>
          <select className="lang-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="ta">தமிழ்</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '6px 0', alignSelf: 'center' }}>
          <div style={{ width: '170px', height: '76px', overflow: 'hidden', position: 'relative' }}>
            <img 
              src={logoImg} 
              alt="RSA Logo" 
              style={{ 
                width: '170px', 
                height: 'auto', 
                position: 'absolute',
                top: 0,
                left: 0,
                filter: 'invert(1) hue-rotate(180deg)' 
              }} 
            />
          </div>
          <div style={{ 
            marginTop: '6px', 
            fontSize: '9.5px', 
            fontWeight: 'bold', 
            letterSpacing: '3.5px', 
            textTransform: 'uppercase', 
            textAlign: 'center', 
            color: '#ffffff',
            opacity: 0.95 
          }}>
            <div>CONSTRUCTION &amp;</div>
            <div style={{ marginTop: '2px' }}>BUILDING MATERIALS</div>
          </div>
        </div>
        <h1>{t('login.title')}</h1>
        <p className="login-sub">{t('login.subtitle')}</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>{t('login.email')}</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>{t('login.password')}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('login.signingIn') : t('login.signIn')}
        </button>
      </form>
    </div>
  );
}
