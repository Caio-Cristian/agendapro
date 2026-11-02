import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ToastProvider } from './components/ToastProvider'
import { AuthPage, PasswordResetPage } from './pages/AuthPage'
import { PublicSite } from './pages/PublicSite'
import { Workspace } from './pages/Workspace'

function NotFound() {
  return (
    <main className="not-found">
      <span className="not-found-code">404</span>
      <h1>Este caminho ainda não existe.</h1>
      <p>Mas sua próxima reserva está a poucos cliques de distância.</p>
      <a className="button button-dark" href="/">
        Voltar ao início <span aria-hidden="true">→</span>
      </a>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<PublicSite />} />
            <Route path="/entrar" element={<AuthPage mode="login" />} />
            <Route path="/cadastro" element={<AuthPage mode="signup" />} />
            <Route path="/app/*" element={<Workspace />} />
            <Route path="/redefinir-senha" element={<PasswordResetPage />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
