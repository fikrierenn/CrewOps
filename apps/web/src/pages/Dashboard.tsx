import React, { useEffect, useState } from "react";
import { fetchProjects, fetchMemoryStatus, fetchRuns } from "../api";
import type { Project, Run } from "../api";

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [memoryOk, setMemoryOk] = useState(false);
  const [lastRun, setLastRun] = useState<Run | null>(null);

  useEffect(() => {
    fetchProjects().then(setProjects).catch(console.error);
    fetchMemoryStatus().then((s) => setMemoryOk(s.ok)).catch(console.error);
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      fetchRuns(projects[0].id, 1).then((r) => setLastRun(r[0] ?? null)).catch(console.error);
    } else {
      setLastRun(null);
    }
  }, [projects]);

  return (
    <div>
      <div className="card">
        <h2>Pano</h2>
        <p>
          Seçili proje sayısı: <strong>{projects.length}</strong>
        </p>
        <p>
          Hafıza dosyaları (NOW / DECISIONS / ARCH_SHORT):{" "}
          {memoryOk ? (
            <span className="badge success">Tam</span>
          ) : (
            <span className="badge failed">Eksik</span>
          )}
        </p>
        {lastRun && (
          <p>
            Son koşu: #{lastRun.id} – Görev #{lastRun.taskId} –{" "}
            <span className={`badge ${lastRun.status === "success" ? "success" : "failed"}`}>
              {lastRun.status}
            </span>{" "}
            – {lastRun.summary || "(özet yok)"}
          </p>
        )}
      </div>
      <p style={{ color: "#9a9ba3", fontSize: 14 }}>
        Proje eklemek için <strong>Projeler</strong>, görev eklemek için{" "}
        <strong>Görevler</strong> sayfasını kullanın. Bir görevi çalıştırmak için
        Görevler sayfasında görevi seçip <strong>Başla</strong> deyin; çıktı
        sayfa içindeki gömülü konsolda canlı gelir.
      </p>
    </div>
  );
}
