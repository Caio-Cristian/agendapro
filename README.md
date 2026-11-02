# AgendaPro

AgendaPro é uma plataforma de agendamentos para pequenos negócios de serviços. Clientes encontram horários e reservam atendimentos; administradores e profissionais acompanham a agenda do próprio estabelecimento.

> **Estado do projeto:** aplicação React funcional e pronta para conectar a um projeto Supabase. A autenticação, os dados persistentes, os convites por e-mail e as reservas passam a funcionar após a configuração descrita abaixo. Não há credenciais ou contas fictícias incluídas.

## Prévia

A página inicial e o painel usam uma identidade visual própria, responsiva e acessível.

![Página inicial do AgendaPro](./public/agenda-pro-home.png)

## Funcionalidades

- **Acesso:** cadastro e login por e-mail, recuperação de senha, sessão persistente e logout pelo Supabase Auth.
- **Onboarding:** cadastro opcional de estabelecimento durante o cadastro. O banco cria o perfil administrativo, a equipe inicial e o estabelecimento em uma única operação de trigger.
- **Cliente:** catálogo de estabelecimentos e serviços, consulta de disponibilidade, reserva, histórico, cancelamento e remarcação dentro das regras do negócio.
- **Administração:** painel com indicadores por dia, semana, mês e período personalizado; agenda; busca de clientes; cadastro, edição e arquivamento de serviços; configuração de cancelamento; convites de profissionais; disponibilidade e bloqueios.
- **Profissional:** agenda limitada aos próprios atendimentos, confirmação e conclusão de consultas, configuração da disponibilidade e bloqueio de horários.
- **Agendamento seguro:** validação da duração, do expediente, das pausas, das folgas e dos bloqueios no banco. Lock transacional por profissional e restrição de exclusão PostgreSQL impedem horários sobrepostos mesmo em reservas concorrentes.
- **Notificações internas:** criação transacional para cliente e profissional em reservas e mudanças de status; leitura e marcação como lida no painel.
- **Segurança:** políticas RLS por perfil e estabelecimento; dados de clientes restritos ao titular, à administração do estabelecimento e ao profissional com atendimento relacionado.
- **Qualidade de uso:** estados vazios e de carregamento, validação de formulários, feedback de erros, confirmação antes de cancelar, navegação por teclado e layouts adaptados a telas pequenas.

## Tecnologias

- React 19, TypeScript em modo strict, Vite e Tailwind CSS.
- React Router, React Hook Form, Zod e Lucide React.
- Supabase Auth, PostgreSQL, Row Level Security e Edge Functions.
- Vitest, Testing Library e ESLint.

## Arquitetura

```text
src/
  components/    Toasts e componentes de interface compartilhados
  context/       Sessão e perfil autenticados
  lib/           Cliente Supabase, formatação e regras puras
  pages/         Site público, acesso e área de trabalho por perfil
  schemas/       Schemas Zod e testes de validação
  test/          Configuração do Testing Library
  types/         Tipos do banco e do domínio
supabase/
  migrations/    Schema, índices, funções transacionais e políticas RLS
  functions/     Convite autenticado de profissionais por e-mail
  seed.sql       Catálogo e horários demonstrativos opcionais
```

O navegador usa somente a chave **publishable** (ou a chave legada **anon/public**) do Supabase. Operações privilegiadas (cadastro de negócio, convites e reservas) são validadas por funções SQL com `SECURITY DEFINER`, permissões restritas e contexto de usuário autenticado. A chave `service_role` é usada exclusivamente no ambiente isolado da Edge Function.

## Requisitos

- Node.js 20.19+ (ou 22.12+) e npm.
- Projeto Supabase próprio.
- Supabase CLI para aplicar migrations e publicar a Edge Function (opcionalmente via `npx supabase`).

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com/) e habilite o provedor de e-mail em **Authentication → Providers**.
2. Em **Authentication → URL Configuration**, inclua `http://localhost:5173/redefinir-senha` e a URL de produção no redirect allow list.
3. Configure as chaves locais:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Preencha `VITE_SUPABASE_URL` em `.env.local` com a URL do projeto e `VITE_SUPABASE_ANON_KEY` com a chave **publishable** (ou **anon/public**) disponível em **Project Settings → API Keys**. Nunca use a chave `service_role` ou uma chave `sb_secret_` no frontend.

4. Aplique a migration no projeto:

   ```powershell
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```

   Alternativamente, execute os arquivos de `supabase/migrations/` no SQL Editor do painel, em ordem: primeiro `202611020001_agendapro.sql`, depois `202611020002_restrict_function_permissions.sql`. A segunda migration remove permissões anônimas das funções que exigem autenticação. Não execute os dois métodos para a mesma migration.

5. Publique o convite de profissionais:

   ```powershell
   npx supabase functions deploy invite-professional
   ```

   A função usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` fornecidas pelo ambiente Supabase. Revise as configurações de SMTP e os templates de convite no Auth para envio de e-mail em produção.

6. (Opcional) Depois de criar um estabelecimento e convidar um profissional, execute `supabase/seed.sql` para inserir serviços e horários de demonstração. O script não cria contas ou agendamentos falsos e não altera empresas quando não encontra uma conta administrativa.

## Desenvolvimento

```powershell
npm install
npm run dev
```

O Vite abre `http://localhost:5173`. Sem as variáveis do Supabase, a landing page permanece navegável e a autenticação mostra uma mensagem explícita; operações de negócio não simulam sucesso.

## Verificações

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes cobrem validação de cadastro e serviços e as regras puras de sobreposição e disponibilidade. A migration executa as verificações de reserva no PostgreSQL; testes concorrentes de integração precisam de um projeto Supabase configurado.

## Deploy na Vercel

1. Envie o repositório ao GitHub e importe-o na Vercel.
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis do projeto Vercel.
3. Use `npm run build` como comando de build e `dist` como diretório de saída.
4. Configure rewrites para que rotas do React Router retornem `index.html` (inclua `vercel.json` se a configuração padrão não fizer fallback).
5. Inclua a URL de produção do site e `/redefinir-senha` no redirect allow list do Supabase.
6. Publique a Edge Function no Supabase e valide o envio de convites com o SMTP configurado.

## Limitações conhecidas / configuração externa

- Cada instalação precisa de um projeto Supabase próprio, das migrations aplicadas e da Edge Function publicada. O envio real de convites depende da configuração de e-mail/SMTP do ambiente.
- Notificações internas estão implementadas. Lembretes por e-mail/SMS, pagamentos, planos faturados e sincronização com calendários externos não estão incluídos.
- O feed de notificações é atualizado quando aberto; não há assinatura Realtime ativa.
- Indicadores e listagens do painel consideram até 200 reservas no intervalo consultado.
- A primeira conta que cria um negócio também recebe um registro de profissional para configurar o expediente inicial. Profissionais adicionais recebem convite por e-mail e configuram seus horários após entrar.
- A validação de regras e as políticas RLS estão versionadas em SQL, mas a migration precisa ser aplicada a uma instância Supabase para validação de integração real.

## Segurança e segredos

`.env.local` não deve ser versionado. Use `.env.example` somente como referência, nunca cole chaves privadas nele e armazene segredos de Edge Functions no Supabase. Em produção, configure SMTP, URLs de redirecionamento, domínios permitidos e políticas de retenção adequados ao negócio.
