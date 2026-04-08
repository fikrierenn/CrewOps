// Ortak tipler ve yardımcı fonksiyonlar
// Bu dosya, monorepo içindeki tüm paketler tarafından paylaşılan temel tipleri içerir.

// Proje aşaması: pipeline lifecycle
export type ProjectPhase = "mutabakat_bekliyor" | "mutabakat_devam"
  | "mutabakat_tamamlandi" | "planlama" | "gelistirme" | "review" | "teslim_edildi";

// Proje tipi: Git tabanlı bir çalışma alanını temsil eder
export interface Project {
  id: number;
  name: string;
  // Projenin git repository kök yolu (mutlaka absolute path olmalı)
  repoPath: string;
  // Teknoloji yığını ile ilgili serbest metin açıklama
  stack: string;
  // Proje oluşturulma tarihi (ISO string olarak saklanır)
  createdAt: string;
  // PM ile mutabakat sonrası yazmaya başlanır
  phase: ProjectPhase;
  mutabakatOzeti?: string | null;
  mutabakatTamamlandiAt?: string | null;
}

// Rol tipi: Bir çalışma rolünü (PM, ARCH, BACKEND vb.) temsil eder
export interface Role {
  id: number;
  projectId: number;
  roleId: string;
  displayName: string;
  avatar: string;
  skills: string[];
  workStyle: string;
  // Basit/orta/karmaşık istekler için model seçim haritası
  defaultModelPolicy: {
    simple: string;
    medium: string;
    complex: string;
  };
  definitionOfDone: string[];
  // Konfigürasyonun ham JSON içeriğini de saklayabiliriz
  rawConfig: any;
}

// Görev karmaşıklık seviyesi
export type TaskComplexity = "simple" | "medium" | "complex";

// Görev durumu
export type TaskStatus = "pending" | "blocked" | "running" | "completed" | "failed";

// Görev tipi: çalıştırılabilir bir işi temsil eder
export interface Task {
  id: number;
  projectId: number;
  roleId: string;
  title: string;
  description: string;
  complexity: TaskComplexity;
  status: TaskStatus;
  // Bağımlı olduğu diğer görevlerin ID listesi (DAG)
  dependencyIds: number[];
  createdAt: string;
  updatedAt: string;
}

// Çalıştırma (run) durumu
export type RunStatus = "running" | "success" | "failed" | "cancelled";

// Bir görev çalıştırmasını temsil eder
export interface Run {
  id: number;
  taskId: number;
  projectId: number;
  roleId: string;
  status: RunStatus;
  // claude-code exit code
  exitCode: number | null;
  // Çıktı parse edilebilmişse true, değilse false
  parsedOk: boolean;
  // Kısa özet (SUMMARY bölümünden)
  summary: string;
  createdAt: string;
}

// Parsed çıktı sözleşmesi: OutputParser bu tip ile döner
export interface ParsedOutput {
  summary: string[];
  filesChanged: string[];
  patch: string;
  next: string[];
  risks: string[];
  commandsToRun: string[];
}

// PM Chat mesajı
export interface ChatMessage {
  id: number;
  projectId: number;
  role: 'user' | 'pm' | 'system';
  content: string;
  createdAt: string;
}

// Plan taslağı
export interface PlanDraft {
  id: number;
  projectId: number;
  rawOutput: string;
  parsedJson: string;
  status: 'draft' | 'approved' | 'rejected';
  createdAt: string;
}

// Planlama çıktısı
export interface PlannedTask {
  tempId: string;
  role: string;
  title: string;
  complexity: 'simple' | 'medium' | 'complex';
  deps: string[];
}

export interface PlanningOutput {
  archShort: string;
  decisions: string;
  nowUpdate: string;
  tasks: PlannedTask[];
}

// Görev review kaydı
export interface TaskReview {
  id: number;
  taskId: number;
  runId: number;
  decision: 'approve' | 'revise' | 'escalate';
  reasoning: string;
  feedback?: string | null;
  createdAt: string;
}

// Teslim raporu
export interface DeliveryReport {
  projectSummary: string;
  completedTasks: { id: number; title: string; role: string; summary: string }[];
  knownIssues: string[];
  testInstructions: string[];
  totalCostUsd: number;
  totalTokens: number;
}

// Orkestrasyon durumu
export type OrchestrationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

// Orkestrasyon event'leri
export interface OrchestrationEvent {
  type: 'task_start' | 'task_progress' | 'task_complete' | 'task_failed'
    | 'task_parallel_start'
    | 'review_start' | 'review_complete' | 'patch_applied' | 'patch_skipped'
    | 'orchestration_complete' | 'orchestration_paused' | 'orchestration_error'
    | 'delivery_start' | 'delivery_complete';
  taskId?: number;
  message: string;
  data?: any;
  timestamp: string;
}

// Çalıştırma ile ilgili detaylı artifact bilgisi
export interface Artifact {
  id: number;
  runId: number;
  kind: "raw_output" | "parsed_output" | "patch" | "diffstat" | "log";
  // İçerik JSON ya da düz metin olabilir, bu yüzden string saklayacağız
  content: string;
  createdAt: string;
}

// Basit maliyet kaydı: tahmini token sayısı ve toplam maliyet
export interface CostLedgerEntry {
  id: number;
  runId: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
}

// Basit bir yardımcı: şu anki zamanı ISO string olarak döndürür
export const nowIso = (): string => new Date().toISOString();

