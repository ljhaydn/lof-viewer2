/**
 * LOF Viewer V2 - Content Layer
 * 
 * Responsibility: All user-facing text/copy
 * - Mode-aware (Halloween, Christmas, neutral)
 * - No business logic
 * - No DOM manipulation
 * - No API calls
 * - Returns structured content objects
 */

const ContentLayer = (() => {
  
  /**
   * Get speaker content for current state and mode
   * @param {Object} state - Current application state
   * @param {Object} flags - Theme flags from ThemeLayer
   * @returns {Object} All text content for speaker card
   */
  function getSpeakerContent(state, flags) {
    const mode = state.themeMode || 'neutral';
    const displayMode = flags.speaker.displayMode;
    
    return {
      // Card title
      cardTitle: _getCardTitle(displayMode, mode),
      
      // Primary button
      primaryButtonLabel: _getPrimaryButtonLabel(displayMode, flags, mode),
      
      // Extension button (only shown in extension window)
      extensionButtonLabel: _getExtensionButtonLabel(mode),
      
      // Status message (main message below title)
      statusMessage: _getStatusMessage(displayMode, state, flags, mode),
      
      // Helper text (additional context)
      helperText: _getHelperText(displayMode, state, flags, mode),
      
      // Countdown label (when active)
      countdownLabel: _getCountdownLabel(state, flags),
      
      // Alternative audio options
      alternatives: {
        fmLabel: `📻 FM ${state.speaker.config.fmFrequency}`,
        streamLabel: '🌐 Live Audio Stream',
        fmHint: 'Listen in your car',
        streamHint: 'Listen from anywhere'
      },
      
      // Toast messages
      toasts: _getToastMessages(mode),
      
      // Proximity hints
      proximityHint: _getProximityHint(flags.speaker.proximityLikelihood, mode),
      
      // Weather notice (future)
      weatherNotice: null,
      
      // Session stats (future)
      sessionStats: null
    };
  }
  
  /**
   * Get card title based on display mode
   */
  function _getCardTitle(displayMode, mode) {
    // Mode-aware titles
    if (mode === 'halloween') {
      if (displayMode === 'locked') {
        return '🎃 Halloween Spectacular!';
      }
      return '👻 Need Spooky Sounds?';
    }
    
    if (mode === 'christmas') {
      if (displayMode === 'locked') {
        return '🎄 Christmas Magic!';
      }
      return '🎅 Need Festive Sounds?';
    }
    
    // Neutral mode
    if (displayMode === 'locked') {
      return '🔒 Event Mode';
    }
    
    if (displayMode === 'curfew') {
      return '🌙 Late Night Audio';
    }
    
    if (displayMode === 'unavailable') {
      return '⚠️ Speaker Unavailable';
    }
    
    if (displayMode === 'waiting') {
      return '⏸️ Show Paused';
    }
    
    return '🔊 Need Sound?';
  }
  
  /**
   * Get primary button label
   */
  function _getPrimaryButtonLabel(displayMode, flags, mode) {
    if (displayMode === 'off') {
      return '🔊 Turn On Speakers';
    }
    
    if (displayMode === 'active') {
      if (flags.speaker.showCountdown) {
        return `🔊 On for ${flags.speaker.countdownValue}`;
      }
      return '🔊 Speakers Active';
    }
    
    if (displayMode === 'extension') {
      return '🔊 Still Here? +5 Minutes';
    }
    
    if (displayMode === 'locked') {
      if (mode === 'halloween') {
        return '🔒 Locked On for Halloween';
      }
      if (mode === 'christmas') {
        return '🔒 Locked On for Christmas';
      }
      return '🔒 Speakers Locked On';
    }
    
    if (displayMode === 'curfew') {
      return '🔇 Speakers Off (Curfew)';
    }
    
    if (displayMode === 'unavailable') {
      return '⚠️ Unavailable';
    }
    
    if (displayMode === 'waiting') {
      return '⏸️ Show Not Active';
    }
    
    return '🔊 Turn On Speakers';
  }
  
  /**
   * Get extension button label
   */
  function _getExtensionButtonLabel(mode) {
    if (mode === 'halloween') {
      return '👻 Still Here? +5 Minutes';
    }
    if (mode === 'christmas') {
      return '🎄 Still Here? +5 Minutes';
    }
    return '⏱️ Still Here? +5 Minutes';
  }
  
  /**
   * Get main status message
   */
  function _getStatusMessage(displayMode, state, flags, mode) {
    if (displayMode === 'locked') {
      return state.speaker.message || 'Speakers are on continuously for tonight\'s event!';
    }
    
    if (displayMode === 'curfew') {
      const hour = state.speaker.config.noiseCurfewHour;
      return `Outdoor speakers end at ${hour}:00 to be good neighbors!`;
    }
    
    if (displayMode === 'unavailable') {
      return 'Speaker control is temporarily unavailable.';
    }
    
    if (displayMode === 'waiting') {
      return 'Speakers are only available when the show is actively playing.';
    }
    
    if (displayMode === 'active') {
      if (state.speaker.currentSong) {
        return `🎵 Now playing: "${state.speaker.currentSong}"`;
      }
      return '🎵 Show is playing';
    }
    
    if (displayMode === 'extension') {
      return `⏱️ ${flags.speaker.countdownValue} remaining`;
    }
    
    // Off mode
    if (state.speaker.currentSong) {
      return `🎵 "${state.speaker.currentSong}" is playing`;
    }
    return '🎵 Show is live right now!';
  }
  
  /**
   * Get helper text (additional context)
   */
  function _getHelperText(displayMode, state, flags, mode) {
    if (displayMode === 'locked') {
      return 'Viewer control is disabled during this event.';
    }
    
    if (displayMode === 'curfew') {
      return `Listen via FM ${state.speaker.config.fmFrequency} or the live stream instead.`;
    }
    
    if (displayMode === 'unavailable') {
      return 'Try again in a moment, or use FM/stream options below.';
    }
    
    if (displayMode === 'waiting') {
      return 'The show will resume shortly. Check back in a few minutes!';
    }
    
    if (displayMode === 'active') {
      return 'Enjoying the show? Button will become available in the last 30 seconds if you need more time.';
    }
    
    if (displayMode === 'extension') {
      return 'Tap the button above to extend your session by 5 more minutes.';
    }
    
    // Off mode
    return 'Turn on outdoor speakers if you\'re near the show!';
  }
  
  /**
   * Get countdown label
   */
  function _getCountdownLabel(state, flags) {
    if (!flags.speaker.showCountdown) {
      return null;
    }
    
    return `⏱️ ${flags.speaker.countdownValue} remaining`;
  }
  
  /**
   * Get proximity hint message
   */
  function _getProximityHint(likelihood, mode) {
    if (likelihood > 0.7) {
      // High confidence they're on-site
      return {
        show: true,
        emphasis: 'high',
        message: 'Tap above to turn on outdoor speakers!',
        alternative: 'Not nearby? Try FM or the stream below.'
      };
    }
    
    if (likelihood > 0.4) {
      // Medium confidence
      return {
        show: true,
        emphasis: 'medium',
        message: 'Turn on speakers if you\'re near the show.',
        alternative: 'Not nearby? Use FM or stream below.'
      };
    }
    
    // Low confidence - probably remote
    if (mode === 'halloween') {
      return {
        show: true,
        emphasis: 'low',
        message: 'Visiting from afar? We\'d love to see you in person!',
        alternative: 'For now, enjoy via FM or stream below. 👻'
      };
    }
    
    if (mode === 'christmas') {
      return {
        show: true,
        emphasis: 'low',
        message: 'Considering visiting? The show is magical in person!',
        alternative: 'For now, enjoy via FM or stream below. 🎄'
      };
    }
    
    return {
      show: true,
      emphasis: 'low',
      message: 'Outdoor speakers are for on-site visitors.',
      alternative: 'Not nearby? Use FM or stream below.'
    };
  }
  
  /**
   * Get toast messages for various events
   */
  function _getToastMessages(mode) {
    return {
      // Success messages
      enableSuccess: mode === 'halloween' 
        ? '🎃 Speakers summoned! The show is louder now.'
        : mode === 'christmas'
        ? '🎄 Speakers on! Let the festive music fill the air.'
        : '🔊 Speakers on. Enjoy the music!',
      
      extendSuccess: mode === 'halloween'
        ? '👻 More spooky sounds! Extended for 5 minutes.'
        : mode === 'christmas'
        ? '🎅 More holiday magic! Extended for 5 minutes.'
        : '⏱️ Speakers extended! Enjoy 5 more minutes.',
      
      // Info messages
      alreadyOn: 'Speakers are already rockin\'!',
      
      physicalButtonDetected: '🔊 Speakers turned on by show attendee',
      
      sessionEnding: 'Speakers will turn off soon. Hit the button to extend!',
      
      // Error messages - Gating denials
      gatingDenied: {
        fppOffline: 'Speaker control is temporarily unavailable. Try FM or stream!',
        
        nothingPlaying: 'Speakers are only available when the show is playing. Check back soon!',
        
        noiseCurfew: (hour, fm) => `Outdoor speakers end at ${hour}:00 to be good neighbors. Try FM ${fm} or the stream!`,
        
        lockedByEvent: (message) => message || 'Speakers are locked on for tonight\'s event.',
        
        maxSession: 'Maximum session duration reached (15 minutes). Take a break, then come back!'
      },
      
      // Generic error
      error: 'Oops! Couldn\'t connect to speaker control. Try again in a moment?',
      
      // Extension errors
      extensionTooEarly: 'Extension button will appear in the last 30 seconds.',
      
      noActiveSession: 'No active speaker session to extend.',
      
      // FPP errors
      fppUnreachable: 'Can\'t reach speaker controller. Try FM or stream instead!',
      
      // Weather (future)
      weatherHold: '⛈️ Show paused due to weather. Stream is still live!',
      
      // Thank you (subtle, not shown to everyone)
      sessionComplete: 'Thanks for enjoying the show! Come back tomorrow night!'
    };
  }
  
  /**
   * Get error message from API error code
   */
  function getErrorMessage(errorCode, state) {
    const toasts = _getToastMessages(state.themeMode);
    
    switch (errorCode) {
      case 'FPP_UNREACHABLE':
        return toasts.gatingDenied.fppOffline;
      
      case 'NOT_PLAYING':
        return toasts.gatingDenied.nothingPlaying;
      
      case 'NOISE_CURFEW':
        return toasts.gatingDenied.noiseCurfew(
          state.speaker.config.noiseCurfewHour,
          state.speaker.config.fmFrequency
        );
      
      case 'OVERRIDE_LOCKED':
        return toasts.gatingDenied.lockedByEvent(state.speaker.message);
      
      case 'MAX_SESSION_REACHED':
        return toasts.gatingDenied.maxSession;
      
      case 'EXTENSION_TOO_EARLY':
        return toasts.extensionTooEarly;
      
      case 'NO_ACTIVE_SESSION':
        return toasts.noActiveSession;
      
      default:
        return toasts.error;
    }
  }
  
  // Public API
  return {
    getSpeakerContent,
    getErrorMessage
  };
  
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentLayer;
} else {
  window.ContentLayer = ContentLayer;
}
