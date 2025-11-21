// assets/js/lof-interaction-layer.js
(function (window) {
  'use strict';

  const InteractionLayer = {
    _pollHandle: null,
    _countdownHandle: null,
    _songCooldowns: new Map(),
    _actionInProgress: false,
    _lastSpeakerState: null,

    init() {
      this._attachEvents();
      this._restoreSession();

      StateLayer.subscribeToState((state) => {
        const derived = StateLayer.getDerivedState();
        ViewLayer.render(state, derived);

        // Manage countdown interval
        this._manageCountdown(state);

        // Detect physical button press
        this._detectPhysicalButtonPress(state);
      });

      this.startPolling();
    },

    _attachEvents() {
      // Song tiles
      document.addEventListener('click', (evt) => {
        const tile = evt.target.closest('[data-lof-song-id]');
        if (tile && !tile.disabled) {
          const songId = tile.getAttribute('data-lof-song-id');
          this.handleSongRequest(songId);
        }
      });

      // Surprise Me button
      const surpriseBtn = document.querySelector('[data-lof="surprise-me"]');
      if (surpriseBtn) {
        surpriseBtn.addEventListener('click', () => this.handleSurpriseMe());
      }

      // Speaker primary button (enable/extend)
      const speakerBtn = document.querySelector('[data-lof="speaker-primary-btn"]');
      if (speakerBtn) {
        speakerBtn.addEventListener('click', () => {
          const action = speakerBtn.dataset.action || 'enable';
          if (action === 'extend') {
            this.handleSpeakerExtend();
          } else if (action === 'enable') {
            this.handleSpeakerEnable();
          }
        });
      }

      // Speaker proximity confirm button
      const proximityBtn = document.querySelector('[data-lof="speaker-proximity-btn"]');
      if (proximityBtn) {
        proximityBtn.addEventListener('click', () => this.handleProximityConfirm());
      }

      // FM info button
      const fmBtn = document.querySelector('[data-lof="fm-btn"]');
      if (fmBtn) {
        fmBtn.addEventListener('click', () => this.handleFMInfo());
      }

      // Stream buttons
      const streamBtn = document.querySelector('[data-lof="stream-btn"]');
      if (streamBtn) {
        streamBtn.addEventListener('click', () => this.handleStreamOpen());
      }

      const streamStartBtn = document.querySelector('[data-lof="stream-start-btn"]');
      if (streamStartBtn) {
        streamStartBtn.addEventListener('click', () => this.handleStreamStart());
      }

      const streamCloseBtn = document.querySelector('[data-lof="stream-close-btn"]');
      if (streamCloseBtn) {
        streamCloseBtn.addEventListener('click', () => this.handleStreamClose());
      }

      const streamMinimizeBtn = document.querySelector('[data-lof="stream-minimize-btn"]');
      if (streamMinimizeBtn) {
        streamMinimizeBtn.addEventListener('click', () => this.handleStreamMinimize());
      }
    },

    // ========================================
    // SONG REQUEST HANDLERS
    // ========================================

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

          // Track activity for speaker timer reset
          StateLayer.recordSpeakerActivity('song_request');

          this._logTelemetry({
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

          // Track activity for speaker timer reset
          StateLayer.recordSpeakerActivity('surprise_me');

          this._logTelemetry({
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

    // ========================================
    // SPEAKER HANDLERS
    // ========================================

    async handleSpeakerEnable() {
      if (this._actionInProgress) return;

      const state = StateLayer.getState();
      const canUse = StateLayer.canUseSpeaker();

      if (!canUse.allowed) {
        console.warn('[InteractionLayer] Cannot use speaker:', canUse.reason);
        return;
      }

      this._actionInProgress = true;
      ViewLayer.showLoading(ContentLayer.getMessage('loading', 'speaker'));

      try {
        const needsProximity = StateLayer.needsProximityConfirmation();
        const res = await LOFClient.enableSpeaker(false, state.speaker.proximityConfirmed);

        if (res.success) {
          StateLayer.setSpeakerState(res);

          ViewLayer.showSuccess(ContentLayer.getMessage('success', 'speaker_enabled'));

          this._logTelemetry({
            event: 'speaker_enabled',
            timestamp: Date.now(),
          });
        } else {
          if (res.errorCode === 'PROXIMITY_REQUIRED') {
            // Show proximity button
            StateLayer.setProximityConfirmed(false);
            ViewLayer.showError({ code: 'SPEAKER_FAILED', context: {} });
          } else {
            ViewLayer.showError({ code: res.errorCode || 'SPEAKER_FAILED', context: {} });
          }
        }
      } catch (err) {
        console.error('[InteractionLayer] handleSpeakerEnable failed', err);
        ViewLayer.showError({ code: 'UNKNOWN', context: {} });
      } finally {
        this._actionInProgress = false;
      }
    },

    async handleSpeakerExtend() {
      if (this._actionInProgress) return;

      const canExtend = StateLayer.canExtendSpeaker();

      if (!canExtend.allowed) {
        console.warn('[InteractionLayer] Cannot extend speaker:', canExtend.reason);
        return;
      }

      this._actionInProgress = true;
      ViewLayer.showLoading(ContentLayer.getMessage('loading', 'speaker'));

      try {
        const res = await LOFClient.enableSpeaker(true, false);

        if (res.success) {
          StateLayer.setSpeakerState(res);

          ViewLayer.showSuccess(ContentLayer.getMessage('success', 'speaker_extended'));

          this._logTelemetry({
            event: 'speaker_extended',
            timestamp: Date.now(),
          });
        } else {
          ViewLayer.showError({ code: res.errorCode || 'SPEAKER_FAILED', context: {} });
        }
      } catch (err) {
        console.error('[InteractionLayer] handleSpeakerExtend failed', err);
        ViewLayer.showError({ code: 'UNKNOWN', context: {} });
      } finally {
        this._actionInProgress = false;
      }
    },

    handleProximityConfirm() {
      StateLayer.setProximityConfirmed(true);
      ViewLayer.showSuccess('Proximity confirmed! You can now enable speakers.');
    },

    handleFMInfo() {
      const state = StateLayer.getState();
      const frequency = state.speaker?.config?.fmFrequency || '107.7';
      ViewLayer.showSuccess(`Tune your FM radio to ${frequency} to hear the show!`);
    },

    handleStreamOpen() {
      const state = StateLayer.getState();
      const streamUrl = state.speaker?.config?.streamUrl || '';

      if (!streamUrl) {
        ViewLayer.showError({ code: 'UNKNOWN', context: {} });
        return;
      }

      ViewLayer.showStreamPlayer(streamUrl);
    },

    handleStreamStart() {
      const state = StateLayer.getState();
      const streamUrl = state.speaker?.config?.streamUrl || '';

      if (!streamUrl) {
        ViewLayer.showError({ code: 'UNKNOWN', context: {} });
        return;
      }

      ViewLayer.startStreamPlayback(streamUrl);

      this._logTelemetry({
        event: 'stream_started',
        timestamp: Date.now(),
      });
    },

    handleStreamClose() {
      ViewLayer.hideStreamPlayer();

      this._logTelemetry({
        event: 'stream_closed',
        timestamp: Date.now(),
      });
    },

    handleStreamMinimize() {
      ViewLayer.minimizeStreamPlayer();
    },

    // ========================================
    // COUNTDOWN MANAGEMENT
    // ========================================

    _manageCountdown(state) {
      const speaker = state.speaker || {};

      if (speaker.enabled && speaker.remainingSeconds > 0) {
        // Start countdown if not running
        if (!this._countdownHandle) {
          this._startCountdown();
        }
      } else {
        // Stop countdown if running
        if (this._countdownHandle) {
          this._stopCountdown();
        }
      }
    },

    _startCountdown() {
      if (this._countdownHandle) return;

      console.debug('[InteractionLayer] Starting countdown interval');

      this._countdownHandle = setInterval(() => {
        const state = StateLayer.getState();
        const speaker = state.speaker || {};

        if (speaker.gracefulShutoff) {
          // Protection mode - use FPP time, don't tick locally
          return;
        }

        if (speaker.enabled && speaker.remainingSeconds > 0) {
          StateLayer.tickSpeakerCountdown();
        } else {
          this._stopCountdown();
        }
      }, 1000);
    },

    _stopCountdown() {
      if (this._countdownHandle) {
        clearInterval(this._countdownHandle);
        this._countdownHandle = null;
        console.debug('[InteractionLayer] Stopped countdown interval');
      }
    },

    // ========================================
    // PHYSICAL BUTTON DETECTION
    // ========================================

    _detectPhysicalButtonPress(state) {
      const current = state.speaker || {};
      const last = this._lastSpeakerState || {};

      // Detect transition from off -> on with physical source
      if (!last.enabled && current.enabled && current.source === 'physical') {
        console.debug('[InteractionLayer] Physical button press detected');
        ViewLayer.showSuccess('Speakers turned on via front button!');
      }

      // Update last state
      this._lastSpeakerState = { ...current };
    },

    // ========================================
    // POLLING
    // ========================================

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

      console.debug('[InteractionLayer] Poll results:', { rfRes, fppRes, speakerRes });

      const consecutiveFailures = {
        rf: rfRes.success ? 0 : current.consecutiveFailures.rf + 1,
        fpp: fppRes.success ? 0 : current.consecutiveFailures.fpp + 1,
      };

      const newStateName = StateLayer.determineStateFromData(rfRes, fppRes, consecutiveFailures);

      StateLayer.setState(
        {
          rfData: rfRes.success ? rfRes.data : current.rfData,
          fppData: fppRes.success ? fppRes.data : current.fppData,
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

      // Update speaker state separately
      if (speakerRes.success) {
        StateLayer.setSpeakerState(speakerRes);
      }
    },

    // ========================================
    // SESSION MANAGEMENT
    // ========================================

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

    // ========================================
    // HELPER METHODS
    // ========================================

    _logTelemetry(data) {
      if (window.LOFClient && typeof window.LOFClient.logTelemetry === 'function') {
        return window.LOFClient.logTelemetry(data);
      } else {
        console.debug('[InteractionLayer] Telemetry (stubbed):', data);
        return Promise.resolve({ success: true });
      }
    },
  };

  window.InteractionLayer = InteractionLayer;
})(window);
