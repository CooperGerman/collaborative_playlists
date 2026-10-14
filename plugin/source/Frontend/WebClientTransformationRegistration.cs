using System.Reflection;
using System.Runtime.Loader;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CollaborativePlaylists.Frontend;

public sealed class WebClientTransformationRegistration : BackgroundService
{
    private static readonly Guid TransformationId =
        Guid.Parse("dbaf0764-31b0-4e47-a6e9-71c141f442cb");
    private readonly ILogger<WebClientTransformationRegistration> _logger;

    public WebClientTransformationRegistration(
        ILogger<WebClientTransformationRegistration> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        for (var attempt = 0; attempt < 60 && !stoppingToken.IsCancellationRequested; attempt++)
        {
            var transformationAssembly = AssemblyLoadContext.All
                .SelectMany(context => context.Assemblies)
                .FirstOrDefault(assembly => assembly.FullName?.Contains(
                    "FileTransformation", StringComparison.OrdinalIgnoreCase) == true);
            var pluginInterface = transformationAssembly?.GetType(
                "Jellyfin.Plugin.FileTransformation.PluginInterface");
            var register = pluginInterface?.GetMethod(
                "RegisterTransformation", BindingFlags.Public | BindingFlags.Static);

            if (register is not null)
            {
                Register(register);
                return;
            }

            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken).ConfigureAwait(false);
        }

        if (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "File Transformation was not found; playlist editor controls are unavailable in Jellyfin Web.");
        }
    }

    private void Register(MethodInfo register)
    {
        try
        {
            var payloadType = register.GetParameters().FirstOrDefault()?.ParameterType;
            var parse = payloadType?.GetMethod("Parse", new[] { typeof(string) });
            if (payloadType is null || parse is null)
            {
                _logger.LogWarning("File Transformation registration API was not recognized.");
                return;
            }

            var payloadJson = JsonSerializer.Serialize(new
            {
                id = TransformationId,
                fileNamePattern = "index.html",
                callbackAssembly = typeof(WebClientScriptTransformation).Assembly.FullName,
                callbackClass = typeof(WebClientScriptTransformation).FullName,
                callbackMethod = nameof(WebClientScriptTransformation.TransformIndexHtml),
            });
            var payload = parse.Invoke(null, new object[] { payloadJson });
            register.Invoke(null, new[] { payload });
            _logger.LogInformation("Registered collaborative playlist editor controls.");
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Could not register playlist editor controls.");
        }
    }
}

public static class WebClientScriptTransformation
{
    private const string InjectionMarker = "data-collaborative-playlists-editors";
    private const string ScriptResourceName =
        "CollaborativePlaylists.Frontend.js.manage-editors.js";

    public static string TransformIndexHtml(object payload)
    {
        using var payloadDocument = JsonDocument.Parse(payload.ToString() ?? "{}");
        if (!payloadDocument.RootElement.TryGetProperty("contents", out var contentsElement))
        {
            return string.Empty;
        }

        var contents = contentsElement.GetString() ?? string.Empty;
        if (contents.Contains(InjectionMarker, StringComparison.Ordinal))
        {
            return contents;
        }

        using var stream = typeof(WebClientScriptTransformation).Assembly
            .GetManifestResourceStream(ScriptResourceName);
        if (stream is null)
        {
            return contents;
        }

        using var reader = new StreamReader(stream, Encoding.UTF8);
        var injected = $"<script {InjectionMarker}=\"true\">{reader.ReadToEnd()}</script>";
        var bodyEnd = contents.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        return bodyEnd < 0 ? contents : contents.Insert(bodyEnd, injected);
    }
}