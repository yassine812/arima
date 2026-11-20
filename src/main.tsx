import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AtelierExperience from './components/AtelierExperience';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtelierExperience><App /></AtelierExperience>
  </StrictMode>,
);
