const express = require("express");
const cors = require("cors");
const si = require("systeminformation");

const app = express();
app.use(cors());

// Lista de processos (top 30 por CPU)
app.get("/api/processes", async (req, res) => {
  const { list, all } = await si.processes();
  const top = list
    .map((p) => ({
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
app.get("/api/summary", async (req, res) => {
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
app.listen(PORT, () => console.log(`✅ Backend em http://localhost:${PORT}`));
