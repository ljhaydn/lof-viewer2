/**
 * LOF Viewer V2 - Theme Layer
 * 
 * Responsibility: Map state to visual flags
 * - No business logic
 * - No DOM manipulation
 * - No API calls
 * - Pure functions that transform state into presentation flags
 */

const ThemeLayer = (() => {
  
  /**
   * Map state to speaker display flags
   * Returns flags for all 7 display modes
   */
  function mapSpeakerFlags(state) {
    const gating = StateLayer.canUseSpeaker();
    const canExtend = StateLayer.canExtendSpeaker();
    const currentHour = new Date().getHours();
    
    // Determine which display mode we're in
    let displayMode = 'off'; // Default
    
    if (gating.code === 'OVERRIDE_LOCKED') {
      displayMode = 'locked';
    } else if (gating.code === 'NOISE_CURFEW') {
      displayMode = 'curfew';
    } else if (gating.code === 'FPP_UNREACHABLE') {
      displayMode = 'unavailable';
    } else if (gating.code === 'NOT_PLAYING') {
      displayMode = 'waiting';
    } else if (state.speaker.enabled) {
      if (canExtend) {
        displayMode = 'extension';
      } else {
        displayMode = 'active';
      }
    } else if (gating.allowed) {
      displayMode = 'off';
    }
    
    return {
      // Display mode
      displayMode,
      
      // Primary button state
      showSpeakerButton: true, // Always show (educational)
      canClickPrimaryButton: displayMode === 'off',
      canClickExtensionButton: displayMode === 'extension',
      primaryButtonEnabled: displayMode === 'off' || displayMode === 'extension',
      
      // Status flags
      isSpeakerOn: state.speaker.enabled,
      isSpeakerLocked: displayMode === 'locked',
      isSpeakerUnavailable: displayMode === 'unavailable',
      isWaitingForShow: displayMode === 'waiting',
      isNoiseCurfew: displayMode === 'curfew',
      isExtensionWindow: displayMode === 'extension',
      
      // Visual classes
      speakerCardClass: _getCardClass(displayMode),
      primaryButtonClass: _getButtonClass(displayMode, 'primary'),
      extensionButtonClass: _getButtonClass(displayMode, 'extension'),
      statusIconClass: _getStatusIconClass(displayMode),
      
      // Countdown display
      showCountdown: state.speaker.enabled && state.speaker.remainingSeconds > 0,
      countdownValue: _formatCountdown(state.speaker.remainingSeconds),
      countdownClass: _getCountdownClass(state.speaker.remainingSeconds),
      
      // Alternative audio options
      showAlternatives: true, // Always show FM/stream options
      emphasizeAlternatives: displayMode === 'curfew' || displayMode === 'unavailable' || displayMode === 'waiting',
      
      // Proximity hints
      showProximityHint: displayMode === 'off',
      proximityLikelihood: 0, // Will be populated by proximity estimation
      
      // Weather awareness (future)
      showWeatherNotice: false,
      
      // Session stats (future)
      showSessionStats: false
    };
  }
  
  /**
   * Get CSS class for speaker card based on display mode
   */
  function _getCardClass(mode) {
    const baseClass = 'lof-speaker-card';
    
    const modeClasses = {
      'off': 'lof-speaker-card--off',
      'active': 'lof-speaker-card--active',
      'extension': 'lof-speaker-card--extension',
      'locked': 'lof-speaker-card--locked',
      'curfew': 'lof-speaker-card--curfew',
      'unavailable': 'lof-speaker-card--unavailable',
      'waiting': 'lof-speaker-card--waiting'
    };
    
    return `${baseClass} ${modeClasses[mode] || ''}`;
  }
  
  /**
   * Get CSS class for buttons based on display mode
   */
  function _getButtonClass(mode, buttonType) {
    const baseClass = 'lof-btn';
    
    if (buttonType === 'primary') {
      if (mode === 'off') {
        return `${baseClass} lof-btn--primary lof-btn--speaker-enable`;
      } else if (mode === 'active') {
        return `${baseClass} lof-btn--disabled lof-btn--speaker-active`;
      } else if (mode === 'extension') {
        return `${baseClass} lof-btn--primary lof-btn--speaker-extend`;
      } else if (mode === 'locked') {
        return `${baseClass} lof-btn--locked lof-btn--speaker-locked`;
      } else {
        return `${baseClass} lof-btn--disabled`;
      }
    }
    
    if (buttonType === 'extension') {
      if (mode === 'extension') {
        return `${baseClass} lof-btn--primary lof-btn--pulse`;
      } else {
        return `${baseClass} lof-btn--hidden`;
      }
    }
    
    return baseClass;
  }
  
  /**
   * Get status icon class
   */
  function _getStatusIconClass(mode) {
    const iconMap = {
      'off': 'icon-speaker-off',
      'active': 'icon-speaker-on',
      'extension': 'icon-speaker-on icon-pulse',
      'locked': 'icon-lock',
      'curfew': 'icon-moon',
      'unavailable': 'icon-alert',
      'waiting': 'icon-clock'
    };
    
    return iconMap[mode] || 'icon-speaker-off';
  }
  
  /**
   * Format countdown for display
   */
  function _formatCountdown(seconds) {
    if (seconds <= 0) {
      return '0:00';
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Get countdown visual class based on remaining time
   */
  function _getCountdownClass(seconds) {
    if (seconds <= 30) {
      return 'lof-countdown--warning'; // Red/urgent
    } else if (seconds <= 60) {
      return 'lof-countdown--caution'; // Yellow/attention
    } else {
      return 'lof-countdown--normal'; // Green/normal
    }
  }
  
  /**
   * Map state to complete theme flags
   * This is the main entry point for the Theme Layer
   */
  function mapStateToFlags(state) {
    // Estimate proximity for hints
    const proximity = StateLayer.estimateProximity();
    
    // Get speaker flags
    const speakerFlags = mapSpeakerFlags(state);
    
    // Add proximity data
    speakerFlags.proximityLikelihood = proximity.likelihood;
    speakerFlags.proximityConfidence = proximity.confidence;
    speakerFlags.proximitySignals = proximity.signals;
    
    return {
      speaker: speakerFlags,
      
      // Other flags for future features
      // (song tiles, surprise me, etc.)
      
      // Global theme
      themeMode: state.themeMode
    };
  }
  
  // Public API
  return {
    mapStateToFlags,
    mapSpeakerFlags
  };
  
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeLayer;
} else {
  window.ThemeLayer = ThemeLayer;
}
