(function (window) {
  'use strict';

  const ViewLayer = {
    render(state, derived) {
      const enhancedDerived = { ...derived, state: state.currentState };

      this.renderStatusPanel(state, enhancedDerived);
      this.renderNowNext(state.rfData?.nowPlaying, state.rfData?.upNext);
      this.renderSongGrid(state.rfData?.availableSongs || []);
      this.renderQueue(state.rfData?.queue || []);
      this.renderSpeakerCard(state);
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
        artistEl.textContent = song.artist || '';

        tile.appendChild(titleEl);
        tile.appendChild(artistEl);

        tile.setAttribute(
          'aria-label',
          ContentLayer.getTileAriaLabel(song.title, song.artist, !tile.disabled)
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
        positionEl.textContent = entry.position + '.';

        const titleEl = document.createElement('span');
        titleEl.className = 'lof-queue-item__title';
        titleEl.textContent = entry.title;

        const requestedByEl = document.createElement('span');
        requestedByEl.className = 'lof-queue-item__requested-by';
        requestedByEl.textContent = ContentLayer.getRequesterLabel(entry.requestedBy);

        li.appendChild(positionEl);
        li.appendChild(titleEl);
        li.appendChild(requestedByEl);

        listEl.appendChild(li);
      });
    },

    renderSpeakerCard(state) {
      const container = document.getElementById('lof-speaker-card');
      if (!container) return;

      const flags = ThemeLayer.mapStateToFlags(state);
      const content = ContentLayer.getSpeakerContent(state, flags);

      if (!flags.speaker.showSpeakerButton) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';
      container.className = flags.speaker.speakerCardClass;

      const titleEl = container.querySelector('#speaker-title');
      if (titleEl) titleEl.textContent = content.cardTitle;

      const statusEl = container.querySelector('#speaker-status');
      if (statusEl) statusEl.textContent = content.statusMessage;

      const helperEl = container.querySelector('#speaker-message');
      if (helperEl) helperEl.textContent = content.helperText;

      const countdownEl = container.querySelector('#speaker-countdown');
      if (countdownEl) {
        if (flags.speaker.showCountdown) {
          countdownEl.style.display = 'block';
          const valueEl = countdownEl.querySelector('#countdown-value');
          if (valueEl) valueEl.textContent = flags.speaker.countdownValue;
          countdownEl.className = `speaker-countdown ${flags.speaker.countdownClass}`;
        } else {
          countdownEl.style.display = 'none';
        }
      }

      const proximityConfirmBtn = container.querySelector('#speaker-proximity-confirm-btn');
      if (proximityConfirmBtn) {
        if (flags.speaker.showProximityConfirmButton) {
          proximityConfirmBtn.style.display = 'block';
          proximityConfirmBtn.textContent = content.proximityConfirmLabel;
          proximityConfirmBtn.className = flags.speaker.proximityConfirmButtonClass;
          proximityConfirmBtn.disabled = false;
        } else {
          proximityConfirmBtn.style.display = 'none';
        }
      }

      const primaryBtn = container.querySelector('#speaker-primary-btn');
      if (primaryBtn) {
        if (flags.speaker.showPrimaryButton) {
          primaryBtn.style.display = 'block';
          primaryBtn.textContent = content.primaryButtonLabel;
          primaryBtn.className = flags.speaker.primaryButtonClass;
          primaryBtn.disabled = !flags.speaker.primaryButtonEnabled;
        } else {
          primaryBtn.style.display = 'none';
        }
      }

      const fmBtn = container.querySelector('#fm-info-btn');
      if (fmBtn) {
        const freqSpan = fmBtn.querySelector('#fm-freq');
        if (freqSpan) freqSpan.textContent = state.speaker.config.fmFrequency;
      }

      const hintEl = container.querySelector('#speaker-hint');
      if (hintEl && content.proximityHint) {
        hintEl.textContent = content.proximityHint;
        hintEl.style.display = 'block';
      } else if (hintEl) {
        hintEl.style.display = 'none';
      }
    },

    showStreamPlayer() {
      const player = document.getElementById('stream-mini-player');
      if (!player) return;

      player.style.display = 'block';
      player.classList.add('lof-stream-player--visible');

      const content = player.querySelector('#stream-content');
      const container = player.querySelector('#stream-container');
      if (content) content.style.display = 'block';
      if (container) container.style.display = 'none';
    },

    loadStreamIframe(streamUrl) {
      const player = document.getElementById('stream-mini-player');
      if (!player) return;

      const content = player.querySelector('#stream-content');
      const container = player.querySelector('#stream-container');
      const startBtn = player.querySelector('#stream-start-btn');

      if (!container) return;

      if (content) content.style.display = 'none';
      if (startBtn) startBtn.style.display = 'none';

      container.style.display = 'block';
      container.innerHTML = `
        <iframe 
          src="${this._escapeHtml(streamUrl)}"
          width="100%"
          height="300"
          frameborder="0"
          allow="autoplay"
          class="lof-stream-iframe">
        </iframe>
      `;
    },

    hideStreamPlayer() {
      const player = document.getElementById('stream-mini-player');
      if (!player) return;

      player.style.display = 'none';
      player.classList.remove('lof-stream-player--visible');

      const container = player.querySelector('#stream-container');
      if (container) container.innerHTML = '';

      const content = player.querySelector('#stream-content');
      const startBtn = player.querySelector('#stream-start-btn');
      if (content) content.style.display = 'block';
      if (startBtn) startBtn.style.display = 'block';
    },

    minimizeStreamPlayer() {
      const player = document.getElementById('stream-mini-player');
      if (!player) return;
      player.classList.add('lof-stream-player--minimized');
    },

    expandStreamPlayer() {
      const player = document.getElementById('stream-mini-player');
      if (!player) return;
      player.classList.remove('lof-stream-player--minimized');
    },

    showLoading(message) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;

      container.innerHTML = `
        <div class="lof-message lof-message--loading" role="status" aria-live="polite">
          <div class="lof-spinner"></div>
          <span>${this._escapeHtml(message)}</span>
        </div>`;
    },

    showSuccess(message) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;

      container.innerHTML = `
        <div class="lof-message lof-message--success" role="status" aria-live="polite">
          <span>${this._escapeHtml(message)}</span>
        </div>`;

      setTimeout(() => this.clearMessages(), 5000);
    },

    showError(errorData) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;

      const message = typeof errorData === 'string' 
        ? errorData 
        : ContentLayer.getErrorMessage(errorData.code || 'UNKNOWN', errorData.context || {});

      container.innerHTML = `
        <div class="lof-message lof-message--error" role="alert" aria-live="assertive">
          <span>${this._escapeHtml(message)}</span>
        </div>`;

      setTimeout(() => this.clearMessages(), 8000);
    },

    showInfo(message) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;

      container.innerHTML = `
        <div class="lof-message lof-message--info" role="status" aria-live="polite">
          <span>${this._escapeHtml(message)}</span>
        </div>`;

      setTimeout(() => this.clearMessages(), 5000);
    },

    showToast(message) {
      this.showSuccess(message);
    },

    clearMessages() {
      const container = document.querySelector('[data-lof="messages"]');
      if (container) container.innerHTML = '';
    },

    setButtonLoading(buttonId, loading) {
      const button = document.getElementById(`${buttonId}-btn`);
      if (!button) return;

      if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = 'Loading...';
        button.classList.add('lof-btn--loading');
      } else {
        button.disabled = false;
        if (button.dataset.originalText) {
          button.textContent = button.dataset.originalText;
          delete button.dataset.originalText;
        }
        button.classList.remove('lof-btn--loading');
      }
    },

    updateUI(state) {
      const flags = ThemeLayer.mapStateToFlags(state);
      const content = ContentLayer.getSpeakerContent(state, flags);
      this.renderSpeakerCard(state);
    },

    _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
  };

  window.ViewLayer = ViewLayer;
})(window);