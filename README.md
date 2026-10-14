# Collaborative Playlists

A Jellyfin server plugin that adds per-user playlist editor controls to the
standard Jellyfin Web **Edit Playlist** dialog. It uses Jellyfin's native
playlist shares, so playlists remain ordinary Jellyfin playlists and the
server enforces access.

## Features

- Playlist owners can open **Manage editors** from the Edit Playlist dialog.
- A searchable, scrollable user list shows who can edit the playlist.
- Checking a user grants native `CanEdit` access; unchecking an existing
  editor removes that user's playlist share.
- Existing view-only shares are shown unchecked and are left unchanged unless
  selected.
- Sharing controls are hidden when the current user is not the playlist owner.

The plugin does not add public access or create a custom playlist store. It
does not synchronize playback; Jellyfin SyncPlay remains separate.

## Requirements

- Jellyfin 12.1.x on .NET 10.
- The Jellyfin **File Transformation** plugin, which provides the supported
  mechanism used to inject the small Web UI enhancement.

The sharing and edit permissions are handled by Jellyfin's native playlist
API. The plugin only adds the missing per-user editor controls to the Web UI;
other Jellyfin clients continue to use their own playlist interfaces.

## Build

```bash
make package
```

The package is written to `plugin/CollaborativePlaylists.zip`. The package
target also updates the catalog checksum and timestamp in `manifest.json`.

## Install

Extract `plugin/CollaborativePlaylists.zip` into a folder named
`CollaborativePlaylists_0.1.1.0` in Jellyfin's plugins directory, then restart
Jellyfin. The folder must match the version in `meta.json`.

For installation from a custom plugin catalog, host `manifest.json` and the
ZIP at the URLs recorded in the manifest. Those URLs currently assume a
`CooperGerman/collaborative_playlists` GitHub repository and must be changed if
the repository owner or name differs before publishing.