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

    // Initialize API clients
    if (window.RFClient) {
      RFClient.init(config.restBase + '/show', config.restBase + '/request', config.restBase + '/vote');
    }

    if (window.FPPClient) {
      FPPClient.init(config.restBase + '/fpp/status');
    }

    if (window.LOFClient) {
      LOFClient.init(
        config.restBase + '/speaker',
        config.restBase + '/speaker/notify'
      );
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