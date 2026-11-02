import { zodResolver } from '@hookform/resolvers/zod'
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus2,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  DollarSign,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  Scissors,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/useToast'
import {
  businessSchema,
  profileSchema,
  serviceSchema,
  type ServiceFormInput,
  type ServiceValues,
} from '../schemas/auth'
import { formatCurrency, formatDate, formatTime, getRange } from '../lib/format'
import { supabase } from '../lib/supabase'
import type {
  Appointment,
  AppointmentStatus,
  BlockedTime,
  Business,
  Notification,
  Profile,
  Professional,
  Service,
} from '../types/database'

type AppointmentRow = Appointment & {
  start_at: string
  end_at: string
  service_name: string
  customer_name: string
  professional_name: string
}
type NavItem = { label: string; path: string; icon: typeof LayoutDashboard }
const dateInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

const statusNames: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  canceled: 'Cancelado',
}
const navAdmin: NavItem[] = [
  { label: 'Visão geral', path: '/app', icon: LayoutDashboard },
  { label: 'Agendamentos', path: '/app/agenda', icon: CalendarDays },
  { label: 'Clientes', path: '/app/clientes', icon: Users },
  { label: 'Serviços', path: '/app/servicos', icon: Scissors },
  { label: 'Disponibilidade', path: '/app/disponibilidade', icon: Clock3 },
  { label: 'Meu perfil', path: '/app/perfil', icon: UserRound },
  { label: 'Configurações', path: '/app/configuracoes', icon: Settings2 },
]
const navClient: NavItem[] = [
  { label: 'Meu espaço', path: '/app', icon: LayoutDashboard },
  { label: 'Meus horários', path: '/app/agenda', icon: CalendarDays },
  { label: 'Agendar horário', path: '/app/agendar', icon: CalendarPlus2 },
  { label: 'Meu perfil', path: '/app/perfil', icon: UserRound },
]
const navProfessional: NavItem[] = [
  { label: 'Visão geral', path: '/app', icon: LayoutDashboard },
  { label: 'Minha agenda', path: '/app/agenda', icon: CalendarDays },
  { label: 'Serviços', path: '/app/servicos', icon: Scissors },
  { label: 'Disponibilidade', path: '/app/disponibilidade', icon: Clock3 },
  { label: 'Meu perfil', path: '/app/perfil', icon: UserRound },
]

