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

    mapSpeakerFlags(state) {
      const gating = StateLayer.canUseSpeaker();
      const canExtend = StateLayer.canExtendSpeaker();
      const needsConfirmation = StateLayer.needsProximityConfirmation();

      let displayMode = 'off';

      if (gating.code === 'OVERRIDE_LOCKED') {
        displayMode = 'locked';
      } else if (gating.code === 'NOISE_CURFEW') {
        displayMode = 'curfew';
      } else if (gating.code === 'FPP_UNREACHABLE') {
        displayMode = 'unavailable';
      } else if (gating.code === 'NOT_PLAYING') {
        displayMode = 'waiting';
      } else if (gating.code === 'LIFETIME_CAP_REACHED') {
        displayMode = 'capped';
      } else if (needsConfirmation) {
        displayMode = 'proximity_confirm';
      } else if (state.speaker.enabled) {
        if (state.speaker.maxSessionReached) {
          displayMode = 'session_ending';
        } else if (canExtend) {
          displayMode = 'extension';
        } else {
          displayMode = 'active';
        }
      } else if (gating.allowed) {
        displayMode = 'off';
      }

      const showProximityConfirmButton = displayMode === 'proximity_confirm';
      const showPrimaryButton = !showProximityConfirmButton;

      return {
        displayMode,
        showSpeakerButton: true,
        showProximityConfirmButton,
        showPrimaryButton,
        canClickPrimaryButton: displayMode === 'off' || displayMode === 'extension',
        canClickExtensionButton: displayMode === 'extension',
        primaryButtonEnabled: displayMode === 'off' || displayMode === 'extension',
        isSpeakerOn: state.speaker.enabled,
        isSpeakerLocked: displayMode === 'locked',
        isSpeakerUnavailable: displayMode === 'unavailable',
        isWaitingForShow: displayMode === 'waiting',
        isNoiseCurfew: displayMode === 'curfew',
        isExtensionWindow: displayMode === 'extension',
        isSessionEnding: displayMode === 'session_ending',
        isLifetimeCapped: displayMode === 'capped',
        needsProximityConfirmation: needsConfirmation,
        speakerCardClass: this._getCardClass(displayMode),
        primaryButtonClass: this._getButtonClass(displayMode, 'primary'),
        proximityConfirmButtonClass: this._getButtonClass(displayMode, 'proximity_confirm'),
        extensionButtonClass: this._getButtonClass(displayMode, 'extension'),
        statusIconClass: this._getStatusIconClass(displayMode),
        showCountdown: state.speaker.enabled && state.speaker.remainingSeconds > 0,
        countdownValue: this._formatCountdown(state.speaker.remainingSeconds),
        countdownClass: this._getCountdownClass(state.speaker.remainingSeconds),
        showAlternatives: true,
        emphasizeAlternatives: displayMode === 'curfew' || displayMode === 'unavailable' || displayMode === 'waiting' || displayMode === 'locked' || displayMode === 'capped',
        showProximityHint: displayMode === 'off' || displayMode === 'proximity_confirm',
        proximityTier: state.speaker.proximityTier,
        showWeatherNotice: false,
        showSessionStats: false,
      };
    },

    _getCardClass(mode) {
      const baseClass = 'lof-speaker-card';
      const modeClasses = {
        'off': 'lof-speaker-card--off',
        'active': 'lof-speaker-card--active',
        'extension': 'lof-speaker-card--extension',
        'session_ending': 'lof-speaker-card--session-ending',
        'locked': 'lof-speaker-card--locked',
        'curfew': 'lof-speaker-card--curfew',
        'unavailable': 'lof-speaker-card--unavailable',
        'waiting': 'lof-speaker-card--waiting',
        'capped': 'lof-speaker-card--capped',
        'proximity_confirm': 'lof-speaker-card--proximity-confirm',
      };
      return `${baseClass} ${modeClasses[mode] || ''}`;
    },

    _getButtonClass(mode, buttonType) {
      const baseClass = 'lof-btn';

      if (buttonType === 'proximity_confirm') {
        if (mode === 'proximity_confirm') {
          return `${baseClass} lof-btn--primary lof-btn--proximity-confirm`;
        }
        return `${baseClass} lof-btn--hidden`;
      }

      if (buttonType === 'primary') {
        if (mode === 'off') {
          return `${baseClass} lof-btn--primary lof-btn--speaker-enable`;
        } else if (mode === 'active') {
          return `${baseClass} lof-btn--disabled lof-btn--speaker-active`;
        } else if (mode === 'extension') {
          return `${baseClass} lof-btn--primary lof-btn--speaker-extend lof-btn--pulse`;
        } else if (mode === 'session_ending') {
          return `${baseClass} lof-btn--disabled lof-btn--speaker-ending`;
        } else if (mode === 'locked' || mode === 'curfew' || mode === 'unavailable' || mode === 'waiting' || mode === 'capped') {
          return `${baseClass} lof-btn--disabled lof-btn--speaker-blocked`;
        } else if (mode === 'proximity_confirm') {
          return `${baseClass} lof-btn--hidden`;
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
    },

    _getStatusIconClass(mode) {
      const iconMap = {
        'off': 'icon-speaker-off',
        'active': 'icon-speaker-on',
        'extension': 'icon-speaker-on icon-pulse',
        'session_ending': 'icon-speaker-on icon-warning',
        'locked': 'icon-lock',
        'curfew': 'icon-moon',
        'unavailable': 'icon-alert',
        'waiting': 'icon-clock',
        'capped': 'icon-timer-off',
        'proximity_confirm': 'icon-location',
      };
      return iconMap[mode] || 'icon-speaker-off';
    },

    _formatCountdown(seconds) {
      if (seconds <= 0) {
        return '0:00';
      }

      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;

      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    _getCountdownClass(seconds) {
      if (seconds <= 30) {
        return 'lof-countdown--warning';
      } else if (seconds <= 60) {
        return 'lof-countdown--caution';
      } else {
        return 'lof-countdown--normal';
      }
    },

    mapStateToFlags(state) {
      const speakerFlags = this.mapSpeakerFlags(state);

      return {
        speaker: speakerFlags,
        themeMode: state.themeMode || this._currentTheme,
      };
    },

    updateCSSVariables() {
      const theme = this._themes[this._currentTheme] || this._themes.default;
      const root = document.documentElement;
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--lof-${key}`, value);
      });
    },
  };

  window.ThemeLayer = ThemeLayer;
})(window);