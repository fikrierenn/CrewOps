// RoleRegistry
// Rol konfigürasyonlarını /templates/roles altından yükleyip bellekte tutar.
// Bu MVP sürümde, rol tanımları JSON dosyalarından tek seferde okunur.

import * as fs from "fs";
import * as path from "path";

export interface RoleConfig {
  roleId: string;
  displayName: string;
  avatar: string;
  skills: string[];
  workStyle: string;
  defaultModelPolicy: {
    simple: string;
    medium: string;
    complex: string;
  };
  definitionOfDone: string[];
}

export class RoleRegistry {
  private roles = new Map<string, RoleConfig>();

  // rootDir: monorepo kökü (ör: process.cwd())
  constructor(private rootDir: string) {}

  // Rol konfigürasyonlarını diskten yükler
  loadRolesFromTemplates(): void {
    const rolesDir = path.join(this.rootDir, "templates", "roles");
    if (!fs.existsSync(rolesDir)) {
      // Sessizce yok saymak yerine açık hata vermek daha güvenli
      throw new Error(`Rol şablon klasörü bulunamadı: ${rolesDir}`);
    }

    const files = fs.readdirSync(rolesDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const fullPath = path.join(rolesDir, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw);
      // Basit doğrulama: roleId zorunlu
      if (!parsed.roleId) {
        throw new Error(`Rol konfig dosyasında roleId eksik: ${fullPath}`);
      }
      this.roles.set(parsed.roleId, parsed as RoleConfig);
    }
  }

  getRoleConfig(roleId: string): RoleConfig | undefined {
    return this.roles.get(roleId);
  }

  listRoleConfigs(): RoleConfig[] {
    return Array.from(this.roles.values());
  }
}

