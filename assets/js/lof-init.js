/**
 * LOF Viewer V2 - Init Layer (FULLY CORRECTED)
 * 
 * Responsibility: Bootstrap and initialize the application
 * - Initial data fetch
 * - Set up polling intervals
 * - Subscribe to state changes
 * - Wire up interaction handlers
 * - Hide loading state
 * - No business logic beyond initialization
 */

const InitLayer = (() => {
  
  let _initialized = false;
  let _statusPollInterval = null;
  let _countdownInterval = null;
  
  /**
   * Hide loading screen, show viewer
   */
  function hideLoadingScreen() {
    const loadingEl = document.getElementById('lof-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    
    const speakerCard = document.getElementById('lof-speaker-card');
    if (speakerCard) {
      speakerCard.style.display = 'block';
    }
    
    console.log('[InitLayer] Loading screen hidden, viewer visible');
  }
  
  /**
   * Show error state (if init fails completely)
   */
  function showErrorState(message) {
    const loadingEl = document.getElementById('lof-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="loading-error" style="text-align: center; padding: 32px;">
          <p style="color: #F5222D; font-weight: 500; font-size: 18px; margin-bottom: 8px;">⚠ Initialization Failed</p>
          <p style="font-size: 14px; color: #595959; margin-bottom: 16px;">${message}</p>
          <button onclick="location.reload()" style="padding: 8px 24px; border: 1px solid #d9d9d9; border-radius: 4px; background: white; cursor: pointer; font-size: 14px;">
            Retry
          </button>
        </div>
      `;
    }
  }
  
  /**
   * Render speaker UI based on current state
   */
  function renderSpeakerUI(state) {
    try {
      // Get flags from ThemeLayer (correct method name)
      const flags = ThemeLayer.mapSpeakerFlags(state);
      
      // Get content from ContentLayer (correct method name)
      const content = ContentLayer.getSpeakerContent(state, flags);
      
      // Render via ViewLayer
      ViewLayer.renderSpeakerCard(state, flags, content);
    } catch (err) {
      console.error('[InitLayer] Error rendering speaker UI:', err);
    }
  }
  
  /**
   * Initialize speaker system
   */
  async function initSpeaker() {
    console.log('[InitLayer] Initializing speaker system...');
    
    // 1. Fetch initial speaker status
    try {
      const status = await LOFClient.getSpeakerStatus();
      
      if (status.success) {
        StateLayer.setSpeakerState(status);
        console.log('[InitLayer] Initial speaker status loaded');
      } else {
        console.warn('[InitLayer] Failed to load initial speaker status:', status.error);
        // Continue anyway - speaker might be disabled or unavailable
      }
    } catch (err) {
      console.error('[InitLayer] Error loading initial speaker status:', err);
      // Continue anyway
    }
    
    // 2. Subscribe to state changes
    StateLayer.subscribeToState((state) => {
      // Render speaker UI on every state change
      renderSpeakerUI(state);
      
      // Detect physical button presses
      if (InteractionLayer.detectPhysicalButtonPress) {
        InteractionLayer.detectPhysicalButtonPress(state);
      }
    });
    
    // 3. Initialize interaction handlers
    InteractionLayer.init();
    
    // 4. Initial render
    const initialState = StateLayer.getState();
    renderSpeakerUI(initialState);
    
    // 5. Set up status polling (every 5 seconds)
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
    }, 5000); // 5 seconds
    
    // 6. Set up countdown ticker (every 1 second)
    _countdownInterval = setInterval(() => {
      StateLayer.tickSpeakerCountdown();
    }, 1000);
    
    console.log('[InitLayer] Speaker system initialized');
  }
  
  /**
   * Initialize theme based on config
   */
  function initTheme() {
    let themeMode = 'neutral';
    
    // Check for theme in LOF_CONFIG
    if (window.LOF_CONFIG && window.LOF_CONFIG.theme) {
      themeMode = window.LOF_CONFIG.theme;
    }
    
    // Apply theme to viewer container
    const viewerEl = document.getElementById('lof-viewer-v2');
    if (viewerEl) {
      viewerEl.setAttribute('data-theme', themeMode);
    }
    
    console.log('[InitLayer] Theme mode:', themeMode);
  }
  
  /**
   * Main initialization function
   * Called when DOM is ready
   */
  async function init() {
    if (_initialized) {
      console.warn('[InitLayer] Already initialized');
      return;
    }
    
    console.log('[InitLayer] Starting Lights on Falcon Viewer V2...');
    console.log('[InitLayer] LOF_CONFIG:', window.LOF_CONFIG);
    
    try {
      // Verify all required layers are loaded
      const requiredLayers = [
        'LOFClient',
        'StateLayer', 
        'ThemeLayer',
        'ContentLayer',
        'ViewLayer',
        'InteractionLayer'
      ];
      
      const missingLayers = requiredLayers.filter(layer => !window[layer]);
      
      if (missingLayers.length > 0) {
        throw new Error(`Missing required layers: ${missingLayers.join(', ')}`);
      }
      
      console.log('[InitLayer] All layers loaded successfully');
      
      // Initialize theme first (no async)
      initTheme();
      
      // Initialize speaker system
      await initSpeaker();
      
      // Hide loading screen, show viewer
      hideLoadingScreen();
      
      _initialized = true;
      console.log('[InitLayer] ✅ All systems initialized successfully');
      
    } catch (err) {
      console.error('[InitLayer] ❌ Initialization failed:', err);
      showErrorState(err.message || 'Unknown error occurred');
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
    
    if (_countdownInterval) {
      clearInterval(_countdownInterval);
      _countdownInterval = null;
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