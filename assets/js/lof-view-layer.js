(function (window) {
  'use strict';

  const ViewLayer = {
    _elements: {},
    _lastRenderedState: null,

    init() {
      this._cacheElements();
    },

    _cacheElements() {
      this._elements = {
        statusBar: document.getElementById('lof-status-bar'),
        statusText: document.getElementById('lof-status-text'),
        statusIndicator: document.getElementById('lof-status-indicator'),
        
        nowPlayingCard: document.getElementById('lof-now-playing-card'),
        nowPlayingContent: document.getElementById('lof-now-playing-content'),
        
        upNextCard: document.getElementById('lof-up-next-card'),
        upNextContent: document.getElementById('lof-up-next-content'),
        
        speakerSection: document.getElementById('lof-speaker-section'),
        speakerStatus: document.getElementById('lof-speaker-status-text'),
        speakerCountdownWrapper: document.getElementById('lof-speaker-countdown-wrapper'),
        speakerCountdownValue: document.getElementById('lof-speaker-countdown-value'),
        speakerPrimaryBtn: document.getElementById('speaker-primary-btn'),
        speakerHelper: document.getElementById('lof-speaker-helper'),
        speakerAlternatives: document.getElementById('lof-speaker-alternatives'),
        fmFrequency: document.getElementById('fm-frequency'),
        
        queueSection: document.getElementById('lof-queue-section'),
        queueTitle: document.getElementById('lof-queue-title'),
        queueList: document.getElementById('lof-queue-list'),
        
        surpriseSection: document.getElementById('lof-surprise-section'),
        surpriseBtn: document.getElementById('surprise-me-btn'),
        
        gridSection: document.getElementById('lof-grid-section'),
        songGrid: document.getElementById('lof-song-grid'),
        
        toastContainer: document.getElementById('lof-toast-container'),
        
        streamPlayer: document.getElementById('stream-mini-player'),
        streamPlaceholder: document.getElementById('stream-placeholder'),
        streamIframeWrapper: document.getElementById('stream-iframe-wrapper'),
      };
    },

    render(state, derived) {
      if (!state || !derived) return;

      this._lastRenderedState = state;

      this.renderStatus(state, derived);
      this.renderNowPlaying(state);
      this.renderUpNext(state);
      this.renderSpeaker(state);
      this.renderQueue(state, derived);
      this.renderSurpriseMe(state, derived);
      this.renderSongGrid(state, derived);
    },

    renderStatus(state, derived) {
      if (!this._elements.statusText) return;

      const statusCopy = ContentLayer.getStatusCopy(derived);
      this._elements.statusText.textContent = statusCopy.text;
      
      if (this._elements.statusIndicator) {
        this._elements.statusIndicator.className = 'lof-status-indicator ' + statusCopy.indicatorClass;
      }
    },

    renderNowPlaying(state) {
      if (!this._elements.nowPlayingContent) return;

      const nowPlaying = state.rfData?.nowPlaying;

      if (!nowPlaying || !nowPlaying.title) {
        this._elements.nowPlayingContent.innerHTML = '<p class="lof-text-muted">No song playing</p>';
        return;
      }

      this._elements.nowPlayingContent.innerHTML = `
        <div class="lof-now-playing-info">
          <div class="lof-now-playing-title">${this._escapeHtml(nowPlaying.title)}</div>
          ${nowPlaying.artist ? `<div class="lof-now-playing-artist">${this._escapeHtml(nowPlaying.artist)}</div>` : ''}
        </div>
      `;
    },

    renderUpNext(state) {
      if (!this._elements.upNextContent) return;

      const upNext = state.rfData?.upNext;

      if (!upNext || !upNext.title) {
        const placeholder = ContentLayer.getNoNextTrackLabel();
        this._elements.upNextContent.innerHTML = `<p class="lof-text-muted">${this._escapeHtml(placeholder)}</p>`;
        return;
      }

      this._elements.upNextContent.innerHTML = `
        <div class="lof-up-next-info">
          <div class="lof-up-next-title">${this._escapeHtml(upNext.title)}</div>
          ${upNext.artist ? `<div class="lof-up-next-artist">${this._escapeHtml(upNext.artist)}</div>` : ''}
        </div>
      `;
    },

    renderSpeaker(state) {
      if (!this._elements.speakerSection) return;

      const flags = ThemeLayer.mapSpeakerFlags(state);
      const content = ContentLayer.getSpeakerContent(state, flags);

      // Update button
      if (this._elements.speakerPrimaryBtn) {
        this._elements.speakerPrimaryBtn.textContent = content.buttonLabel;
        this._elements.speakerPrimaryBtn.disabled = !flags.buttonEnabled;
        this._elements.speakerPrimaryBtn.className = flags.buttonClass;
      }

      // Update status text
      if (this._elements.speakerStatus) {
        this._elements.speakerStatus.textContent = content.statusText;
      }

      // Update countdown
      if (this._elements.speakerCountdownWrapper && this._elements.speakerCountdownValue) {
        if (flags.showCountdown && flags.countdownValue > 0) {
          this._elements.speakerCountdownWrapper.style.display = 'block';
          this._elements.speakerCountdownValue.textContent = this._formatCountdown(flags.countdownValue);
          this._elements.speakerCountdownWrapper.className = 'lof-speaker-countdown-wrapper ' + flags.countdownClass;
        } else {
          this._elements.speakerCountdownWrapper.style.display = 'none';
        }
      }

      // Update helper text
      if (this._elements.speakerHelper) {
        this._elements.speakerHelper.textContent = content.helperText;
        this._elements.speakerHelper.style.display = content.helperText ? 'block' : 'none';
      }

      // Update FM frequency
      if (this._elements.fmFrequency) {
        this._elements.fmFrequency.textContent = state.speaker.config.fmFrequency;
      }

      // Show/hide alternatives
      if (this._elements.speakerAlternatives) {
        if (flags.emphasizeAlternatives) {
          this._elements.speakerAlternatives.style.display = 'block';
          this._elements.speakerAlternatives.classList.add('lof-alternatives--emphasized');
        } else {
          this._elements.speakerAlternatives.style.display = 'block';
          this._elements.speakerAlternatives.classList.remove('lof-alternatives--emphasized');
        }
      }
    },

    renderQueue(state, derived) {
      if (!this._elements.queueSection || !this._elements.queueList) return;

      const queue = state.rfData?.queue || [];

      if (queue.length === 0 || !derived.shouldShowQueue) {
        this._elements.queueSection.style.display = 'none';
        return;
      }

      this._elements.queueSection.style.display = 'block';

      const queueHtml = queue.map((item, index) => {
        const requester = ContentLayer.getRequesterLabel(item.requester);
        return `
          <div class="lof-queue-item">
            <div class="lof-queue-position">${index + 1}</div>
            <div class="lof-queue-info">
              <div class="lof-queue-title">${this._escapeHtml(item.title)}</div>
              <div class="lof-queue-requester">Requested by ${this._escapeHtml(requester)}</div>
            </div>
          </div>
        `;
      }).join('');

      this._elements.queueList.innerHTML = queueHtml;
    },

    renderSurpriseMe(state, derived) {
      if (!this._elements.surpriseSection || !this._elements.surpriseBtn) return;

      if (derived.shouldShowSurpriseMe) {
        this._elements.surpriseSection.style.display = 'block';
        this._elements.surpriseBtn.textContent = ContentLayer.getMessage('labels', 'surpriseMe');
      } else {
        this._elements.surpriseSection.style.display = 'none';
      }
    },

    renderSongGrid(state, derived) {
      if (!this._elements.songGrid) return;

      const songs = state.rfData?.availableSongs || [];

      if (songs.length === 0 || !derived.shouldShowGrid) {
        this._elements.songGrid.innerHTML = `
          <div class="lof-empty-message">
            ${ContentLayer.getEmptyGridMessage()}
          </div>
        `;
        return;
      }

      const tilesHtml = songs.map((song) => {
        const isAvailable = song.isAvailable !== false;
        const tileClass = ThemeLayer.getTileClass(isAvailable, false);
        const ariaLabel = ContentLayer.getTileAriaLabel(song.title, song.artist, isAvailable);

        return `
          <button 
            class="${tileClass}" 
            data-lof-song-id="${this._escapeHtml(song.songId)}"
            ${!isAvailable ? 'disabled' : ''}
            aria-label="${this._escapeHtml(ariaLabel)}">
            
            <div class="lof-tile-content">
              <div class="lof-tile-title">${this._escapeHtml(song.title)}</div>
              ${song.artist ? `<div class="lof-tile-artist">${this._escapeHtml(song.artist)}</div>` : ''}
              ${song.category ? `<div class="lof-tile-category ${ThemeLayer.getCategoryClass(song.category)}">${this._escapeHtml(song.category)}</div>` : ''}
            </div>
            
            ${!isAvailable ? '<div class="lof-tile-overlay">Not Available</div>' : ''}
          </button>
        `;
      }).join('');

      this._elements.songGrid.innerHTML = tilesHtml;
    },

    showSuccess(message) {
      this._showToast(message, 'success');
    },

    showError(errorOrMessage) {
      let message = '';
      
      if (typeof errorOrMessage === 'string') {
        message = errorOrMessage;
      } else if (errorOrMessage.code) {
        message = ContentLayer.getErrorMessage(errorOrMessage.code, errorOrMessage.context || {});
      } else if (errorOrMessage.error) {
        message = errorOrMessage.error;
      } else {
        message = 'Something went wrong';
      }
      
      this._showToast(message, 'error');
    },

    showInfo(message) {
      this._showToast(message, 'info');
    },

    showLoading(message) {
      this._showToast(message, 'loading', 30000);
    },

    _showToast(message, type = 'info', duration = 5000) {
      if (!this._elements.toastContainer) return;

      const toast = document.createElement('div');
      toast.className = `lof-toast lof-toast--${type}`;
      toast.textContent = message;

      this._elements.toastContainer.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('lof-toast--show');
      }, 10);

      if (type !== 'loading') {
        setTimeout(() => {
          toast.classList.remove('lof-toast--show');
          setTimeout(() => {
            if (toast.parentNode) {
              toast.parentNode.removeChild(toast);
            }
          }, 300);
        }, duration);
      }

      return toast;
    },

    setButtonLoading(btnId, loading) {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      if (loading) {
        btn.disabled = true;
        btn.classList.add('lof-btn--loading');
        btn.setAttribute('data-original-text', btn.textContent);
        btn.textContent = '...';
      } else {
        btn.disabled = false;
        btn.classList.remove('lof-btn--loading');
        const original = btn.getAttribute('data-original-text');
        if (original) {
          btn.textContent = original;
          btn.removeAttribute('data-original-text');
        }
      }
    },

    updateUI(state) {
      const derived = StateLayer.getDerivedState();
      this.render(state, derived);
    },

    showStreamPlayer() {
      if (this._elements.streamPlayer) {
        this._elements.streamPlayer.style.display = 'block';
      }
    },

    hideStreamPlayer() {
      if (this._elements.streamPlayer) {
        this._elements.streamPlayer.style.display = 'none';
      }
      
      if (this._elements.streamIframeWrapper) {
        this._elements.streamIframeWrapper.innerHTML = '';
        this._elements.streamIframeWrapper.style.display = 'none';
      }
      
      if (this._elements.streamPlaceholder) {
        this._elements.streamPlaceholder.style.display = 'block';
      }
    },

    loadStreamIframe(url) {
      if (!this._elements.streamIframeWrapper) return;

      this._elements.streamIframeWrapper.innerHTML = `
        <iframe 
          src="${this._escapeHtml(url)}" 
          class="lof-stream-iframe"
          frameborder="0"
          allow="autoplay"
          allowfullscreen>
        </iframe>
      `;

      this._elements.streamIframeWrapper.style.display = 'block';
      
      if (this._elements.streamPlaceholder) {
        this._elements.streamPlaceholder.style.display = 'none';
      }
    },

    minimizeStreamPlayer() {
      if (this._elements.streamPlayer) {
        this._elements.streamPlayer.classList.add('lof-stream-player--minimized');
      }
    },

    expandStreamPlayer() {
      if (this._elements.streamPlayer) {
        this._elements.streamPlayer.classList.remove('lof-stream-player--minimized');
      }
    },

    _formatCountdown(seconds) {
      if (seconds <= 0) return '0:00';
      
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    _escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return String(text).replace(/[&<>"']/g, (m) => map[m]);
    },
  };

  window.ViewLayer = ViewLayer;
})(window);