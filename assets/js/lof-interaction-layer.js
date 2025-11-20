(function (window) {
  'use strict';

  const InteractionLayer = {
    _pollHandle: null,
    _songCooldowns: new Map(),
    _actionInProgress: false,
    _countdownInterval: null,
    _lastSpeakerState: null,
    _lastPhysicalToastAt: 0,

    init() {
      this._attachEvents();
      this._restoreSession();

      StateLayer.subscribeToState((state) => {
        const derived = StateLayer.getDerivedState();
        ViewLayer.render(state, derived);
        this.detectPhysicalButtonPress(state);
      });

      this.startPolling();
    },

    _attachEvents() {
      document.addEventListener('click', (evt) => {
        const tile = evt.target.closest('[data-lof-song-id]');
        if (tile && !tile.disabled) {
          const songId = tile.getAttribute('data-lof-song-id');
          this.handleSongRequest(songId);
        }
      });

      const surpriseBtn = document.querySelector('[data-lof="surprise-me"]');
      if (surpriseBtn) {
        surpriseBtn.addEventListener('click', () => this.handleSurpriseMe());
      }

      const speakerBtn = document.getElementById('speaker-primary-btn');
      if (speakerBtn) {
        speakerBtn.addEventListener('click', () => {
          const state = StateLayer.getState();
          const flags = ThemeLayer.mapStateToFlags(state);

          if (flags.speaker.displayMode === 'extension') {
            this.handleSpeakerExtend();
          } else if (flags.speaker.displayMode === 'off') {
            this.handleSpeakerToggle();
          } else if (flags.speaker.displayMode === 'capped' || flags.speaker.displayMode === 'session_ending') {
            this.handleSpeakerToggle();
          }
        });
      }

      const proximityConfirmBtn = document.getElementById('speaker-proximity-confirm-btn');
      if (proximityConfirmBtn) {
        proximityConfirmBtn.addEventListener('click', () => this.handleProximityConfirm());
      }

      const streamBtn = document.getElementById('stream-btn');
      if (streamBtn) {
        streamBtn.addEventListener('click', () => this.handleStreamOpen());
      }

      const streamStartBtn = document.getElementById('stream-start-btn');
      if (streamStartBtn) {
        streamStartBtn.addEventListener('click', () => this.handleStreamStart());
      }

      const streamCloseBtn = document.getElementById('stream-close-btn');
      if (streamCloseBtn) {
        streamCloseBtn.addEventListener('click', () => this.handleStreamClose());
      }

      const streamMinimizeBtn = document.getElementById('stream-minimize-btn');
      if (streamMinimizeBtn) {
        streamMinimizeBtn.addEventListener('click', () => this.handleStreamMinimize());
      }

      const fmBtn = document.getElementById('fm-info-btn');
      if (fmBtn) {
        fmBtn.addEventListener('click', () => this.handleFMInfo());
      }
    },

    async handleSongRequest(songId) {
      if (this._actionInProgress) return;

      const now = Date.now();
      const cooldownTime = this._songCooldowns.get(songId);
      if (cooldownTime && now < cooldownTime) {
        const remainingSeconds = Math.ceil((cooldownTime - now) / 1000);
        ViewLayer.showError({
          code: 'SONG_COOLDOWN',
          context: { remainingSeconds, songId },
        });
        return;
      }

      const state = StateLayer.getState();

      this._actionInProgress = true;
      ViewLayer.showLoading(ContentLayer.getMessage('loading', 'request'));

      try {
        const res = await RFClient.requestSong(songId, state.visitorId);
        if (res.success) {
          const songs = state.rfData?.availableSongs || [];
          const songMeta = songs.find((s) => s.songId === songId);
          StateLayer.setState(
            {
              recentRequest: {
                songId,
                title: songMeta?.title || 'Unknown Song',
                timestamp: Date.now(),
                queuePosition: res.data?.queuePosition || 0,
              },
              interactionCount: state.interactionCount + 1,
            },
            'SONG_REQUESTED'
          );

          this._songCooldowns.set(songId, now + 15000);

          ViewLayer.showSuccess(
            ContentLayer.getMessage('success', 'request', {
              position: res.data?.queuePosition || '?',
            })
          );

          LOFClient.logTelemetry({
            event: 'song_request',
            songId,
            queuePosition: res.data?.queuePosition,
            timestamp: Date.now(),
          });
        } else {
          ViewLayer.showError({ code: res.errorCode, context: { songId } });
        }
      } catch (err) {
        console.error('[InteractionLayer] handleSongRequest failed', err);
        ViewLayer.showError({ code: 'UNKNOWN', context: {} });
      } finally {
        this._actionInProgress = false;
        this._saveSession();
      }
    },

    async handleSurpriseMe() {
      if (this._actionInProgress) return;

      const state = StateLayer.getState();
      const availableSongs = state.rfData?.availableSongs?.filter((s) => s.isAvailable) || [];
      if (!availableSongs.length) {
        ViewLayer.showError({ code: 'NO_SONGS', context: {} });
        return;
      }

      this._actionInProgress = true;
      ViewLayer.showLoading(ContentLayer.getMessage('loading', 'surprise'));

      try {
        const randomSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
        const res = await RFClient.requestSong(randomSong.songId, state.visitorId);

        if (res.success) {
          StateLayer.setState(
            {
              recentRequest: {
                songId: randomSong.songId,
                title: randomSong.title,
                timestamp: Date.now(),
                queuePosition: res.data?.queuePosition || 0,
              },
              interactionCount: state.interactionCount + 1,
            },
            'SURPRISE_ME'
          );

          this._songCooldowns.set(randomSong.songId, Date.now() + 15000);

          ViewLayer.showSuccess(
            ContentLayer.getMessage('success', 'surprise', {
              title: randomSong.title,
              position: res.data?.queuePosition || '?',
            })
          );

          LOFClient.logTelemetry({
            event: 'surprise_me',
            songId: randomSong.songId,
            timestamp: Date.now(),
          });
        } else {
          ViewLayer.showError({ code: res.errorCode, context: {} });
        }
      } catch (err) {
        console.error('[InteractionLayer] handleSurpriseMe failed', err);
        ViewLayer.showError({ code: 'UNKNOWN', context: {} });
      } finally {
        this._actionInProgress = false;
        this._saveSession();
      }
    },

    async handleProximityConfirm() {
      StateLayer.setProximityConfirmed(true);
      StateLayer.trackUserAction('proximity_confirmed');

      const state = StateLayer.getState();
      const flags = ThemeLayer.mapStateToFlags(state);
      const content = ContentLayer.getSpeakerContent(state, flags);

      ViewLayer.showSuccess(content.toasts.proximityConfirmed);
      ViewLayer.updateUI(StateLayer.getState());
    },

    async handleSpeakerToggle() {
      if (this._actionInProgress) return;

      const state = StateLayer.getState();
      const needsConfirmation = StateLayer.needsProximityConfirmation();

      if (needsConfirmation) {
        ViewLayer.showError('Please confirm you are at the show first');
        return;
      }

      const gating = StateLayer.canUseSpeaker();
      if (!gating.allowed) {
        const message = ContentLayer.getErrorMessage(gating.code, state);
        ViewLayer.showError(message);
        return;
      }

      StateLayer.trackUserAction('speaker_enable');

      this._actionInProgress = true;
      ViewLayer.setButtonLoading('speaker-primary', true);

      const response = await LOFClient.enableSpeaker(false, state.speaker.proximityConfirmed);

      this._actionInProgress = false;
      ViewLayer.setButtonLoading('speaker-primary', false);

      if (response.success) {
        StateLayer.setSpeakerState(response);

        const freshState = StateLayer.getState();
        const flags = ThemeLayer.mapStateToFlags(freshState);
        const content = ContentLayer.getSpeakerContent(freshState, flags);

        ViewLayer.showSuccess(response.data.message || content.toasts.enableSuccess);

        this._startCountdown();
      } else {
        const freshState = StateLayer.getState();
        const message = ContentLayer.getErrorMessage(response.errorCode, freshState);
        ViewLayer.showError(response.error || message);
      }
    },

    async handleSpeakerExtend() {
      if (this._actionInProgress) return;

      if (!StateLayer.canExtendSpeaker()) {
        ViewLayer.showError('Extension is not available right now.');
        return;
      }

      const state = StateLayer.getState();

      StateLayer.trackUserAction('speaker_extend');

      this._actionInProgress = true;
      ViewLayer.setButtonLoading('speaker-primary', true);

      const response = await LOFClient.enableSpeaker(true, state.speaker.proximityConfirmed);

      this._actionInProgress = false;
      ViewLayer.setButtonLoading('speaker-primary', false);

      if (response.success) {
        StateLayer.setSpeakerState(response);

        const freshState = StateLayer.getState();
        const flags = ThemeLayer.mapStateToFlags(freshState);
        const content = ContentLayer.getSpeakerContent(freshState, flags);

        ViewLayer.showSuccess(response.data.message || content.toasts.extendSuccess);

        this._startCountdown();
      } else {
        const freshState = StateLayer.getState();
        const message = ContentLayer.getErrorMessage(response.errorCode, freshState);
        ViewLayer.showError(response.error || message);
      }
    },

    handleStreamOpen() {
      const state = StateLayer.getState();
      const streamUrl = state.speaker.config.streamUrl;

      if (!streamUrl) {
        ViewLayer.showError('Audio stream is not available right now.');
        return;
      }

      StateLayer.trackUserAction('stream_open');
      ViewLayer.showStreamPlayer();
    },

    handleStreamStart() {
      const state = StateLayer.getState();
      const streamUrl = state.speaker.config.streamUrl;

      ViewLayer.loadStreamIframe(streamUrl);
      StateLayer.trackUserAction('stream_start');
    },

    handleStreamClose() {
      ViewLayer.hideStreamPlayer();
    },

    handleStreamMinimize() {
      const player = document.getElementById('stream-mini-player');
      if (!player) return;

      if (player.classList.contains('lof-stream-player--minimized')) {
        ViewLayer.expandStreamPlayer();
      } else {
        ViewLayer.minimizeStreamPlayer();
      }
    },

    handleFMInfo() {
      const state = StateLayer.getState();
      const freq = state.speaker.config.fmFrequency;

      ViewLayer.showInfo(`Tune your car radio to FM ${freq} to listen!`);
      StateLayer.trackUserAction('fm_info');
    },

    _startCountdown() {
      if (this._countdownInterval) {
        clearInterval(this._countdownInterval);
      }

      this._countdownInterval = setInterval(() => {
        StateLayer.tickSpeakerCountdown();

        const state = StateLayer.getState();

        if (state.speaker.remainingSeconds <= 0) {
          this._stopCountdown();
        }

        if (state.speaker.remainingSeconds === 30 && !state.speaker.maxSessionReached) {
          const content = ContentLayer.getSpeakerContent(state, ThemeLayer.mapStateToFlags(state));
          ViewLayer.showInfo(content.toasts.sessionEndingSoon);
        }
      }, 1000);
    },

    _stopCountdown() {
      if (this._countdownInterval) {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
      }
    },

    detectPhysicalButtonPress(newState) {
      if (!this._lastSpeakerState) {
        this._lastSpeakerState = newState.speaker;
        return;
      }

      const wasOff = !this._lastSpeakerState.enabled;
      const nowOn = newState.speaker.enabled;
      const source = newState.speaker.source;

      if (wasOff && nowOn && source === 'physical') {
        const now = Date.now();
        if (now - this._lastPhysicalToastAt > 5000) {
          const content = ContentLayer.getSpeakerContent(newState, ThemeLayer.mapStateToFlags(newState));
          ViewLayer.showInfo(content.toasts.physicalButtonDetected);
          this._lastPhysicalToastAt = now;

          if (!this._countdownInterval) {
            this._startCountdown();
          }
        }
      }

      this._lastSpeakerState = newState.speaker;
    },

    startPolling() {
      if (this._pollHandle) return;
      this._fetchAll();
      this._pollHandle = setInterval(() => this._fetchAll(), 15000);
    },

    stopPolling() {
      if (this._pollHandle) clearInterval(this._pollHandle);
      this._pollHandle = null;
    },

    async _fetchAll() {
      const current = StateLayer.getState();

      const [rfRes, fppRes, speakerRes] = await Promise.all([
        RFClient.getShowDetails(),
        FPPClient.getStatus(),
        LOFClient.getSpeakerStatus(),
      ]);

      const consecutiveFailures = {
        rf: rfRes.success ? 0 : current.consecutiveFailures.rf + 1,
        fpp: fppRes.success ? 0 : current.consecutiveFailures.fpp + 1,
      };

      const newStateName = StateLayer.determineStateFromData(rfRes, fppRes, consecutiveFailures);

      if (rfRes.success) {
        StateLayer.setShowState(rfRes);
      }

      if (fppRes.success) {
        StateLayer.setFPPStatus(fppRes);
      }

      if (speakerRes.success) {
        StateLayer.setSpeakerState(speakerRes);
      }

      StateLayer.setState(
        {
          lastRFUpdate: rfRes.success ? Date.now() : current.lastRFUpdate,
          lastFPPUpdate: fppRes.success ? Date.now() : current.lastFPPUpdate,
          errors: {
            rf: rfRes.error,
            fpp: fppRes.error,
            config: current.errors.config,
          },
          consecutiveFailures,
          currentState: newStateName,
        },
        'POLL_UPDATE'
      );
    },

    _restoreSession() {
      try {
        const raw = localStorage.getItem('lof_session');
        if (!raw) return;
        const session = JSON.parse(raw);
        if (!session.visitorId) return;

        if (session.recentRequest && Date.now() - session.recentRequest.timestamp < 300000) {
          StateLayer.setState(
            {
              recentRequest: session.recentRequest,
              visitorId: session.visitorId,
            },
            'SESSION_RESTORED'
          );
        } else {
          StateLayer.setState({ visitorId: session.visitorId }, 'SESSION_RESTORED');
        }
      } catch (err) {
        console.warn('[InteractionLayer] _restoreSession failed', err);
      }
    },

    _saveSession() {
      try {
        const state = StateLayer.getState();
        localStorage.setItem(
          'lof_session',
          JSON.stringify({
            visitorId: state.visitorId,
            recentRequest: state.recentRequest,
          })
        );
      } catch (err) {
        console.warn('[InteractionLayer] _saveSession failed', err);
      }
    },
  };

  window.InteractionLayer = InteractionLayer;
})(window);