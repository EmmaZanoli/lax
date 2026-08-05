import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components';
import { Backup, Banco, Import, Magazzino, Prodotti, Recap } from './screens';
import { useUnloadGuard } from './lib';

export function App() {
  useUnloadGuard();

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Default su /banco. */}
        <Route index element={<Navigate to="/banco" replace />} />
        <Route path="import" element={<Import />} />
        <Route path="banco" element={<Banco />} />
        <Route path="magazzino" element={<Magazzino />} />
        <Route path="recap" element={<Recap />} />
        <Route path="prodotti" element={<Prodotti />} />
        <Route path="backup" element={<Backup />} />
        {/* Qualsiasi rotta sconosciuta torna al banco. */}
        <Route path="*" element={<Navigate to="/banco" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
