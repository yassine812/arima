import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AtelierExperience from './components/AtelierExperience';
import './index.css';
import './mobile.css';
import './invoice-stationery.css';
import './order-receipt.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtelierExperience><App /></AtelierExperience>
  </StrictMode>,
);
