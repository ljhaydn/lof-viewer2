// assets/js/lof-view-layer.js
(function (window) {
  'use strict';

  const ViewLayer = {
    render(state, derived) {
      this.renderStatusPanel(state, derived);
      this.renderNowNext(state.rfData?.nowPlaying, state.rfData?.upNext);
      this.renderSongGrid(state.rfData?.availableSongs || []);
      this.renderQueue(state.rfData?.queue || []);
      this.renderSpeakerButton(state.speaker);
    },

    renderStatusPanel(state, derived) {
      const panel = document.querySelector('[data-lof="status-panel"]');
      if (!panel) return;

      const indicator = panel.querySelector('[data-lof="state-indicator"]');
      const textEl = panel.querySelector('[data-lof="status-text"]');
      const warningEl = panel.querySelector('[data-lof="connection-warning"]');

      if (!indicator || !textEl || !warningEl) return;

      const statusCopy = ContentLayer.getStatusCopy(derived);
      textEl.textContent = statusCopy.text;

      indicator.className = `lof-state-indicator ${statusCopy.indicatorClass}`;
      warningEl.style.display = statusCopy.warning ? '' : 'none';
      warningEl.textContent = statusCopy.warning || '';
    },

    renderNowNext(nowPlaying, upNext) {
      const nowTitleEl = document.querySelector('[data-lof="now-title"]');
      const nowArtistEl = document.querySelector('[data-lof="now-artist"]');
      const nextTitleEl = document.querySelector('[data-lof="next-title"]');
      const nextArtistEl = document.querySelector('[data-lof="next-artist"]');

      if (nowTitleEl) nowTitleEl.textContent = nowPlaying?.title || 'Intermission';
      if (nowArtistEl) nowArtistEl.textContent = nowPlaying?.artist || '';

      if (nextTitleEl) nextTitleEl.textContent = upNext?.title || ContentLayer.getNoNextTrackLabel();
      if (nextArtistEl) nextArtistEl.textContent = upNext?.artist || '';
    },

    renderSongGrid(songs) {
      const grid = document.querySelector('[data-lof="song-grid"]');
      if (!grid) return;

      grid.innerHTML = '';

      if (!songs || songs.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'lof-empty-grid';
        emptyMsg.textContent = ContentLayer.getEmptyGridMessage();
        grid.appendChild(emptyMsg);
        return;
      }

      songs.forEach((song) => {
        const tile = document.createElement('button');
        tile.className = 'lof-tile';
        tile.dataset.lofSongId = song.songId;

        if (!song.isAvailable) {
          tile.disabled = true;
          tile.classList.add('lof-tile--disabled');
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'lof-tile__title';
        titleEl.textContent = song.title;

        const artistEl = document.createElement('div');
        artistEl.className = 'lof-tile__artist';
        artistEl.textContent = song.artist;

        tile.appendChild(titleEl);
        tile.appendChild(artistEl);

        tile.setAttribute(
          'aria-label',
          ContentLayer.getTileAriaLabel(
            song.title,
            song.artist,
            tile.disabled === false
          )
        );

        grid.appendChild(tile);
      });
    },

    renderQueue(queue) {
      const container = document.querySelector('[data-lof="queue"]');
      const listEl = container?.querySelector('[data-lof="queue-list"]');

      if (!container || !listEl) return;

      if (!queue || queue.length === 0) {
        container.style.display = 'none';
        listEl.innerHTML = '';
        return;
      }

      container.style.display = '';
      listEl.innerHTML = '';

      queue.forEach((entry) => {
        const li = document.createElement('li');
        li.className = 'lof-queue-item';

        const positionEl = document.createElement('span');
        positionEl.className = 'lof-queue-item__position';
        positionEl.textContent = entry.position;

        const titleEl = document.createElement('span');
        titleEl.className = 'lof-queue-item__title';
        titleEl.textContent = entry.title;

        const requestedByEl = document.createElement('span');
        requestedByEl.className = 'lof-queue-item__requested-by';
        requestedByEl.textContent = ContentLayer.getRequestedByLabel(entry.requestedBy);

        li.appendChild(positionEl);
        li.appendChild(titleEl);
        li.appendChild(requestedByEl);

        listEl.appendChild(li);
      });
    },

    renderSpeakerButton(speakerState) {
      const button = document.querySelector('[data-lof="speaker-toggle"]');
      const labelEl = document.querySelector('[data-lof="speaker-label"]');
      const helperEl = document.querySelector('[data-lof="speaker-helper"]');

      if (!button || !labelEl || !helperEl) return;

      const copy = ContentLayer.getSpeakerCopy(speakerState);

      button.disabled = !copy.enabled;
      button.classList.toggle('lof-button--disabled', !copy.enabled);
      button.textContent = copy.buttonLabel;

      labelEl.textContent = copy.title;
      helperEl.textContent = copy.helper;
    },

    showToast(message) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;

      container.innerHTML = `
        <div class="lof-message lof-message--success" role="status">
          <span>${message}</span>
        </div>`;
      setTimeout(() => this.clearMessages(), 5000);
    },

    clearMessages() {
      const container = document.querySelector('[data-lof="messages"]');
      if (container) container.innerHTML = '';
    },
  };

  // Expose globally so StateLayer/InteractionLayer can call ViewLayer.render(...)
  window.ViewLayer = ViewLayer;
})(window);