export function Workspace() {
  const { profile, session, loading, refreshProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [business, setBusiness] = useState<Business | null>(null)
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [professionals, setProfessionals] = useState<Array<Professional & { name: string }>>([])
  const [busy, setBusy] = useState(true)
  const [sideOpen, setSideOpen] = useState(false)
  const isClient = profile?.role === 'client'
  const isAdmin = profile?.role === 'admin'
  const page = location.pathname.replace('/app', '') || '/'

  const loadWorkspace = useCallback(async () => {
    if (!supabase || !profile) return
    setBusy(true)
    if (profile.role === 'client') {
      const { data: directory, error: directoryError } = await supabase
        .from('businesses')
        .select('*')
        .order('name')
      if (directoryError) notify('Não foi possível carregar os estabelecimentos.', 'error')
      setBusinesses(directory ?? [])
      const { data: ownAppointments, error: ownError } = await supabase
        .from('appointments')
        .select('*')
        .order('starts_at', { ascending: false })
        .limit(50)
      if (ownError) notify('Não foi possível carregar seus agendamentos.', 'error')
      const bookings = ownAppointments ?? []
      const serviceIds = [...new Set(bookings.map((item) => item.service_id))]
      const businessIds = [...new Set(bookings.map((item) => item.business_id))]
      const [serviceResult, businessResult] = await Promise.all([
        serviceIds.length
          ? supabase.from('services').select('*').in('id', serviceIds)
          : Promise.resolve({ data: [], error: null }),
        businessIds.length
          ? supabase.from('businesses').select('*').in('id', businessIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      const serviceById = new Map((serviceResult.data ?? []).map((item) => [item.id, item.name]))
      const businessById = new Map((businessResult.data ?? []).map((item) => [item.id, item.name]))
      setAppointments(
        bookings.map((item) => ({
          ...item,
          start_at: item.starts_at,
          end_at: item.ends_at,
          service_name: serviceById.get(item.service_id) ?? 'Serviço',
          customer_name: profile.full_name,
          professional_name: businessById.get(item.business_id) ?? 'Estabelecimento',
        })),
      )
      setServices(serviceResult.data ?? [])
      setBusy(false)
      return
    }

    if (!profile.business_id) {
      setBusiness(null)
      setBusy(false)
      return
    }
    const [businessResult, servicesResult, appointmentsResult, professionalsResult] =
      await Promise.all([
        supabase.from('businesses').select('*').eq('id', profile.business_id).maybeSingle(),
        supabase.from('services').select('*').eq('business_id', profile.business_id).order('name'),
        supabase
          .from('appointments')
          .select('*')
          .eq('business_id', profile.business_id)
          .gte('starts_at', new Date(Date.now() - 90 * 86400000).toISOString())
          .lte('starts_at', new Date(Date.now() + 180 * 86400000).toISOString())
          .order('starts_at')
          .limit(200),
        supabase
          .from('professionals')
          .select('*')
          .eq('business_id', profile.business_id)
          .eq('active', true),
      ])
    if (businessResult.error) notify('Não foi possível carregar o estabelecimento.', 'error')
    if (servicesResult.error) notify('Não foi possível carregar os serviços.', 'error')
    if (appointmentsResult.error) notify('Não foi possível carregar a agenda.', 'error')
    if (professionalsResult.error) notify('Não foi possível carregar a equipe.', 'error')
    const rawAppointments = appointmentsResult.data ?? []
    const customerIds = [...new Set(rawAppointments.map((item) => item.customer_id))]
    const professionalProfileIds = (professionalsResult.data ?? []).map((item) => item.profile_id)
    const lookUpIds = [...new Set([...customerIds, ...professionalProfileIds])]
    const { data: memberProfiles, error: memberError } = lookUpIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', lookUpIds)
      : { data: [], error: null }
    if (memberError) notify('Alguns nomes não puderam ser carregados.', 'error')
    const profileNames = new Map((memberProfiles ?? []).map((item) => [item.id, item.full_name]))
    const serviceNames = new Map((servicesResult.data ?? []).map((item) => [item.id, item.name]))
    const professionalNames = new Map(
      (professionalsResult.data ?? []).map((item) => [
        item.id,
        profileNames.get(item.profile_id) ?? 'Profissional',
      ]),
    )
    setBusiness(businessResult.data)
    setServices(servicesResult.data ?? [])
    setProfessionals(
      (professionalsResult.data ?? []).map((item) => ({
        ...item,
        name: profileNames.get(item.profile_id) ?? 'Profissional',
      })),
    )
    setAppointments(
      rawAppointments.map((item) => ({
        ...item,
        start_at: item.starts_at,
        end_at: item.ends_at,
        service_name: serviceNames.get(item.service_id) ?? 'Serviço removido',
        customer_name:
          profileNames.get(item.customer_id) ??
          (profile.role === 'professional' ? 'Cliente' : 'Cliente'),
        professional_name: professionalNames.get(item.professional_id) ?? 'Profissional',
      })),
    )
    setBusy(false)
  }, [profile, notify])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0)
    return () => window.clearTimeout(timer)
  }, [loadWorkspace])

  if (loading)
    return (
      <div className="full-loading" role="status">
        Carregando seu espaço...
      </div>
    )
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  if (!profile)
    return (
      <div className="full-loading">
        <div className="setup-card">
          <CircleAlert size={25} />
          <h2>Não foi possível carregar seu perfil</h2>
          <p>Verifique se a migration do AgendaPro foi aplicada no Supabase e tente novamente.</p>
          <button className="button button-dark" onClick={() => void refreshProfile()}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  if (profile.role === 'admin' && !profile.business_id)
    return <Navigate to="/app/configuracoes" replace />
  if (profile.role !== 'client' && !profile.business_id) {
    return (
      <main className="setup-screen">
        <div className="setup-card">
          <span className="brand-mark">
            <CalendarCheck2 size={20} />
          </span>
          <span className="section-kicker">SÓ MAIS UM PASSO</span>
          <h1>Crie seu espaço de atendimento</h1>
          <p>Seu estabelecimento terá uma agenda própria e segura, separada dos demais negócios.</p>
          <BusinessSetup
            onCreated={async () => {
              await refreshProfile()
              await loadWorkspace()
            }}
          />
        </div>
        <button
          className="setup-logout"
          onClick={async () => {
            if (supabase) await supabase.auth.signOut()
            navigate('/')
          }}
        >
          <LogOut size={15} /> Sair da conta
        </button>
      </main>
    )
  }

  const nav = isClient ? navClient : isAdmin ? navAdmin : navProfessional
  const displayName = profile.full_name.split(' ')[0]
  const currentTitle =
    nav.find((item) => item.path === (page === '/' ? '/app' : `/app${page}`))?.label ??
    (isClient ? 'Agendar horário' : 'Seu espaço')
  const showBooking = page === '/agendar'
  const showServices = page === '/servicos'
  const showClients = page === '/clientes'
  const showAvailability = page === '/disponibilidade'
  const showProfile = page === '/perfil'
  const showSettings = page === '/configuracoes'
  const showAgenda = page === '/agenda'

  return (
    <div className="workspace">
      {sideOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setSideOpen(false)}
        />
      )}
      <aside className={`sidebar ${sideOpen ? 'sidebar-open' : ''}`}>
        <Link to="/app" className="brand-lockup sidebar-brand">
          <span className="brand-mark">
            <CalendarCheck2 size={18} />
          </span>
          <span>
            agenda<span className="brand-light">pro</span>
          </span>
        </Link>
        <div className="workspace-context">
          <span className="context-icon">
            {isClient ? <Users size={16} /> : <Sparkles size={16} />}
          </span>
          <span>
            <strong>
              {isClient ? 'Área do cliente' : (business?.name ?? 'Meu estabelecimento')}
            </strong>
            <small>
              {isClient
                ? 'Seu próximo momento'
                : isAdmin
                  ? 'Painel administrativo'
                  : 'Área profissional'}
            </small>
          </span>
          <ChevronDown size={14} />
        </div>
        <span className="sidebar-label">MENU PRINCIPAL</span>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {nav.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setSideOpen(false)}
              className={`sidebar-link ${(page === '/' && path === '/app') || path === `/app${page}` ? 'sidebar-link-active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {path === '/app/agenda' &&
                appointments.filter((item) => ['pending', 'confirmed'].includes(item.status))
                  .length > 0 && (
                  <span className="nav-count">
                    {
                      appointments.filter((item) => ['pending', 'confirmed'].includes(item.status))
                        .length
                    }
                  </span>
                )}
            </Link>
          ))}
        </nav>
        {!isClient && (
          <>
            <span className="sidebar-label sidebar-label-lower">NEGÓCIO</span>
            <button
              className="sidebar-link sidebar-static"
              onClick={() => navigate('/app/configuracoes')}
            >
              <Activity size={18} />
              <span>Relatórios</span>
              <span className="soon-tag">EM BREVE</span>
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <ShieldCheck size={17} />
            </span>
            <strong>Seus dados estão seguros</strong>
            <small>O acesso é protegido pelo seu perfil e pelo estabelecimento.</small>
            <Link to="/app/configuracoes">
              Entenda como <ArrowRight size={13} />
            </Link>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">{initials(profile.full_name)}</span>
            <span>
              <strong>{profile.full_name}</strong>
              <small>
                {isAdmin
                  ? 'Administrador'
                  : profile.role === 'professional'
                    ? 'Profissional'
                    : 'Cliente'}
              </small>
            </span>
            <button
              type="button"
              className="sidebar-logout"
              aria-label="Sair da conta"
              title="Sair da conta"
              onClick={async () => {
                if (supabase) await supabase.auth.signOut()
                navigate('/')
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-header">
          <div className="header-title-group">
            <button
              className="mobile-menu workspace-menu"
              aria-label="Abrir menu"
              onClick={() => setSideOpen(true)}
            >
              <span className="menu-lines" />
            </button>
            <div>
              <span className="breadcrumb">
                AgendaPro <span>/</span> {currentTitle}
              </span>
              <h1>{page === '/' ? `Olá, ${displayName}` : currentTitle}</h1>
            </div>
          </div>
          <div className="header-actions">
            <span className="today-label">
              <CalendarDays size={15} />{' '}
              {formatDate(new Date(), { weekday: 'short', day: '2-digit', month: 'short' })}
            </span>
            <NotificationCenter />
            <span className="header-avatar">{initials(profile.full_name)}</span>
          </div>
        </header>
        <div className="workspace-content">
          {!isClient && !business && showSettings ? (
            <BusinessSetup
              onCreated={async () => {
                await refreshProfile()
                await loadWorkspace()
              }}
            />
          ) : null}
          {!isClient && !business && !showSettings && (
            <div className="setup-banner">
              <CircleAlert size={18} />
              <span>Configure o estabelecimento para começar a gerenciar seus horários.</span>
              <Link to="/app/configuracoes">
                Configurar agora <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {(showBooking && !isClient) ||
          (showSettings && !isAdmin) ||
          (showClients && !isAdmin) ||
          (showAvailability && isClient) ? (
            <AccessDenied />
          ) : showBooking ? (
            <BookingPage businesses={businesses} onBooked={loadWorkspace} />
          ) : showServices ? (
            <ServicesPage
              services={services}
              businessId={business?.id ?? null}
              isAdmin={isAdmin}
              loading={busy}
              onChanged={loadWorkspace}
            />
          ) : showSettings ? (
            <SettingsPage
              key={business?.id ?? 'new'}
              business={business}
              professionals={professionals}
              onChanged={loadWorkspace}
            />
          ) : showAvailability ? (
            <AvailabilityPage profile={profile} professionals={professionals} isAdmin={isAdmin} />
          ) : showProfile ? (
            <ProfilePage
              profile={profile}
              email={session.user.email ?? ''}
              onSaved={refreshProfile}
            />
          ) : showAgenda ? (
            <AgendaPage
              appointments={appointments}
              loading={busy}
              isClient={isClient}
              onChanged={loadWorkspace}
            />
          ) : showClients ? (
            <CustomersPage appointments={appointments} loading={busy} />
          ) : (
            <Dashboard
              appointments={appointments}
              services={services}
              loading={busy}
              isClient={isClient}
              business={business}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function Dashboard({
  appointments,
  services,
  loading,
  isClient,
  business,
}: {
  appointments: AppointmentRow[]
  services: Service[]
  loading: boolean
  isClient: boolean
  business: Business | null
}) {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('week')
  const [anchorDate, setAnchorDate] = useState(dateInput(new Date()))
  const [customStart, setCustomStart] = useState(dateInput(getRange('week').start))
  const [customEnd, setCustomEnd] = useState(dateInput(getRange('week').end))
  const range =
    period === 'custom'
      ? { start: new Date(`${customStart}T00:00:00`), end: new Date(`${customEnd}T23:59:59`) }
      : getRange(period, new Date(`${anchorDate}T12:00:00`))
  const scopedAppointments = appointments.filter((item) => {
    const date = new Date(item.start_at)
    return date >= range.start && date <= range.end
  })
  const active = scopedAppointments.filter((item) => item.status !== 'canceled')
  const pending = active.filter((item) => item.status === 'pending').length
  const completed = active.filter((item) => item.status === 'completed')
  const estimatedRevenue = active.reduce(
    (sum, item) =>
      sum + (services.find((service) => service.id === item.service_id)?.price_cents ?? 0),
    0,
  )
  const todayAppointments = appointments.filter(
    (item) =>
      new Date(item.start_at).toDateString() === new Date().toDateString() &&
      item.status !== 'canceled',
  )
  const bars = (() => {
    const days = period === 'day' ? 8 : period === 'month' ? 14 : 7
    const result = Array.from({ length: days }, (_, index) => {
      const start = new Date(range.start)
      start.setDate(
        start.getDate() +
          Math.floor((index * ((range.end.getTime() - range.start.getTime()) / 86400000)) / days),
      )
      const count = scopedAppointments.filter(
        (item) =>
          new Date(item.start_at).toDateString() === start.toDateString() &&
          item.status !== 'canceled',
      ).length
      return {
        label: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(start),
        count,
      }
    })
    const max = Math.max(1, ...result.map(({ count }) => count))
    return result.map((item) => ({
      ...item,
      height: Math.max(item.count ? 16 : 5, Math.round((item.count / max) * 100)),
    }))
  })()
  const selectedServices = services.filter((service) =>
    active.some((item) => item.service_id === service.id),
  )

  if (isClient) {
    const next = appointments
      .filter((item) => item.status === 'pending' || item.status === 'confirmed')
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
    return (
      <div className="client-home">
        <div className="client-welcome">
          <div>
            <span className="section-kicker">UM TEMPO PARA VOCÊ</span>
            <h2>Seu próximo momento de cuidado começa aqui.</h2>
            <p>Encontre seu estabelecimento e escolha um horário que combine com o seu dia.</p>
            <button className="button button-dark" onClick={() => navigate('/app/agendar')}>
              Encontrar um horário <ArrowRight size={16} />
            </button>
          </div>
          <div className="welcome-illustration">
            <div className="welcome-circle">
              <CalendarPlus2 size={36} />
            </div>
            <span className="welcome-star">✦</span>
            <span className="welcome-spark">✳</span>
            <span className="welcome-caption">
              um espaço
              <br />
              na sua agenda
            </span>
          </div>
        </div>
        <div className="section-heading-row">
          <div>
            <h2>Seus próximos horários</h2>
            <p>Um resumo do que vem por aí.</p>
          </div>
          <Link to="/app/agenda" className="link-arrow">
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>
        {next.length ? (
          <div className="appointment-card-grid">
            {next.slice(0, 3).map((item) => (
              <AppointmentCard
                key={item.id}
                item={item}
                isClient
                onChanged={() => window.location.reload()}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="Ainda não tem nenhum horário"
            copy="Um momento para você começa com um primeiro agendamento."
            action={
              <button
                className="button button-dark button-small"
                onClick={() => navigate('/app/agendar')}
              >
                Escolher horário <ArrowRight size={14} />
              </button>
            }
          />
        )}
      </div>
    )
  }
  const todayCount = todayAppointments.length
  const stats = [
    {
      title: 'Horários no período',
      value: String(active.length),
      icon: CalendarDays,
      color: 'mint',
      note: `${pending} aguardando confirmação`,
    },
    {
      title: 'Para hoje',
      value: String(todayCount),
      icon: Clock3,
      color: 'blue',
      note: 'atendimentos na agenda',
    },
    {
      title: 'Concluídos',
      value: String(completed.length),
      icon: CheckCheck,
      color: 'violet',
      note: 'atendimentos realizados',
    },
    {
      title: 'Receita estimada',
      value: formatCurrency(estimatedRevenue),
      icon: DollarSign,
      color: 'amber',
      note: 'com base nos agendamentos',
    },
  ]
  return (
    <div className="dashboard">
      <div className="welcome-banner">
        <div>
          <span className="welcome-eyebrow">
            <Sparkles size={14} /> SEU NEGÓCIO, EM BOAS MÃOS
          </span>
          <h2>Uma agenda organizada muda o dia inteiro.</h2>
          <p>{business?.name ?? 'Acompanhe seus atendimentos e cuide de cada detalhe.'}</p>
        </div>
        <div className="welcome-mark">
          <span>✳</span>
          <small>
            seu espaço,
            <br />
            seu ritmo.
          </small>
        </div>
      </div>
      <div className="section-heading-row dashboard-heading">
        <div>
          <h2>Visão geral</h2>
          <p>Acompanhe o movimento do seu espaço.</p>
        </div>
        <button className="button button-dark button-small" onClick={() => navigate('/app/agenda')}>
          <CalendarPlus2 size={15} /> Ver agenda
        </button>
      </div>
      <div className="period-toolbar">
        <div className="period-tabs" role="group" aria-label="Filtrar por período">
          {(['day', 'week', 'month'] as const).map((value) => (
            <button
              key={value}
              className={period === value ? 'period-active' : ''}
              onClick={() => setPeriod(value)}
            >
              {value === 'day' ? 'Dia' : value === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
          <button
            className={period === 'custom' ? 'period-active' : ''}
            onClick={() => setPeriod('custom')}
          >
            Período
          </button>
        </div>
        {period === 'custom' ? (
          <div className="date-range">
            <input
              aria-label="Data inicial"
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
            />
            <span>até</span>
            <input
              aria-label="Data final"
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(event) => setCustomEnd(event.target.value)}
            />
          </div>
        ) : (
          <label className="date-picker">
            <CalendarDays size={15} />
            <input
              aria-label="Data de referência"
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
            />
            <ChevronDown size={14} />
          </label>
        )}
      </div>
      <div className="stats-grid">
        {stats.map(({ title, value, icon: Icon, color, note }) => (
          <article className="stat-card" key={title}>
            <span className={`stat-icon stat-${color}`}>
              <Icon size={18} />
            </span>
            <span className="stat-note">{note}</span>
            <span className="stat-title">{title}</span>
            <strong className="stat-value">
              {loading ? <span className="skeleton skeleton-number" /> : value}
            </strong>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Ritmo dos atendimentos</h3>
              <p>Horários confirmados e realizados no período.</p>
            </div>
            <button className="icon-button panel-more" title="Indicadores do período">
              <MoreHorizontal size={19} />
            </button>
          </div>
          <div className="chart-summary">
            <strong>{active.length}</strong>
            <span>agendamentos no período</span>
            <span className="chart-range">
              {formatDate(range.start, { day: '2-digit', month: 'short' })} —{' '}
              {formatDate(range.end, { day: '2-digit', month: 'short' })}
            </span>
          </div>
          {loading ? (
            <div className="chart-skeleton">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ) : (
            <div className="bar-chart" role="img" aria-label="Gráfico de agendamentos no período">
              {bars.map((bar, index) => (
                <div className="bar-column" key={`${bar.label}-${index}`}>
                  <span className="bar-value">{bar.count || ''}</span>
                  <span
                    className={`bar ${bar.count ? 'bar-filled' : ''}`}
                    style={{ height: `${bar.height}%` }}
                  />
                  <span className="bar-label">{bar.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="chart-legend">
            <span>
              <i /> Agendamentos
            </span>
            <span>
              {scopedAppointments.filter((item) => item.status === 'canceled').length} cancelamentos
            </span>
          </div>
        </section>
        <section className="panel popular-panel">
          <div className="panel-heading">
            <div>
              <h3>Serviços em destaque</h3>
              <p>Os mais procurados no período.</p>
            </div>
            <Scissors size={17} className="muted-icon" />
          </div>
          {selectedServices.length ? (
            <div className="popular-list">
              {selectedServices.slice(0, 4).map((service) => {
                const count = active.filter((item) => item.service_id === service.id).length
                return (
                  <div className="popular-row" key={service.id}>
                    <span className="service-mini-icon">
                      <Scissors size={15} />
                    </span>
                    <span className="popular-name">
                      <strong>{service.name}</strong>
                      <small>{service.duration_minutes} min</small>
                    </span>
                    <span className="popular-count">
                      {count}
                      <small>horários</small>
                    </span>
                    <span className="popular-track">
                      <i
                        style={{
                          width: `${Math.min(100, Math.max(10, (count / Math.max(1, active.length)) * 100))}%`,
                        }}
                      />
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-chart">
              <Scissors size={20} />
              <span>Seus serviços aparecerão aqui conforme os horários forem agendados.</span>
            </div>
          )}
          <Link className="panel-link" to="/app/servicos">
            Ver todos os serviços <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <section className="panel appointments-panel">
        <div className="panel-heading">
          <div>
            <h3>Próximos atendimentos</h3>
            <p>Um olhar rápido para o que vem por aí.</p>
          </div>
          <Link to="/app/agenda" className="link-arrow">
            Ver agenda <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="table-skeleton">
            <span className="skeleton" />
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
        ) : appointments
            .filter((item) => new Date(item.start_at) >= new Date() && item.status !== 'canceled')
            .slice(0, 4).length ? (
          <div className="appointments-table-wrap">
            <table className="appointments-table">
              <thead>
                <tr>
                  <th>CLIENTE</th>
                  <th>SERVIÇO</th>
                  <th>DATA E HORÁRIO</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {appointments
                  .filter(
                    (item) => new Date(item.start_at) >= new Date() && item.status !== 'canceled',
                  )
                  .slice(0, 4)
                  .map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="table-person">
                          <span className="table-avatar">{initials(item.customer_name)}</span>
                          <strong>{item.customer_name}</strong>
                        </span>
                      </td>
                      <td>{item.service_name}</td>
                      <td>
                        {formatDate(item.start_at, { day: '2-digit', month: 'short' })}{' '}
                        <span className="table-time">{formatTime(item.start_at)}</span>
                      </td>
                      <td>
                        <StatusPill status={item.status} />
                      </td>
                      <td>
                        <Link
                          to="/app/agenda"
                          aria-label={`Detalhes de ${item.customer_name}`}
                          className="table-more"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<CalendarDays size={18} />}
            title="Tudo tranquilo por aqui"
            copy="Seus próximos agendamentos aparecerão nesta lista."
            action={
              <button className="text-button" onClick={() => navigate('/app/agenda')}>
                Abrir agenda <ArrowRight size={14} />
              </button>
            }
          />
        )}
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`status-pill status-${status}`}>
      <i />
      {statusNames[status]}
    </span>
  )
}

function CustomersPage({
  appointments,
  loading,
}: {
  appointments: AppointmentRow[]
  loading: boolean
}) {
  const [query, setQuery] = useState('')
  const customers = [
    ...new Map(
      appointments.map((item) => [
        item.customer_id,
        {
          id: item.customer_id,
          name: item.customer_name,
          count: appointments.filter((appointment) => appointment.customer_id === item.customer_id)
            .length,
          next: appointments
            .filter(
              (appointment) =>
                appointment.customer_id === item.customer_id &&
                appointment.status !== 'canceled' &&
                new Date(appointment.start_at) >= new Date(),
            )
            .sort((a, b) => a.start_at.localeCompare(b.start_at))[0],
          last: appointments
            .filter((appointment) => appointment.customer_id === item.customer_id)
            .sort((a, b) => b.start_at.localeCompare(a.start_at))[0],
        },
      ]),
    ).values(),
  ].filter((customer) =>
    customer.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
  )
  return (
    <section className="panel customers-page">
      <div className="agenda-page-header">
        <div>
          <span className="section-kicker">RELACIONAMENTO COM CUIDADO</span>
          <h2>Seus clientes</h2>
          <p>
            Clientes com agendamentos no seu espaço, com o histórico necessário para atender bem.
          </p>
        </div>
        <span className="team-count">{customers.length} clientes</span>
      </div>
      <label className="customer-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar cliente pelo nome"
          aria-label="Buscar cliente pelo nome"
        />
        {query && (
          <button aria-label="Limpar busca" onClick={() => setQuery('')}>
            <X size={14} />
          </button>
        )}
      </label>
      {loading ? (
        <div className="table-skeleton">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ) : customers.length ? (
        <div className="appointments-table-wrap">
          <table className="appointments-table customers-table">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>AGENDAMENTOS</th>
                <th>PRÓXIMO HORÁRIO</th>
                <th>ÚLTIMO ATENDIMENTO</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <span className="table-person">
                      <span className="table-avatar">{initials(customer.name)}</span>
                      <strong>{customer.name}</strong>
                    </span>
                  </td>
                  <td>{customer.count}</td>
                  <td>
                    {customer.next
                      ? `${formatDate(customer.next.start_at, { day: '2-digit', month: 'short' })} · ${formatTime(customer.next.start_at)}`
                      : '—'}
                  </td>
                  <td>
                    {customer.last
                      ? formatDate(customer.last.start_at, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<Users size={20} />}
          title={query ? 'Nenhum resultado para essa busca' : 'Seus clientes aparecerão aqui'}
          copy={
            query
              ? 'Tente buscar por outro nome.'
              : 'Quando alguém agendar um atendimento, você verá seu histórico aqui.'
          }
        />
      )}
    </section>
  )
}

function NotificationCenter() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const client = supabase
    if (!client || !profile || !open) return
    let active = true
    void client
      .from('notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!active) return
        if (error) notify('Não foi possível carregar as notificações.', 'error')
        setNotifications(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, profile, notify])
  const unread = notifications.filter((item) => !item.read_at).length
  const markRead = async (item: Notification) => {
    if (!supabase || item.read_at) return
    const readAt = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', item.id)
    if (error) notify('Não foi possível atualizar a notificação.', 'error')
    else
      setNotifications((current) =>
        current.map((notice) => (notice.id === item.id ? { ...notice, read_at: readAt } : notice)),
      )
  }
  return (
    <div className="notification-wrap">
      <button
        className="notification-button"
        title="Notificações"
        aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}
        aria-expanded={open}
        onClick={() => {
          setLoading(true)
          setOpen((value) => !value)
        }}
      >
        <Bell size={18} />
        {unread > 0 && <span />}
      </button>
      {open && (
        <>
          <button
            className="notification-backdrop"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
          />
          <section className="notification-popover" aria-label="Suas notificações">
            <div className="notification-heading">
              <div>
                <strong>Notificações</strong>
                <small>{unread ? `${unread} não lidas` : 'Tudo em dia'}</small>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar notificações"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            {loading ? (
              <div className="notification-loading">
                <span className="skeleton" />
                <span className="skeleton" />
              </div>
            ) : notifications.length ? (
              <div className="notification-list">
                {notifications.map((item) => (
                  <button
                    className={`notification-item ${item.read_at ? '' : 'notification-unread'}`}
                    key={item.id}
                    onClick={() => void markRead(item)}
                  >
                    <span className="notification-icon">
                      <CalendarCheck2 size={15} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                      <time>
                        {formatDate(item.created_at, { day: '2-digit', month: 'short' })} ·{' '}
                        {formatTime(item.created_at)}
                      </time>
                    </span>
                    {!item.read_at && <i />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="notification-empty">
                <Bell size={20} />
                <strong>Sem notificações</strong>
                <span>As atualizações dos seus agendamentos aparecem aqui.</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  copy,
  action,
}: {
  icon: React.ReactNode
  title: string
  copy: string
  action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{copy}</p>
      {action}
    </div>
  )
}

function AccessDenied() {
  return (
    <section className="panel access-denied">
      <span className="empty-icon">
        <ShieldCheck size={20} />
      </span>
      <h2>Este espaço não está disponível para o seu perfil.</h2>
      <p>As permissões da sua conta não permitem acessar esta área.</p>
      <Link className="button button-dark button-small" to="/app">
        Voltar ao meu espaço <ArrowRight size={14} />
      </Link>
    </section>
  )
}

function ProfilePage({
  profile,
  email,
  onSaved,
}: {
  profile: Profile
  email: string
  onSaved: () => Promise<void>
}) {
  const { notify } = useToast()
  const [fullName, setFullName] = useState(profile.full_name)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = profileSchema.safeParse({ full_name: fullName, phone })
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? 'Revise seus dados.', 'error')
      return
    }
    if (!supabase) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
      .eq('id', profile.id)
    if (error) notify(`Não foi possível atualizar o perfil: ${error.message}`, 'error')
    else {
      notify('Seus dados foram atualizados.')
      await onSaved()
    }
    setSaving(false)
  }
  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      notify('A senha deve ter pelo menos 8 caracteres.', 'error')
      return
    }
    if (!supabase) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) notify(`Não foi possível atualizar a senha: ${error.message}`, 'error')
    else {
      setPassword('')
      notify('Senha atualizada com segurança.')
    }
    setSaving(false)
  }
  return (
    <div className="profile-page">
      <section className="panel settings-panel">
        <div className="agenda-page-header">
          <div>
            <span className="section-kicker">SEUS DADOS, DO SEU JEITO</span>
            <h2>Meu perfil</h2>
            <p>Atualize as informações usadas na sua conta e nos atendimentos.</p>
          </div>
          <span className="settings-shield">
            <UserRound size={20} />
          </span>
        </div>
        <form className="settings-form" onSubmit={(event) => void saveProfile(event)}>
          <label className="field-label">
            Nome completo
            <input
              className="form-input"
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label className="field-label">
            E-mail
            <input className="form-input" type="email" value={email} disabled />
            <small className="field-hint">
              O e-mail de acesso é gerenciado pelo Supabase Auth.
            </small>
          </label>
          <label className="field-label">
            Telefone
            <input
              className="form-input"
              type="tel"
              maxLength={30}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(11) 99999-9999"
            />
          </label>
          <button className="button button-dark button-small" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar dados'} <Check size={14} />
          </button>
        </form>
      </section>
      <section className="panel settings-panel">
        <div className="agenda-page-header">
          <div>
            <span className="section-kicker">ACESSO SEGURO</span>
            <h2>Alterar senha</h2>
            <p>Escolha uma senha com pelo menos oito caracteres.</p>
          </div>
          <span className="settings-shield">
            <KeyRound size={20} />
          </span>
        </div>
        <form className="settings-form" onSubmit={(event) => void savePassword(event)}>
          <label className="field-label">
            Nova senha
            <input
              className="form-input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="button button-outline button-small" disabled={saving}>
            {saving ? 'Atualizando...' : 'Atualizar senha'} <ArrowRight size={14} />
          </button>
        </form>
      </section>
    </div>
  )
}

function AppointmentCard({
  item,
  isClient,
  onChanged,
}: {
  item: AppointmentRow
  isClient: boolean
  onChanged: () => void
}) {
  const { notify } = useToast()
  const [saving, setSaving] = useState(false)
  const cancel = async () => {
    if (!supabase || !window.confirm('Deseja cancelar este agendamento?')) return
    setSaving(true)
    const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: item.id })
    if (error) notify(error.message, 'error')
    else {
      notify('Agendamento cancelado.')
      onChanged()
    }
    setSaving(false)
  }
  return (
    <article className="appointment-card">
      <div className="appointment-card-date">
        <strong>{formatDate(item.start_at, { day: '2-digit' })}</strong>
        <span>{formatDate(item.start_at, { month: 'short' })}</span>
      </div>
      <div className="appointment-card-info">
        <span className="status-pill status-soft">
          <i />
          {statusNames[item.status]}
        </span>
        <h3>{item.service_name}</h3>
        <p>
          {formatTime(item.start_at)} · {isClient ? item.professional_name : item.customer_name}
        </p>
      </div>
      <button
        className="card-cancel"
        disabled={saving}
        onClick={() => void cancel()}
        aria-label="Cancelar agendamento"
      >
        <X size={17} />
      </button>
    </article>
  )
}

function AgendaPage({
  appointments,
  loading,
  isClient,
  onChanged,
}: {
  appointments: AppointmentRow[]
  loading: boolean
  isClient: boolean
  onChanged: () => void
}) {
  const [filter, setFilter] = useState<'upcoming' | 'history' | 'all'>('upcoming')
  const visible = appointments
    .filter((item) => {
      const future = new Date(item.start_at) >= new Date() && item.status !== 'canceled'
      return (
        filter === 'all' || (filter === 'upcoming' ? future : !future || item.status === 'canceled')
      )
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
  return (
    <section className="panel agenda-page">
      <div className="agenda-page-header">
        <div>
          <span className="section-kicker">
            {isClient ? 'SEUS MOMENTOS' : 'ACOMPANHAMENTO DA EQUIPE'}
          </span>
          <h2>{isClient ? 'Seus agendamentos' : 'Agenda de atendimentos'}</h2>
          <p>
            {isClient
              ? 'Acompanhe seus próximos horários e seu histórico.'
              : 'Confirmações, atendimentos e horários em um só lugar.'}
          </p>
        </div>
        {isClient && (
          <Link to="/app/agendar" className="button button-dark button-small">
            <Plus size={16} /> Novo horário
          </Link>
        )}
      </div>
      <div className="agenda-filters">
        {(['upcoming', 'history', 'all'] as const).map((value) => (
          <button
            key={value}
            className={filter === value ? 'filter-active' : ''}
            onClick={() => setFilter(value)}
          >
            {value === 'upcoming' ? 'Próximos' : value === 'history' ? 'Histórico' : 'Todos'}
            <span>
              {
                appointments.filter((item) =>
                  value === 'upcoming'
                    ? new Date(item.start_at) >= new Date() && item.status !== 'canceled'
                    : value === 'history'
                      ? new Date(item.start_at) < new Date() || item.status === 'canceled'
                      : true,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      {loading ? (
        <div className="table-skeleton">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ) : visible.length ? (
        <div className="agenda-list">
          {visible.map((item) => (
            <AgendaRow key={item.id} item={item} isClient={isClient} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarDays size={20} />}
          title="Nenhum agendamento por aqui"
          copy={
            isClient
              ? 'Escolha um estabelecimento e encontre um horário para você.'
              : 'Quando um cliente reservar um horário, ele aparecerá aqui.'
          }
          action={
            isClient ? (
              <Link className="button button-dark button-small" to="/app/agendar">
                Agendar horário <ArrowRight size={14} />
              </Link>
            ) : undefined
          }
        />
      )}
    </section>
  )
}

function AgendaRow({
  item,
  isClient,
  onChanged,
}: {
  item: AppointmentRow
  isClient: boolean
  onChanged: () => void
}) {
  const { notify } = useToast()
  const [saving, setSaving] = useState(false)
  const update = async (status: AppointmentStatus) => {
    if (!supabase) return
    setSaving(true)
    const { error } = await supabase.rpc('change_appointment_status', {
      p_appointment_id: item.id,
      p_status: status,
    })
    if (error) notify(error.message, 'error')
    else {
      notify(`Agendamento ${statusNames[status].toLowerCase()}.`)
      onChanged()
    }
    setSaving(false)
  }
  const cancel = async () => {
    if (!supabase || !window.confirm('Deseja cancelar este agendamento?')) return
    setSaving(true)
    const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: item.id })
    if (error) notify(error.message, 'error')
    else {
      notify('Agendamento cancelado.')
      onChanged()
    }
    setSaving(false)
  }
  return (
    <article className="agenda-row">
      <div className="agenda-time">
        <strong>{formatTime(item.start_at)}</strong>
        <span>
          {formatDate(item.start_at, { weekday: 'short', day: '2-digit', month: 'short' })}
        </span>
      </div>
      <span className="table-avatar">
        {initials(isClient ? item.professional_name : item.customer_name)}
      </span>
      <div className="agenda-details">
        <strong>{isClient ? item.professional_name : item.customer_name}</strong>
        <span>{item.service_name}</span>
      </div>
      <StatusPill status={item.status} />
      {isClient && ['pending', 'confirmed'].includes(item.status) && (
        <Link
          className="table-more"
          to={`/app/agendar?remarcar=${item.id}`}
          title="Solicitar remarcação"
        >
          <ArrowRight size={15} />
        </Link>
      )}
      {!isClient && item.status === 'pending' && (
        <button
          className="button button-outline button-xs"
          disabled={saving}
          onClick={() => void update('confirmed')}
        >
          Confirmar
        </button>
      )}
      {!isClient && item.status === 'confirmed' && (
        <button
          className="button button-outline button-xs"
          disabled={saving}
          onClick={() => void update('completed')}
        >
          Concluir
        </button>
      )}
      {['pending', 'confirmed'].includes(item.status) && (
        <button
          className="card-cancel"
          disabled={saving}
          onClick={() => void cancel()}
          aria-label="Cancelar agendamento"
        >
          <X size={16} />
        </button>
      )}
    </article>
  )
}

function BookingPage({ businesses, onBooked }: { businesses: Business[]; onBooked: () => void }) {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [businessId, setBusinessId] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<
    Array<{ id: string; profile_id: string; name: string }>
  >([])
  const [serviceId, setServiceId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [date, setDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return dateInput(tomorrow)
  })
  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState('')
  const { search } = useLocation()
  const appointmentToMove = new URLSearchParams(search).get('remarcar')
  const [originalAppointment, setOriginalAppointment] = useState<Appointment | null>(null)
  const businessOptions = businesses

  useEffect(() => {
    if (appointmentToMove && supabase) {
      void supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentToMove)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) notify('Não foi possível carregar o agendamento para remarcação.', 'error')
          if (data) {
            setOriginalAppointment(data)
            setBusinessId(data.business_id)
            setServiceId(data.service_id)
            setProfessionalId(data.professional_id)
          }
        })
    }
  }, [appointmentToMove, notify])

  useEffect(() => {
    const client = supabase
    if (!client || !businessId) return
    let active = true
    void Promise.all([
      client
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .eq('active', true)
        .order('name'),
      client.from('professionals').select('*').eq('business_id', businessId).eq('active', true),
    ]).then(async ([serviceResult, professionalResult]) => {
      if (serviceResult.error || professionalResult.error) {
        notify('Não foi possível carregar os serviços e profissionais.', 'error')
        return
      }
      if (!active) return
      setServices(serviceResult.data ?? [])
      const people = professionalResult.data ?? []
      if (!people.length) {
        setProfessionals([])
        return
      }
      const { data: directory, error } = await client
        .from('professional_directory')
        .select('profile_id, full_name, business_id')
        .eq('business_id', businessId)
      if (error) {
        notify('Não foi possível carregar a equipe deste estabelecimento.', 'error')
        return
      }
      if (active)
        setProfessionals(
          people.map((person) => ({
            ...person,
            name:
              directory?.find((item) => item.profile_id === person.profile_id)?.full_name ??
              'Profissional',
          })),
        )
    })
    return () => {
      active = false
    }
  }, [businessId, notify])

  useEffect(() => {
    if (!supabase || !professionalId || !serviceId || !date) return
    let active = true
    const loadingTimer = window.setTimeout(() => {
      if (active) setLoadingSlots(true)
    }, 0)
    void supabase
      .rpc('get_available_slots', {
        p_professional_id: professionalId,
        p_service_id: serviceId,
        p_date: date,
      })
      .then(({ data, error }) => {
        if (!active) return
        window.clearTimeout(loadingTimer)
        if (error) {
          setPageError('Não foi possível consultar os horários. Tente novamente.')
          setSlots([])
        } else setSlots((data ?? []).map((slot) => slot.slot_start))
        setSelectedSlot('')
        setLoadingSlots(false)
      })
    return () => {
      active = false
      window.clearTimeout(loadingTimer)
    }
  }, [professionalId, serviceId, date])

  const submitBooking = async () => {
    if (!supabase || !selectedSlot || !profile) return
    if (date < dateInput(new Date())) {
      setPageError('Escolha uma data futura.')
      return
    }
    setSaving(true)
    setPageError('')
    const result = originalAppointment
      ? await supabase.rpc('reschedule_appointment', {
          p_appointment_id: originalAppointment.id,
          p_new_start_at: selectedSlot,
        })
      : await supabase.rpc('book_appointment', {
          p_professional_id: professionalId,
          p_service_id: serviceId,
          p_start_at: selectedSlot,
          p_notes: notes || null,
        })
    if (result.error) {
      setPageError(
        result.error.message.includes('slot_unavailable')
          ? 'Este horário acabou de ser reservado. Escolha outro horário.'
          : result.error.message,
      )
      notify(
        originalAppointment
          ? 'Não foi possível remarcar o agendamento.'
          : 'Não foi possível criar o agendamento.',
        'error',
      )
    } else {
      notify(
        originalAppointment
          ? 'Horário remarcado com sucesso.'
          : 'Agendamento realizado com sucesso.',
      )
      if (originalAppointment) window.history.replaceState({}, '', '/app/agendar')
      setSelectedSlot('')
      setNotes('')
      await onBooked()
    }
    setSaving(false)
  }

  return (
    <div className="booking-layout">
      <div className="booking-main">
        <div className="booking-heading">
          <span className="section-kicker">
            {originalAppointment ? 'UM NOVO HORÁRIO' : 'SEU PRÓXIMO MOMENTO'}
          </span>
          <h2>
            {originalAppointment
              ? 'Vamos encontrar um novo horário?'
              : 'Encontre um horário que combine com você.'}
          </h2>
          <p>
            Escolha o estabelecimento, o serviço e um horário disponível. A reserva é confirmada na
            hora.
          </p>
        </div>
        {pageError && (
          <div role="alert" className="form-alert form-alert-error">
            <CircleAlert size={17} />
            {pageError}
          </div>
        )}
        <div className="booking-steps">
          <div className="booking-step">
            <span className="step-number">01</span>
            <div className="booking-field">
              <label htmlFor="book-business">Estabelecimento</label>
              <select
                id="book-business"
                value={businessId}
                onChange={(event) => {
                  setBusinessId(event.target.value)
                  setServiceId('')
                  setProfessionalId('')
                  setSlots([])
                  setSelectedSlot('')
                  setPageError('')
                }}
              >
                <option value="">Escolha um espaço</option>
                {businessOptions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {businessId && (
                <small className="field-hint">
                  {businesses.find((item) => item.id === businessId)?.address ??
                    'Um espaço para você.'}
                </small>
              )}
            </div>
          </div>
          <div className="booking-step">
            <span className="step-number">02</span>
            <div className="booking-field">
              <label htmlFor="book-service">Serviço</label>
              <select
                id="book-service"
                value={serviceId}
                onChange={(event) => {
                  setServiceId(event.target.value)
                  setProfessionalId('')
                  setSlots([])
                  setSelectedSlot('')
                  setPageError('')
                }}
                disabled={!businessId}
              >
                <option value="">Escolha um serviço</option>
                {services.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {formatCurrency(item.price_cents)} · {item.duration_minutes} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="booking-step">
            <span className="step-number">03</span>
            <div className="booking-field">
              <label htmlFor="book-professional">Profissional</label>
              <select
                id="book-professional"
                value={professionalId}
                onChange={(event) => {
                  setProfessionalId(event.target.value)
                  setSlots([])
                  setSelectedSlot('')
                  setPageError('')
                }}
                disabled={!serviceId}
              >
                <option value="">Escolha quem vai atender</option>
                {professionals.map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="booking-step">
            <span className="step-number">04</span>
            <div className="booking-field">
              <label htmlFor="book-date">Dia e horário</label>
              <input
                id="book-date"
                type="date"
                min={dateInput(new Date())}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setSelectedSlot('')
                  setPageError('')
                }}
                disabled={!professionalId}
              />
              {loadingSlots ? (
                <div className="slot-loading">
                  <span className="skeleton" />
                  <span className="skeleton" />
                  <span className="skeleton" />
                </div>
              ) : slots.length ? (
                <div className="slot-grid" aria-label="Horários disponíveis">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={selectedSlot === slot ? 'slot-selected' : ''}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              ) : (
                professionalId && (
                  <p className="slots-empty">
                    Nenhum horário disponível nessa data. Tente outro dia.
                  </p>
                )
              )}
            </div>
          </div>
          <div className="booking-step">
            <span className="step-number">05</span>
            <div className="booking-field">
              <label htmlFor="book-notes">
                Observação <span className="optional-label">opcional</span>
              </label>
              <textarea
                id="book-notes"
                rows={3}
                maxLength={280}
                placeholder="Algo que a equipe precisa saber?"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        </div>
        <button
          className="button button-dark booking-submit"
          disabled={!selectedSlot || saving}
          onClick={() => void submitBooking()}
        >
          {saving
            ? 'Confirmando...'
            : originalAppointment
              ? 'Confirmar remarcação'
              : 'Confirmar horário'}{' '}
          <ArrowRight size={16} />
        </button>
        <span className="booking-secure">
          <ShieldCheck size={14} /> Seu horário é reservado com segurança.
        </span>
      </div>
      <aside className="booking-side">
        <div className="booking-side-art">
          <span>✳</span>
          <div>
            <CalendarPlus2 size={25} />
            <p>Seu tempo também merece cuidado.</p>
          </div>
        </div>
        <h3>O que acontece depois?</h3>
        <ul>
          <li>
            <Check size={15} /> Seu horário é reservado na hora
          </li>
          <li>
            <Check size={15} /> O estabelecimento recebe a confirmação
          </li>
          <li>
            <Check size={15} /> Você pode acompanhar tudo na sua agenda
          </li>
        </ul>
        <p className="booking-side-note">
          Precisa cancelar? Você pode gerenciar seus horários na área “Meus horários”.
        </p>
      </aside>
    </div>
  )
}

function ServicesPage({
  services,
  businessId,
  isAdmin,
  loading,
  onChanged,
}: {
  services: Service[]
  businessId: string | null
  isAdmin: boolean
  loading: boolean
  onChanged: () => void
}) {
  const { notify } = useToast()
  const [editing, setEditing] = useState<Service | null>(null)
  const [creating, setCreating] = useState(false)
  const form = useForm<ServiceFormInput, unknown, ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: '', description: '', duration_minutes: 30, price: 0 },
  })
  const errors = form.formState.errors
  const openNew = () => {
    setEditing(null)
    setCreating(true)
    form.reset({ name: '', description: '', duration_minutes: 30, price: 0 })
  }
  const openEdit = (service: Service) => {
    setEditing(service)
    setCreating(true)
    form.reset({
      name: service.name,
      description: service.description ?? '',
      duration_minutes: service.duration_minutes,
      price: service.price_cents / 100,
    })
  }
  const save = async (values: ServiceValues) => {
    if (!supabase || !businessId) return
    const record = {
      name: values.name,
      description: values.description || null,
      duration_minutes: values.duration_minutes,
      price_cents: Math.round(values.price * 100),
    }
    const result = editing
      ? await supabase.from('services').update(record).eq('id', editing.id)
      : await supabase.from('services').insert({ ...record, business_id: businessId })
    if (result.error) notify(`Não foi possível salvar o serviço: ${result.error.message}`, 'error')
    else {
      notify(editing ? 'Serviço atualizado.' : 'Serviço adicionado.')
      setCreating(false)
      await onChanged()
    }
  }
  const archive = async (service: Service) => {
    if (!supabase || !window.confirm(`Ocultar o serviço “${service.name}” dos novos agendamentos?`))
      return
    const { error } = await supabase.from('services').update({ active: false }).eq('id', service.id)
    if (error) notify(`Não foi possível atualizar o serviço: ${error.message}`, 'error')
    else {
      notify('Serviço removido dos agendamentos disponíveis.')
      await onChanged()
    }
  }
  return (
    <section className="panel services-page">
      <div className="agenda-page-header">
        <div>
          <span className="section-kicker">
            {isAdmin ? 'O QUE VOCÊ OFERECE' : 'CONHEÇA AS OPÇÕES'}
          </span>
          <h2>{isAdmin ? 'Seus serviços' : 'Serviços disponíveis'}</h2>
          <p>
            {isAdmin
              ? 'Atualize seus atendimentos e deixe os valores sempre claros.'
              : 'Escolha o serviço que combina com o que você precisa.'}
          </p>
        </div>
        {isAdmin && (
          <button className="button button-dark button-small" onClick={openNew}>
            <Plus size={16} /> Novo serviço
          </button>
        )}
      </div>
      {creating && (
        <form
          className="service-editor"
          onSubmit={(event) => void form.handleSubmit(save)(event)}
          noValidate
        >
          <div className="service-editor-heading">
            <strong>{editing ? 'Editar serviço' : 'Adicionar serviço'}</strong>
            <button
              type="button"
              aria-label="Fechar formulário"
              className="icon-button"
              onClick={() => setCreating(false)}
            >
              <X size={17} />
            </button>
          </div>
          <label className="field-label">
            Nome do serviço
            <input
              className="form-input"
              placeholder="Ex.: Corte e finalização"
              {...form.register('name')}
            />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </label>
          <label className="field-label">
            Descrição <span className="optional-label">opcional</span>
            <textarea
              rows={2}
              placeholder="Conte um pouco sobre esse atendimento"
              {...form.register('description')}
            />
          </label>
          <div className="service-editor-grid">
            <label className="field-label">
              Duração (minutos)
              <input
                className="form-input"
                type="number"
                min="15"
                max="480"
                step="15"
                {...form.register('duration_minutes')}
              />
              {errors.duration_minutes && (
                <span className="field-error">{errors.duration_minutes.message}</span>
              )}
            </label>
            <label className="field-label">
              Preço (R$)
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                {...form.register('price')}
              />
              {errors.price && <span className="field-error">{errors.price.message}</span>}
            </label>
          </div>
          <button
            className="button button-dark button-small"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar serviço'}{' '}
            <ArrowRight size={14} />
          </button>
        </form>
      )}
      {loading ? (
        <div className="service-grid">
          {[1, 2, 3].map((item) => (
            <span className="skeleton service-skeleton" key={item} />
          ))}
        </div>
      ) : services.filter((item) => item.active).length ? (
        <div className="service-grid">
          {services
            .filter((item) => item.active)
            .map((service, index) => (
              <article className="service-card" key={service.id}>
                <span className={`service-card-icon service-card-${index % 3}`}>
                  <Scissors size={18} />
                </span>
                {isAdmin && (
                  <button className="service-edit" onClick={() => openEdit(service)}>
                    Editar
                  </button>
                )}
                <h3>{service.name}</h3>
                <p>{service.description || 'Um atendimento preparado especialmente para você.'}</p>
                <div className="service-card-meta">
                  <span>
                    <Clock3 size={15} />
                    {service.duration_minutes} min
                  </span>
                  <strong>{formatCurrency(service.price_cents)}</strong>
                </div>
                {isAdmin && (
                  <button className="archive-service" onClick={() => void archive(service)}>
                    Ocultar serviço
                  </button>
                )}
              </article>
            ))}
        </div>
      ) : (
        <EmptyState
          icon={<Scissors size={20} />}
          title="Nenhum serviço cadastrado"
          copy={
            isAdmin
              ? 'Adicione o primeiro serviço para que seus clientes possam reservar um horário.'
              : 'Este estabelecimento ainda não publicou serviços.'
          }
          action={
            isAdmin ? (
              <button className="button button-dark button-small" onClick={openNew}>
                <Plus size={15} /> Adicionar serviço
              </button>
            ) : undefined
          }
        />
      )}
    </section>
  )
}

function SettingsPage({
  business,
  professionals,
  onChanged,
}: {
  business: Business | null
  professionals: Array<Professional & { name: string }>
  onChanged: () => void
}) {
  const { notify } = useToast()
  const [name, setName] = useState(business?.name ?? '')
  const [address, setAddress] = useState(business?.address ?? '')
  const [phone, setPhone] = useState(business?.phone ?? '')
  const [cancellationHours, setCancellationHours] = useState(
    String(business?.cancellation_hours ?? 24),
  )
  const [saving, setSaving] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (!business) {
      const parsed = businessSchema.safeParse({ name })
      if (!parsed.success) {
        notify(parsed.error.issues[0]?.message ?? 'Informe o nome do estabelecimento.', 'error')
        return
      }
      const slug = `${name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 6)}`
      setSaving(true)
      const { error } = await supabase.rpc('create_business', { p_name: name.trim(), p_slug: slug })
      if (error) notify(`Não foi possível criar o estabelecimento: ${error.message}`, 'error')
      else {
        notify('Estabelecimento criado.')
        await onChanged()
      }
      setSaving(false)
      return
    }
    const hours = Number(cancellationHours)
    if (!Number.isInteger(hours) || hours < 0 || hours > 720) {
      notify('O prazo deve ser de 0 a 720 horas.', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('businesses')
      .update({
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        cancellation_hours: hours,
      })
      .eq('id', business.id)
    if (error) notify(`Não foi possível salvar as configurações: ${error.message}`, 'error')
    else {
      notify('Configurações atualizadas.')
      await onChanged()
    }
    setSaving(false)
  }
  const inviteProfessional = async (event: React.FormEvent) => {
    event.preventDefault()
    if (
      !supabase ||
      inviteName.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)
    ) {
      notify('Informe um nome e um e-mail válido para convidar.', 'error')
      return
    }
    setInviting(true)
    const { error } = await supabase.functions.invoke('invite-professional', {
      body: { full_name: inviteName.trim(), email: inviteEmail.trim() },
    })
    if (error) notify(`Não foi possível convidar o profissional: ${error.message}`, 'error')
    else {
      notify('Convite enviado. O profissional receberá um e-mail para ativar o acesso.')
      setInviteName('')
      setInviteEmail('')
      await onChanged()
    }
    setInviting(false)
  }
  if (!business)
    return (
      <section className="settings-page">
        <div className="panel settings-panel">
          <div className="agenda-page-header">
            <div>
              <span className="section-kicker">SEU NEGÓCIO COMEÇA AQUI</span>
              <h2>Crie seu espaço de atendimento</h2>
              <p>Depois, você poderá adicionar serviços e compartilhar sua agenda.</p>
            </div>
          </div>
          <form className="settings-form" onSubmit={(event) => void saveSettings(event)}>
            <label className="field-label">
              Nome do estabelecimento
              <input
                className="form-input"
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Studio Aurora"
              />
            </label>
            <button className="button button-dark button-small" disabled={saving}>
              {saving ? 'Criando...' : 'Criar estabelecimento'} <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </section>
    )
  return (
    <div className="settings-page">
      <section className="panel settings-panel">
        <div className="agenda-page-header">
          <div>
            <span className="section-kicker">SEU ESPAÇO, SUAS REGRAS</span>
            <h2>Configurações do negócio</h2>
            <p>Essas informações ajudam seus clientes a encontrar e agendar com você.</p>
          </div>
          <span className="settings-shield">
            <ShieldCheck size={20} />
          </span>
        </div>
        <form className="settings-form" onSubmit={(event) => void saveSettings(event)}>
          <label className="field-label">
            Nome do estabelecimento
            <input
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Endereço
            <input
              className="form-input"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Rua, número, bairro e cidade"
            />
          </label>
          <label className="field-label">
            Telefone
            <input
              className="form-input"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(11) 99999-9999"
            />
          </label>
          <div className="settings-divider" />
          <div className="settings-group-heading">
            <div>
              <h3>Cancelamentos e remarcações</h3>
              <p>Clientes podem alterar ou cancelar seus próprios horários dentro deste prazo.</p>
            </div>
            <Clock3 size={18} />
          </div>
          <label className="field-label settings-hours">
            Prazo mínimo para cancelar{' '}
            <span>
              <input
                className="form-input"
                type="number"
                min="0"
                max="720"
                value={cancellationHours}
                onChange={(event) => setCancellationHours(event.target.value)}
              />{' '}
              horas de antecedência
            </span>
          </label>
          <button className="button button-dark button-small" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'} <ArrowRight size={15} />
          </button>
        </form>
      </section>
      <section className="panel settings-panel team-panel">
        <div className="agenda-page-header">
          <div>
            <span className="section-kicker">QUEM CUIDA DO SEU ESPAÇO</span>
            <h2>Equipe</h2>
            <p>Profissionais com acesso à agenda deste estabelecimento.</p>
          </div>
          <span className="team-count">{professionals.length} profissionais</span>
        </div>
        <form className="invite-form" onSubmit={(event) => void inviteProfessional(event)}>
          <label className="field-label">
            Nome
            <input
              className="form-input"
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              minLength={2}
              required
              placeholder="Nome do profissional"
            />
          </label>
          <label className="field-label">
            E-mail
            <input
              className="form-input"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              required
              placeholder="profissional@email.com"
            />
          </label>
          <button className="button button-outline button-small" disabled={inviting}>
            {inviting ? 'Enviando convite...' : 'Convidar profissional'} <ArrowRight size={14} />
          </button>
        </form>
        {professionals.length ? (
          <div className="team-list">
            {professionals.map((person) => (
              <div className="team-member" key={person.id}>
                <span className="table-avatar">{initials(person.name)}</span>
                <strong>{person.name}</strong>
                <span className="team-role">Profissional</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Users size={19} />}
            title="Equipe a configurar"
            copy="Envie um convite para dar acesso à agenda e ao estabelecimento."
          />
        )}
      </section>
    </div>
  )
}

type EditableHours = {
  weekday: number
  enabled: boolean
  open_time: string
  close_time: string
  break_start: string
  break_end: string
}
const weekdayNames = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]
const defaultHours = (): EditableHours[] =>
  weekdayNames.map((_, weekday) => ({
    weekday,
    enabled: weekday >= 1 && weekday <= 5,
    open_time: weekday === 6 ? '10:00' : '09:00',
    close_time: weekday === 6 ? '14:00' : '18:00',
    break_start: weekday === 6 ? '' : '12:00',
    break_end: weekday === 6 ? '' : '13:00',
  }))

function AvailabilityPage({
  profile,
  professionals,
  isAdmin,
}: {
  profile: Profile
  professionals: Array<Professional & { name: string }>
  isAdmin: boolean
}) {
  const { notify } = useToast()
  const [selectedId, setSelectedId] = useState('')
  const [hours, setHours] = useState(defaultHours)
  const [savingHours, setSavingHours] = useState(false)
  const [blocked, setBlocked] = useState<BlockedTime[]>([])
  const [blockDate, setBlockDate] = useState('')
  const [blockStart, setBlockStart] = useState('13:00')
  const [blockEnd, setBlockEnd] = useState('14:00')
  const [blockReason, setBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  const ownProfessional = professionals.find((item) => item.profile_id === profile.id)
  const professionalId =
    selectedId || (isAdmin ? (professionals[0]?.id ?? '') : (ownProfessional?.id ?? ''))

  useEffect(() => {
    const client = supabase
    if (!client || !professionalId) return
    let active = true
    void Promise.all([
      client.from('working_hours').select('*').eq('professional_id', professionalId),
      client
        .from('blocked_times')
        .select('*')
        .eq('professional_id', professionalId)
        .gte('ends_at', new Date().toISOString())
        .order('starts_at')
        .limit(30),
    ]).then(([hoursResult, blockedResult]) => {
      if (!active) return
      if (hoursResult.error || blockedResult.error)
        notify('Não foi possível carregar a disponibilidade.', 'error')
      const byDay = new Map((hoursResult.data ?? []).map((item) => [item.weekday, item]))
      setHours(
        defaultHours().map((fallback) => {
          const saved = byDay.get(fallback.weekday)
          return saved
            ? {
                ...fallback,
                enabled: true,
                open_time: saved.open_time.slice(0, 5),
                close_time: saved.close_time.slice(0, 5),
                break_start: saved.break_start?.slice(0, 5) ?? '',
                break_end: saved.break_end?.slice(0, 5) ?? '',
              }
            : { ...fallback, enabled: false }
        }),
      )
      setBlocked(blockedResult.data ?? [])
    })
    return () => {
      active = false
    }
  }, [professionalId, notify])

  const changeHours = (weekday: number, patch: Partial<EditableHours>) => {
    setHours((current) =>
      current.map((item) => (item.weekday === weekday ? { ...item, ...patch } : item)),
    )
  }
  const saveAvailability = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !professionalId) return
    const activeHours = hours.filter((item) => item.enabled)
    if (
      activeHours.some(
        (item) =>
          item.open_time >= item.close_time ||
          Boolean(item.break_start) !== Boolean(item.break_end) ||
          (item.break_start &&
            (item.break_start <= item.open_time ||
              item.break_end <= item.break_start ||
              item.break_end >= item.close_time)),
      )
    ) {
      notify('Revise os horários de abertura, fechamento e intervalo.', 'error')
      return
    }
    setSavingHours(true)
    const { error } = await supabase.rpc('save_weekly_availability', {
      p_professional_id: professionalId,
      p_hours: activeHours.map(({ weekday, open_time, close_time, break_start, break_end }) => ({
        weekday,
        open_time: `${open_time}:00`,
        close_time: `${close_time}:00`,
        break_start: break_start ? `${break_start}:00` : null,
        break_end: break_end ? `${break_end}:00` : null,
      })),
    })
    if (error)
      notify(
        error.message.includes('working_hours_conflict')
          ? 'Existem agendamentos futuros fora dos novos horários. Cancele ou ajuste esses horários antes de salvar.'
          : `Não foi possível salvar a disponibilidade: ${error.message}`,
        'error',
      )
    else notify('Disponibilidade semanal atualizada.')
    setSavingHours(false)
  }
  const addBlockedTime = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !professionalId || !blockDate || blockStart >= blockEnd) {
      notify('Escolha uma data e um intervalo de bloqueio válido.', 'error')
      return
    }
    const start = new Date(`${blockDate}T${blockStart}`)
    if (start <= new Date()) {
      notify('O bloqueio deve começar no futuro.', 'error')
      return
    }
    setSavingBlock(true)
    const { data, error } = await supabase
      .from('blocked_times')
      .insert({
        professional_id: professionalId,
        starts_at: start.toISOString(),
        ends_at: new Date(`${blockDate}T${blockEnd}`).toISOString(),
        reason: blockReason.trim() || null,
      })
      .select('*')
      .single()
    if (error)
      notify(
        error.message.includes('blocked_time_conflicts')
          ? 'Este intervalo conflita com um agendamento existente.'
          : `Não foi possível bloquear o horário: ${error.message}`,
        'error',
      )
    else {
      setBlocked((current) =>
        [...current, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      )
      setBlockReason('')
      notify('Horário bloqueado.')
    }
    setSavingBlock(false)
  }
  const removeBlockedTime = async (item: BlockedTime) => {
    if (!supabase || !window.confirm('Remover este bloqueio de horário?')) return
    const { error } = await supabase.from('blocked_times').delete().eq('id', item.id)
    if (error) notify(`Não foi possível remover o bloqueio: ${error.message}`, 'error')
    else {
      setBlocked((current) => current.filter((entry) => entry.id !== item.id))
      notify('Bloqueio removido.')
    }
  }

  return (
    <div className="availability-page">
      <section className="panel availability-panel">
        <div className="agenda-page-header">
          <div>
            <span className="section-kicker">NO SEU RITMO</span>
            <h2>Disponibilidade semanal</h2>
            <p>
              Defina seus dias e horários de atendimento. Nenhuma reserva será oferecida fora deles.
            </p>
          </div>
          <Clock3 size={20} className="muted-icon" />
        </div>
        {isAdmin && professionals.length > 1 && (
          <label className="field-label availability-professional">
            Profissional
            <select
              className="form-input"
              value={professionalId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {professionals.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!professionalId ? (
          <EmptyState
            icon={<Users size={20} />}
            title="Nenhum profissional vinculado"
            copy="Convide um profissional antes de definir os horários da equipe."
          />
        ) : (
          <form className="availability-form" onSubmit={(event) => void saveAvailability(event)}>
            <div className="hours-table">
              {hours.map((item) => (
                <div
                  className={`hours-row ${item.enabled ? '' : 'hours-row-disabled'}`}
                  key={item.weekday}
                >
                  <label className="hours-day">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) =>
                        changeHours(item.weekday, { enabled: event.target.checked })
                      }
                    />
                    <span>{weekdayNames[item.weekday]}</span>
                  </label>
                  {item.enabled ? (
                    <>
                      <input
                        aria-label={`${weekdayNames[item.weekday]} abre às`}
                        type="time"
                        value={item.open_time}
                        onChange={(event) =>
                          changeHours(item.weekday, { open_time: event.target.value })
                        }
                      />
                      <span className="hours-separator">até</span>
                      <input
                        aria-label={`${weekdayNames[item.weekday]} fecha às`}
                        type="time"
                        value={item.close_time}
                        onChange={(event) =>
                          changeHours(item.weekday, { close_time: event.target.value })
                        }
                      />
                      <label className="hours-break">
                        <span>Pausa</span>
                        <input
                          aria-label={`${weekdayNames[item.weekday]} início da pausa`}
                          type="time"
                          value={item.break_start}
                          onChange={(event) =>
                            changeHours(item.weekday, { break_start: event.target.value })
                          }
                        />
                        <span>—</span>
                        <input
                          aria-label={`${weekdayNames[item.weekday]} fim da pausa`}
                          type="time"
                          value={item.break_end}
                          onChange={(event) =>
                            changeHours(item.weekday, { break_end: event.target.value })
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <span className="day-off">Folga</span>
                  )}
                </div>
              ))}
            </div>
            <button className="button button-dark button-small" disabled={savingHours}>
              {savingHours ? 'Salvando...' : 'Salvar disponibilidade'} <ArrowRight size={14} />
            </button>
          </form>
        )}
      </section>
      <section className="panel availability-panel">
        <div className="agenda-page-header">
          <div>
            <span className="section-kicker">UM TEMPO PARA VOCÊ</span>
            <h2>Bloquear um horário</h2>
            <p>Adicione folgas, pausas ou compromissos fora da agenda.</p>
          </div>
          <CalendarDays size={20} className="muted-icon" />
        </div>
        <form className="block-time-form" onSubmit={(event) => void addBlockedTime(event)}>
          <label className="field-label">
            Dia
            <input
              className="form-input"
              type="date"
              min={dateInput(new Date())}
              value={blockDate}
              onChange={(event) => setBlockDate(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Início
            <input
              className="form-input"
              type="time"
              value={blockStart}
              onChange={(event) => setBlockStart(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Fim
            <input
              className="form-input"
              type="time"
              value={blockEnd}
              onChange={(event) => setBlockEnd(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Motivo <span className="optional-label">opcional</span>
            <input
              className="form-input"
              maxLength={240}
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="Ex.: compromisso pessoal"
            />
          </label>
          <button className="button button-outline button-small" disabled={savingBlock}>
            {savingBlock ? 'Bloqueando...' : 'Bloquear intervalo'} <Plus size={14} />
          </button>
        </form>
        {blocked.length ? (
          <div className="blocked-list">
            {blocked.map((item) => (
              <div className="blocked-row" key={item.id}>
                <span className="blocked-icon">
                  <Clock3 size={14} />
                </span>
                <span>
                  <strong>
                    {formatDate(item.starts_at, {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    · {formatTime(item.starts_at)}–{formatTime(item.ends_at)}
                  </strong>
                  <small>{item.reason || 'Indisponível'}</small>
                </span>
                <button
                  className="card-cancel"
                  aria-label="Remover bloqueio"
                  onClick={() => void removeBlockedTime(item)}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="blocked-empty">
            Nenhum bloqueio próximo. Os horários reservados já ficam protegidos automaticamente.
          </p>
        )}
      </section>
    </div>
  )
}

function BusinessSetup({ onCreated }: { onCreated: () => Promise<void> }) {
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = businessSchema.safeParse({ name })
    if (!result.success) {
      notify(result.error.issues[0]?.message ?? 'Informe o nome.', 'error')
      return
    }
    if (!supabase) return
    const slug = `${name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 6)}`
    setSaving(true)
    const { error } = await supabase.rpc('create_business', { p_name: name.trim(), p_slug: slug })
    if (error) notify(`Não foi possível criar o estabelecimento: ${error.message}`, 'error')
    else {
      notify('Seu estabelecimento está pronto.')
      await onCreated()
    }
    setSaving(false)
  }
  return (
    <form className="business-setup-form" onSubmit={(event) => void submit(event)}>
      <label className="field-label">
        Nome do estabelecimento
        <input
          className="form-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          placeholder="Ex.: Studio Aurora"
        />
      </label>
      <button className="button button-dark" disabled={saving}>
        {saving ? 'Criando...' : 'Criar meu espaço'} <ArrowRight size={15} />
      </button>
    </form>
  )
}
