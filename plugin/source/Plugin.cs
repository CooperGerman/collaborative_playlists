using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace CollaborativePlaylists;

public sealed class Plugin : BasePlugin<PluginConfiguration>
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
    }

    public override string Name => "Collaborative Playlists";

    public override Guid Id => Guid.Parse("a425dd4d-92e2-40d3-b923-5fe78c53adf1");

    public override string Description =>
        "Manage per-user editor access for Jellyfin playlists.";
}

public sealed class PluginConfiguration : BasePluginConfiguration
{
}