// assets/js/lof-view-layer.js
(function (window) {
  'use strict';

  const ViewLayer = {
    render(state, derived) {
      const enhancedDerived = { ...derived, state: state.currentState };

      this.renderStatusPanel(state, enhancedDerived);
      this.renderNowNext(state.rfData?.nowPlaying, state.rfData?.upNext);
      this.renderSongGrid(state.rfData?.availableSongs || []);
      this.renderQueue(state.rfData?.queue || []);
      this.renderSpeakerCard(state.speaker, state.fppData);
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

    // ========================================
    // SPEAKER CARD RENDERING
    // ========================================

    renderSpeakerCard(speakerState, fppData) {
      const card = document.querySelector('[data-lof="speaker-card"]');
      if (!card) return;

      // Get flags from ThemeLayer
      const flags = ThemeLayer.mapSpeakerFlags(speakerState, fppData);

      // Get copy from ContentLayer
      const copy = ContentLayer.getSpeakerCopy(flags);

      // Show/hide card based on feature flag
      const shouldShow = window.LOF_CONFIG?.lofInitialConfig?.features?.speakerControlEnabled;
      card.style.display = shouldShow ? '' : 'none';

      if (!shouldShow) return;

      // Update title
      const titleEl = card.querySelector('[data-lof="speaker-title"]');
      if (titleEl) titleEl.textContent = copy.title;

      // Update status text
      const statusEl = card.querySelector('[data-lof="speaker-status"]');
      if (statusEl) statusEl.textContent = copy.statusText;

      // Update countdown
      const countdownEl = card.querySelector('[data-lof="speaker-countdown"]');
      const countdownValueEl = card.querySelector('[data-lof="speaker-countdown-value"]');
      if (countdownEl && countdownValueEl) {
        countdownEl.style.display = flags.showCountdown ? '' : 'none';
        if (flags.showCountdown) {
          countdownValueEl.textContent = copy.countdownLabel;
        }
      }

      // Update proximity button
      const proximityBtn = card.querySelector('[data-lof="speaker-proximity-btn"]');
      if (proximityBtn) {
        proximityBtn.style.display = flags.showProximityButton ? '' : 'none';
        proximityBtn.textContent = copy.proximityConfirmLabel;
      }

      // Update primary button
      const primaryBtn = card.querySelector('[data-lof="speaker-primary-btn"]');
      if (primaryBtn) {
        primaryBtn.textContent = copy.buttonLabel;
        primaryBtn.disabled = !flags.buttonEnabled && !flags.showExtendButton;

        // Handle extension button vs regular button
        if (flags.showExtendButton) {
          primaryBtn.disabled = false;
          primaryBtn.dataset.action = 'extend';
        } else {
          primaryBtn.dataset.action = flags.buttonEnabled ? 'enable' : 'none';
        }

        // Update button classes
        primaryBtn.className = 'lof-button lof-button--speaker';
        if (flags.displayMode === 'active' || flags.displayMode === 'protection') {
          primaryBtn.classList.add('lof-button--on');
        }
        if (!flags.buttonEnabled && !flags.showExtendButton) {
          primaryBtn.classList.add('lof-button--disabled');
        }
      }

      // Update helper text
      const helperEl = card.querySelector('[data-lof="speaker-helper"]');
      if (helperEl) helperEl.textContent = copy.helperText;

      // Update alternatives (always visible, just emphasized differently)
      const alternativesEl = card.querySelector('[data-lof="speaker-alternatives"]');
      if (alternativesEl) {
        // Always visible
        alternativesEl.style.display = '';
        
        // Add emphasis class when needed
        if (flags.emphasizeAlternatives) {
          alternativesEl.classList.add('lof-alternatives--emphasized');
        } else {
          alternativesEl.classList.remove('lof-alternatives--emphasized');
        }

        const titleEl = alternativesEl.querySelector('.lof-alternatives-title');
        if (titleEl) titleEl.textContent = copy.alternativesTitle;
      }

      // Update FM button
      const fmBtn = card.querySelector('[data-lof="fm-btn"]');
      const fmFreqEl = card.querySelector('[data-lof="fm-frequency"]');
      if (fmBtn && fmFreqEl) {
        fmFreqEl.textContent = speakerState.config?.fmFrequency || '107.7';
      }

      // Update stream button (always visible)
      const streamBtn = card.querySelector('[data-lof="stream-btn"]');
      if (streamBtn) {
        streamBtn.textContent = copy.streamButtonLabel;
      }
    },

    // ========================================
    // STREAM PLAYER RENDERING
    // ========================================

    showStreamPlayer(streamUrl) {
      const player = document.querySelector('[data-lof="stream-player"]');
      if (!player) return;

      player.style.display = '';

      const placeholder = player.querySelector('[data-lof="stream-placeholder"]');
      const iframeContainer = player.querySelector('[data-lof="stream-iframe-container"]');

      if (placeholder) placeholder.style.display = '';
      if (iframeContainer) {
        iframeContainer.style.display = 'none';
        iframeContainer.innerHTML = '';
      }
    },

    startStreamPlayback(streamUrl) {
      const player = document.querySelector('[data-lof="stream-player"]');
      if (!player) return;

      const placeholder = player.querySelector('[data-lof="stream-placeholder"]');
      const iframeContainer = player.querySelector('[data-lof="stream-iframe-container"]');

      if (placeholder) placeholder.style.display = 'none';
      if (iframeContainer) {
        iframeContainer.style.display = '';
        iframeContainer.innerHTML = `<iframe src="${this._escapeHtml(
          streamUrl
        )}" frameborder="0" allowfullscreen class="lof-stream-iframe"></iframe>`;
      }
    },

    hideStreamPlayer() {
      const player = document.querySelector('[data-lof="stream-player"]');
      if (!player) return;

      player.style.display = 'none';

      const iframeContainer = player.querySelector('[data-lof="stream-iframe-container"]');
      if (iframeContainer) {
        iframeContainer.innerHTML = '';
      }
    },

    minimizeStreamPlayer() {
      const player = document.querySelector('[data-lof="stream-player"]');
      if (!player) return;

      player.classList.add('lof-stream-player--minimized');
    },

    restoreStreamPlayer() {
      const player = document.querySelector('[data-lof="stream-player"]');
      if (!player) return;

      player.classList.remove('lof-stream-player--minimized');
    },

    // ========================================
    // MESSAGE METHODS
    // ========================================

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

      const message = ContentLayer.getErrorMessage(
        errorData.code || 'UNKNOWN',
        errorData.context || {}
      );

      container.innerHTML = `
        <div class="lof-message lof-message--error" role="alert" aria-live="assertive">
          <span>${this._escapeHtml(message)}</span>
        </div>`;

      setTimeout(() => this.clearMessages(), 8000);
    },

    showToast(message) {
      this.showSuccess(message);
    },

    clearMessages() {
      const container = document.querySelector('[data-lof="messages"]');
      if (container) container.innerHTML = '';
    },

    // ========================================
    // UTILITY METHODS
    // ========================================

    _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
  };

  window.ViewLayer = ViewLayer;
})(window);
