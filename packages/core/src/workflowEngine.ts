// WorkflowEngine
// Görevleri bağımlılıklarına göre DAG olarak yöneten basit motor.
// Bu MVP versiyonu sadece bağımlılıkların tamamlanıp tamamlanmadığını kontrol eder.

import type { Task } from "@shared/index";

export class WorkflowEngine {
  // Bir görevin çalıştırılabilir (runnable) olup olmadığını kontrol eder.
  // - Tüm bağımlı görevlerin status'ü "completed" olmalıdır.
  // - Eğer herhangi bir bağımlı görev "failed" ise bu görevi bloke ederiz.
  // Bu fonksiyon, TUI ve runner tarafından kullanılacaktır.
  static canRunTask(task: Task, dependencyTasks: Task[]): {
    canRun: boolean;
    reason?: string;
  } {
    // Hiç bağımlılık yoksa hemen çalıştırılabilir
    if (!task.dependencyIds || task.dependencyIds.length === 0) {
      return { canRun: true };
    }

    const depsById = new Map<number, Task>();
    for (const dep of dependencyTasks) {
      depsById.set(dep.id, dep);
    }

    for (const depId of task.dependencyIds) {
      const depTask = depsById.get(depId);
      if (!depTask) {
        // Eksik tanımlanmış bağımlılıkları güvenli tarafta kalmak için bloke ediyoruz
        return {
          canRun: false,
          reason: `Bağımlı görev bulunamadı: #${depId}`
        };
      }

      if (depTask.status === "failed") {
        return {
          canRun: false,
          reason: `Bağımlı görev başarısız: #${depTask.id} - ${depTask.title}`
        };
      }

      if (depTask.status !== "completed") {
        return {
          canRun: false,
          reason: `Bağımlı görev henüz tamamlanmadı: #${depTask.id} - ${depTask.title}`
        };
      }
    }

    return { canRun: true };
  }
}

