import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthProvider'
import { AuthPage } from './AuthPage'

function renderSignup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AuthPage mode="signup" />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('registration flow', () => {
  it('requires a valid name, email and password', async () => {
    const user = userEvent.setup()
    renderSignup()
    await user.click(screen.getByRole('button', { name: /criar minha conta/i }))
    expect(await screen.findByText('Informe seu nome completo')).toBeInTheDocument()
    expect(await screen.findByText('Informe um e-mail válido')).toBeInTheDocument()
    expect(await screen.findByText('A senha deve ter pelo menos 8 caracteres')).toBeInTheDocument()
  })

  it('supports optional business onboarding and reports missing Supabase configuration', async () => {
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByLabelText(/nome completo/i), 'Marina Costa')
    await user.type(screen.getByLabelText(/nome do estabelecimento/i), 'Studio Aurora')
    await user.type(screen.getByLabelText(/e-mail/i), 'marina@example.com')
    await user.type(screen.getByLabelText(/^senha$/i), 'senha-segura-123')
    await user.click(screen.getByRole('button', { name: /criar minha conta/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O acesso ao banco ainda não está configurado',
    )
  })
})
