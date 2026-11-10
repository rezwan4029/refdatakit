import { Routes, Route } from 'react-router-dom'
import IndexPage from './pages/IndexPage'
import CountryPage from './pages/CountryPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/country/:cc" element={<CountryPage />} />
    </Routes>
  )
}
