// assets/js/lof-theme-layer.js
(function (window) {
  'use strict';

  const ThemeLayer = {
    _currentTheme: 'christmas',

    _themes: {
      christmas: {
        colors: {
          primary: '#c41e3a',
          secondary: '#0b6623',
          accent: '#ffd700',
          background: '#0f0c29',
          surface: '#16213e',
          text: '#ffffff',
          textMuted: '#a8b2c1',
          success: '#00cc66',
          error: '#ff4444',
          warning: '#ffaa00',
        },
      },
      halloween: {
        colors: {
          primary: '#ff6600',
          secondary: '#9b59b6',
          accent: '#00ff41',
          background: '#000000',
          surface: '#1a1a1a',
          text: '#ffffff',
          textMuted: '#888888',
          success: '#00ff41',
          error: '#ff0000',
          warning: '#ff6600',
        },
      },
      default: {
        colors: {
          primary: '#1e90ff',
          secondary: '#00b894',
          accent: '#ffeaa7',
          background: '#111827',
          surface: '#1f2937',
          text: '#ffffff',
          textMuted: '#9ca3af',
          success: '#10b981',
          error: '#ef4444',
          warning: '#f59e0b',
        },
      },
    },

    setTheme(themeName) {
      this._currentTheme = themeName || 'default';
      this.updateCSSVariables();
    },

    getTheme() {
      return this._currentTheme;
    },

    getColor(key) {
      const theme = this._themes[this._currentTheme] || this._themes.default;
      return theme.colors[key] || '#ffffff';
    },

    getStateClass(stateName) {
      return `lof-state-indicator lof-state--${(stateName || '').toLowerCase()}`;
    },

    getCategoryClass(category) {
      return `lof-category lof-category--${(category || 'general').toLowerCase()}`;
    },

    getSpeakerButtonClass(enabled, disabled) {
      let base = 'lof-button lof-button--speaker';
      if (disabled) base += ' lof-button--disabled';
      else if (enabled) base += ' lof-button--on';
      else base += ' lof-button--off';
      return base;
    },

    getTileClass(isAvailable, isCooldown) {
      let base = 'lof-tile';
      if (!isAvailable) base += ' lof-tile--unavailable';
      if (isCooldown) base += ' lof-tile--cooldown';
      return base;
    },

    updateCSSVariables() {
      const theme = this._themes[this._currentTheme] || this._themes.default;
      const root = document.documentElement;
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--lof-${key}`, value);
      });
    },

    // ========================================
    // SPEAKER FLAGS MAPPING
    // ========================================

    /**
     * Map speaker state to UI flags (NO COPY TEXT)
     * Returns flags that ContentLayer and ViewLayer use
     */
    mapSpeakerFlags(speakerState, fppData) {
      const now = Date.now();
      const currentHour = new Date(now).getHours();

      const flags = {
        displayMode: 'off',
        buttonEnabled: false,
        showCountdown: false,
        countdownValue: 0,
        showExtendButton: false,
        showProximityButton: false,
        emphasizeAlternatives: false,
        proximityTier: speakerState.proximityTier || 1,
      };

      // Check curfew
      const curfewActive =
        speakerState.config?.noiseCurfewEnabled &&
        currentHour >= (speakerState.config?.noiseCurfewHour || 22);

      // Check FPP - use actual fppData, not speakerState
      const fppPlaying = fppData && fppData.mode === 'playing';

      // Determine display mode
      if (!speakerState.enabled) {
        // Speaker is OFF
        if (curfewActive) {
          flags.displayMode = 'curfew';
          flags.buttonEnabled = false;
          flags.emphasizeAlternatives = true;
        } else if (speakerState.proximityTier >= 4) {
          flags.displayMode = 'geo_blocked';
          flags.buttonEnabled = false;
          flags.emphasizeAlternatives = true;
        } else if (!fppPlaying) {
          flags.displayMode = 'fpp_offline';
          flags.buttonEnabled = false;
          flags.emphasizeAlternatives = false;
        } else {
          flags.displayMode = 'off';
          flags.buttonEnabled = true;
          flags.emphasizeAlternatives = false;
        }
      } else {
        // Speaker is ON
        if (speakerState.gracefulShutoff) {
          // Protection mode - use FPP time
          flags.displayMode = 'protection';
          flags.buttonEnabled = false;
          flags.showCountdown = true;
          flags.countdownValue = fppData?.secondsRemaining || speakerState.remainingSeconds || 0;
          flags.emphasizeAlternatives = false;
        } else if (speakerState.remainingSeconds <= 30 && speakerState.remainingSeconds > 0) {
          // Extension window
          flags.displayMode = 'extension';
          flags.buttonEnabled = false;
          flags.showCountdown = true;
          flags.countdownValue = speakerState.remainingSeconds;
          flags.showExtendButton = !speakerState.maxSessionReached;
          flags.emphasizeAlternatives = false;
        } else {
          // Active
          flags.displayMode = 'active';
          flags.buttonEnabled = false;
          flags.showCountdown = true;
          flags.countdownValue = speakerState.remainingSeconds;
          flags.emphasizeAlternatives = false;
        }
      }

      // Show proximity button if needed
      if (speakerState.proximityTier >= 4 && !speakerState.proximityConfirmed) {
        flags.showProximityButton = true;
      }

      return flags;
    },
  };

  window.ThemeLayer = ThemeLayer;
})(window);
