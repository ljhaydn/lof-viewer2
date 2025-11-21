// assets/js/lof-state-layer.js
// FIX: Proper state detection - don't show "ACTIVE" when FPP is idle
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

    /**
     * FIXED: Determine state from BOTH API success AND actual show status
     * OLD BUG: Returned 'ACTIVE' whenever both APIs succeeded, even when idle
     * NEW LOGIC: Check FPP playback state AND RF viewer control enabled
     */
    determineStateFromData(rfResponse, fppResponse, consecutiveFailures) {
      const now = Date.now();
      const rfAge = now - (rfResponse?.timestamp || 0);
      const fppAge = now - (fppResponse?.timestamp || 0);

      // OFFLINE - both APIs failed
      if (consecutiveFailures.rf >= 3 && consecutiveFailures.fpp >= 3) {
        return 'OFFLINE';
      }

      // DEGRADED - one API failed or data is stale
      if (consecutiveFailures.rf >= 2 || consecutiveFailures.fpp >= 2) {
        return 'DEGRADED';
      }

      if (rfAge > 60000 || fppAge > 60000) {
        return 'DEGRADED';
      }

      // ENDED - show is over
      if (rfResponse?.data?.showStatus === 'ended') {
        return 'ENDED';
      }

      // NEW LOGIC: Check ACTUAL show state, not just API health
      if (rfResponse?.success && fppResponse?.success) {
        const rfData = rfResponse.data;
        const fppData = fppResponse.data;

        // Check if show is actually active:
        // 1. RF viewer control must be enabled
        // 2. FPP must be playing (status_name === "playing") OR have recent activity
        
        const viewerControlEnabled = rfData?.viewerControlEnabled === true;
        const fppIsPlaying = fppData?.status_name === 'playing';
        const fppIsIdle = fppData?.status_name === 'idle';
        
        // Show is ACTIVE if:
        // - Viewer control is enabled (show is "on")
        // - FPP is either playing or idle-but-ready (not stopped)
        if (viewerControlEnabled && (fppIsPlaying || fppIsIdle)) {
          return 'ACTIVE';
        }

        // Show is IDLE if:
        // - APIs work but viewer control is disabled (after hours)
        // - OR FPP is completely stopped
        return 'IDLE';
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

      // FIXED: Removed global cooldown check - cooldowns are now per-song in InteractionLayer
      // This matches v1 behavior where users can request different songs with only per-song cooldowns
      const canMakeRequest = state.currentState === 'ACTIVE';

      // FIXED: This is no longer used for blocking requests, kept for display purposes only
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
        primaryAction: shouldShowRequestButton ? 'REQUEST_SONG' : shouldShowSurpriseMe ? 'SURPRISE_ME' : null,
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
        2,
      );
    },

    // internal helpers
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
        case 'IDLE':
          return 'Show is resting';
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

    // ========================================
    // SPEAKER STATE METHODS
    // ========================================

    setSpeakerState(apiResponse) {
      if (!apiResponse || !apiResponse.success) {
        console.warn('[StateLayer] Invalid speaker API response');
        return;
      }

      const data = apiResponse.data || {};

      this.setState(
        {
          speaker: {
            ...this._state.speaker,
            enabled: !!data.enabled,
            remainingSeconds: data.remainingSeconds || 0,
            sessionStartedAt: data.sessionStartedAt || 0,
            sessionLifetimeStartedAt: data.sessionLifetimeStartedAt || 0,
            override: !!data.override,
            mode: data.mode || 'automatic',
            message: data.message || '',
            source: data.source || null,
            fppPlaying: !!data.fppPlaying,
            currentSong: data.currentSong || null,
            currentSongAudio: data.currentSongAudio || null,
            maxSessionReached: !!data.maxSessionReached,
            lifetimeCapReached: !!data.lifetimeCapReached,
            targetSongForShutoff: data.targetSongForShutoff || null,
            gracefulShutoff: !!data.gracefulShutoff,
            proximityTier: data.proximityTier || 1,
            proximityReason: data.proximityReason || '',
            config: data.config || this._state.speaker.config,
          },
        },
        'SPEAKER_STATE_UPDATE'
      );
    },

    setProximityConfirmed(confirmed) {
      this.setState(
        {
          speaker: {
            ...this._state.speaker,
            proximityConfirmed: !!confirmed,
          },
        },
        'PROXIMITY_CONFIRMED'
      );
    },

    tickSpeakerCountdown() {
      const current = this._state.speaker.remainingSeconds;
      if (current > 0) {
        this.setState(
          {
            speaker: {
              ...this._state.speaker,
              remainingSeconds: current - 1,
            },
          },
          'COUNTDOWN_TICK'
        );
      }
    },

    canUseSpeaker() {
      const speaker = this._state.speaker;
      const now = Date.now();
      const currentHour = new Date(now).getHours();

      // Check curfew
      if (speaker.config.noiseCurfewEnabled && currentHour >= speaker.config.noiseCurfewHour) {
        return { allowed: false, reason: 'CURFEW' };
      }

      // Check if already enabled
      if (speaker.enabled) {
        return { allowed: false, reason: 'ALREADY_ON' };
      }

      // Check FPP
      if (!speaker.fppPlaying) {
        return { allowed: false, reason: 'FPP_OFFLINE' };
      }

      // Check proximity (tier 4+ blocked)
      if (speaker.proximityTier >= 4 && !speaker.proximityConfirmed) {
        return { allowed: false, reason: 'GEO_BLOCKED' };
      }

      return { allowed: true };
    },

    canExtendSpeaker() {
      const speaker = this._state.speaker;

      if (!speaker.enabled) {
        return { allowed: false, reason: 'NOT_ON' };
      }

      if (speaker.gracefulShutoff) {
        return { allowed: false, reason: 'PROTECTION_MODE' };
      }

      // Extension window: 0:30 - 0:01
      if (speaker.remainingSeconds > 30 || speaker.remainingSeconds < 1) {
        return { allowed: false, reason: 'NOT_IN_EXTENSION_WINDOW' };
      }

      // Check session cap (invisible to user)
      if (speaker.maxSessionReached) {
        return { allowed: false, reason: 'SESSION_CAP' };
      }

      return { allowed: true };
    },

    needsProximityConfirmation() {
      const speaker = this._state.speaker;
      return speaker.proximityTier >= 4 && !speaker.proximityConfirmed;
    },

    recordSpeakerActivity(activityType) {
      const now = Date.now();
      console.debug('[StateLayer] Speaker activity:', activityType, 'at', now);
      // Activity tracking logged for future use
    },
  };

  window.StateLayer = StateLayer;
})(window);