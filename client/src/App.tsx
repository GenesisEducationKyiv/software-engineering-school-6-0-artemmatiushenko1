/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SubscribePage from './pages/SubscribePage';
import SentPage from './pages/SentPage';
import ConfirmPage from './pages/ConfirmPage';
import UnsubscribePage from './pages/UnsubscribePage';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<SubscribePage />} />
          <Route path="/sent" element={<SentPage />} />
          <Route path="/confirm/:token" element={<ConfirmPage />} />
          <Route path="/unsubscribe/:token" element={<UnsubscribePage />} />
        </Routes>
      </Layout>
      <Toaster position="top-center" />
    </Router>
  );
}
