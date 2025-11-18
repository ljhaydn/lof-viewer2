// assets/js/lof-interaction-layer.js
(function (window) {
  'use strict';

  const InteractionLayer = {
    _pollHandle: null,
    // FIXED: Changed to per-song cooldown map like v1 viewer
    _songCooldowns: new Map(),
    _actionInProgress: false,

    init() {
      this._attachEvents();
      this._restoreSession();

      StateLayer.subscribeToState((state) => {
        const derived = StateLayer.getDerivedState();
        ViewLayer.render(state, derived);
      });

      this.startPolling();
    },

    _attachEvents() {
      // ✅ FIXED: Changed from [data-song-id] to [data-lof-song-id]
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

      const speakerBtn = document.querySelector('[data-lof="speaker-toggle"]');
      if (speakerBtn) {
        speakerBtn.addEventListener('click', () => this.handleSpeakerToggle());
      }
    },

    /**
     * FIXED: Changed to per-song cooldown matching v1 viewer behavior
     * - v1 had 15-second per-song cooldown
     * - v2 incorrectly had 5-minute global cooldown
     */
    async handleSongRequest(songId) {
      if (this._actionInProgress) return;

      // FIXED: Check per-song cooldown instead of global
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

          // FIXED: Set per-song cooldown (15 seconds like v1)
          this._songCooldowns.set(songId, now + 15000);

          ViewLayer.showSuccess(
            ContentLayer.getMessage('success', 'request', {
              position: res.data?.queuePosition || '?',
            })
          );

          // ✅ FIXED: LOFClient telemetry (will be stubbed if not available)
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

          // FIXED: Also set per-song cooldown for Surprise Me selections
          this._songCooldowns.set(randomSong.songId, Date.now() + 15000);

          ViewLayer.showSuccess(
            ContentLayer.getMessage('success', 'surprise', {
              title: randomSong.title,
              position: res.data?.queuePosition || '?',
            })
          );

          // ✅ FIXED: LOFClient telemetry (stubbed)
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

    async handleSpeakerToggle() {
      if (this._actionInProgress) return;

      this._actionInProgress = true;
      const state = StateLayer.getState();
      const newState = !state.speaker.enabled;

      try {
        // ✅ FIXED: Call LOFClient.toggleSpeakerOn (or stub)
        const res = await this._toggleSpeaker(newState);

        if (res.success) {
          StateLayer.setState(
            {
              speaker: {
                ...state.speaker,
                enabled: newState,
                userToggled: true,
                disabledByHeuristic: false,
                disabledReason: null,
              },
            },
            'SPEAKER_TOGGLED'
          );

          ViewLayer.showSuccess(
            ContentLayer.getMessage('speaker', newState ? 'enabled' : 'disabled')
          );
        } else {
          ViewLayer.showError({ code: 'SPEAKER_FAILED', context: {} });
        }
      } catch (err) {
        console.error('[InteractionLayer] handleSpeakerToggle failed', err);
        ViewLayer.showError({ code: 'UNKNOWN', context: {} });
      } finally {
        this._actionInProgress = false;
        this._saveSession();
      }
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

      // Fetch RF and FPP in parallel
      const [rfRes, fppRes] = await Promise.all([
        RFClient.getShowDetails(),
        FPPClient.getStatus(),
      ]);

      console.debug('[InteractionLayer] RF result:', rfRes);
      console.debug('[InteractionLayer] FPP result:', fppRes);

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
    },

    _restoreSession() {
      try {
        const raw = localStorage.getItem('lof_session');
        if (!raw) return;
        const session = JSON.parse(raw);
        if (!session.visitorId) return;

        // Only restore recent request if still within 5 minutes
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
    // HELPER METHODS FOR LOF CLIENT CALLS
    // ========================================

    /**
     * Log telemetry (stub if LOFClient not available)
     */
    _logTelemetry(data) {
      if (window.LOFClient && typeof window.LOFClient.logTelemetry === 'function') {
        return window.LOFClient.logTelemetry(data);
      } else {
        // Stub: just log to console for now
        console.debug('[InteractionLayer] Telemetry (stubbed):', data);
        return Promise.resolve({ success: true });
      }
    },

    /**
     * Toggle speaker (stub if LOFClient not available)
     */
    _toggleSpeaker(enabled) {
      if (window.LOFClient && typeof window.LOFClient.toggleSpeakerOn === 'function') {
        return window.LOFClient.toggleSpeakerOn(enabled);
      } else {
        // Stub: return success for now
        console.debug('[InteractionLayer] Speaker toggle (stubbed):', enabled);
        return Promise.resolve({ success: true });
      }
    },
  };

  window.InteractionLayer = InteractionLayer;
})(window);