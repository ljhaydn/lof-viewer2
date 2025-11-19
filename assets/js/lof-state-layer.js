/**
 * LOF Viewer V2 - State Layer
 * 
 * Responsibility: Central state management
 * - Single source of truth for all application state
 * - Gating logic (pure functions)
 * - Derived state computation
 * - No DOM manipulation
 * - No API calls (reads from API layer results)
 */

const StateLayer = (() => {
  
  // Private state
  let _state = {
    // Speaker state
    speaker: {
      enabled: false,
      remainingSeconds: 0,
      override: false,
      mode: 'automatic',
      lastStatusCheck: 0,
      lastUpdatedAt: 0,
      message: '',
      source: null,
      sessionStartedAt: 0, // Milliseconds (JS time)
      fppPlaying: false,
      currentSong: null,
      config: {
        fmFrequency: '107.7',
        streamUrl: '',
        noiseCurfewHour: 22,
        noiseCurfewEnabled: true,
        noiseCurfewOverride: false
      }
    },
    
    // FPP status
    fppStatus: {
      status: 'unknown', // 'playing' | 'idle' | 'stopped' | 'unreachable'
      currentSequence: null,
      secondsRemaining: 0,
      playlistName: null
    },
    
    // RF data
    rfData: {
      viewerControlEnabled: false,
      mode: 'NONE', // 'JUKEBOX' | 'VOTING' | 'NONE'
      preferences: {},
      sequences: [],
      queue: [],
      playingNow: null,
      playingNext: null,
      playingNextFromSchedule: null
    },
    
    // Computed "Up Next" based on priority
    upNext: null,
    
    // Now Playing
    nowPlaying: null,
    
    // Show schedule info
    schedule: {
      showActive: false,
      nextShowStart: null
    },
    
    // Current viewer state (for future state machine integration)
    currentState: 'INITIAL_LOAD',
    
    // Theme mode
    themeMode: 'neutral', // 'halloween' | 'christmas' | 'neutral'
    
    // User context for proximity estimation
    userContext: {
      pageLoadTime: Date.now(),
      isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      cfCountry: null,
      cfRegion: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      firstActionTime: null,
      actionCount: 0
    }
  };
  
  // Subscribers
  let _subscribers = [];
  
  // State history (for debugging)
  let _stateHistory = [];
  const MAX_HISTORY = 50;
  
  /**
   * Get current state (immutable copy)
   */
  function getState() {
    return JSON.parse(JSON.stringify(_state));
  }
  
  /**
   * Set speaker state from API response
   * CRITICAL FIX: sessionStartedAt comes from PHP as seconds, convert to milliseconds
   */
  function setSpeakerState(apiResponse) {
    if (!apiResponse.success || !apiResponse.data) {
      console.warn('[StateLayer] Invalid speaker API response', apiResponse);
      return;
    }
    
    const now = Date.now();
    const data = apiResponse.data;
    
    _state.speaker = {
      enabled: data.enabled,
      remainingSeconds: data.remainingSeconds || 0,
      override: data.override || false,
      mode: data.mode || 'automatic',
      lastStatusCheck: now,
      lastUpdatedAt: now,
      message: data.message || '',
      source: data.source || null,
      // CRITICAL FIX: PHP sends time() (seconds), convert to milliseconds
      sessionStartedAt: data.sessionStartedAt ? data.sessionStartedAt * 1000 : 0,
      fppPlaying: data.fppPlaying || false,
      currentSong: data.currentSong || null,
      config: {
        fmFrequency: data.config?.fmFrequency || '107.7',
        streamUrl: data.config?.streamUrl || '',
        noiseCurfewHour: data.config?.noiseCurfewHour || 22,
        noiseCurfewEnabled: data.config?.noiseCurfewEnabled !== false,
        noiseCurfewOverride: data.config?.noiseCurfewOverride || false
      }
    };
    
    // Update FPP status from speaker response
    if (data.fppPlaying !== undefined) {
      _state.fppStatus.status = data.fppPlaying ? 'playing' : 'idle';
      _state.fppStatus.currentSequence = data.currentSong;
    }
    
    // Update schedule info
    if (data.scheduleInfo) {
      _state.schedule = {
        showActive: data.scheduleInfo.showActive || false,
        nextShowStart: data.scheduleInfo.nextShowStart || null
      };
    }
    
    _recordStateChange('SPEAKER_STATE_UPDATED');
    _notifySubscribers();
  }
  
  /**
   * Set RF show state from API response
   * Normalizes RF data and computes Up Next
   */
  function setShowState(apiResponse) {
    if (!apiResponse.success || !apiResponse.data) {
      console.warn('[StateLayer] Invalid RF API response', apiResponse);
      return;
    }
    
    const data = apiResponse.data;
    
    // Store normalized RF data
    _state.rfData = {
      viewerControlEnabled: data.viewerControlEnabled || false,
      mode: data.mode || 'NONE',
      preferences: data.preferences || {},
      sequences: data.sequences || [],
      queue: data.queue || [],
      playingNow: data.playingNow,
      playingNext: data.playingNext,
      playingNextFromSchedule: data.playingNextFromSchedule
    };
    
    // Compute Now Playing
    _state.nowPlaying = data.playingNow;
    
    // Compute Up Next based on priority:
    // 1. First queue item (if any)
    // 2. Else playingNext
    // 3. Else playingNextFromSchedule
    if (data.queue && data.queue.length > 0) {
      _state.upNext = data.queue[0].sequence;
    } else if (data.playingNext) {
      _state.upNext = data.playingNext;
    } else if (data.playingNextFromSchedule) {
      _state.upNext = data.playingNextFromSchedule;
    } else {
      _state.upNext = null;
    }
    
    _recordStateChange('RF_SHOW_STATE_UPDATED');
    _notifySubscribers();
  }
  
  /**
   * Set FPP status from API response
   */
  function setFPPStatus(apiResponse) {
    if (!apiResponse.success || !apiResponse.data) {
      console.warn('[StateLayer] Invalid FPP API response', apiResponse);
      _state.fppStatus.status = 'unreachable';
      _notifySubscribers();
      return;
    }
    
    const data = apiResponse.data;
    
    _state.fppStatus = {
      status: data.status || 'unknown',
      currentSequence: data.currentSequence || null,
      secondsRemaining: data.secondsRemaining || 0,
      playlistName: data.playlistName || null
    };
    
    _recordStateChange('FPP_STATUS_UPDATED');
    _notifySubscribers();
  }
  
  /**
   * Tick speaker countdown (client-side, called every 1 second)
   */
  function tickSpeakerCountdown() {
    if (_state.speaker.remainingSeconds > 0) {
      _state.speaker.remainingSeconds -= 1;
      _notifySubscribers();
    }
  }
  
  /**
   * Track user action for proximity estimation
   */
  function trackUserAction(actionType) {
    const now = Date.now();
    
    if (!_state.userContext.firstActionTime) {
      _state.userContext.firstActionTime = now;
    }
    
    _state.userContext.actionCount += 1;
    _state.userContext.lastActionType = actionType;
    _state.userContext.lastActionTime = now;
  }
  
  /**
   * Estimate if user is likely on-site (passive proximity detection)
   * Uses multiple signals, no permission prompts
   * 
   * @returns {Object} { likelihood: 0.0-1.0, confidence: 'low'|'medium'|'high', signals: [] }
   */
  function estimateProximity() {
    let score = 0.5; // Start neutral
    const signals = [];
    const ctx = _state.userContext;
    
    // Signal 1: Time of page load relative to show
    const currentHour = new Date().getHours();
    if (currentHour >= 18 && currentHour <= 22) {
      score += 0.15;
      signals.push('showtime_access');
    }
    
    // Signal 2: Device type
    if (ctx.isMobile) {
      score += 0.1;
      signals.push('mobile_device');
    }
    
    // Signal 3: Quick engagement
    if (ctx.firstActionTime) {
      const minutesSinceLoad = (ctx.firstActionTime - ctx.pageLoadTime) / 60000;
      if (minutesSinceLoad < 2) {
        score += 0.15;
        signals.push('immediate_engagement');
      }
    }
    
    // Signal 4: Multiple actions
    if (ctx.actionCount >= 3) {
      score += 0.1;
      signals.push('high_engagement');
    }
    
    // Signal 5: Timezone match
    if (ctx.timezone && ctx.timezone.includes('Los_Angeles')) {
      score += 0.1;
      signals.push('timezone_match');
    }
    
    // Signal 6: Cloudflare geo headers
    if (ctx.cfCountry === 'US' && ctx.cfRegion === 'CA') {
      score += 0.15;
      signals.push('california_ip');
    }
    
    const likelihood = Math.min(score, 1.0);
    const confidence = likelihood > 0.7 ? 'high' : likelihood > 0.4 ? 'medium' : 'low';
    
    return {
      likelihood,
      confidence,
      signals
    };
  }
  
  /**
   * Check if speaker can be used (frontend gating - UX guidance only)
   * Backend is authoritative and can veto
   * 
   * @returns {Object} { allowed: boolean, code: string, reasonKey: string }
   */
  function canUseSpeaker() {
    const state = _state;
    const currentHour = new Date().getHours();
    
    // Check 1: Override/locked mode
    if (state.speaker.override && state.speaker.mode === 'locked_on') {
      return {
        allowed: false,
        code: 'OVERRIDE_LOCKED',
        reasonKey: 'lockedByEvent'
      };
    }
    
    // Check 2: Noise curfew
    if (state.speaker.config.noiseCurfewEnabled && 
        !state.speaker.config.noiseCurfewOverride &&
        currentHour >= state.speaker.config.noiseCurfewHour) {
      return {
        allowed: false,
        code: 'NOISE_CURFEW',
        reasonKey: 'noiseCurfew'
      };
    }
    
    // Check 3: FPP status
    if (state.fppStatus.status === 'unreachable') {
      return {
        allowed: false,
        code: 'FPP_UNREACHABLE',
        reasonKey: 'fppOffline'
      };
    }
    
    if (state.fppStatus.status !== 'playing') {
      return {
        allowed: false,
        code: 'NOT_PLAYING',
        reasonKey: 'nothingPlaying'
      };
    }
    
    // All checks passed
    return {
      allowed: true,
      code: 'OK',
      reasonKey: null
    };
  }
  
  /**
   * Check if extension button should be available
   */
  function canExtendSpeaker() {
    const state = _state;
    
    if (!state.speaker.enabled) {
      return false;
    }
    
    // Extension only available in last 30 seconds
    if (state.speaker.remainingSeconds > 30) {
      return false;
    }
    
    if (state.speaker.remainingSeconds <= 0) {
      return false;
    }
    
    // Check if we've hit max session duration (15 min = 900s)
    const sessionDuration = (Date.now() - state.speaker.sessionStartedAt) / 1000;
    if (sessionDuration >= 900) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Set theme mode (for seasonal content)
   */
  function setThemeMode(mode) {
    if (['halloween', 'christmas', 'neutral'].includes(mode)) {
      _state.themeMode = mode;
      _recordStateChange('THEME_MODE_CHANGED');
      _notifySubscribers();
    }
  }
  
  /**
   * Set user context from server (Cloudflare headers, etc.)
   */
  function setUserContext(context) {
    _state.userContext = {
      ..._state.userContext,
      ...context
    };
  }
  
  /**
   * Subscribe to state changes
   */
  function subscribeToState(callback) {
    if (typeof callback === 'function') {
      _subscribers.push(callback);
    }
    
    // Return unsubscribe function
    return () => {
      _subscribers = _subscribers.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Notify all subscribers of state change
   */
  function _notifySubscribers() {
    const state = getState();
    _subscribers.forEach(callback => {
      try {
        callback(state);
      } catch (err) {
        console.error('[StateLayer] Subscriber error:', err);
      }
    });
  }
  
  /**
   * Record state change in history (for debugging)
   */
  function _recordStateChange(reason) {
    _stateHistory.push({
      timestamp: Date.now(),
      reason,
      state: getState()
    });
    
    // Keep history size manageable
    if (_stateHistory.length > MAX_HISTORY) {
      _stateHistory.shift();
    }
  }
  
  /**
   * Get state history (for debugging)
   */
  function getStateHistory() {
    return [..._stateHistory];
  }
  
  /**
   * Dump current state (for debugging)
   */
  function dumpState() {
    console.log('[StateLayer] Current State:', getState());
    console.log('[StateLayer] State History:', getStateHistory());
  }
  
  // Public API
  return {
    getState,
    setSpeakerState,
    setShowState,
    setFPPStatus,
    tickSpeakerCountdown,
    trackUserAction,
    estimateProximity,
    canUseSpeaker,
    canExtendSpeaker,
    setThemeMode,
    setUserContext,
    subscribeToState,
    getStateHistory,
    dumpState
  };
  
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateLayer;
} else {
  window.StateLayer = StateLayer;
}
