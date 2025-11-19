/**
 * LOF Viewer V2 - Interaction Layer
 * 
 * Responsibility: Handle user actions and orchestrate responses
 * - Event handlers
 * - Orchestrates calls between API, State, and View layers
 * - No DOM manipulation (delegates to View)
 * - No direct API calls (delegates to API layer)
 */

const InteractionLayer = (() => {
  
  // Track action state
  let _actionInProgress = false;
  let _countdownInterval = null;
  let _lastSpeakerState = null;
  
  /**
   * Handle primary speaker button click
   * (Enable speakers when off, or does nothing when active)
   */
  async function handleSpeakerToggle() {
    if (_actionInProgress) {
      console.log('[InteractionLayer] Action already in progress');
      return;
    }
    
    const preState = StateLayer.getState();
    
    // Check gating
    const gating = StateLayer.canUseSpeaker();
    if (!gating.allowed) {
      const flags = ThemeLayer.mapStateToFlags(preState);
      const content = ContentLayer.getSpeakerContent(preState, flags);
      const message = ContentLayer.getErrorMessage(gating.code, preState) 
        || content.toasts.gatingDenied 
        || 'Speaker is not available right now.';
      ViewLayer.showError(message);
      return;
    }
    
    // Track user action for proximity estimation
    StateLayer.trackUserAction('speaker_enable');
    
    // Call API
    _actionInProgress = true;
    ViewLayer.setButtonLoading('speaker-primary', true);
    
    const response = await LOFClient.enableSpeaker(false); // Not an extension
    
    _actionInProgress = false;
    ViewLayer.setButtonLoading('speaker-primary', false);
    
    // Handle response
    if (response.success) {
      // Update state from fresh API response
      StateLayer.setSpeakerState(response);
      
      const state = StateLayer.getState();
      const flags = ThemeLayer.mapStateToFlags(state);
      const content = ContentLayer.getSpeakerContent(state, flags);
      
      // Show success message
      ViewLayer.showSuccess(
        response.data?.message || content.toasts.enableSuccess || 'Speakers on. Enjoy the music!'
      );
      
      // Start countdown
      _startCountdown();
      
    } else {
      const state = StateLayer.getState();
      const message = ContentLayer.getErrorMessage(response.errorCode, state) 
        || response.error 
        || 'Something went wrong enabling speakers.';
      ViewLayer.showError(message);
    }
  }
  
  /**
   * Handle extension button click
   * (Only available in last 30 seconds)
   */
  async function handleSpeakerExtend() {
    if (_actionInProgress) {
      console.log('[InteractionLayer] Action already in progress');
      return;
    }
    
    const preState = StateLayer.getState();
    
    // Check if extension is allowed
    if (!StateLayer.canExtendSpeaker()) {
      ViewLayer.showError('Extension is not available right now.');
      return;
    }
    
    // Track user action
    StateLayer.trackUserAction('speaker_extend');
    
    // Call API
    _actionInProgress = true;
    ViewLayer.setButtonLoading('speaker-primary', true);
    
    const response = await LOFClient.enableSpeaker(true); // Is an extension
    
    _actionInProgress = false;
    ViewLayer.setButtonLoading('speaker-primary', false);
    
    // Handle response
    if (response.success) {
      // Update state
      StateLayer.setSpeakerState(response);
      
      const state = StateLayer.getState();
      const flags = ThemeLayer.mapStateToFlags(state);
      const content = ContentLayer.getSpeakerContent(state, flags);
      
      ViewLayer.showSuccess(
        response.data?.message || content.toasts.extendSuccess || 'Speakers extended!'
      );
      
      // Restart countdown with new remainingSeconds
      _startCountdown();
      
    } else {
      const state = StateLayer.getState();
      const message = ContentLayer.getErrorMessage(response.errorCode, state) 
        || response.error 
        || 'Something went wrong extending speakers.';
      ViewLayer.showError(message);
    }
  }
  
  /**
   * Handle stream button click
   */
  function handleStreamOpen() {
    const state = StateLayer.getState();
    const streamUrl = state.speaker.config.streamUrl;
    
    if (!streamUrl) {
      ViewLayer.showError('Stream is not available right now.');
      return;
    }
    
    // Track action
    StateLayer.trackUserAction('stream_open');
    
    // Show modal
    ViewLayer.showStreamModal(streamUrl);
  }
  
  /**
   * Handle stream start button click (inside modal)
   */
  function handleStreamStart() {
    ViewLayer.loadStreamIframe();
    
    // Track action
    StateLayer.trackUserAction('stream_start');
  }
  
  /**
   * Handle stream modal close
   */
  function handleStreamClose() {
    ViewLayer.hideStreamModal();
  }
  
  /**
   * Handle FM info button click
   */
  function handleFMInfo() {
    const state = StateLayer.getState();
    const freq = state.speaker.config.fmFrequency;
    
    ViewLayer.showInfo(`Tune your car radio to FM ${freq} to listen!`);
    
    // Track action
    StateLayer.trackUserAction('fm_info');
  }
  
  /**
   * Start countdown timer (1 second ticks)
   */
  function _startCountdown() {
    // Clear any existing countdown
    if (_countdownInterval) {
      clearInterval(_countdownInterval);
    }
    
    _countdownInterval = setInterval(() => {
      StateLayer.tickSpeakerCountdown();
      
      const state = StateLayer.getState();
      
      // Clamp at zero and stop
      if (state.speaker.remainingSeconds <= 0) {
        _stopCountdown();
      }
      
      // Show warning at 30 seconds
      if (state.speaker.remainingSeconds === 30) {
        const flags = ThemeLayer.mapStateToFlags(state);
        const content = ContentLayer.getSpeakerContent(state, flags);
        if (content.toasts.sessionEnding) {
          ViewLayer.showInfo(content.toasts.sessionEnding);
        }
      }
      
    }, 1000);
  }
  
  /**
   * Stop countdown timer
   */
  function _stopCountdown() {
    if (_countdownInterval) {
      clearInterval(_countdownInterval);
      _countdownInterval = null;
    }
  }
  
  /**
   * Detect physical button press
   * Called during status polling - checks if state changed unexpectedly
   */
  function detectPhysicalButtonPress(newState) {
    if (!_lastSpeakerState) {
      _lastSpeakerState = newState.speaker;
      return;
    }
    
    const wasOff = !_lastSpeakerState.enabled;
    const nowOn = newState.speaker.enabled;
    const source = newState.speaker.source;
    
    if (wasOff && nowOn && source === 'physical') {
      const flags = ThemeLayer.mapStateToFlags(newState);
      const content = ContentLayer.getSpeakerContent(newState, flags);
      if (content.toasts.physicalButtonDetected) {
        ViewLayer.showInfo(content.toasts.physicalButtonDetected);
      }
      
      if (!_countdownInterval) {
        _startCountdown();
      }
    }
    
    _lastSpeakerState = newState.speaker;
  }
  
  /**
   * Initialize interaction layer
   * Wire up all event handlers
   */
  function init() {
    // Primary speaker button
    const primaryBtn = document.getElementById('speaker-primary-btn');
    if (primaryBtn) {
      primaryBtn.addEventListener('click', () => {
        const state = StateLayer.getState();
        const flags = ThemeLayer.mapStateToFlags(state);
        
        if (flags.speaker.displayMode === 'extension') {
          handleSpeakerExtend();
        } else if (flags.speaker.displayMode === 'off') {
          handleSpeakerToggle();
        }
        // Otherwise button is disabled, do nothing
      });
    }
    
    // Stream button
    const streamBtn = document.getElementById('stream-btn');
    if (streamBtn) {
      streamBtn.addEventListener('click', handleStreamOpen);
    }
    
    // Stream modal - start button
    const streamStartBtn = document.getElementById('stream-start-btn');
    if (streamStartBtn) {
      streamStartBtn.addEventListener('click', handleStreamStart);
    }
    
    // Stream modal - close button
    const streamCloseBtn = document.querySelector('.lof-modal-close');
    if (streamCloseBtn) {
      streamCloseBtn.addEventListener('click', handleStreamClose);
    }
    
    // Stream modal - overlay click
    const streamOverlay = document.querySelector('.lof-modal-overlay');
    if (streamOverlay) {
      streamOverlay.addEventListener('click', handleStreamClose);
    }
    
    // FM info button
    const fmBtn = document.getElementById('fm-info-btn');
    if (fmBtn) {
      fmBtn.addEventListener('click', handleFMInfo);
    }
    
    console.log('[InteractionLayer] Initialized');
  }
  
  // Public API
  return {
    init,
    handleSpeakerToggle,
    handleSpeakerExtend,
    handleStreamOpen,
    handleStreamStart,
    handleStreamClose,
    handleFMInfo,
    detectPhysicalButtonPress
  };
  
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InteractionLayer;
} else {
  window.InteractionLayer = InteractionLayer;
}
