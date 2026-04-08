using CrewOps.Capabilities.Models;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Capabilities;

/// <summary>
/// Tüm yetenek tanımları için merkezi sorgu arayüzü.
/// Startup'ta yüklenir, runtime'da salt okunur.
/// </summary>
public interface ICapabilityRegistry
{
    // ─── Roller ──────────────────────────────────────────────
    IReadOnlyList<RoleProfile> GetAllRoles();
    RoleProfile? GetRole(string roleId);

    // ─── Skill'ler ───────────────────────────────────────────
    IReadOnlyList<SkillManifest> GetAllSkills();
    IReadOnlyList<SkillManifest> GetSkillsByDomain(string pluginDomain);
    SkillManifest? GetSkill(string skillId);

    // ─── Capability Pack'ler ─────────────────────────────────
    IReadOnlyList<CapabilityPack> GetAllPacks();
    IReadOnlyList<CapabilityPack> GetPacksByDomain(string domain);
    CapabilityPack? GetPack(string packId);

    // ─── Domain'ler ──────────────────────────────────────────
    IReadOnlyList<DomainInfo> GetAllDomains();
    DomainInfo? GetDomain(string domainId);

    // ─── Team Template'ler ───────────────────────────────────
    IReadOnlyList<TeamTemplate> GetAllTeamTemplates();
    TeamTemplate? GetTeamTemplate(Guid id);
    TeamTemplate? GetTeamTemplateByName(string name);
}
