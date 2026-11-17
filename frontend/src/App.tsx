import { Route, Routes } from 'react-router'
import Layout from './components/Layout.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import AuthPage from './pages/AuthPage.tsx'
import CatalogPage from './pages/CatalogPage.tsx'
import CollectionPage from './pages/CollectionPage.tsx'
import EntryPage from './pages/EntryPage.tsx'
import ItemPage from './pages/ItemPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'

/** Route table. Every page renders inside Layout (header + main area). */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="items/:slug" element={<ItemPage />} />
        <Route
          path="collection"
          element={
            <RequireAuth>
              <CollectionPage />
            </RequireAuth>
          }
        />
        <Route
          path="collection/:entryId"
          element={
            <RequireAuth>
              <EntryPage />
            </RequireAuth>
          }
        />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
