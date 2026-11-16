# Tutorial — Construindo um Process Monitor

Guia passo a passo para construir o projeto do zero, na ordem em que deve ser feito.
Cada etapa é executável e testável antes de seguir para a próxima.

Stack:
- Backend: Node.js + Express + systeminformation
- Frontend: React + Vite + Recharts + Axios
- CSS: **mobile first**, responsivo com breakpoints crescentes

---

## Pré-requisitos

- Node.js 20+
- npm
- Terminal (bash, zsh ou PowerShell)
- Editor de código

Verificar:

```bash
node -v
npm -v
```

---

## Etapa 1 — Criar o monorepo

```bash
mkdir process-monitor
cd process-monitor
npm init -y
npm install -D concurrently
```

Editar `package.json` da raiz:

```json
{
  "name": "process-monitor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:backend": "npm --prefix backend run dev",
    "dev:frontend": "npm --prefix frontend run dev",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\""
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

O `concurrently` permite subir backend e frontend com um único comando.

---

## Etapa 2 — Criar o backend

```bash
mkdir backend
cd backend
npm init -y
npm install express cors systeminformation
npm install -D nodemon
```

Editar `backend/package.json` e adicionar os scripts:

```json
"scripts": {
  "dev": "nodemon server.js",
  "start": "node server.js"
}
```

Voltar para a raiz:

```bash
cd ..
```

---

## Etapa 3 — Escrever o servidor Express

Criar `backend/server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const si = require('systeminformation');

const app = express();
app.use(cors());

// Lista de processos (top 30 por CPU)
app.get('/api/processes', async (req, res) => {
  const { list, all } = await si.processes();
  const top = list
    .map(p => ({
      pid: p.pid,
      name: p.name,
      cpu: Number(p.cpu.toFixed(1)),
      mem: Number(p.mem.toFixed(1)),
      user: p.user,
    }))
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 30);

  res.json({ total: all, list: top });
});

// Resumo do sistema
app.get('/api/summary', async (req, res) => {
  const [load, mem, os] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.osInfo(),
  ]);

  res.json({
    cpu: Math.round(load.currentLoad),
    memPercent: Math.round((mem.used / mem.total) * 100),
    memUsed: mem.used,
    memTotal: mem.total,
    os: `${os.distro} ${os.release}`,
    uptime: si.time().uptime,
  });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Backend em http://localhost:${PORT}`));
```

O que esse arquivo faz:
- Habilita CORS para o frontend poder chamar a API
- Expõe `GET /api/processes` retornando os 30 processos mais pesados em CPU
- Expõe `GET /api/summary` retornando CPU, RAM e dados do SO
- Usa `Promise.all` para buscar as métricas em paralelo

---

## Etapa 4 — Testar o backend pelo terminal

Subir o servidor:

```bash
npm run dev:backend
```

Deve aparecer:

```
Backend em http://localhost:3001
```

Em outro terminal, testar os endpoints:

```bash
curl http://localhost:3001/api/summary
curl http://localhost:3001/api/processes
```

Ou abrir no navegador:
- http://localhost:3001/api/summary
- http://localhost:3001/api/processes

Rodar o `curl` de processos duas vezes seguidas para ver os valores de CPU mudando.

Se os dois endpoints retornarem JSON, o backend está pronto.

---

## Etapa 5 — Criar o frontend

Na raiz do projeto:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios recharts
cd ..
```

Configurar o proxy em `frontend/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

O proxy evita problemas de CORS e permite chamar `/api/...` sem domínio completo.

---

## Etapa 6 — Escrever o App

Substituir `frontend/src/App.jsx`:

```jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import './App.css';

const fmtBytes = (b) => {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
};

const fmtUptime = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
};

