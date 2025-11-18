// assets/js/lof-view-layer.js
(function (window) {
  'use strict';

  const ViewLayer = {
    render(state, derived) {
      // Add state to derived for ContentLayer access
      const enhancedDerived = { ...derived, state: state.currentState };
      
      this.renderStatusPanel(state, enhancedDerived);
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

      // ✅ FIXED: ContentLayer.getStatusCopy() now exists
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

      // ✅ FIXED: ContentLayer.getNoNextTrackLabel() now exists
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
        // ✅ FIXED: ContentLayer.getEmptyGridMessage() now exists
        emptyMsg.textContent = ContentLayer.getEmptyGridMessage();
        grid.appendChild(emptyMsg);
        return;
      }

      songs.forEach((song) => {
        const tile = document.createElement('button');
        tile.className = 'lof-tile';
        // ✅ FIXED: Use data-lof-song-id to match InteractionLayer selector
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
        // ✅ This method exists in ContentLayer
        requestedByEl.textContent = ContentLayer.getRequesterLabel(entry.requestedBy);

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

      // ✅ FIXED: ContentLayer.getSpeakerCopy() now exists
      const copy = ContentLayer.getSpeakerCopy(speakerState);

      button.disabled = !copy.enabled;
      button.classList.toggle('lof-button--disabled', !copy.enabled);

      labelEl.textContent = copy.title;
      helperEl.textContent = copy.helper;
    },

    // ========================================
    // NEW METHODS REQUIRED BY INTERACTION LAYER
    // ========================================

    /**
     * Show loading state
     * Called by InteractionLayer during async operations
     */
    showLoading(message) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;

      container.innerHTML = `
        <div class="lof-message lof-message--loading" role="status" aria-live="polite">
          <div class="lof-spinner"></div>
          <span>${this._escapeHtml(message)}</span>
        </div>`;
    },

    /**
     * Show success toast
     * Called by InteractionLayer after successful actions
     */
    showSuccess(message) {
      const container = document.querySelector('[data-lof="messages"]');
      if (!container) return;

      container.innerHTML = `
        <div class="lof-message lof-message--success" role="status" aria-live="polite">
          <span>${this._escapeHtml(message)}</span>
        </div>`;

      // Auto-clear after 5 seconds
      setTimeout(() => this.clearMessages(), 5000);
    },

    /**
     * Show error message
     * Called by InteractionLayer when actions fail
     * @param {Object} errorData - { code, context }
     */
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

      // Auto-clear after 8 seconds
      setTimeout(() => this.clearMessages(), 8000);
    },

    /**
     * Show generic toast (kept for backwards compatibility)
     */
    showToast(message) {
      this.showSuccess(message);
    },

    /**
     * Clear all messages
     */
    clearMessages() {
      const container = document.querySelector('[data-lof="messages"]');
      if (container) container.innerHTML = '';
    },

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Escape HTML to prevent XSS
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
  };

  // Expose globally so StateLayer/InteractionLayer can call ViewLayer.render(...)
  window.ViewLayer = ViewLayer;
})(window);