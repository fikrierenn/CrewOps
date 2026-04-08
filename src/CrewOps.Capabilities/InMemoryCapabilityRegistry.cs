using CrewOps.Capabilities.Models;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Capabilities;

/// <summary>
/// Dictionary-backed, startup'ta yüklenen, thread-safe (read-only) yetenek kaydı.
/// Tüm veriler bir kez yüklenir ve runtime boyunca değişmez.
/// </summary>
public sealed class InMemoryCapabilityRegistry : ICapabilityRegistry
{
    private readonly Dictionary<string, RoleProfile> _roles = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, SkillManifest> _skills = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, CapabilityPack> _packs = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, DomainInfo> _domains = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<Guid, TeamTemplate> _templates = [];

    // ─── Yükleme (startup'ta bir kez çağrılır) ──────────────

    /// <summary>Rol profillerini kayda ekler.</summary>
    public void RegisterRoles(IEnumerable<RoleProfile> roles)
    {
        foreach (var role in roles)
            _roles[role.RoleId] = role;
    }

    /// <summary>Skill manifest'lerini kayda ekler.</summary>
    public void RegisterSkills(IEnumerable<SkillManifest> skills)
    {
        foreach (var skill in skills)
            _skills[skill.Id] = skill;
    }

    /// <summary>Capability pack'lerini kayda ekler.</summary>
    public void RegisterPacks(IEnumerable<CapabilityPack> packs)
    {
        foreach (var pack in packs)
            _packs[pack.Id] = pack;
    }

    /// <summary>Domain bilgilerini kayda ekler.</summary>
    public void RegisterDomains(IEnumerable<DomainInfo> domains)
    {
        foreach (var domain in domains)
            _domains[domain.Id] = domain;
    }

    /// <summary>Team template'leri kayda ekler.</summary>
    public void RegisterTeamTemplates(IEnumerable<TeamTemplate> templates)
    {
        foreach (var template in templates)
            _templates[template.Id] = template;
    }

    // ─── ICapabilityRegistry implementasyonu ─────────────────

    public IReadOnlyList<RoleProfile> GetAllRoles() =>
        _roles.Values.ToList().AsReadOnly();

    public RoleProfile? GetRole(string roleId) =>
        _roles.GetValueOrDefault(roleId);

    public IReadOnlyList<SkillManifest> GetAllSkills() =>
        _skills.Values.ToList().AsReadOnly();

    public IReadOnlyList<SkillManifest> GetSkillsByDomain(string pluginDomain) =>
        _skills.Values
            .Where(s => s.PluginDomain.Equals(pluginDomain, StringComparison.OrdinalIgnoreCase))
            .ToList()
            .AsReadOnly();

    public SkillManifest? GetSkill(string skillId) =>
        _skills.GetValueOrDefault(skillId);

    public IReadOnlyList<CapabilityPack> GetAllPacks() =>
        _packs.Values.ToList().AsReadOnly();

    public IReadOnlyList<CapabilityPack> GetPacksByDomain(string domain) =>
        _packs.Values
            .Where(p => p.Domain.Equals(domain, StringComparison.OrdinalIgnoreCase))
            .ToList()
            .AsReadOnly();

    public CapabilityPack? GetPack(string packId) =>
        _packs.GetValueOrDefault(packId);

    public IReadOnlyList<DomainInfo> GetAllDomains() =>
        _domains.Values.ToList().AsReadOnly();

    public DomainInfo? GetDomain(string domainId) =>
        _domains.GetValueOrDefault(domainId);

    public IReadOnlyList<TeamTemplate> GetAllTeamTemplates() =>
        _templates.Values.ToList().AsReadOnly();

    public TeamTemplate? GetTeamTemplate(Guid id) =>
        _templates.GetValueOrDefault(id);

    public TeamTemplate? GetTeamTemplateByName(string name) =>
        _templates.Values.FirstOrDefault(t => t.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
}