export default function App() {
  const [procs, setProcs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [p, s] = await Promise.all([
          axios.get('/api/processes'),
          axios.get('/api/summary'),
        ]);
        setProcs(p.data.list);
        setSummary(s.data);
        setHistory((prev) => [
          ...prev.slice(-39),
          {
            t: new Date().toLocaleTimeString().slice(0, 8),
            cpu: s.data.cpu,
            mem: s.data.memPercent,
          },
        ]);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 2000);
    return () => clearInterval(id);
  }, []);

  if (!summary) return <div className="loading">Carregando...</div>;

  const topCpu = [...procs].sort((a, b) => b.cpu - a.cpu).slice(0, 20);

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🖥️</span>
          <div>
            <h1>Process Monitor</h1>
            <p>{summary.os}</p>
          </div>
        </div>
        <div className="live">
          <span className="dot" /> ao vivo
        </div>
      </header>

      <section className="kpis">
        <Kpi label="CPU" value={`${summary.cpu}%`} color="#6366f1" percent={summary.cpu} />
        <Kpi label="RAM" value={`${summary.memPercent}%`} color="#10b981" percent={summary.memPercent} />
        <Kpi label="Processos" value={procs.length} color="#f59e0b" sub="top 30 exibidos" />
        <Kpi label="Uptime" value={fmtUptime(summary.uptime)} color="#06b6d4" />
        <Kpi
          label="Memória"
          value={`${fmtBytes(summary.memUsed)} / ${fmtBytes(summary.memTotal)}`}
          color="#ec4899"
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Uso em tempo real</h2>
          <div className="legend">
            <span><i style={{ background: '#6366f1' }} /> CPU</span>
            <span><i style={{ background: '#10b981' }} /> RAM</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="t" stroke="#6b7280" fontSize={11} />
            <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: 8,
                color: '#e5e7eb',
              }}
            />
            <Line type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={2} dot={false} name="CPU %" />
            <Line type="monotone" dataKey="mem" stroke="#10b981" strokeWidth={2} dot={false} name="RAM %" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Top processos por CPU</h2>
          <span className="muted">atualiza a cada 2s</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PID</th>
                <th>Nome</th>
                <th className="col-cpu">CPU</th>
                <th className="col-mem">RAM</th>
                <th className="col-user">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {topCpu.map((p) => (
                <tr key={p.pid}>
                  <td className="mono">{p.pid}</td>
                  <td className="name">
                    <span className="name-full">{p.name}</span>
                    <span className="name-mobile">
                      <strong>{p.name}</strong>
                      <small>CPU {p.cpu.toFixed(1)}% · RAM {p.mem.toFixed(1)}%</small>
                    </span>
                  </td>
                  <td className="col-cpu"><Bar value={p.cpu} color="#6366f1" /></td>
                  <td className="col-mem"><Bar value={p.mem} color="#10b981" /></td>
                  <td className="col-user muted">{p.user || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, color, percent, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        <span className="kpi-dot" style={{ background: color }} />
        {label}
      </div>
      <div className="kpi-value">{value}</div>
      {percent !== undefined ? (
        <div className="kpi-bar">
          <div style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
        </div>
      ) : (
        <div className="kpi-sub">{sub || '\u00A0'}</div>
      )}
    </div>
  );
}

function Bar({ value, color }) {
  return (
    <div className="bar-cell">
      <div className="bar">
        <div style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="bar-value">{value.toFixed(1)}%</span>
    </div>
  );
}
```

O que esse arquivo faz:
- Busca `/api/processes` e `/api/summary` a cada 2 segundos
- Guarda as últimas 40 amostras para o gráfico
- Renderiza topbar, cards KPI, gráfico e tabela
- Na tabela, `name-full` e `name-mobile` são alternados via CSS:
  - **mobile**: nome + linha secundária com CPU/RAM (cabe na tela)
  - **desktop**: nome em uma linha e colunas separadas de CPU/RAM/Usuário

---

## Etapa 7 — Escrever o CSS (mobile first)

Substituir `frontend/src/App.css`.

Regra do mobile first: **estilos base são para telas pequenas**. Os `@media` só **adicionam** o que muda em telas maiores (usando `min-width`).

```css
/* =========================================================
   RESET + VARIÁVEIS
   ========================================================= */
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0b1020;
  --panel: #111827;
  --panel-2: #0f172a;
  --border: #1f2937;
  --text: #e5e7eb;
  --muted: #9ca3af;
  --accent: #6366f1;
  --success: #34d399;
  --warning: #f59e0b;
  --info: #06b6d4;
  --danger: #ec4899;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  /* evita scroll horizontal em telas muito estreitas (ex: 320px) */
  overflow-x: hidden;
}

/* =========================================================
   BASE — MOBILE
   Estilos abaixo valem para todas as telas.
   ========================================================= */
.dashboard {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ---------- Topbar ---------- */
.topbar {
  display: flex;
  flex-direction: column;
  gap: .75rem;
  align-items: flex-start;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
}
.brand { display: flex; align-items: center; gap: .75rem; }
.logo {
  font-size: 1.5rem;
  background: #1e293b;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  flex-shrink: 0;
}
.brand h1 { font-size: 1rem; font-weight: 600; }
.brand p {
  font-size: .8rem;
  color: var(--muted);
  /* evita quebrar layout com nomes de SO longos */
  overflow-wrap: anywhere;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  font-size: .8rem;
  color: var(--success);
  background: rgba(16, 185, 129, .15);
  padding: .35rem .75rem;
  border-radius: 999px;
  border: 1px solid rgba(52, 211, 153, .4);
}

.dot {
  width: 7px;
  height: 7px;
  background: var(--success);
  border-radius: 50%;
}

@media (prefers-reduced-motion: no-preference) {
  .dot { animation: pulse 1.5s infinite; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: .5; transform: scale(1.3); }
}

/* ---------- KPIs ---------- */
.kpis {
  display: grid;
  /* mobile: 1 coluna. Em 360px já começa a ficar apertado com 2. */
  grid-template-columns: 1fr;
  gap: .75rem;
}
.kpi {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: .9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: .4rem;
}
.kpi-label {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  font-weight: 500;
}
.kpi-dot { width: 8px; height: 8px; border-radius: 2px; }
.kpi-value {
  font-size: 1.2rem;
  font-weight: 700;
  /* valores longos como "10.2 GB / 16.0 GB" não estouram */
  overflow-wrap: anywhere;
}
.kpi-bar {
  height: 5px;
  background: var(--panel-2);
  border-radius: 999px;
  overflow: hidden;
}
.kpi-bar > div { height: 100%; transition: width .4s ease; }
.kpi-sub { font-size: .72rem; color: var(--muted); }

/* ---------- Painéis ---------- */
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
}
.panel-head {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.panel-head h2 { font-size: .9rem; font-weight: 600; }
.muted { color: var(--muted); font-size: .75rem; }

.legend { display: flex; gap: .75rem; font-size: .75rem; color: var(--muted); }
.legend span { display: flex; align-items: center; gap: .35rem; }
.legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}

/* ---------- Tabela ---------- */
.table-wrap {
  max-height: 60vh;
  overflow-y: auto;
  border-radius: 8px;
}
.table-wrap::-webkit-scrollbar { width: 8px; }
.table-wrap::-webkit-scrollbar-track { background: var(--panel-2); }
.table-wrap::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }

