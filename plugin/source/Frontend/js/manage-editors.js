(function () {
  'use strict';

  const STYLE_ID = 'collaborative-playlists-editor-styles';
  const CONTROL_MARKER = 'collaborativePlaylistsEditors';
  const POLL_INTERVAL_MS = 700;

  function getApi() {
    return window.ApiClient ?? null;
  }

  function request(method, path, data) {
    const api = getApi();
    if (!api) return Promise.reject(new Error('Jellyfin API is unavailable.'));

    const options = {
      type: method,
      url: api.getUrl(path),
    };
    if (method === 'GET') options.dataType = 'json';
    if (data !== undefined) {
      options.contentType = 'application/json';
      options.data = JSON.stringify(data);
    }
    return api.ajax(options);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .collab-playlist-editor { margin: 16px 0; }
      .collab-playlist-editor-panel { margin-top: 10px; }
      .collab-playlist-editor-panel[hidden] { display: none !important; }
      .collab-playlist-editor-help { margin: 8px 0; opacity: .8; }
      .collab-playlist-editor-list {
        max-height: 220px; overflow-y: auto; overscroll-behavior: contain;
        border: 1px solid rgba(128, 128, 128, .4); border-radius: 4px;
        margin-top: 8px; padding: 4px 10px;
      }
      .collab-playlist-editor-row {
        display: flex; align-items: center; gap: 10px; min-height: 40px;
        border-bottom: 1px solid rgba(128, 128, 128, .2);
      }
      .collab-playlist-editor-row:last-child { border-bottom: 0; }
      .collab-playlist-editor-row label { display: flex; align-items: center; gap: 10px; width: 100%; }
      .collab-playlist-editor-status { min-height: 1.5em; margin-top: 6px; }
    `;
    document.head.appendChild(style);
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function normalizeId(value) {
    return String(value ?? '').toLowerCase();
  }

  function responseItems(response) {
    if (Array.isArray(response)) return response;
    return response?.Items ?? response?.items ?? [];
  }

  function playlistUsersPath(playlistId) {
    return `Playlists/${encodeURIComponent(playlistId)}/Users`;
  }

  function getEditDialogs() {
    return [...document.querySelectorAll('.dialog')].filter(dialog =>
      dialog.querySelector('#chkPlaylistPublic')
      && dialog.querySelector('#txtNewPlaylistName')
      && dialog.playlistId
      && dialog.dataset[CONTROL_MARKER] !== '1'
    );
  }

  function addEditorControls(dialog) {
    const playlistId = String(dialog.playlistId);
    const footer = dialog.querySelector('.formDialogFooter');
    const api = getApi();
    if (!footer || !api) return;

    installStyles();
    dialog.dataset[CONTROL_MARKER] = '1';

    const section = createElement('section', 'collab-playlist-editor');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('is', 'emby-button');
    toggle.className = 'raised';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Manage editors';

    const panel = createElement('div', 'collab-playlist-editor-panel');
    panel.hidden = true;
    panel.id = `collab-playlist-editors-${playlistId.replace(/[^a-z0-9]/gi, '')}`;
    toggle.setAttribute('aria-controls', panel.id);

    const help = createElement(
      'p',
      'collab-playlist-editor-help',
      'Checked users can edit this playlist. Unchecking an editor removes their share.'
    );
    const filter = document.createElement('input');
    filter.type = 'search';
    filter.className = 'emby-input';
    filter.placeholder = 'Filter users';
    filter.setAttribute('aria-label', 'Filter users');
    const list = createElement('div', 'collab-playlist-editor-list');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Playlist editors');
    const status = createElement('div', 'collab-playlist-editor-status');
    status.setAttribute('aria-live', 'polite');

    panel.append(help, filter, list, status);
    section.append(toggle, panel);
    footer.parentElement.insertBefore(section, footer);

    let usersLoaded = false;
    let shares = new Map();
    let users = [];

    function setStatus(message, isError = false) {
      status.textContent = message;
      status.setAttribute('role', isError ? 'alert' : 'status');
    }

    function renderUsers() {
      const query = filter.value.trim().toLocaleLowerCase();
      list.replaceChildren();
      const visibleUsers = users.filter(user =>
        String(user.Name ?? '').toLocaleLowerCase().includes(query)
      );

      if (visibleUsers.length === 0) {
        list.append(createElement('p', '', users.length ? 'No matching users.' : 'No other users found.'));
        return;
      }

      for (const user of visibleUsers) {
        const userId = String(user.Id ?? '');
        if (!userId) continue;

        const row = createElement('div', 'collab-playlist-editor-row');
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = shares.get(normalizeId(userId))?.CanEdit === true;
        checkbox.setAttribute('aria-label', `Can edit: ${user.Name ?? 'User'}`);
        label.append(checkbox, document.createTextNode(user.Name ?? 'Unnamed user'));
        row.append(label);
        list.append(row);

        checkbox.addEventListener('change', async () => {
          const checked = checkbox.checked;
          checkbox.disabled = true;
          setStatus(`Updating access for ${user.Name ?? 'user'}…`);
          try {
            const path = `${playlistUsersPath(playlistId)}/${encodeURIComponent(userId)}`;
            if (checked) {
              await request('POST', path, { CanEdit: true });
              shares.set(normalizeId(userId), { UserId: userId, CanEdit: true });
            } else if (shares.has(normalizeId(userId))) {
              await request('DELETE', path);
              shares.delete(normalizeId(userId));
            }
            setStatus(`Access updated for ${user.Name ?? 'user'}.`);
          } catch (error) {
            checkbox.checked = !checked;
            setStatus(error?.message ?? 'Could not update playlist access.', true);
          } finally {
            checkbox.disabled = false;
          }
        });
      }
    }

    async function loadUsers() {
      setStatus('Loading users…');
      try {
        const currentUserId = normalizeId(api.getCurrentUserId?.());
        const [shareResponse, userResponse] = await Promise.all([
          request('GET', playlistUsersPath(playlistId)),
          api.ajax({
            type: 'GET',
            url: api.getUrl('Users', { isDisabled: false }),
            dataType: 'json',
          }),
        ]);

        shares = new Map(responseItems(shareResponse).map(share => [
          normalizeId(share.UserId), share,
        ]));
        users = responseItems(userResponse)
          .filter(user => normalizeId(user.Id) !== currentUserId)
          .sort((left, right) => String(left.Name ?? '').localeCompare(String(right.Name ?? '')));
        usersLoaded = true;
        renderUsers();
        setStatus('');
      } catch (error) {
        setStatus(error?.message ?? 'Could not load playlist editors.', true);
      }
    }

    filter.addEventListener('input', renderUsers);
    toggle.addEventListener('click', async () => {
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      toggle.setAttribute('aria-expanded', String(willOpen));
      if (willOpen && !usersLoaded) await loadUsers();
      if (willOpen) filter.focus();
    });

    request('GET', playlistUsersPath(playlistId))
      .then(() => {
        toggle.hidden = false;
      })
      .catch(() => {
        section.remove();
      });
    toggle.hidden = true;
  }

  function scan() {
    for (const dialog of getEditDialogs()) addEditorControls(dialog);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(scan, POLL_INTERVAL_MS);
  scan();
})();