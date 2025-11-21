(function (window) {
  'use strict';

  const ContentLayer = {
    _currentTheme: 'christmas',

    _content: {
      status: {
        LOADING: {
          default: 'Connecting to the light show...',
          christmas: "Connecting to Santa's workshop...",
          halloween: 'Awakening the spirits...',
        },
        ACTIVE: {
          default: 'Show is live!',
          christmas: 'The magic is happening! ✨',
          halloween: 'The show rises...',
        },
        DEGRADED: {
          default: 'Limited connectivity',
          christmas: "Connection wobbling like Rudolph's nose",
          halloween: 'The connection flickers...',
        },
        OFFLINE: {
          default: 'Unable to connect to show',
          christmas: 'Lost in a snowstorm',
          halloween: 'Vanished into the darkness',
        },
        ENDED: {
          default: 'Show has ended for tonight',
          christmas: 'Santa has left the building! See you tomorrow! 🎅',
          halloween: 'The spirits have returned to rest',
        },
      },

      statusWarnings: {
        DEGRADED: {
          default: 'Connection unstable. Some features may be limited.',
          christmas: 'The workshop connection is flickering...',
          halloween: 'The veil between worlds weakens...',
        },
        OFFLINE: {
          default: 'Unable to reach the show. Trying to reconnect...',
          christmas: "Can't reach the North Pole right now...",
          halloween: 'Lost in the darkness...',
        },
      },

      loading: {
        request: {
          default: 'Adding your song to the queue...',
          christmas: "Sending request to Santa's elves...",
          halloween: 'Summoning your selection...',
        },
        surprise: {
          default: 'Picking a surprise song...',
          christmas: 'Shaking the present...',
          halloween: 'Conjuring a mystery...',
        },
        retry: {
          default: 'Reconnecting...',
          christmas: "Fixing the sleigh's radio...",
          halloween: 'Calling through the veil...',
        },
      },

      success: {
        request: {
          default: 'Your song is in the queue at position {position}!',
          christmas: '🎄 Your song is queued at #{position}!',
          halloween: '👻 Your song rises to position {position}.',
        },
        surprise: {
          default: "Surprise! '{title}' is queued at position {position}!",
          christmas: "🎁 Unwrapped: '{title}' at position {position}!",
          halloween: "🎃 Revealed: '{title}' at position {position}!",
        },
      },

      errors: {
        COOLDOWN: {
          default: 'Please wait {remainingSeconds} seconds before requesting another song.',
          christmas: 'The elves need a break! Wait {remainingSeconds} seconds.',
          halloween: 'The spirits are tired. Wait {remainingSeconds} seconds.',
        },
        DUPLICATE: {
          default: 'This song is already in the queue.',
          christmas: 'That song is already wrapped under the tree!',
          halloween: 'That spell has already been cast!',
        },
        UNAVAILABLE: {
          default: 'This song is not available right now.',
          christmas: "Santa's checking his list on this one...",
          halloween: 'This song sleeps in its coffin tonight.',
        },
        RATE_LIMIT: {
          default: 'Too many requests. Please slow down.',
          christmas: 'Whoa there! Even Rudolph needs to pace himself!',
          halloween: 'Too much magic at once!',
        },
        NO_SONGS: {
          default: 'No songs available for Surprise Me.',
          christmas: 'The toy workshop is empty! Check back soon.',
          halloween: 'The spell book is empty...',
        },
        UNKNOWN: {
          default: 'Something went wrong. Please try again.',
          christmas: 'A gremlin got in the gears! Try again.',
          halloween: 'The magic misfired. Try again.',
        },
        SPEAKER_FAILED: {
          default: 'Unable to toggle speaker.',
          christmas: "The reindeer aren't listening!",
          halloween: "The speakers won't obey...",
        },
        SONG_COOLDOWN: {
          default: 'This song was recently requested. Wait {remainingSeconds}s.',
          christmas: 'That song just played! Wait {remainingSeconds}s.',
          halloween: 'That spirit is resting. Wait {remainingSeconds}s.',
        },
      },

      labels: {
        nowPlaying: {
          default: 'Now Playing',
          christmas: '🎵 On the Radio',
          halloween: '🎶 Now Haunting',
        },
        upNext: {
          default: 'Up Next',
          christmas: 'Next Gift',
          halloween: 'Next Spirit',
        },
        queue: {
          default: 'Request Queue',
          christmas: "Santa's List",
          halloween: 'The Summoning Order',
        },
        surpriseMe: {
          default: 'Surprise Me!',
          christmas: 'Shake the Present! 🎁',
          halloween: 'Summon a Mystery! 👻',
        },
        noNextTrack: {
          default: 'Tuning the lights...',
          christmas: 'Preparing the next gift...',
          halloween: 'Summoning the next spirit...',
        },
        emptyGrid: {
          default: 'No songs available right now. Check back soon!',
          christmas: "Santa's elves are restocking the workshop...",
          halloween: 'The spell book is being updated...',
        },
      },

      aria: {
        tile: {
          available: 'Request {title} by {artist}',
          unavailable: '{title} by {artist}, not available',
        },
        nowPlaying: 'Currently playing {title} by {artist}',
        upNext: 'Up next: {title} by {artist}',
        queueItem: 'Request number {position}: {title} by {requester}',
      },

      speaker: {
        // Button labels by state
        buttonLabel: {
          off: '🔊 Turn On Speakers',
          active: '🔊 Speakers On',
          extension: '🎵 Still here? +5 min',
          protection: '🔊 Speakers On',
          curfew: '🌙 Speakers Off (Late Night)',
          geo_blocked: '🔊 On-Site Speakers Only',
          fpp_offline: '⏸️ Show Paused',
        },

        // Status text by state
        statusText: {
          off: '🎵 Show is live right now!',
          active: '🎵 Enjoying the show',
          extension: '🎵 Enjoying the show',
          protection: '🎵 Current song will finish',
          curfew: 'Outdoor speakers quiet after 10 PM',
          geo_blocked: 'Outdoor speakers available to guests at the show',
          fpp_offline: 'The show will resume shortly',
        },

        // Helper text by state
        helperText: {
          off: 'Turn on outdoor speakers if you\'re near the show',
          active: 'You can extend in a bit',
          extension: 'Tap to keep the audio going',
          protection: 'This song will finish, then you can start a new turn',
          curfew: 'Listen via 📻 FM {frequency} or 🌐 Audio Stream',
          geo_blocked: 'Watching from afar? Enjoy via 📻 FM {frequency} or 🌐 Audio Stream',
          fpp_offline: 'Check back in a few minutes',
        },

        // Toast messages
        toasts: {
          enableSuccess: {
            default: '🔊 Speakers on. Enjoy the music!',
            christmas: '🎄 Speakers on! Let the festive music fill the air.',
            halloween: '🎃 Speakers summoned! The show is louder now.',
          },
          extendSuccess: {
            default: '⏱️ Speakers extended! Enjoy 5 more minutes.',
            christmas: '🎅 More holiday magic! Extended for 5 minutes.',
            halloween: '👻 More spooky sounds! Extended for 5 minutes.',
          },
          proximityConfirmed: {
            default: '✓ Location confirmed. You can now control speakers!',
            christmas: '🎄 Welcome to the show! Speaker control enabled.',
            halloween: '👻 Welcome, guest! Speaker control enabled.',
          },
          alreadyOn: 'Speakers are already rockin\'!',
          physicalButtonDetected: '🔊 Speakers turned on by show attendee',
          turningOff: '⏸️ Speakers turning off',
        },

        // Alternatives (FM/Stream)
        alternatives: {
          fmLabel: '📻 FM {frequency}',
          streamLabel: '🌐 Audio Stream',
          fmHint: 'Listen in your car',
          streamHint: 'Perfectly synced audio',
        },
      },
    },

    setTheme(themeName) {
      this._currentTheme = themeName || 'christmas';
    },

    getMessage(category, key, context = {}) {
      const theme = this._currentTheme;
      const cat = this._content[category] || {};
      const entry = cat[key] || {};
      let message = entry[theme] || entry.default || `[Missing content: ${category}.${key}]`;

      Object.entries(context).forEach(([k, v]) => {
        message = message.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });

      return message;
    },

    getErrorMessage(code, context = {}) {
      return this.getMessage('errors', code || 'UNKNOWN', context);
    },

    getCategoryLabel(category) {
      const key = category || 'general';
      if (!this._content.categories) return key;
      return this.getMessage('categories', key);
    },

    getTileAriaLabel(title, artist, isAvailable) {
      const templateKey = isAvailable ? 'available' : 'unavailable';
      const tpl = this._content.aria?.tile?.[templateKey] || 'Request {title} by {artist}';
      return tpl.replace('{title}', title).replace('{artist}', artist || '');
    },

    getRequesterLabel(name) {
      if (!name || name === 'Anonymous' || name === 'Guest') {
        return this._currentTheme === 'christmas' ? '🎅' : '👻';
      }
      return name;
    },

    getStatusCopy(derived) {
      const state = derived.state || 'LOADING';
      const text = this.getMessage('status', state);
      const indicatorClass = `lof-state--${state.toLowerCase()}`;
      let warning = '';
      if (state === 'DEGRADED' || state === 'OFFLINE') {
        warning = this.getMessage('statusWarnings', state);
      }
      return { text, indicatorClass, warning };
    },

    getNoNextTrackLabel() {
      return this.getMessage('labels', 'noNextTrack');
    },

    getEmptyGridMessage() {
      return this.getMessage('labels', 'emptyGrid');
    },

    getSpeakerContent(state, flags) {
      const mode = flags.speaker.displayMode;
      const frequency = state.speaker.config.fmFrequency;

      // Get base content from state
      let buttonLabel = flags.speaker.buttonLabel;
      let statusText = flags.speaker.statusText;
      let helperText = flags.speaker.helperText;

      // Apply theme if available
      const themeMode = this._currentTheme;

      // Replace frequency placeholders
      helperText = helperText.replace('{frequency}', frequency);

      // Format countdown if shown
      let countdownLabel = null;
      if (flags.speaker.showCountdown && flags.speaker.countdownValue > 0) {
        const formatted = this._formatCountdown(flags.speaker.countdownValue);
        countdownLabel = `${formatted} remaining`;
      }

      return {
        buttonLabel,
        statusText,
        helperText,
        countdownLabel,
        alternatives: {
          fmLabel: `📻 FM ${frequency}`,
          streamLabel: '🌐 Audio Stream',
          fmHint: 'Listen in your car',
          streamHint: 'Perfectly synced audio',
        },
        toasts: this._getSpeakerToasts(themeMode),
      };
    },

    _getSpeakerToasts(themeMode) {
      const toasts = this._content.speaker.toasts;
      return {
        enableSuccess: toasts.enableSuccess[themeMode] || toasts.enableSuccess.default,
        extendSuccess: toasts.extendSuccess[themeMode] || toasts.extendSuccess.default,
        proximityConfirmed: toasts.proximityConfirmed[themeMode] || toasts.proximityConfirmed.default,
        alreadyOn: toasts.alreadyOn,
        physicalButtonDetected: toasts.physicalButtonDetected,
        turningOff: toasts.turningOff,
      };
    },

    _formatCountdown(seconds) {
      if (seconds <= 0) {
        return '0:00';
      }

      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;

      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
  };

  window.ContentLayer = ContentLayer;
})(window);
