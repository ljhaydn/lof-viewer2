/**
 * LOF Viewer V2 - View Layer (COMPLETE: RF Viewer + Speaker Control)
 * 
 * Responsibility: DOM manipulation ONLY
 * - Renders RF viewer components (song grid, now playing, queue)
 * - Renders speaker control components
 * - No business logic
 * - No API calls
 * - Reads from State, Theme, and Content layers only
 */

const ViewLayer = (() => {
  
  // ========================================================================
  // RF VIEWER RENDERING METHODS
  // ========================================================================
  
  /**
   * Render status panel (connection status, state indicator)
   */
  function renderStatusPanel(statusCopy) {
    const panel = document.querySelector('[data-lof="status-panel"]');
    if (!panel) return;
    
    const textEl = panel.querySelector('[data-lof="status-text"]');
    const indicatorEl = panel.querySelector('[data-lof="state-indicator"]');
    const warningEl = panel.querySelector('[data-lof="connection-warning"]');
    
    if (textEl) textEl.textContent = statusCopy.text;
    
    if (indicatorEl) {
      indicatorEl.className = `lof-state-indicator ${statusCopy.indicatorClass}`;
    }
    
    if (warningEl) {
      warningEl.style.display = statusCopy.warning ? '' : 'none';
      warningEl.textContent = statusCopy.warning || '';
    }
  }
  
  /**
   * Render Now Playing / Up Next section
   */
  function renderNowNext(nowPlaying, upNext) {
    const nowTitleEl = document.querySelector('[data-lof="now-title"]');
    const nowArtistEl = document.querySelector('[data-lof="now-artist"]');
    const nextTitleEl = document.querySelector('[data-lof="next-title"]');
    const nextArtistEl = document.querySelector('[data-lof="next-artist"]');
    
    if (nowTitleEl) {
      nowTitleEl.textContent = nowPlaying?.title || 'Intermission';
    }
    
    if (nowArtistEl) {
      nowArtistEl.textContent = nowPlaying?.artist || '';
    }
    
    if (nextTitleEl) {
      nextTitleEl.textContent = upNext?.title || ContentLayer.getNoNextTrackLabel();
    }
    
    if (nextArtistEl) {
      nextArtistEl.textContent = upNext?.artist || '';
    }
  }
  
  /**
   * Render song grid (song tiles for requests/voting)
   */
  function renderSongGrid(songs) {
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
  }
  
  /**
   * Render queue list
   */
  function renderQueue(queue) {
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
      
      li.appendChild(positionEl);
      li.appendChild(titleEl);
      listEl.appendChild(li);
    });
  }
  
  /**
   * Show loading state
   */
  function showLoading(message = 'Loading...') {
    const shell = document.getElementById('lof-viewer-v2-root');
    if (shell) {
      shell.classList.add('lof-state--loading');
    }
    
    const statusText = document.querySelector('[data-lof="status-text"]');
    if (statusText) {
      statusText.textContent = message;
    }
  }
  
  /**
   * Hide loading state
   */
  function hideLoading() {
    const shell = document.getElementById('lof-viewer-v2-root');
    if (shell) {
      shell.classList.remove('lof-state--loading');
    }
  }
  
  /**
   * Show success message (toast)
   */
  function showSuccess(message) {
    _showToast(message, 'success');
  }
  
  /**
   * Show error message (toast)
   */
  function showError(errorCode, context = {}) {
    const message = ContentLayer.getErrorMessage(errorCode, context);
    _showToast(message, 'error');
  }
  
  /**
   * Internal: Show toast notification
   */
  function _showToast(message, type = 'info') {
    const container = document.querySelector('[data-lof="messages"]');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `lof-toast lof-toast--${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('lof-toast--fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
  
  // ========================================================================
  // SPEAKER CONTROL RENDERING METHODS
  // ========================================================================
  
  /**
   * Render complete speaker card
   */
  function renderSpeakerCard(state, flags, content) {
    const container = document.getElementById('lof-speaker-card');
    if (!container) {
      console.warn('[ViewLayer] Speaker card container not found');
      return;
    }
    
    // Show/hide entire card
    if (!flags.showSpeakerButton) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    container.className = flags.speakerCardClass;
    
    // Update title
    const titleEl = container.querySelector('#speaker-title');
    if (titleEl) {
      titleEl.textContent = content.cardTitle;
    }
    
    // Update status message
    const statusEl = container.querySelector('#speaker-status');
    if (statusEl) {
      statusEl.textContent = content.statusMessage;
    }
    
    // Update helper text
    const helperEl = container.querySelector('#speaker-message');
    if (helperEl) {
      helperEl.textContent = content.helperText;
    }
    
    // Update countdown
    const countdownEl = container.querySelector('#speaker-countdown');
    if (countdownEl) {
      if (flags.showCountdown) {
        countdownEl.style.display = 'block';
        const valueEl = countdownEl.querySelector('#countdown-value');
        if (valueEl) {
          valueEl.textContent = flags.countdownValue;
        }
        countdownEl.className = `speaker-countdown ${flags.countdownClass}`;
      } else {
        countdownEl.style.display = 'none';
      }
    }
    
    // Update primary button
    const primaryBtn = container.querySelector('#speaker-primary-btn');
    if (primaryBtn) {
      primaryBtn.textContent = content.primaryButtonLabel;
      primaryBtn.className = flags.primaryButtonClass;
      primaryBtn.disabled = !flags.canClickPrimaryButton;
    }
    
    // Update alternatives
    const fmBtn = container.querySelector('#fm-info-btn');
    if (fmBtn) {
      fmBtn.textContent = content.alternatives.fmLabel;
      if (flags.emphasizeAlternatives) {
        fmBtn.classList.add('lof-btn-text--emphasized');
      } else {
        fmBtn.classList.remove('lof-btn-text--emphasized');
      }
    }
    
    const streamBtn = container.querySelector('#stream-btn');
    if (streamBtn) {
      streamBtn.textContent = content.alternatives.streamLabel;
      if (flags.emphasizeAlternatives) {
        streamBtn.classList.add('lof-btn-text--emphasized');
      } else {
        streamBtn.classList.remove('lof-btn-text--emphasized');
      }
    }
    
    // Update proximity hint
    const hintEl = container.querySelector('#speaker-hint');
    if (hintEl) {
      if (content.proximityHint && content.proximityHint.show && flags.showProximityHint) {
        hintEl.style.display = 'block';
        hintEl.innerHTML = `
          <p class="proximity-hint proximity-hint--${content.proximityHint.emphasis}">
            ${content.proximityHint.message}
          </p>
          ${content.proximityHint.alternative ? `
            <p class="proximity-hint-alt">${content.proximityHint.alternative}</p>
          ` : ''}
        `;
      } else {
        hintEl.style.display = 'none';
      }
    }
  }
  
  /**
   * Show stream modal
   */
  function showStreamModal(streamUrl) {
    const modal = document.getElementById('stream-modal');
    if (!modal) {
      console.warn('[ViewLayer] Stream modal not found');
      return;
    }
    
    modal.style.display = 'flex';
    
    const container = modal.querySelector('#stream-container');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
    
    modal.dataset.streamUrl = streamUrl;
  }
  
  /**
   * Load stream iframe (after user confirms)
   */
  function loadStreamIframe() {
    const modal = document.getElementById('stream-modal');
    if (!modal) return;
    
    const streamUrl = modal.dataset.streamUrl;
    if (!streamUrl) {
      console.warn('[ViewLayer] No stream URL available');
      return;
    }
    
    const container = modal.querySelector('#stream-container');
    const startBtn = modal.querySelector('#stream-start-btn');
    
    if (!container) return;
    
    if (startBtn) {
      startBtn.style.display = 'none';
    }
    
    container.style.display = 'block';
    container.innerHTML = `
      <iframe 
        src="${streamUrl}"
        width="100%"
        height="400"
        frameborder="0"
        allow="autoplay"
        class="lof-stream-iframe">
      </iframe>
    `;
  }
  
  /**
   * Hide stream modal
   */
  function hideStreamModal() {
    const modal = document.getElementById('stream-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
    
    const container = modal.querySelector('#stream-container');
    if (container) {
      container.innerHTML = '';
    }
    
    const startBtn = modal.querySelector('#stream-start-btn');
    if (startBtn) {
      startBtn.style.display = 'block';
    }
  }
  
  /**
   * Show FM modal
   */
  function showFMModal(frequency) {
    const modal = document.getElementById('fm-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    const freqEl = modal.querySelector('#fm-frequency');
    const freqTextEl = modal.querySelector('#fm-frequency-text');
    
    if (freqEl) freqEl.textContent = frequency;
    if (freqTextEl) freqTextEl.textContent = frequency + ' FM';
  }
  
  /**
   * Hide FM modal
   */
  function hideFMModal() {
    const modal = document.getElementById('fm-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
  }
  
  // Public API
  return {
    // RF Viewer methods
    renderStatusPanel,
    renderNowNext,
    renderSongGrid,
    renderQueue,
    showLoading,
    hideLoading,
    showSuccess,
    showError,
    
    // Speaker Control methods
    renderSpeakerCard,
    showStreamModal,
    loadStreamIframe,
    hideStreamModal,
    showFMModal,
    hideFMModal
  };
  
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ViewLayer;
} else {
  window.ViewLayer = ViewLayer;
}
