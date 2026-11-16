import axios from "axios";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const fmtBytes = (b) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
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
          axios.get("/api/processes"),
          axios.get("/api/summary"),
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
    void fetchAll();
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
        <Kpi
          label="CPU"
          value={`${summary.cpu}%`}
          color="#6366f1"
          percent={summary.cpu}
        />
        <Kpi
          label="RAM"
          value={`${summary.memPercent}%`}
          color="#10b981"
          percent={summary.memPercent}
        />
        <Kpi
          label="Processos"
          value={procs.length}
          color="#f59e0b"
          sub="top 30 exibidos"
        />
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
            <span>
              <i style={{ background: "#6366f1" }} /> CPU
            </span>
            <span>
              <i style={{ background: "#10b981" }} /> RAM
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="t" stroke="#6b7280" fontSize={11} />
            <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                color: "#e5e7eb",
              }}
            />
            <Line
              type="monotone"
              dataKey="cpu"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              name="CPU %"
            />
            <Line
              type="monotone"
              dataKey="mem"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="RAM %"
            />
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
                      <small>
                        CPU {p.cpu.toFixed(1)}% · RAM {p.mem.toFixed(1)}%
                      </small>
                    </span>
                  </td>
                  <td className="col-cpu">
                    <Bar value={p.cpu} color="#6366f1" />
                  </td>
                  <td className="col-mem">
                    <Bar value={p.mem} color="#10b981" />
                  </td>
                  <td className="col-user muted">{p.user || "-"}</td>
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
          <div
            style={{ width: `${Math.min(percent, 100)}%`, background: color }}
          />
        </div>
      ) : (
        <div className="kpi-sub">{sub || "\u00A0"}</div>
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
