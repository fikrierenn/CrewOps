import React, { useEffect, useState } from "react";
import { fetchProjects, fetchRoleTemplates, importRoles } from "../api";
import type { Project, RoleTemplate } from "../api";

export function Roles() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  // Rol şablonlarının tamamını (skills, workStyle, definitionOfDone dahil) tutuyoruz
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects().then((list) => {
      setProjects(list);
      if (list.length > 0 && selectedProjectId === null) setSelectedProjectId(list[0].id);
    }).catch(console.error);
    fetchRoleTemplates()
      .then((list) => {
        setTemplates(Array.isArray(list) ? list : []);
        if (list?.length > 0) setSelectedRoleId((id) => id || list[0].roleId);
      })
      .catch(console.error);
  }, []);

  const handleImport = async () => {
    if (!selectedProjectId) {
      setMessage("Önce proje seçin.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { imported } = await importRoles(selectedProjectId);
      setMessage(`${imported} rol projeye import edildi.`);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = selectedRoleId ? templates.find((t) => t.roleId === selectedRoleId) : null;

  return (
    <div>
      <div className="card">
        <h2>Rol şablonları</h2>
        <p style={{ color: "#9a9ba3", fontSize: 14, marginBottom: 12 }}>
          <code>templates/roles/*.json</code> dosyalarından yüklenir. Seçili proje için
          &quot;Import et&quot; ile bu rolleri projeye ekleyebilirsiniz. Aşağıda bir rol seçtiğinizde,
          şablonun tam içeriğini (skills, çalışma tarzı, Definition of Done) görebilirsiniz.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)", gap: 16 }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, borderRight: "1px solid #2d2e36" }}>
            {templates.map((r) => (
              <li
                key={r.roleId}
                onClick={() => setSelectedRoleId(r.roleId)}
                style={{
                  padding: "8px 6px",
                  borderBottom: "1px solid #2d2e36",
                  cursor: "pointer",
                  background: r.roleId === selectedRoleId ? "#2d2e36" : "transparent"
                }}
              >
                <strong>{r.avatar} {r.displayName}</strong>
                <div style={{ fontSize: 12, color: "#9a9ba3" }}>{r.roleId}</div>
              </li>
            ))}
          </ul>

          <div>
            {selectedRole ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                  {selectedRole.avatar} {selectedRole.displayName}{" "}
                  <span style={{ fontSize: 12, color: "#9a9ba3" }}>({selectedRole.roleId})</span>
                </h3>
                {selectedRole.skills && selectedRole.skills.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: "#9a9ba3", marginBottom: 4 }}>Yetenekler (skills):</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedRole.skills.map((s) => (
                        <span
                          key={s}
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "#22232a",
                            border: "1px solid #2d2e36",
                            color: "#cbd5f5"
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedRole.workStyle && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: "#9a9ba3", marginBottom: 4 }}>Çalışma tarzı (workStyle):</div>
                    <p style={{ fontSize: 13, margin: 0 }}>{selectedRole.workStyle}</p>
                  </div>
                )}
                {selectedRole.definitionOfDone && selectedRole.definitionOfDone.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#9a9ba3", marginBottom: 4 }}>Definition of Done:</div>
                    <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13 }}>
                      {selectedRole.definitionOfDone.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "#9a9ba3", fontSize: 13 }}>Detay görmek için soldan bir rol seçin.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Projeye rol import et</h2>
        <div className="form-group">
          <label>Proje</label>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value) || null)}
          >
            <option value="">Seçin</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {message && (
          <p style={{ color: message.startsWith("Hata") ? "#cc6666" : "#b5bd68", marginBottom: 12 }}>
            {message}
          </p>
        )}
        <button type="button" onClick={handleImport} disabled={loading}>
          {loading ? "Import ediliyor…" : "Import et"}
        </button>
      </div>
    </div>
  );
}
