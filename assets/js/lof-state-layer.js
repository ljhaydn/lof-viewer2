(function (window) {
  'use strict';

  const StateLayer = {
    _state: null,
    _subscribers: [],
    _history: [],

    init(initialConfig) {
      this._state = {
        currentState: 'LOADING',
        previousState: null,
        stateEnteredAt: Date.now(),

        rfData: null,
        fppData: null,
        lofConfig: initialConfig || null,

        lastRFUpdate: 0,
        lastFPPUpdate: 0,
        lastConfigUpdate: initialConfig ? Date.now() : 0,

        errors: { rf: null, fpp: null, config: null },
        consecutiveFailures: { rf: 0, fpp: 0 },

        visitorId: this._generateVisitorId(),
        sessionStarted: Date.now(),
        interactionCount: 0,

        features: {
          requestsEnabled: false,
          surpriseMeEnabled: false,
          speakerControlEnabled: false,
          chaosMode: false,
        },

        speaker: {
          enabled: false,
          remainingSeconds: 0,
          sessionStartedAt: 0,
          sessionLifetimeStartedAt: 0,
          override: false,
          mode: 'automatic',
          message: '',
          source: null,
          fppPlaying: false,
          currentSong: null,
          currentSongAudio: null,
          maxSessionReached: false,
          lifetimeCapReached: false,
          targetSongForShutoff: null,
          gracefulShutoff: false,
          proximityTier: 1,
          proximityReason: '',
          proximityConfirmed: false,
          config: {
            fmFrequency: '107.7',
            streamUrl: '',
            noiseCurfewHour: 22,
            noiseCurfewEnabled: true,
            noiseCurfewOverride: false,
          },
        },

        recentRequest: null,

        _version: '1.0',
        _debug: !!window.LOF_CONFIG?.debug,
      };

      this._recordHistory('INIT', null, 'LOADING');
    },

    getState() {
      return Object.freeze({ ...this._state });
    },

    setState(updates, reason) {
      const oldStateName = this._state.currentState;

      this._state = {
        ...this._state,
        ...updates,
        _lastUpdated: Date.now(),
      };

      if (this._state.currentState !== oldStateName) {
        this._state.previousState = oldStateName;
        this._state.stateEnteredAt = Date.now();
        this._recordHistory(reason || 'STATE_CHANGE', oldStateName, this._state.currentState);
      }

      this._notifySubscribers();

      if (this._state._debug) {
        console.log('[StateLayer] Update:', reason, updates);
      }
    },

    subscribeToState(callback) {
      this._subscribers.push(callback);
      return () => {
        this._subscribers = this._subscribers.filter((cb) => cb !== callback);
      };
    },

    setSpeakerState(apiResponse) {
      if (!apiResponse.success || !apiResponse.data) {
        console.warn('[StateLayer] Invalid speaker API response', apiResponse);
        return;
      }

      const now = Date.now();
      const data = apiResponse.data;

      this._state.speaker = {
        enabled: data.enabled,
        remainingSeconds: data.remainingSeconds || 0,
        sessionStartedAt: data.sessionStartedAt ? data.sessionStartedAt * 1000 : 0,
        sessionLifetimeStartedAt: data.sessionLifetimeStartedAt ? data.sessionLifetimeStartedAt * 1000 : 0,
        override: data.override || false,
        mode: data.mode || 'automatic',
        message: data.message || '',
        source: data.source || null,
        fppPlaying: data.fppPlaying || false,
        currentSong: data.currentSong || null,
        currentSongAudio: data.currentSongAudio || null,
        maxSessionReached: data.maxSessionReached || false,
        lifetimeCapReached: data.lifetimeCapReached || false,
        targetSongForShutoff: data.targetSongForShutoff || null,
        gracefulShutoff: data.gracefulShutoff || false,
        proximityTier: data.proximityTier || 1,
        proximityReason: data.proximityReason || '',
        proximityConfirmed: this._state.speaker.proximityConfirmed || false,
        config: {
          fmFrequency: data.config?.fmFrequency || '107.7',
          streamUrl: data.config?.streamUrl || '',
          noiseCurfewHour: data.config?.noiseCurfewHour || 22,
          noiseCurfewEnabled: data.config?.noiseCurfewEnabled !== false,
          noiseCurfewOverride: data.config?.noiseCurfewOverride || false,
        },
      };

      if (data.fppPlaying !== undefined) {
        this._state.fppData = this._state.fppData || {};
        this._state.fppData.status = data.fppPlaying ? 'playing' : 'idle';
        this._state.fppData.currentSequence = data.currentSong;
        this._state.fppData.currentSongAudio = data.currentSongAudio;
      }

      this._recordHistory('SPEAKER_STATE_UPDATED', null, null);
      this._notifySubscribers();
    },

    setProximityConfirmed(confirmed) {
      this._state.speaker.proximityConfirmed = confirmed;
      this._notifySubscribers();
    },

    setShowState(rfResponse) {
      if (!rfResponse.success || !rfResponse.data) {
        console.warn('[StateLayer] Invalid RF response', rfResponse);
        return;
      }

      const data = rfResponse.data;

      this._state.rfData = {
        nowPlaying: data.nowPlaying,
        upNext: data.upNext,
        queue: data.queue || [],
        availableSongs: data.availableSongs || [],
        showStatus: data.showStatus,
        requestsEnabled: data.requestsEnabled,
      };

      this._state.lastRFUpdate = Date.now();
      this._state.errors.rf = null;
      this._state.consecutiveFailures.rf = 0;

      this._recordHistory('RF_STATE_UPDATED', null, null);
      this._notifySubscribers();
    },

    setFPPStatus(fppResponse) {
      if (!fppResponse.success || !fppResponse.data) {
        this._state.fppData = { status: 'unreachable', currentSequence: null, currentSongAudio: null };
        this._state.consecutiveFailures.fpp += 1;
      } else {
        const data = fppResponse.data;
        this._state.fppData = {
          status: data.mode === 'playing' ? 'playing' : 'idle',
          currentSequence: data.currentSequence,
          currentSongAudio: data.currentSongAudio,
          secondsRemaining: data.secondsRemaining || 0,
        };
        this._state.lastFPPUpdate = Date.now();
        this._state.errors.fpp = null;
        this._state.consecutiveFailures.fpp = 0;
      }

      this._recordHistory('FPP_STATUS_UPDATED', null, null);
      this._notifySubscribers();
    },

    tickSpeakerCountdown() {
      if (this._state.speaker.remainingSeconds > 0) {
        this._state.speaker.remainingSeconds -= 1;
        this._notifySubscribers();
      }
    },

    canUseSpeaker() {
      const state = this._state;
      const currentHour = new Date().getHours();

      if (state.speaker.override && state.speaker.mode === 'locked_on') {
        return {
          allowed: false,
          code: 'OVERRIDE_LOCKED',
          reasonKey: 'lockedByEvent',
          displayMode: 'locked',
        };
      }

      if (
        state.speaker.config.noiseCurfewEnabled &&
        !state.speaker.config.noiseCurfewOverride &&
        currentHour >= state.speaker.config.noiseCurfewHour
      ) {
        return {
          allowed: false,
          code: 'NOISE_CURFEW',
          reasonKey: 'noiseCurfew',
          displayMode: 'curfew',
        };
      }

      if (state.fppData?.status === 'unreachable') {
        return {
          allowed: false,
          code: 'FPP_UNREACHABLE',
          reasonKey: 'fppOffline',
          displayMode: 'unavailable',
        };
      }

      if (state.fppData?.status !== 'playing') {
        return {
          allowed: false,
          code: 'NOT_PLAYING',
          reasonKey: 'nothingPlaying',
          displayMode: 'waiting',
        };
      }

      if (state.speaker.lifetimeCapReached) {
        return {
          allowed: false,
          code: 'LIFETIME_CAP_REACHED',
          reasonKey: 'lifetimeCapReached',
          displayMode: 'capped',
        };
      }

      return {
        allowed: true,
        code: 'OK',
        reasonKey: null,
        displayMode: 'active',
      };
    },

    canExtendSpeaker() {
      const state = this._state;

      if (!state.speaker.enabled) {
        return false;
      }

      if (state.speaker.remainingSeconds > 30) {
        return false;
      }

      if (state.speaker.remainingSeconds <= 0) {
        return false;
      }

      if (state.speaker.maxSessionReached || state.speaker.lifetimeCapReached) {
        return false;
      }

      const sessionDuration = (Date.now() - state.speaker.sessionStartedAt) / 1000;
      if (sessionDuration >= 900) {
        return false;
      }

      return true;
    },

    needsProximityConfirmation() {
      const state = this._state;
      return (state.speaker.proximityTier === 2 || state.speaker.proximityTier === 3) && !state.speaker.proximityConfirmed;
    },

    trackUserAction(actionType) {
      const now = Date.now();
      this._state.interactionCount += 1;
    },

    determineStateFromData(rfResponse, fppResponse, consecutiveFailures) {
      const now = Date.now();
      const rfAge = now - (rfResponse?.timestamp || 0);
      const fppAge = now - (fppResponse?.timestamp || 0);

      if (consecutiveFailures.rf >= 3 && consecutiveFailures.fpp >= 3) {
        return 'OFFLINE';
      }

      if (consecutiveFailures.rf >= 2 || consecutiveFailures.fpp >= 2) {
        return 'DEGRADED';
      }

      if (rfAge > 60000 || fppAge > 60000) {
        return 'DEGRADED';
      }

      if (rfResponse?.data?.showStatus === 'ended') {
        return 'ENDED';
      }

      if (rfResponse?.success && fppResponse?.success) {
        return 'ACTIVE';
      }

      return 'LOADING';
    },

    getDerivedState() {
      const state = this._state;
      const now = Date.now();

      const shouldShowRequestButton =
        state.currentState === 'ACTIVE' &&
        (state.features.requestsEnabled || state.lofConfig?.features?.requestsEnabled) &&
        state.rfData?.requestsEnabled === true;

      const shouldShowSurpriseMe =
        state.currentState === 'ACTIVE' &&
        (state.features.surpriseMeEnabled || state.lofConfig?.features?.surpriseMeEnabled);

      const shouldShowSpeakerButton =
        (state.features.speakerControlEnabled || state.lofConfig?.features?.speakerControlEnabled) &&
        state.currentState !== 'OFFLINE';

      const shouldShowQueue = !!(state.rfData?.queue && state.rfData.queue.length > 0);
      const shouldShowGrid =
        state.currentState === 'ACTIVE' &&
        state.rfData?.availableSongs &&
        state.rfData.availableSongs.length > 0;

      const isShowActive = state.rfData?.showStatus === 'active';
      const isInDegradedMode = state.currentState === 'DEGRADED';
      const isDataFresh = now - state.lastRFUpdate < 30000;
      const canMakeRequest = state.currentState === 'ACTIVE';
      const cooldownRemaining = 0;

      return {
        shouldShowRequestButton,
        shouldShowSpeakerButton,
        shouldShowSurpriseMe,
        shouldShowQueue,
        shouldShowGrid,
        isShowActive,
        isDataFresh,
        isInDegradedMode,
        canMakeRequest,
        cooldownRemaining,
        displayStatus: this._getDisplayStatus(state),
        primaryAction: shouldShowRequestButton
          ? 'REQUEST_SONG'
          : shouldShowSurpriseMe
          ? 'SURPRISE_ME'
          : null,
        dataAge: {
          rf: now - state.lastRFUpdate,
          fpp: now - state.lastFPPUpdate,
        },
        healthScore: this._computeHealthScore(state),
      };
    },

    getStateHistory() {
      return [...this._history];
    },

    dumpState() {
      return JSON.stringify(
        {
          state: this._state,
          derived: this.getDerivedState(),
          history: this._history.slice(-10),
        },
        null,
        2
      );
    },

    _notifySubscribers() {
      const snapshot = this.getState();
      this._subscribers.forEach((cb) => {
        try {
          cb(snapshot);
        } catch (e) {
          console.error('[StateLayer] subscriber error', e);
        }
      });
    },

    _getDisplayStatus(state) {
      switch (state.currentState) {
        case 'LOADING':
          return 'Connecting to show...';
        case 'ACTIVE':
          return 'Show is live!';
        case 'DEGRADED':
          return 'Limited connectivity';
        case 'OFFLINE':
          return 'Unable to connect';
        case 'ENDED':
          return 'Show has ended';
        default:
          return 'Unknown';
      }
    },

    _computeHealthScore(state) {
      let score = 100;

      if (state.errors.rf) score -= 20;
      if (state.errors.fpp) score -= 20;

      const now = Date.now();
      const rfAge = now - state.lastRFUpdate;
      const fppAge = now - state.lastFPPUpdate;

      if (rfAge > 30000) score -= 15;
      if (rfAge > 60000) score -= 15;
      if (fppAge > 60000) score -= 15;

      score -= state.consecutiveFailures.rf * 5;
      score -= state.consecutiveFailures.fpp * 5;

      return Math.max(0, score);
    },

    _recordHistory(reason, fromState, toState) {
      this._history.push({
        timestamp: Date.now(),
        reason,
        transition: `${fromState} -> ${toState}`,
      });
      if (this._history.length > 50) this._history.shift();
    },

    _generateVisitorId() {
      return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },
  };

  window.StateLayer = StateLayer;
})(window);