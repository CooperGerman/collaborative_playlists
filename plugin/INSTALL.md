# Installation

## Requirements

- Jellyfin 12.1.x on .NET 10.
- The Jellyfin File Transformation plugin must be installed and enabled for
  the Edit Playlist dialog enhancement to appear.

## Manual installation

1. Build the package with `make package`, or download
   `CollaborativePlaylists.zip` from the plugin catalog.
2. Extract the ZIP into a new folder named
   `CollaborativePlaylists_0.1.1.0` in Jellyfin's plugins directory.
3. Restart Jellyfin.

The plugin folder must match the `version` in `meta.json`. Keep the existing
playlist data untouched; the plugin uses Jellyfin's native playlist shares.

## Catalog installation

The repository `manifest.json` is ready for a custom catalog once the project
is hosted. Before publishing, update the manifest's `sourceUrl` to the actual
ZIP URL and ensure the manifest itself is hosted at the catalog URL you add to
Jellyfin.