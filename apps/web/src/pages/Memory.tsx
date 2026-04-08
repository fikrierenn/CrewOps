import React, { useEffect, useState } from "react";
import { fetchMemoryStatus, createDefaultMemory } from "../api";

export function Memory() {
  const [ok, setOk] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    fetchMemoryStatus()
      .then((s) => {
        setOk(s.ok);
        setMissing(s.missing ?? []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateDefault = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await createDefaultMemory();
      setMessage("Varsayılan hafıza dosyaları oluşturuldu (NOW.md, DECISIONS.md, ARCH_SHORT.md).");
      load();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Hafıza dosyaları</h2>
        <p style={{ color: "#9a9ba3", fontSize: 14 }}>
          Görev çalıştırmadan önce <code>memory/NOW.md</code>,{" "}
          <code>memory/DECISIONS.md</code>, <code>memory/ARCH_SHORT.md</code> dosyalarının
          mevcut olması gerekir.
        </p>
        <p>
          Durum:{" "}
          {ok ? (
            <span className="badge success">Tam</span>
          ) : (
            <span className="badge failed">Eksik: {missing.join(", ")}</span>
          )}
        </p>
        {!ok && (
          <button type="button" onClick={handleCreateDefault} disabled={loading}>
            {loading ? "Oluşturuluyor…" : "Varsayılan dosyaları oluştur"}
          </button>
        )}
        {message && (
          <p style={{ color: message.startsWith("Hata") ? "#cc6666" : "#b5bd68", marginTop: 12 }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
