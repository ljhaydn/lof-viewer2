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

      const statusTextEl = panel.querySelector('[data-lof="status-text"]');
      const indicatorEl = panel.querySelector('[data-lof="state-indicator"]');
      const warningEl = panel.querySelector('[data-lof="connection-warning"]');

      if (statusTextEl) {
        statusTextEl.textContent = ContentLayer.getMessage(
          'status',
          state.currentState,
          { showActive: derived.isShowActive },
        );
      }

      if (indicatorEl) {
        indicatorEl.className = ThemeLayer.getStateClass(state.currentState);
      }

      if (warningEl) {
        if (derived.isInDegradedMode) {
          warningEl.style.display = 'block';
          warningEl.textContent = 'Limited connectivity – things may flicker.';
        } else {
          warningEl.style.display = 'none';
        }
      }
    },

    renderNowNext(nowPlaying, upNext) {
      const nowEl = document.querySelector('[data-lof="now-playing"]');
      const nextEl = document.querySelector('[data-lof="up-next"]');

      if (nowEl) {
        if (nowPlaying) {
          nowEl.style.display = '';
          const titleEl = nowEl.querySelector('[data-lof="np-title"]');
          const artistEl = nowEl.querySelector('[data-lof="np-artist"]');
          const progEl = nowEl.querySelector('[data-lof="np-progress"]');
          if (titleEl) titleEl.textContent = nowPlaying.title;
          if (artistEl) artistEl.textContent = nowPlaying.artist;
          if (progEl && nowPlaying.duration > 0) {
            const pct = Math.max(
              0,
              Math.min(100, (nowPlaying.elapsedSeconds / nowPlaying.duration) * 100),
            );
            progEl.style.width = `${pct}%`;
            progEl.setAttribute('aria-valuenow', String(Math.round(pct)));
          }
        } else {
          nowEl.style.display = 'none';
        }
      }

      if (nextEl) {
        if (upNext) {
          nextEl.style.display = '';
          const titleEl = nextEl.querySelector('[data-lof="next-title"]');
          const artistEl = nextEl.querySelector('[data-lof="next-artist"]');
          if (titleEl) titleEl.textContent = upNext.title;
          if (artistEl) artistEl.textContent = upNext.artist;
        } else {
          nextEl.style.display = 'none';
        }
      }
    },

    renderSongGrid(songs) {
      const grid = document.querySelector('[data-lof="song-grid"]');
      if (!grid) return;

      grid.innerHTML = '';

      if (!songs || songs.length === 0) {
        return;
      }

      // Simple flat grid for now – categories can come later
      songs.forEach((song) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = ThemeLayer.getTileClass(song.isAvailable, !!song.cooldownUntil);
        tile.setAttribute('data-song-id', song.songId);

        if (!song.isAvailable || (song.cooldownUntil && song.cooldownUntil > Date.now())) {
          tile.disabled = true;
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
          ContentLayer.getTileAriaLabel(song.title, song.artist, tile.disabled === false),
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

      queue.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'lof-queue-item';

        const pos = document.createElement('span');
        pos.className = 'lof-queue-item__position';
        pos.textContent = `${idx + 1}.`;

        const title = document.createElement('span');
        title.className = 'lof-queue-item__title';
        title.textContent = item.title;

        const requester = document.createElement('span');
        requester.className = 'lof-queue-item__requester';
        requester.textContent = ContentLayer.getRequesterLabel(item.requestedBy);

        li.appendChild(pos);
        li.appendChild(title);
        li.appendChild(requester);

        listEl.appendChild(li);
      });
    },

    renderSpeakerButton(speakerState) {
      const btn = document.querySelector('[data-lof="speaker-toggle"]');
      const labelEl = btn?.querySelector('[data-lof="speaker-label"]');
      if (!btn || !labelEl) return;

      btn.className = ThemeLayer.getSpeakerButtonClass(
        speakerState.enabled,
        speakerState.disabledByHeuristic,
      );
      btn.setAttribute('aria-pressed', speakerState.enabled ? 'true' : 'false');

      if (speakerState.disabledByHeuristic) {
        btn.disabled = true;
        btn.setAttribute(
          'aria-label',
          ContentLayer.getSpeakerAriaLabel('disabled', speakerState.disabledReason),
        );
      } else {
        btn.disabled = false;
        btn.setAttribute(
          'aria-label',
          ContentLayer.getSpeakerAriaLabel(speakerState.enabled ? 'on' : 'off'),
        );
      }

      labelEl.textContent = ContentLayer.getSpeakerLabel(speakerState.enabled);
    },

    showLoading(message) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;
      container.innerHTML = `
        <div class="lof-message lof-message--loading" role="status">
          <span>${message}</span>
        </div>`;
    },

    showError(errorData) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;
      const msg = ContentLayer.getErrorMessage(errorData.code, errorData.context || {});
      container.innerHTML = `
        <div class="lof-message lof-message--error" role="alert">
          <span>${msg}</span>
        </div>`;
      setTimeout(() => this.clearMessages(), 8000);
    },

    showSuccess(message) {
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

  window.ViewLayer = ViewLayer;
})(window);
