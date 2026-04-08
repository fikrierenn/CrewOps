// SQLite şema tanımları ve migration fonksiyonları
// Bu dosya, orchestrator için gerekli olan tabloları oluşturur.

import Database from "better-sqlite3";

// Veritabanı dosya yolu (şimdilik repo köküne göre sabit, daha sonra yapılandırılabilir)
const DEFAULT_DB_PATH = "orchestrator.db";

// Basit migration versiyonlama tablosu adı
const MIGRATIONS_TABLE = "_migrations";

// Migration'ları temsil eden basit tip
interface Migration {
  id: number;
  name: string;
  appliedAt: string;
}

// Varsayılan veritabanı örneğini oluşturur
// Not: better-sqlite3 senkron ve gömülü olduğundan bu fonksiyon hafif ve yerel çalışır.
export const createDb = (dbPath: string = DEFAULT_DB_PATH): Database.Database => {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  ensureMigrationsTable(db);
  applyMigrations(db);
  return db;
};

// Migration versiyon tablosu yoksa oluşturur
const ensureMigrationsTable = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
};

// Tüm migration'ları uygular
const applyMigrations = (db: Database.Database) => {
  const appliedNames = new Set<string>(
    db
      .prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`)
      .all()
      .map((row: any) => row.name as string)
  );

  const migrations: { name: string; sql: string }[] = [
    {
      name: "001_init_core_tables",
      sql: `
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          repo_path TEXT NOT NULL,
          stack TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          role_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          avatar TEXT NOT NULL,
          skills_json TEXT NOT NULL,
          work_style TEXT NOT NULL,
          model_policy_json TEXT NOT NULL,
          definition_of_done_json TEXT NOT NULL,
          raw_config_json TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          role_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          complexity TEXT NOT NULL,
          status TEXT NOT NULL,
          dependency_ids_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          role_id TEXT NOT NULL,
          status TEXT NOT NULL,
          exit_code INTEGER,
          parsed_ok INTEGER NOT NULL,
          summary TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(task_id) REFERENCES tasks(id),
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(run_id) REFERENCES runs(id)
        );

        CREATE TABLE IF NOT EXISTS cost_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          estimated_tokens INTEGER NOT NULL,
          estimated_cost_usd REAL NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(run_id) REFERENCES runs(id)
        );
      `
    },
    {
      name: "002_projects_phase",
      sql: `ALTER TABLE projects ADD COLUMN phase TEXT NOT NULL DEFAULT 'mutabakat_bekliyor';`
    },
    {
      name: "003_projects_mutabakat_ozeti",
      sql: `ALTER TABLE projects ADD COLUMN mutabakat_ozeti TEXT;`
    },
    {
      name: "004_projects_mutabakat_tarih",
      sql: `ALTER TABLE projects ADD COLUMN mutabakat_tamamlandi_at TEXT;`
    },
    {
      name: "005_chat_messages",
      sql: `
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );
      `
    },
    {
      name: "006_plan_drafts",
      sql: `
        CREATE TABLE IF NOT EXISTS plan_drafts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL UNIQUE,
          raw_output TEXT NOT NULL,
          parsed_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );
      `
    },
    {
      name: "007_task_reviews",
      sql: `
        CREATE TABLE IF NOT EXISTS task_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          run_id INTEGER NOT NULL,
          decision TEXT NOT NULL,
          reasoning TEXT NOT NULL,
          feedback TEXT,
          created_at TEXT NOT NULL
        );
        ALTER TABLE tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
      `
    },
    {
      name: "008_orchestration_events_and_indexes",
      sql: `
        CREATE TABLE IF NOT EXISTS orchestration_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          data_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id)
        );

        CREATE INDEX IF NOT EXISTS idx_orchestration_events_project
          ON orchestration_events(project_id, id);

        CREATE INDEX IF NOT EXISTS idx_tasks_project_status
          ON tasks(project_id, status);

        CREATE INDEX IF NOT EXISTS idx_runs_project
          ON runs(project_id, id);

        CREATE INDEX IF NOT EXISTS idx_runs_task
          ON runs(task_id, id);

        CREATE INDEX IF NOT EXISTS idx_chat_messages_project
          ON chat_messages(project_id, id);

        CREATE INDEX IF NOT EXISTS idx_artifacts_run
          ON artifacts(run_id);

        CREATE INDEX IF NOT EXISTS idx_cost_ledger_run
          ON cost_ledger(run_id);

        CREATE INDEX IF NOT EXISTS idx_task_reviews_task
          ON task_reviews(task_id);
      `
    }
  ];

  const insertMigration = db.prepare(
    `INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES (?, ?)`
  );

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) continue;
    db.exec(migration.sql);
    insertMigration.run(migration.name, new Date().toISOString());
  }
};

export type OrchestratorDb = Database.Database;

