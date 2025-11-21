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
      const now = Date.now();
      const speakerOn = state.speaker.enabled;
      const remaining = state.speaker.remainingSeconds;
      const inProtection = state.speaker.gracefulShutoff;
      const currentHour = new Date().getHours();
      
      // Calculate session duration (cumulative time)
      const sessionDuration = speakerOn ? (now - state.speaker.sessionStartedAt) / 1000 : 0;
      const sessionCapped = sessionDuration >= 900; // 15 minutes

      let displayMode = 'off';
      let buttonEnabled = false;
      let buttonLabel = '🔊 Turn On Speakers';
      let statusText = '🎵 Show is live right now!';
      let helperText = 'Turn on outdoor speakers if you\'re near the show';
      let showCountdown = false;
      let countdownValue = 0;

      // === SPEAKER OFF STATES ===
      if (!speakerOn) {
        
        // Check external blockers
        if (state.speaker.config.noiseCurfewEnabled && 
            !state.speaker.config.noiseCurfewOverride &&
            currentHour >= state.speaker.config.noiseCurfewHour) {
          
          displayMode = 'curfew';
          buttonEnabled = false;
          buttonLabel = '🌙 Speakers Off (Late Night)';
          statusText = 'Outdoor speakers quiet after 10 PM';
          helperText = 'Listen via 📻 FM ' + state.speaker.config.fmFrequency + ' or 🌐 Audio Stream';
          
        } else if (state.speaker.proximityTier >= 4 && !state.speaker.proximityConfirmed) {
          
          displayMode = 'geo_blocked';
          buttonEnabled = false;
          buttonLabel = '🔊 On-Site Speakers Only';
          statusText = 'Outdoor speakers available to guests at the show';
          helperText = 'Watching from afar? Enjoy via 📻 FM ' + state.speaker.config.fmFrequency + ' or 🌐 Audio Stream';
          
        } else if (!state.fppData || state.fppData.status === 'unreachable') {
          
          displayMode = 'fpp_offline';
          buttonEnabled = false;
          buttonLabel = '⏸️ Show Paused';
          statusText = 'The show will resume shortly';
          helperText = 'Check back in a few minutes';
          
        } else {
          // Ready to enable
          displayMode = 'off';
          buttonEnabled = true;
          buttonLabel = '🔊 Turn On Speakers';
          statusText = '🎵 Show is live right now!';
          helperText = 'Turn on outdoor speakers if you\'re near the show';
        }
        
      } 
      // === SPEAKER ON STATES ===
      else {
        
        // In protection mode (song finishing)
        if (inProtection) {
          displayMode = 'protection';
          buttonEnabled = false;
          buttonLabel = '🔊 Speakers On';
          statusText = '🎵 Current song will finish';
          helperText = 'This song will finish, then you can start a new turn';
          showCountdown = true;
          countdownValue = state.fppData?.secondsRemaining || 0;
          
        }
        // Extension window (0:01-0:30 remaining, under session cap)
        else if (remaining > 0 && remaining <= 30 && !sessionCapped) {
          displayMode = 'extension';
          buttonEnabled = true;
          buttonLabel = '🎵 Still here? +5 min';
          statusText = '🎵 Enjoying the show';
          helperText = 'Tap to keep the audio going';
          showCountdown = true;
          countdownValue = remaining;
          
        }
        // Active, waiting for extension window
        else if (remaining > 30) {
          displayMode = 'active';
          buttonEnabled = false;
          buttonLabel = '🔊 Speakers On';
          statusText = '🎵 Enjoying the show';
          helperText = 'You can extend in a bit';
          showCountdown = true;
          countdownValue = remaining;
          
        }
        // Timer at 0 or session capped (caps are invisible to user)
        else {
          displayMode = 'active';
          buttonEnabled = false;
          buttonLabel = '🔊 Speakers On';
          statusText = '🎵 Enjoying the show';
          helperText = '';
          showCountdown = remaining > 0;
          countdownValue = remaining;
        }
      }

      return {
        displayMode,
        buttonEnabled,
        buttonLabel,
        statusText,
        helperText,
        showCountdown,
        countdownValue,
        countdownClass: this._getCountdownClass(countdownValue),
        buttonClass: this._getButtonClass(displayMode, buttonEnabled),
        statusIconClass: this._getStatusIconClass(displayMode),
        showAlternatives: true,
        emphasizeAlternatives: displayMode === 'curfew' || displayMode === 'geo_blocked' || displayMode === 'fpp_offline',
        showProximityHint: false,
        proximityTier: state.speaker.proximityTier,
      };
    },

    _getButtonClass(mode, enabled) {
      const baseClass = 'lof-btn';
      
      if (!enabled) {
        return `${baseClass} lof-btn--disabled lof-btn--${mode}`;
      }
      
      if (mode === 'extension') {
        return `${baseClass} lof-btn--primary lof-btn--extension lof-btn--pulse`;
      }
      
      return `${baseClass} lof-btn--primary lof-btn--${mode}`;
    },

    _getStatusIconClass(mode) {
      const iconMap = {
        'off': 'icon-speaker-off',
        'active': 'icon-speaker-on',
        'extension': 'icon-speaker-on icon-pulse',
        'protection': 'icon-speaker-on',
        'curfew': 'icon-moon',
        'geo_blocked': 'icon-location',
        'fpp_offline': 'icon-alert',
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
