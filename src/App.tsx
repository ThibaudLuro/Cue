import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Landing } from './pages/Landing'
import { Tool } from './pages/Tool'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Tool />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
