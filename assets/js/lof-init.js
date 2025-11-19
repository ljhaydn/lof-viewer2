/**
 * LOF Viewer V2 - Init Layer (COMPLETE WITH RF VIEWER)
 * 
 * Responsibility: Bootstrap and initialize the application
 * - Initialize RF viewer (song cards, now playing, etc.)
 * - Initialize speaker control
 * - Set up polling intervals
 * - Subscribe to state changes
 * - Wire up interaction handlers
 */

const InitLayer = (() => {
  
  let _initialized = false;
  let _rfPollInterval = null;
  let _fppPollInterval = null;
  let _speakerPollInterval = null;
  let _countdownInterval = null;
  
  /**
   * Hide loading screen, show viewer
   */
  function hideLoadingScreen() {
    const loadingEl = document.getElementById('lof-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    console.log('[InitLayer] Loading screen hidden');
  }
  
  /**
   * Show error state
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
   * Render speaker UI
   */
  function renderSpeakerUI(state) {
    try {
      const flags = ThemeLayer.mapSpeakerFlags(state);
      const content = ContentLayer.getSpeakerContent(state, flags);
      ViewLayer.renderSpeakerCard(state, flags, content);
    } catch (err) {
      console.error('[InitLayer] Error rendering speaker UI:', err);
    }
  }
  
  /**
   * Render main viewer UI (song cards, now playing, etc.)
   */
  function renderViewerUI(state) {
    try {
      // Get overall state flags from ThemeLayer
      const viewerFlags = ThemeLayer.mapStateToFlags ? ThemeLayer.mapStateToFlags(state) : {};
      
      // Render now playing section
      if (ViewLayer.renderNowPlaying) {
        ViewLayer.renderNowPlaying(state, viewerFlags);
      }
      
      // Render up next section
      if (ViewLayer.renderUpNext) {
        ViewLayer.renderUpNext(state, viewerFlags);
      }
      
      // Render song cards/tiles
      if (ViewLayer.renderSongCards) {
        ViewLayer.renderSongCards(state, viewerFlags);
      }
      
      // Render queue display
      if (ViewLayer.renderQueue) {
        ViewLayer.renderQueue(state, viewerFlags);
      }
      
    } catch (err) {
      console.error('[InitLayer] Error rendering viewer UI:', err);
    }
  }
  
  /**
   * Initialize Remote Falcon viewer
   */
  async function initRFViewer() {
    console.log('[InitLayer] Initializing Remote Falcon viewer...');
    
    // Check if RF features are enabled
    const config = window.LOF_CONFIG || {};
    const rfEnabled = config.features?.requestsEnabled || config.features?.votingEnabled;
    
    if (!rfEnabled) {
      console.log('[InitLayer] RF features disabled, skipping RF initialization');
      return;
    }
    
    try {
      // Fetch initial show details
      const showData = await LOFClient.getShowDetails();
      
      if (showData.success) {
        StateLayer.setShowState(showData);
        console.log('[InitLayer] RF show details loaded');
      } else {
        console.warn('[InitLayer] Failed to load RF show details:', showData.error);
      }
    } catch (err) {
      console.error('[InitLayer] Error loading RF show details:', err);
    }
    
    // Set up RF polling (every 5 seconds)
    _rfPollInterval = setInterval(async () => {
      try {
        const showData = await LOFClient.getShowDetails();
        
        if (showData.success) {
          StateLayer.setShowState(showData);
        }
      } catch (err) {
        console.error('[InitLayer] RF poll error:', err);
      }
    }, 5000);
    
    console.log('[InitLayer] RF viewer initialized');
  }
  
  /**
   * Initialize FPP integration
   */
  async function initFPP() {
    console.log('[InitLayer] Initializing FPP integration...');
    
    try {
      // Fetch initial FPP status
      const fppStatus = await LOFClient.getFPPStatus();
      
      if (fppStatus.success) {
        StateLayer.setFPPStatus(fppStatus);
        console.log('[InitLayer] FPP status loaded');
      } else {
        console.warn('[InitLayer] Failed to load FPP status:', fppStatus.error);
      }
    } catch (err) {
      console.error('[InitLayer] Error loading FPP status:', err);
    }
    
    // Set up FPP polling (every 5 seconds)
    _fppPollInterval = setInterval(async () => {
      try {
        const fppStatus = await LOFClient.getFPPStatus();
        
        if (fppStatus.success) {
          StateLayer.setFPPStatus(fppStatus);
        }
      } catch (err) {
        console.error('[InitLayer] FPP poll error:', err);
      }
    }, 5000);
    
    console.log('[InitLayer] FPP integration initialized');
  }
  
  /**
   * Initialize speaker system
   */
  async function initSpeaker() {
    console.log('[InitLayer] Initializing speaker system...');
    
    // Check if speaker features are enabled
    const config = window.LOF_CONFIG || {};
    const speakerEnabled = config.features?.speakerControlEnabled !== false;
    
    if (!speakerEnabled) {
      console.log('[InitLayer] Speaker control disabled, skipping speaker initialization');
      // Hide speaker card
      const speakerCard = document.getElementById('lof-speaker-card');
      if (speakerCard) {
        speakerCard.style.display = 'none';
      }
      return;
    }
    
    try {
      // Fetch initial speaker status
      const status = await LOFClient.getSpeakerStatus();
      
      if (status.success) {
        StateLayer.setSpeakerState(status);
        console.log('[InitLayer] Speaker status loaded');
      } else {
        console.warn('[InitLayer] Failed to load speaker status:', status.error);
      }
    } catch (err) {
      console.error('[InitLayer] Error loading speaker status:', err);
    }
    
    // Initial render
    const initialState = StateLayer.getState();
    renderSpeakerUI(initialState);
    
    // Show speaker card
    const speakerCard = document.getElementById('lof-speaker-card');
    if (speakerCard) {
      speakerCard.style.display = 'block';
    }
    
    // Set up speaker polling (every 5 seconds)
    _speakerPollInterval = setInterval(async () => {
      try {
        const status = await LOFClient.getSpeakerStatus();
        
        if (status.success) {
          StateLayer.setSpeakerState(status);
        }
      } catch (err) {
        console.error('[InitLayer] Speaker poll error:', err);
      }
    }, 5000);
    
    // Set up countdown ticker (every 1 second)
    _countdownInterval = setInterval(() => {
      StateLayer.tickSpeakerCountdown();
    }, 1000);
    
    console.log('[InitLayer] Speaker system initialized');
  }
  
  /**
   * Initialize theme
   */
  function initTheme() {
    let themeMode = 'neutral';
    
    if (window.LOF_CONFIG && window.LOF_CONFIG.theme) {
      themeMode = window.LOF_CONFIG.theme;
    }
    
    const viewerEl = document.getElementById('lof-viewer-v2');
    if (viewerEl) {
      viewerEl.setAttribute('data-theme', themeMode);
    }
    
    console.log('[InitLayer] Theme mode:', themeMode);
  }
  
  /**
   * Main initialization function
   */
  async function init() {
    if (_initialized) {
      console.warn('[InitLayer] Already initialized');
      return;
    }
    
    console.log('[InitLayer] 🚀 Starting Lights on Falcon Viewer V2...');
    console.log('[InitLayer] LOF_CONFIG:', window.LOF_CONFIG);
    
    try {
      // Verify all required layers are loaded
      const requiredLayers = ['LOFClient', 'StateLayer', 'ThemeLayer', 'ContentLayer', 'ViewLayer', 'InteractionLayer'];
      const missingLayers = requiredLayers.filter(layer => !window[layer]);
      
      if (missingLayers.length > 0) {
        throw new Error(`Missing required layers: ${missingLayers.join(', ')}`);
      }
      
      console.log('[InitLayer] ✅ All layers loaded');
      
      // Initialize theme
      initTheme();
      
      // Subscribe to state changes (do this BEFORE loading data)
      StateLayer.subscribeToState((state) => {
        // Render both speaker UI and viewer UI on every state change
        renderSpeakerUI(state);
        renderViewerUI(state);
        
        // Detect physical button presses
        if (InteractionLayer.detectPhysicalButtonPress) {
          InteractionLayer.detectPhysicalButtonPress(state);
        }
      });
      
      // Initialize interaction handlers
      InteractionLayer.init();
      
      // Initialize all subsystems in parallel
      await Promise.all([
        initRFViewer(),
        initFPP(),
        initSpeaker()
      ]);
      
      // Initial render of everything
      const currentState = StateLayer.getState();
      renderSpeakerUI(currentState);
      renderViewerUI(currentState);
      
      // Hide loading screen
      hideLoadingScreen();
      
      _initialized = true;
      console.log('[InitLayer] ✅ All systems initialized successfully');
      
    } catch (err) {
      console.error('[InitLayer] ❌ Initialization failed:', err);
      showErrorState(err.message || 'Unknown error occurred');
    }
  }
  
  /**
   * Cleanup function
   */
  function cleanup() {
    if (_rfPollInterval) clearInterval(_rfPollInterval);
    if (_fppPollInterval) clearInterval(_fppPollInterval);
    if (_speakerPollInterval) clearInterval(_speakerPollInterval);
    if (_countdownInterval) clearInterval(_countdownInterval);
    
    _rfPollInterval = null;
    _fppPollInterval = null;
    _speakerPollInterval = null;
    _countdownInterval = null;
    _initialized = false;
    
    console.log('[InitLayer] Cleaned up');
  }
  
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
  InitLayer.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InitLayer;
} else {
  window.InitLayer = InitLayer;
}
