// assets/js/lof-interaction-layer.js
(function (window) {
  'use strict';

  const InteractionLayer = {
    _pollHandle: null,
    _cooldowns: new Map(),
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
      document.addEventListener('click', (evt) => {
        const tile = evt.target.closest('[data-song-id]');
        if (tile && !tile.disabled) {
          const songId = tile.getAttribute('data-song-id');
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

    async handleSongRequest(songId) {
      if (this._actionInProgress) return;

      const state = StateLayer.getState();
      const derived = StateLayer.getDerivedState();

      if (!derived.canMakeRequest) {
        ViewLayer.showError({
          code: 'COOLDOWN',
          context: { remainingSeconds: Math.ceil(derived.cooldownRemaining / 1000) },
        });
        return;
      }

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
                queuePosition: res.data.queuePosition,
              },
              interactionCount: state.interactionCount + 1,
            },
            'SONG_REQUESTED',
          );

          this._setCooldown('request', 300000);

          ViewLayer.showSuccess(
            ContentLayer.getMessage('success', 'request', {
              position: res.data.queuePosition,
              wait: res.data.estimatedWaitMinutes,
            }),
          );

          LOFClient.logTelemetry({
            event: 'song_request',
            songId,
            queuePosition: res.data.queuePosition,
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
        const randomSong =
          availableSongs[Math.floor(Math.random() * availableSongs.length)];
        const res = await RFClient.requestSong(randomSong.songId, state.visitorId);

        if (res.success) {
          StateLayer.setState(
            {
              recentRequest: {
                songId: randomSong.songId,
                title: randomSong.title,
                timestamp: Date.now(),
                queuePosition: res.data.queuePosition,
              },
              interactionCount: state.interactionCount + 1,
            },
            'SURPRISE_ME',
          );

          this._setCooldown('request', 300000);

          ViewLayer.showSuccess(
            ContentLayer.getMessage('success', 'surprise', {
              title: randomSong.title,
              position: res.data.queuePosition,
            }),
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

    async handleSpeakerToggle() {
      if (this._actionInProgress) return;

      this._actionInProgress = true;
      const state = StateLayer.getState();
      const newState = !state.speaker.enabled;

      try {
        const res = await LOFClient.toggleSpeakerOn(newState);
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
            'SPEAKER_TOGGLED',
          );

          ViewLayer.showSuccess(
            ContentLayer.getMessage(
              'speaker',
              newState ? 'enabled' : 'disabled',
            ),
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
      const rfResult = await RFClient.getShowDetails();
      console.debug('[Interaction] RF result from getShowDetails', rfResult);
      const [rfRes, fppRes] = await Promise.all([
        RFClient.getShowDetails(),
        FPPClient.getStatus(),
      ]);

      const consecutiveFailures = {
        rf: rfRes.success ? 0 : current.consecutiveFailures.rf + 1,
        fpp: fppRes.success ? 0 : current.consecutiveFailures.fpp + 1,
      };

      const newStateName = StateLayer.determineStateFromData(
        rfRes,
        fppRes,
        consecutiveFailures,
      );

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
        'POLL_UPDATE',
      );
    },

    _setCooldown(key, durationMs) {
      this._cooldowns.set(key, Date.now() + durationMs);
    },

    _restoreSession() {
      try {
        const raw = localStorage.getItem('lof_session');
        if (!raw) return;
        const session = JSON.parse(raw);
        if (!session.visitorId) return;

        // Only restore recent request if still within 5 minutes
        if (
          session.recentRequest &&
          Date.now() - session.recentRequest.timestamp < 300000
        ) {
          StateLayer.setState(
            {
              recentRequest: session.recentRequest,
              visitorId: session.visitorId,
            },
            'SESSION_RESTORED',
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
          }),
        );
      } catch (err) {
        console.warn('[InteractionLayer] _saveSession failed', err);
      }
    },
  };

  window.InteractionLayer = InteractionLayer;
})(window);
