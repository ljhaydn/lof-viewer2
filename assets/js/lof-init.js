(function (window) {
  'use strict';

  function initLOFViewer() {
    const configFromWP = window.LOF_CONFIG || {};
    const themeName = configFromWP.theme || 'christmas';

    ContentLayer.setTheme(themeName);
    ThemeLayer.setTheme(themeName);

    StateLayer.init(configFromWP.lofInitialConfig || null);

    InteractionLayer.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLOFViewer);
  } else {
    initLOFViewer();
  }
})(window);