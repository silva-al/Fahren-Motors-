# Diretrizes Gerais de Desenvolvimento (Padrões de Engenharia)

Você deve seguir rigorosamente estas 5 diretrizes fundamentais em qualquer projeto ao criar, refatorar ou analisar código:

---

## 1. ⚛️ React & Next.js Performance (@react-best-practices)
- **Elimine Waterfalls:** Inicie promessas assíncronas cedo e utilize `Promise.all()` para operações independentes ou streaming com `<Suspense>`.
- **Otimização de Pacotes (Bundle Size):** Evite importações de arquivos de barril (*barrel files*). Importe diretamente dos módulos de origem. Use `next/dynamic` para componentes pesados que não são imediatamente visíveis.
- **Prevenção de Re-renders:** Isole estados em componentes filhos menores e preserve imutabilidade.

---

## 2. 🎨 Tailwind CSS & Design System (@tailwind-design-system)
- **Consistência Visual:** Utilize tokens de cores, tipografia e espaçamentos consistentes.
- **Responsividade e Dark Mode:** Todos os componentes visuais devem suportar breakpoints responsivos (`sm:`, `md:`, `lg:`) e ter compatibilidade nativa com modo escuro (`dark:`).
- **Acessibilidade (a11y):** Garanta bom contraste de cores, tags HTML semânticas adequadas (`<button>`, `<main>`, `<nav>`) e atributos `aria-*` quando apropriado.

---

## 3. 🛡️ Segurança de Aplicações & APIs (@api-security-best-practices)
- **Validação de Entrada:** Valide e sanitize rigorosamente todas as entradas de dados na borda/API usando bibliotecas de schema (ex: Zod, Valibot).
- **Proteção OWASP Top 10:** Blinde contra Injeções (SQL/NoSQL), Cross-Site Scripting (XSS), CSRF e IDOR (Insecure Direct Object References).
- **Gerenciamento Seguro:** Armazene segredos exclusivamente em variáveis de ambiente (`.env`). Nunca exponha credenciais, tokens de acesso ou senhas no código ou no lado do cliente.

---

## 4. 🗄️ Modelagem e Arquitetura de Dados (@database-architect)
- **Schemas Estruturados:** Modele schemas com tipos explícitos, integridade referencial e chaves estrangeiras bem definidas.
- **Indexação Estratégica:** Crie índices em campos de consulta frequente, filtros e chaves estrangeiras para evitar varreduras completas (*table scans*).
- **Migrações Seguras:** Planeje migrações de dados incrementais sem perda de dados e preparadas para zero-downtime.

---

## 5. 🧪 Qualidade de Software & Testes (@test-driven-development)
- **Mentalidade TDD:** Projete testes considerando casos de sucesso, valores de borda (limiares) e cenários de erro esperados.
- **Pirâmide de Testes:**
  - Testes unitários rápidos e focados para regras de negócio (usando Vitest ou Jest).
  - Testes de integração para validar a comunicação entre camadas.
  - Testes ponta a ponta (E2E) com Playwright para fluxos críticos do usuário.

