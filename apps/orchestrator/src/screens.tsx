// Ink TUI ekran bileşenleri
// Not: Tüm açıklamalar Türkçe tutulmuştur ki ekipten biri kodu ilk kez görse bile rahatça anlayabilsin.

import React from "react";
import { Box, Text } from "ink";
import type { Project, Task, Run } from "@shared/index";
import type { MemoryContent } from "@core/memoryEngine";
import type { RoleConfig } from "@core/roleRegistry";

export type ScreenId =
  | "dashboard"
  | "projects"
  | "roles"
  | "tasks"
  | "run"
  | "review"
  | "history"
  | "memory";

// Basit dashboard görünümü: seçili proje, son koşu ve NOW içeriğini gösterir
export const DashboardScreen: React.FC<{
  project: Project | null;
  lastRun: Run | null;
  memory: MemoryContent | null;
  memoryStatus: { ok: boolean; missing: string[] };
}> = ({ project, lastRun, memory, memoryStatus }) => {
  return (
    <Box flexDirection="column">
      <Text>=== DASHBOARD ===</Text>
      {project ? (
        <>
          <Text>
            Seçili proje: {project.name} ({project.repoPath})
          </Text>
          <Text>Stack: {project.stack}</Text>
        </>
      ) : (
        <Text>Henüz seçili proje yok. Projeler ekranından bir proje ekleyin/seçin.</Text>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text>--- Hafıza Durumu (NOW / DECISIONS / ARCH_SHORT) ---</Text>
        {memoryStatus.ok ? (
          <>
            <Text>Hafıza dosyaları: TAM</Text>
            {memory && (
              <>
                <Text>NOW.md (ilk satırlar):</Text>
                <Text wrap="truncate-end">
                  {memory.now.split(/\r?\n/).slice(0, 3).join(" | ")}
                </Text>
              </>
            )}
          </>
        ) : (
          <>
            <Text color="red">
              Hafıza dosyaları eksik: {memoryStatus.missing.join(", ")}
            </Text>
            <Text>Memory ekranında varsayılanları oluşturabilirsiniz.</Text>
          </>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>--- Son Çalıştırma (Run) ---</Text>
        {lastRun ? (
          <>
            <Text>
              Run #{lastRun.id} - Görev #{lastRun.taskId} - Rol: {lastRun.roleId}
            </Text>
            <Text>
              Durum: {lastRun.status} | Parsed: {lastRun.parsedOk ? "EVET" : "HAYIR"}
            </Text>
            <Text>Özet: {lastRun.summary || "(boş)"}</Text>
          </>
        ) : (
          <Text>Bu proje için henüz hiç koşu yok.</Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>--- Basit Maliyet Tahmini (Yer tutucu) ---</Text>
        <Text>
          Maliyet hesapları DB'de saklanır; detaylı görünüm ileride History ekranından
          genişletilebilir.
        </Text>
      </Box>
    </Box>
  );
};

// Projeler ekranı: çağıran bileşen liste/faaliyet işlerini halleder, burada sadece özet yazılır
export const ProjectsScreen: React.FC<{
  projects: Project[];
  selectedProjectId: number | null;
  mode: "list" | "adding";
  inputBuffer: string;
}> = ({ projects, selectedProjectId, mode, inputBuffer }) => {
  return (
    <Box flexDirection="column">
      <Text>=== PROJECTS ===</Text>
      <Text>
        Seçilmiş proje ID: {selectedProjectId !== null ? String(selectedProjectId) : "yok"}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {projects.length === 0 ? (
          <Text>Henüz proje yok. Aşağıdaki talimatla yeni proje ekleyin.</Text>
        ) : (
          projects.map((p) => (
            <Text key={p.id}>
              [{p.id === selectedProjectId ? "*" : " "}] #{p.id} - {p.name} ({p.repoPath})
            </Text>
          ))
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Yeni proje eklemek için:</Text>
        <Text>
          `a` tuşuna basın, ardından şu formatta yazın ve Enter'a basın:
        </Text>
        <Text>name|absoluteRepoPath|stack</Text>
        {mode === "adding" && (
          <Text>
            Girdi: <Text color="green">{inputBuffer}</Text>
          </Text>
        )}
        <Text>Mevcut projeyi seçmek için: `s` + proje ID yazıp Enter'a basın.</Text>
      </Box>
    </Box>
  );
};

// Görevler ekranı: basit liste görünümü
export const TasksScreen: React.FC<{
  tasks: Task[];
  selectedTaskId: number | null;
  inputMode: "idle" | "adding" | "selecting";
  inputBuffer: string;
}> = ({ tasks, selectedTaskId, inputMode, inputBuffer }) => {
  return (
    <Box flexDirection="column">
      <Text>=== TASKS ===</Text>
      <Text>
        Seçilmiş görev ID: {selectedTaskId !== null ? String(selectedTaskId) : "yok"}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {tasks.length === 0 ? (
          <Text>Henüz görev yok. Aşağıdaki talimatla yeni görev ekleyin.</Text>
        ) : (
          tasks.map((t) => (
            <Text key={t.id}>
              [{t.id === selectedTaskId ? "*" : " "}] #{t.id} - ({t.roleId}){" "}
              {t.title} | durum: {t.status} | karmaşıklık: {t.complexity}
            </Text>
          ))
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Yeni görev eklemek için:</Text>
        <Text>
          `a` tuşuna basın, ardından şu formatta yazın ve Enter'a basın:
        </Text>
        <Text>title|description|roleId|complexity(simple|medium|complex)|dependencyIdsCsv</Text>
        <Text>Örn: "Self test|Sandbox dosyası oluştur|backend|simple|"</Text>
        <Text>Görev seçmek için: `s` + görev ID yazıp Enter'a basın.</Text>
        {inputMode !== "idle" && (
          <Text>
            Girdi: <Text color="green">{inputBuffer}</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
};

// Koşu ekranı: seçili görev için özet ve "run" talimatı
export const RunScreen: React.FC<{
  selectedTask: Task | null;
  dependencyStatus: { canRun: boolean; reason?: string } | null;
  lastRun: Run | null;
}> = ({ selectedTask, dependencyStatus, lastRun }) => {
  return (
    <Box flexDirection="column">
      <Text>=== RUN TASK ===</Text>
      {selectedTask ? (
        <>
          <Text>
            Seçili görev: #{selectedTask.id} - {selectedTask.title} ({selectedTask.roleId})
          </Text>
          <Text>Durum: {selectedTask.status}</Text>
          <Text>Karmaşıklık: {selectedTask.complexity}</Text>
          <Text>Bağımlılıklar: {selectedTask.dependencyIds.join(", ") || "(yok)"}</Text>
          <Box marginTop={1} flexDirection="column">
            {dependencyStatus && !dependencyStatus.canRun ? (
              <Text color="red">
                Bu görev şu anda ÇALIŞTIRILAMAZ: {dependencyStatus.reason}
              </Text>
            ) : (
              <Text color="green">
                Bu görev çalıştırılabilir. `r` tuşuna basarak claude-code koşusunu başlatın.
              </Text>
            )}
          </Box>
        </>
      ) : (
        <Text>Önce Tasks ekranından bir görev seçin.</Text>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text>Son koşu özeti:</Text>
        {lastRun ? (
          <Text>
            Run #{lastRun.id} - durum: {lastRun.status} - parsed:{" "}
            {lastRun.parsedOk ? "EVET" : "HAYIR"}
          </Text>
        ) : (
          <Text>Bu görev için henüz koşu yok.</Text>
        )}
      </Box>
    </Box>
  );
};

// Review ekranı: PATCH diff'ini gösterir ve y/n onayı ister
export const ReviewScreen: React.FC<{
  patch: string;
  filesChanged: string[];
  applyState: "idle" | "applying" | "applied" | "error" | "rejected";
  errorMessage?: string;
}> = ({ patch, filesChanged, applyState, errorMessage }) => {
  const hasPatch = patch.trim().length > 0;
  return (
    <Box flexDirection="column">
      <Text>=== REVIEW & APPLY (GUARDED MODE) ===</Text>
      {!hasPatch ? (
        <Text>Bu koşudan gelen PATCH boş. Uygulanacak değişiklik yok.</Text>
      ) : (
        <>
          <Text>Değişen dosyalar:</Text>
          {filesChanged.length > 0 ? (
            filesChanged.map((f) => <Text key={f}>- {f}</Text>)
          ) : (
            <Text>(FILES_CHANGED listesi boş)</Text>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text>--- PATCH (ilk satırlar) ---</Text>
            {patch
              .split(/\r?\n/)
              .slice(0, 40)
              .map((l, idx) => (
                <Text key={idx}>{l}</Text>
              ))}
            {patch.split(/\r?\n/).length > 40 && <Text>... (kısaltıldı) ...</Text>}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text>
              Guarded Mode: Değişiklikler asla otomatik uygulanmaz. Devam için açık onay gerekir.
            </Text>
            <Text>
              Patch'i uygulamak için `y`, reddetmek için `n` tuşuna basın.
            </Text>
            <Text>Durum: {applyState}</Text>
            {errorMessage && <Text color="red">Hata: {errorMessage}</Text>}
          </Box>
        </>
      )}
    </Box>
  );
};

// Hafıza ekranı: üç dosyanın durumunu ve kısa içeriğini gösterir
export const MemoryScreen: React.FC<{
  memory: MemoryContent | null;
  status: { ok: boolean; missing: string[] };
}> = ({ memory, status }) => {
  return (
    <Box flexDirection="column">
      <Text>=== MEMORY (NOW / DECISIONS / ARCH_SHORT) ===</Text>
      {status.ok ? (
        <>
          <Text color="green">Tüm zorunlu hafıza dosyaları mevcut.</Text>
          {memory && (
            <>
              <Box marginTop={1} flexDirection="column">
                <Text>NOW.md:</Text>
                {memory.now.split(/\r?\n/).slice(0, 10).map((l, i) => (
                  <Text key={i}>{l}</Text>
                ))}
              </Box>
              <Box marginTop={1} flexDirection="column">
                <Text>DECISIONS.md (ilk satırlar):</Text>
                {memory.decisions.split(/\r?\n/).slice(0, 8).map((l, i) => (
                  <Text key={i}>{l}</Text>
                ))}
              </Box>
              <Box marginTop={1} flexDirection="column">
                <Text>ARCH_SHORT.md (ilk satırlar):</Text>
                {memory.archShort.split(/\r?\n/).slice(0, 8).map((l, i) => (
                  <Text key={i}>{l}</Text>
                ))}
              </Box>
            </>
          )}
        </>
      ) : (
        <>
          <Text color="red">
            Eksik hafıza dosyaları: {status.missing.join(", ")}
          </Text>
          <Text>
            Varsayılan hafıza dosyalarını oluşturmak için `c` tuşuna basabilirsiniz (NOW /
            DECISIONS / ARCH_SHORT).
          </Text>
        </>
      )}
      <Box marginTop={1} flexDirection="column">
        <Text>
          NOT: Bu MVP sürümünde hafızayı düzenleme sadece dosyaları dışarıdan açarak
          yapılmalıdır. İleride TUI içinden düzenleme eklenebilir.
        </Text>
      </Box>
    </Box>
  );
};

// History ekranı: son koşuların basit listesi
export const HistoryScreen: React.FC<{
  runs: Run[];
}> = ({ runs }) => {
  return (
    <Box flexDirection="column">
      <Text>=== HISTORY ===</Text>
      {runs.length === 0 ? (
        <Text>Bu proje için henüz koşu yok.</Text>
      ) : (
        runs.map((r) => (
          <Text key={r.id}>
            Run #{r.id} - Task #{r.taskId} - Rol: {r.roleId} - Durum: {r.status} - Parsed:{" "}
            {r.parsedOk ? "EVET" : "HAYIR"}
          </Text>
        ))
      )}
      <Box marginTop={1} flexDirection="column">
        <Text>
          Detaylı raw output ve parsing hataları, proje klasöründeki `artifacts/` altında
          saklanır.
        </Text>
      </Box>
    </Box>
  );
};

// Roller ekranı: şablondan gelen rol konfiglerini gösterir
export const RolesScreen: React.FC<{
  roles: RoleConfig[];
  project: Project | null;
}> = ({ roles, project }) => {
  return (
    <Box flexDirection="column">
      <Text>=== ROLES ===</Text>
      {project ? (
        <Text>
          Aktif proje: #{project.id} - {project.name}
        </Text>
      ) : (
        <Text>Henüz aktif proje yok. Önce Projects ekranından bir proje seçin.</Text>
      )}
      <Box marginTop={1} flexDirection="column">
        <Text>Yüklü rol şablonları (templates/roles/*.json):</Text>
        {roles.length === 0 ? (
          <Text>Şu anda yüklenmiş rol şablonu yok.</Text>
        ) : (
          roles.map((r) => (
            <Text key={r.roleId}>
              - {r.roleId} - {r.displayName} ({r.avatar})
            </Text>
          ))
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>
          `r`: Rol şablonlarını diskten tekrar yükle (`templates/roles` klasörünü okur).
        </Text>
        <Text>
          `i`: Aktif proje için bu rol şablonlarını DB'ye import et (roles tablosu).
        </Text>
        <Text>
          Not: Bu MVP'de rol düzenleme TUI üzerinden yapılmıyor; JSON dosyalarını manuel
          düzenleyip `r` ile yeniden yükleyebilirsiniz.
        </Text>
      </Box>
    </Box>
  );
};

