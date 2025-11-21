(function (window) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    
    // Check if viewer root exists
    const viewerRoot = document.getElementById('lof-viewer-root');
    if (!viewerRoot) {
      console.warn('[LOF Init] Viewer root not found');
      return;
    }

    // Validate config
    if (!window.LOF_CONFIG) {
      console.error('[LOF Init] LOF_CONFIG not found');
      return;
    }

    const config = window.LOF_CONFIG;

    // API clients get config from window.LOF_CONFIG directly (no init needed)
    if (!window.RFClient) {
      console.error('[LOF Init] RFClient not loaded');
      return;
    }

    if (!window.FPPClient) {
      console.error('[LOF Init] FPPClient not loaded');
      return;
    }

    if (!window.LOFClient) {
      console.error('[LOF Init] LOFClient not loaded');
      return;
    }

    // Initialize layers
    if (window.StateLayer) {
      StateLayer.init(config);
    } else {
      console.error('[LOF Init] StateLayer not loaded');
      return;
    }

    if (window.ThemeLayer) {
      ThemeLayer.setTheme(config.theme || 'christmas');
      ThemeLayer.updateCSSVariables();
    }

    if (window.ContentLayer) {
      ContentLayer.setTheme(config.theme || 'christmas');
    }

    if (window.ViewLayer) {
      ViewLayer.init();
    } else {
      console.error('[LOF Init] ViewLayer not loaded');
      return;
    }

    if (window.InteractionLayer) {
      InteractionLayer.init();
    } else {
      console.error('[LOF Init] InteractionLayer not loaded');
      return;
    }

    // Debug mode
    if (config.debug) {
      console.log('[LOF Init] Debug mode enabled');
      console.log('[LOF Init] Config:', config);
      
      window.LOF_DEBUG = {
        dumpState: () => {
          console.log(StateLayer.dumpState());
        },
        getState: () => {
          return StateLayer.getState();
        },
        getDerived: () => {
          return StateLayer.getDerivedState();
        },
        getHistory: () => {
          return StateLayer.getStateHistory();
        },
        forceRefresh: () => {
          InteractionLayer._fetchAll();
        },
        testSpeaker: () => {
          console.log('Speaker state:', StateLayer.getState().speaker);
          console.log('Speaker flags:', ThemeLayer.mapSpeakerFlags(StateLayer.getState()));
        },
      };
      
      console.log('[LOF Init] Debug utilities available via window.LOF_DEBUG');
    }

    // Initial render
    const initialState = StateLayer.getState();
    const initialDerived = StateLayer.getDerivedState();
    ViewLayer.render(initialState, initialDerived);

    console.log('[LOF Init] Viewer initialized successfully');
  });

})(window);