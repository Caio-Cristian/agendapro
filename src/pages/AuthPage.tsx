import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CalendarCheck2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import {
  signInSchema,
  signUpSchema,
  type SignInValues,
  type SignUpFormInput,
  type SignUpValues,
} from '../schemas/auth'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup'
  const { session } = useAuth()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')

  if (session) return <Navigate to="/app" replace />

  const onSignup = async (values: SignUpValues) => {
    setErrorMessage('')
    setNotice('')
    if (!supabase) {
      setErrorMessage(
        'O acesso ao banco ainda não está configurado. Adicione as variáveis do Supabase para continuar.',
      )
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: values.business_name
          ? { full_name: values.full_name, business_name: values.business_name }
          : { full_name: values.full_name },
      },
    })
    if (error) setErrorMessage(error.message)
    else if (data.session) navigate('/app')
    else
      setNotice(
        'Conta criada. Verifique seu e-mail para confirmar o cadastro e depois entre na plataforma.',
      )
  }

  const onLogin = async (values: SignInValues) => {
    setErrorMessage('')
    setNotice('')
    if (!supabase) {
      setErrorMessage(
        'O acesso ao banco ainda não está configurado. Adicione as variáveis do Supabase para continuar.',
      )
      return
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (error) setErrorMessage('Não foi possível entrar. Confira seu e-mail e senha.')
    else navigate('/app')
  }

  const recoverPassword = async (email: string) => {
    if (!email || !supabase) {
      setErrorMessage('Informe seu e-mail e configure o Supabase antes de recuperar a senha.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setErrorMessage(error ? error.message : '')
    setNotice(
      error ? '' : 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.',
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-art">
        <Link to="/" className="brand-lockup auth-brand">
          <span className="brand-mark">
            <CalendarCheck2 size={18} />
          </span>
          <span>
            agenda<span className="brand-light">pro</span>
          </span>
        </Link>
        <div className="auth-art-content">
          <span className="section-kicker">BOM TER VOCÊ POR AQUI</span>
          <h1>Seu trabalho faz o dia de alguém melhor.</h1>
          <p>A gente cuida da organização para você cuidar do que importa.</p>
          <div className="auth-quote">
            <div className="quote-stars">★★★★★</div>
            <p>“A agenda finalmente trabalha comigo, não o contrário.”</p>
            <div className="quote-person">
              <span className="quote-avatar">CM</span>
              <span>
                <strong>Camila Martins</strong>
                <small>Esteticista e empreendedora</small>
              </span>
            </div>
          </div>
        </div>
        <span className="auth-art-footer">
          Sua rotina merece esse cuidado. © {new Date().getFullYear()} AgendaPro
        </span>
      </section>
      <section className="auth-panel">
        <Link to="/" className="auth-back">
          <ArrowLeft size={16} /> Voltar para o início
        </Link>
        <div className="auth-form-wrap">
          <span className="section-kicker">
            {isSignup ? 'UM NOVO COMEÇO' : 'QUE BOM TER VOCÊ DE VOLTA'}
          </span>
          <h2>{isSignup ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
          <p className="auth-subtitle">
            {isSignup
              ? 'Comece a organizar seus horários do seu jeito.'
              : 'Acesse sua agenda e continue de onde parou.'}
          </p>
          {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) && (
            <div className="config-notice" role="status">
              Conecte seu projeto Supabase para ativar o acesso. Veja o{' '}
              <Link to="/#recursos">guia de configuração</Link> no README.
            </div>
          )}
          {errorMessage && (
            <div className="form-alert form-alert-error" role="alert">
              {errorMessage}
            </div>
          )}
          {notice && (
            <div className="form-alert form-alert-success" role="status">
              {notice}
            </div>
          )}
          {isSignup ? (
            <SignupForm onSubmit={onSignup} />
          ) : (
            <LoginForm onSubmit={onLogin} onRecover={recoverPassword} />
          )}
          <div className="auth-switch">
            {isSignup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
            <Link to={isSignup ? '/entrar' : '/cadastro'}>
              {isSignup ? 'Entrar' : 'Criar conta'}
            </Link>
          </div>
          <div className="auth-terms">
            Ao continuar, você concorda com nossos{' '}
            <a href="mailto:privacidade@agendapro.app">termos de uso</a> e{' '}
            <a href="mailto:privacidade@agendapro.app">política de privacidade</a>.
          </div>
        </div>
      </section>
    </main>
  )
}

function SignupForm({ onSubmit }: { onSubmit: (values: SignUpValues) => Promise<void> }) {
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<SignUpFormInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', password: '', business_name: '' },
  })
  const errors = form.formState.errors
  return (
    <form
      className="auth-form"
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      noValidate
    >
      <label className="field-label">
        Nome completo
        <div className={`input-shell ${errors.full_name ? 'input-error' : ''}`}>
          <UserRound size={17} />
          <input
            autoComplete="name"
            placeholder="Como podemos te chamar?"
            {...form.register('full_name')}
            aria-invalid={Boolean(errors.full_name)}
          />
        </div>
        {errors.full_name && <span className="field-error">{errors.full_name.message}</span>}
      </label>
      <label className="field-label">
        Nome do estabelecimento{' '}
        <span className="optional-label">opcional · preencha para criar seu negócio</span>
        <div className={`input-shell ${errors.business_name ? 'input-error' : ''}`}>
          <CalendarCheck2 size={17} />
          <input
            autoComplete="organization"
            placeholder="Ex.: Studio Aurora"
            {...form.register('business_name')}
            aria-invalid={Boolean(errors.business_name)}
          />
        </div>
        {errors.business_name && (
          <span className="field-error">{errors.business_name.message}</span>
        )}
      </label>
      <label className="field-label">
        E-mail
        <div className={`input-shell ${errors.email ? 'input-error' : ''}`}>
          <Mail size={17} />
          <input
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            {...form.register('email')}
            aria-invalid={Boolean(errors.email)}
          />
        </div>
        {errors.email && <span className="field-error">{errors.email.message}</span>}
      </label>
      <label className="field-label">
        Senha
        <div className={`input-shell ${errors.password ? 'input-error' : ''}`}>
          <LockKeyhole size={17} />
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            {...form.register('password')}
            aria-invalid={Boolean(errors.password)}
          />
          <button
            className="icon-button"
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.password && <span className="field-error">{errors.password.message}</span>}
      </label>
      <button
        type="submit"
        className="button button-dark button-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Aguarde...' : 'Criar minha conta'}{' '}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}

function LoginForm({
  onSubmit,
  onRecover,
}: {
  onSubmit: (values: SignInValues) => Promise<void>
  onRecover: (email: string) => Promise<void>
}) {
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })
  const errors = form.formState.errors
  return (
    <form
      className="auth-form"
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      noValidate
    >
      <label className="field-label">
        E-mail
        <div className={`input-shell ${errors.email ? 'input-error' : ''}`}>
          <Mail size={17} />
          <input
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            {...form.register('email')}
            aria-invalid={Boolean(errors.email)}
          />
        </div>
        {errors.email && <span className="field-error">{errors.email.message}</span>}
      </label>
      <label className="field-label">
        Senha
        <div className={`input-shell ${errors.password ? 'input-error' : ''}`}>
          <LockKeyhole size={17} />
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha"
            {...form.register('password')}
            aria-invalid={Boolean(errors.password)}
          />
          <button
            className="icon-button"
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.password && <span className="field-error">{errors.password.message}</span>}
      </label>
      <div className="forgot-row">
        <span>Protegido com segurança</span>
        <button type="button" onClick={() => void onRecover(form.getValues('email'))}>
          Esqueceu a senha?
        </button>
      </div>
      <button
        type="submit"
        className="button button-dark button-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Aguarde...' : 'Entrar'} <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}

export function PasswordResetPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      setMessage('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (!supabase || !session) {
      setMessage(
        'Abra o link de recuperação enviado ao seu e-mail antes de definir uma nova senha.',
      )
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(`Não foi possível atualizar sua senha: ${error.message}`)
    else {
      setMessage('Senha atualizada. Você já pode acessar sua conta.')
      window.setTimeout(() => navigate('/app'), 1200)
    }
    setSaving(false)
  }
  return (
    <main className="password-reset">
      <Link to="/" className="brand-lockup">
        <span className="brand-mark">
          <CalendarCheck2 size={18} />
        </span>
        <span>
          agenda<span className="brand-light">pro</span>
        </span>
      </Link>
      <form className="panel reset-card" onSubmit={(event) => void submit(event)}>
        <span className="section-kicker">ACESSO SEGURO</span>
        <h1>Crie uma nova senha</h1>
        <p>Escolha uma senha com pelo menos 8 caracteres.</p>
        <label className="field-label" htmlFor="new-password">
          Nova senha
          <input
            id="new-password"
            className="form-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {message && (
          <div className="form-alert" role="status">
            {message}
          </div>
        )}
        <button className="button button-dark" disabled={saving}>
          {saving ? 'Salvando...' : 'Atualizar senha'}
        </button>
      </form>
    </main>
  )
}
