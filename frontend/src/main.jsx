import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ViewportProvider } from './context/ViewportContext.jsx';
import './styles/app.css';
import './styles/print.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ViewportProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ViewportProvider>
    </BrowserRouter>
  </React.StrictMode>
);
