import {
  ArrowDownRight,
  ArrowRight,
  CalendarCheck2,
  Check,
  Clock3,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const features = [
  {
    icon: CalendarCheck2,
    title: 'Agenda sem conflitos',
    copy: 'Disponibilidade em tempo real e reservas protegidas até quando dois clientes tentam o mesmo horário.',
  },
  {
    icon: Clock3,
    title: 'Mais tempo para atender',
    copy: 'Serviços, equipe e horários organizados em um só lugar. Menos mensagens, mais atendimento.',
  },
  {
    icon: ShieldCheck,
    title: 'Seus dados, protegidos',
    copy: 'Acesso por perfil e isolamento entre estabelecimentos com políticas de segurança no banco de dados.',
  },
]

export function PublicSite() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="marketing">
      <header className="marketing-header">
        <Link to="/" className="brand-lockup" aria-label="AgendaPro início">
          <span className="brand-mark">
            <CalendarCheck2 size={19} />
          </span>
          <span>
            agenda<span className="brand-light">pro</span>
          </span>
        </Link>
        <button
          className="mobile-menu"
          type="button"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={menuOpen ? 'marketing-nav nav-open' : 'marketing-nav'}>
          <a href="#recursos" onClick={() => setMenuOpen(false)}>
            Recursos
          </a>
          <a href="#como-funciona" onClick={() => setMenuOpen(false)}>
            Como funciona
          </a>
          <a href="#precos" onClick={() => setMenuOpen(false)}>
            Planos
          </a>
          <Link className="nav-login" to="/entrar">
            Entrar
          </Link>
          <Link className="button button-dark button-small" to="/cadastro">
            Começar grátis <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" /> A rotina do seu negócio, no ritmo certo
            </div>
            <h1>
              Seu talento merece uma agenda <span>à altura.</span>
            </h1>
            <p className="hero-description">
              Uma forma mais leve de cuidar dos horários, encantar seus clientes e fazer seu negócio
              crescer.
            </p>
            <div className="hero-actions">
              <Link className="button button-dark" to="/cadastro">
                Organizar minha agenda <ArrowRight size={17} />
              </Link>
              <a className="text-link" href="#recursos">
                Conhecer a plataforma <ArrowDownRight size={16} />
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack">
                <span>MA</span>
                <span>JC</span>
                <span>LP</span>
                <span>+</span>
              </div>
              <div>
                <div className="rating">
                  <Star size={13} fill="currentColor" /> <strong>4,9/5</strong>
                </div>
                <span className="proof-caption">feito para quem cuida de pessoas</span>
              </div>
            </div>
          </div>
          <div className="hero-art" aria-label="Prévia ilustrativa do painel AgendaPro">
            <div className="hero-glow" />
            <div className="floating-note note-top">
              <span className="note-icon note-green">
                <Check size={16} />
              </span>
              <span>
                <strong>Agenda confirmada</strong>
                <small>Hoje, às 14:30</small>
              </span>
            </div>
            <div className="preview-card">
              <div className="preview-top">
                <div>
                  <span className="preview-overline">SEGUNDA-FEIRA, 02 NOV</span>
                  <h2>
                    Bom dia, Marina <span>☀</span>
                  </h2>
                </div>
                <div className="preview-avatar">MC</div>
              </div>
              <div className="preview-metrics">
                <div>
                  <small>Atendimentos</small>
                  <strong>12</strong>
                  <span className="trend">↗ 18% esta semana</span>
                </div>
                <div className="mini-chart" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="agenda-title">
                <strong>Próximos horários</strong>
                <span>
                  Ver agenda <ArrowRight size={12} />
                </span>
              </div>
              <div className="preview-appointment">
                <span className="time-pill">09:30</span>
                <span className="appointment-person">
                  <b className="person-dot" />
                  <span>
                    <strong>Ana Carolina</strong>
                    <small>Design de sobrancelha</small>
                  </span>
                </span>
                <span className="status-dot" aria-label="Confirmado" />
              </div>
              <div className="preview-appointment">
                <span className="time-pill">10:45</span>
                <span className="appointment-person">
                  <b className="person-dot person-dot-lilac" />
                  <span>
                    <strong>Julia Martins</strong>
                    <small>Limpeza de pele</small>
                  </span>
                </span>
                <span className="status-dot status-dot-wait" aria-label="Pendente" />
              </div>
              <div className="preview-appointment">
                <span className="time-pill">13:00</span>
                <span className="appointment-person">
                  <b className="person-dot person-dot-amber" />
                  <span>
                    <strong>Larissa Prado</strong>
                    <small>Consulta inicial</small>
                  </span>
                </span>
                <span className="status-dot" aria-label="Confirmado" />
              </div>
            </div>
            <div className="floating-note note-bottom">
              <span className="note-icon note-purple">
                <Sparkles size={16} />
              </span>
              <span>
                <strong>Seu dia, mais leve</strong>
                <small>O próximo cliente já confirmou</small>
              </span>
            </div>
          </div>
        </section>

        <div className="trust-strip">
          <span>FEITO PARA QUEM FAZ ACONTECER</span>
          <div>
            <b>✳</b> BELEZA & BEM-ESTAR
          </div>
          <div>
            <b>⌂</b> SAÚDE & CUIDADO
          </div>
          <div>
            <b>◌</b> PROFISSIONAIS AUTÔNOMOS
          </div>
          <div>
            <b>✦</b> ESTÚDIOS & CLÍNICAS
          </div>
        </div>

        <section className="features-section" id="recursos">
          <div className="section-heading">
            <span className="section-kicker">CUIDADO EM CADA DETALHE</span>
            <h2>
              Organização que aparece
              <br />
              em cada atendimento.
            </h2>
            <p>Menos tempo resolvendo horários. Mais tempo entregando o que você faz de melhor.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, copy }, index) => (
              <article className="feature-card" key={title}>
                <span className={`feature-icon feature-icon-${index}`}>
                  <Icon size={20} />
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <a href="#como-funciona">
                  Saiba mais <ArrowRight size={14} />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="steps-section" id="como-funciona">
          <div className="steps-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="steps-center">
              <CalendarCheck2 size={30} />
              <span>
                agenda
                <br />
                pro
              </span>
            </div>
            <span className="orbit-label orbit-a">Serviços</span>
            <span className="orbit-label orbit-b">Agenda</span>
            <span className="orbit-label orbit-c">Clientes</span>
          </div>
          <div className="steps-copy">
            <span className="section-kicker">SIMPLES DESDE O PRIMEIRO DIA</span>
            <h2>Da primeira reserva à próxima fase do seu negócio.</h2>
            <p>
              Monte sua estrutura, compartilhe seus horários e acompanhe tudo com clareza. O
              AgendaPro cuida dos detalhes para você focar nas pessoas.
            </p>
            <div className="step-list">
              <div>
                <span>01</span>
                <p>
                  <strong>Configure seu espaço</strong>
                  <small>Adicione serviços, equipe e horários de atendimento.</small>
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>Compartilhe sua agenda</strong>
                  <small>Seus clientes escolhem o melhor horário para eles.</small>
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>Atenda com tranquilidade</strong>
                  <small>Acompanhe confirmações, mudanças e resultados.</small>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="pricing-section" id="precos">
          <div className="pricing-copy">
            <span className="section-kicker">COMECE DO SEU JEITO</span>
            <h2>
              Um começo leve.
              <br />
              Espaço para crescer.
            </h2>
            <p>
              Crie sua conta e explore a plataforma. Você só precisa das suas informações e alguns
              minutos para começar.
            </p>
            <Link className="button button-dark" to="/cadastro">
              Criar minha conta <ArrowRight size={16} />
            </Link>
          </div>
          <div className="pricing-card">
            <span className="pricing-label">PARA NEGÓCIOS QUE ESTÃO COMEÇANDO</span>
            <h3>Agenda essencial</h3>
            <div className="price">
              <strong>Grátis</strong>
              <span>para conhecer a plataforma</span>
            </div>
            <ul>
              <li>
                <Check size={16} /> Agenda digital e gestão de reservas
              </li>
              <li>
                <Check size={16} /> Cadastro de serviços e profissionais
              </li>
              <li>
                <Check size={16} /> Lembretes e status de atendimento
              </li>
              <li>
                <Check size={16} /> Dados seguros e separados por negócio
              </li>
            </ul>
            <Link className="button button-outline" to="/cadastro">
              Começar agora <ArrowRight size={15} />
            </Link>
            <small>Sem cartão de crédito. Sem compromisso.</small>
          </div>
        </section>

        <section className="final-cta">
          <div>
            <span className="section-kicker">SUA AGENDA PODE SER MAIS LEVE</span>
            <h2>Pronto para cuidar do seu tempo?</h2>
            <p>Comece hoje. O próximo horário pode ser o início de algo maior.</p>
          </div>
          <Link className="button button-light" to="/cadastro">
            Criar minha conta <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="marketing-footer">
        <Link to="/" className="brand-lockup">
          <span className="brand-mark">
            <CalendarCheck2 size={17} />
          </span>
          <span>
            agenda<span className="brand-light">pro</span>
          </span>
        </Link>
        <span>Feito para cuidar bem do seu tempo. © {new Date().getFullYear()} AgendaPro</span>
        <a href="mailto:contato@agendapro.app">Fale com a gente</a>
      </footer>
    </div>
  )
}
