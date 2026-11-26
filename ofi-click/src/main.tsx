import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Google Maps Platform Case A quota/auth runtime error listeners
if (typeof window !== 'undefined') {
  const win = window as unknown as {
    gm_authFailure?: () => void;
    __oficlickGmpQuotaFlag?: boolean;
  };
  win.gm_authFailure = () => {
    win.__oficlickGmpQuotaFlag = true;
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    origConsoleError.apply(console, args);
    const first = args[0];
    if (typeof first === 'string' && first.includes('OverQuotaMapError')) {
      win.__oficlickGmpQuotaFlag = true;
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