table { width: 100%; border-collapse: collapse; font-size: .8rem; }
thead {
  position: sticky;
  top: 0;
  background: var(--panel-2);
  z-index: 1;
}
th {
  text-align: left;
  padding: .55rem .5rem;
  font-size: .68rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
td {
  padding: .55rem .5rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
tbody tr:hover { background: var(--panel-2); }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; color: var(--muted); }
.name { font-weight: 500; overflow-wrap: anywhere; }

/* ---------- Nome do processo: versão mobile ---------- */
.name-full   { display: none; }
.name-mobile { display: flex; flex-direction: column; gap: .15rem; }
.name-mobile small { color: var(--muted); font-size: .7rem; font-weight: 400; }

/* ---------- Colunas escondidas no mobile ---------- */
.col-cpu,
.col-mem,
.col-user { display: none; }

/* ---------- Barras ---------- */
.bar-cell { display: flex; align-items: center; gap: .5rem; }
.bar {
  flex: 1;
  height: 6px;
  background: var(--panel-2);
  border-radius: 999px;
  overflow: hidden;
  min-width: 60px;
}
.bar > div { height: 100%; transition: width .3s ease; }
.bar-value {
  font-size: .72rem;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  min-width: 42px;
  text-align: right;
  color: var(--muted);
}

/* ---------- Loading ---------- */
.loading {
  display: grid;
  place-items: center;
  min-height: 100vh;
  color: var(--muted);
  padding: 1rem;
}

/* =========================================================
   ≥ 480px — telas grandes de celular
   ========================================================= */
@media (min-width: 480px) {
  .dashboard { padding: 1.25rem; gap: 1.25rem; }

  /* dois KPIs por linha */
  .kpis { grid-template-columns: repeat(2, 1fr); }

  .kpi-value { font-size: 1.35rem; }
  .kpi-label { font-size: .75rem; }
  .kpi-sub   { font-size: .75rem; }

  table { font-size: .85rem; }
  th, td { padding: .6rem .7rem; }
}

/* =========================================================
   ≥ 768px — tablet
   ========================================================= */
@media (min-width: 768px) {
  .dashboard { padding: 1.5rem; gap: 1.25rem; }

  /* topbar volta para linha */
  .topbar {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
  }
  .brand h1 { font-size: 1.05rem; }

  /* 3 colunas no KPI */
  .kpis { grid-template-columns: repeat(3, 1fr); gap: 1rem; }

  .panel { padding: 1.25rem; }

  /* mostra colunas de CPU/RAM/Usuário */
  .col-cpu,
  .col-mem,
  .col-user { display: table-cell; }

  /* nome em uma linha só */
  .name-full   { display: inline; }
  .name-mobile { display: none; }

  .bar-value { font-size: .78rem; }
  .table-wrap { max-height: 460px; }
}

/* =========================================================
   ≥ 1024px — desktop
   ========================================================= */
@media (min-width: 1024px) {
  /* 5 colunas no KPI — todos em uma linha */
  .kpis { grid-template-columns: repeat(5, 1fr); }

  .panel-head h2 { font-size: .95rem; }
  .muted { font-size: .8rem; }
  .legend { font-size: .8rem; gap: 1rem; }
}

/* =========================================================
   ≥ 1280px — telas grandes
   ========================================================= */
@media (min-width: 1280px) {
  .dashboard { padding: 2rem 1.5rem; }
  .kpi-value { font-size: 1.5rem; }
}
```

### Como o mobile first está aplicado

| Faixa           | KPI columns | Tabela                             | Topbar        |
|-----------------|-------------|------------------------------------|---------------|
| base (mobile)   | 1           | PID + Nome (CPU/RAM inline)        | empilhada     |
| ≥ 480px         | 2           | PID + Nome (CPU/RAM inline)        | empilhada     |
| ≥ 768px         | 3           | PID + Nome + CPU + RAM + Usuário   | em linha      |
| ≥ 1024px        | 5           | completa                           | em linha      |
| ≥ 1280px        | 5           | completa                           | em linha      |

O truque da tabela: no mobile, as colunas `.col-cpu`, `.col-mem` e `.col-user` ficam com `display: none`, e a célula do nome mostra um bloco `.name-mobile` com os valores CPU/RAM em uma linha secundária. A partir de 768px, as colunas reais aparecem e o `.name-mobile` é ocultado.

---

## Etapa 8 — Rodar tudo junto

Na raiz do projeto:

```bash
npm run dev
```

O `concurrently` sobe backend (`:3001`) e frontend (`:5173`).
Abrir http://localhost:5173 no navegador.

O que deve aparecer:
- Topbar com o nome do SO
- Cards KPI empilhados no mobile e em linha no desktop
- Gráfico de linha crescendo a cada 2s
- Tabela com os processos mais pesados em CPU

---

## Etapa 9 — Testar o responsivo no navegador

Com DevTools aberto (`F12`):

1. Clicar no ícone de **Toggle device toolbar** (`Ctrl+Shift+M`)
2. Testar em presets: **iPhone SE (375px)**, **iPhone 12 (390px)**, **iPad Mini (768px)**, **Desktop (1280px)**
3. Arrastar a barra de largura lentamente para ver os breakpoints trocando ao vivo
4. Verificar:
   - Nenhuma barra de rolagem horizontal aparece
   - KPIs passam de 1 → 2 → 3 → 5 colunas
   - Tabela vai de nome+valores inline para colunas separadas
   - Topbar empilha no mobile e fica lado a lado a partir de 768px

---

## Etapa 10 — Testar acessibilidade no navegador

Reduced motion:
1. Abrir DevTools (`F12`)
2. `Ctrl+Shift+P` → digitar `reduced-motion`
3. Escolher `Emulate CSS prefers-reduced-motion: reduce`
4. O pontinho verde para de pulsar

Contraste:
1. DevTools → aba Elements
2. Selecionar o elemento `.live`
3. Painel Styles mostra o contraste ao lado da cor (AA ou AAA)

---

## Etapa 11 — Testar o backend isolado

Útil para debug, quando o frontend não estiver rodando:

```bash
npm run dev:backend
```

E em outro terminal:

```bash
curl http://localhost:3001/api/summary
curl http://localhost:3001/api/processes
```

Ou abrir direto no navegador:
- http://localhost:3001/api/summary
- http://localhost:3001/api/processes

---

## Estrutura final

```
process-monitor/
├── package.json
├── backend/
│   ├── package.json
│   └── server.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        └── App.css
```

---

## Comandos úteis

| Comando                | O que faz                                  |
|------------------------|--------------------------------------------|
| `npm run dev`          | Sobe backend + frontend juntos             |
| `npm run dev:backend`  | Sobe apenas o backend em `:3001`           |
| `npm run dev:frontend` | Sobe apenas o frontend em `:5173`          |

---

## O que foi construído

- API REST com dois endpoints retornando dados do SO
- Frontend React com polling de 2s
- Dashboard com KPIs, gráfico em tempo real e tabela de processos
- **Layout mobile first**: base em 1 coluna, expandindo em 480 / 768 / 1024 / 1280px
- Tabela que se adapta: no mobile mostra nome + CPU/RAM em linha, no desktop mostra colunas completas
- Estilo escuro, responsivo, sem scroll horizontal em nenhum breakpoint
- Acessibilidade: contraste WCAG AA e `prefers-reduced-motion`