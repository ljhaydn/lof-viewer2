/**
 * LOF Viewer V2 - Init Layer
 * 
 * Responsibility: Bootstrap and initialize the application
 * - Initial data fetch
 * - Set up polling intervals
 * - Subscribe to state changes
 * - Wire up interaction handlers
 * - No business logic beyond initialization
 */

const InitLayer = (() => {
  
  let _initialized = false;
  let _statusPollInterval = null;
  
  /**
   * Initialize speaker system
   */
  async function initSpeaker() {
    if (_initialized) {
      console.warn('[InitLayer] Speaker already initialized');
      return;
    }
    
    console.log('[InitLayer] Initializing speaker system...');
    
    // 1. Fetch initial speaker status
    try {
      const status = await LOFClient.getSpeakerStatus();
      
      if (status.success) {
        StateLayer.setSpeakerState(status);
        console.log('[InitLayer] Initial speaker status loaded');
      } else {
        console.warn('[InitLayer] Failed to load initial speaker status:', status.error);
      }
    } catch (err) {
      console.error('[InitLayer] Error loading initial speaker status:', err);
    }
    
    // 2. Subscribe to state changes
    StateLayer.subscribeToState((state) => {
      // Update UI on every state change
      ViewLayer.updateUI(state);
      
      // Detect physical button presses
      InteractionLayer.detectPhysicalButtonPress(state);
    });
    
    // 3. Initialize interaction handlers
    InteractionLayer.init();
    
    // 4. Set up status polling (every 15 seconds)
    _statusPollInterval = setInterval(async () => {
      try {
        const status = await LOFClient.getSpeakerStatus();
        
        if (status.success) {
          StateLayer.setSpeakerState(status);
        } else {
          console.warn('[InitLayer] Status poll failed:', status.error);
        }
      } catch (err) {
        console.error('[InitLayer] Status poll error:', err);
      }
    }, 15000); // 15 seconds
    
    // 5. Initial UI render
    const initialState = StateLayer.getState();
    ViewLayer.updateUI(initialState);
    
    _initialized = true;
    console.log('[InitLayer] Speaker system initialized successfully');
  }
  
  /**
   * Initialize theme based on date/settings
   */
  function initTheme() {
    // Detect theme based on current date
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const day = now.getDate();
    
    let themeMode = 'neutral';
    
    // Halloween: October 1 - November 1
    if (month === 9 || (month === 10 && day === 1)) {
      themeMode = 'halloween';
    }
    
    // Christmas: December 1 - January 1
    if (month === 11 || (month === 0 && day === 1)) {
      themeMode = 'christmas';
    }
    
    // Check for manual override in config
    if (window.LOF_CONFIG && window.LOF_CONFIG.themeMode) {
      themeMode = window.LOF_CONFIG.themeMode;
    }
    
    StateLayer.setThemeMode(themeMode);
    console.log('[InitLayer] Theme mode:', themeMode);
  }
  
  /**
   * Initialize user context from server data
   */
  function initUserContext() {
    // If server provided Cloudflare headers or other context
    if (window.LOF_CONFIG && window.LOF_CONFIG.userContext) {
      StateLayer.setUserContext(window.LOF_CONFIG.userContext);
      console.log('[InitLayer] User context set from server');
    }
  }
  
  /**
   * Main initialization function
   * Called when DOM is ready
   */
  async function init() {
    console.log('[InitLayer] Starting Lights on Falcon Viewer V2...');
    
    try {
      // Initialize theme first (no async)
      initTheme();
      
      // Initialize user context
      initUserContext();
      
      // Initialize speaker system
      await initSpeaker();
      
      console.log('[InitLayer] All systems initialized');
      
    } catch (err) {
      console.error('[InitLayer] Initialization failed:', err);
    }
  }
  
  /**
   * Cleanup function (for page unload or SPA transitions)
   */
  function cleanup() {
    if (_statusPollInterval) {
      clearInterval(_statusPollInterval);
      _statusPollInterval = null;
    }
    
    _initialized = false;
    
    console.log('[InitLayer] Cleaned up');
  }
  
  // Public API
  return {
    init,
    cleanup
  };
  
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    InitLayer.init();
  });
} else {
  // DOM already loaded
  InitLayer.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InitLayer;
} else {
  window.InitLayer = InitLayer;
}
