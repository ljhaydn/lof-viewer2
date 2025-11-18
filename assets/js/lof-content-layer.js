// assets/js/lof-content-layer.js
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
        enabled: {
          default: 'Speaker On',
          christmas: 'Hear the Magic! 🔊',
          halloween: 'Hear the Spirits! 🔊',
        },
        disabled: {
          default: 'Speaker Off',
          christmas: 'Silent Night 🔇',
          halloween: 'Silence 🔇',
        },
        disabledByHeuristic: {
          default: 'Speaker temporarily disabled',
          christmas: 'Shh... neighbors are sleeping 🌙',
          halloween: 'The spirits are resting 🌙',
        },
        helperText: {
          default: 'Tap to play the speakers out front when the show is running.',
          christmas: 'Tap to hear the music outside! 🎶',
          halloween: 'Tap to unleash the sounds... 🎵',
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

    getSpeakerLabel(enabled) {
      return this.getMessage('speaker', enabled ? 'enabled' : 'disabled');
    },

    getSpeakerAriaLabel(state, reason) {
      if (state === 'disabled') {
        return this.getMessage('speaker', 'disabledByHeuristic');
      }
      return this.getSpeakerLabel(state === 'on');
    },

    getRequesterLabel(name) {
      if (!name || name === 'Anonymous' || name === 'Guest') {
        return this._currentTheme === 'christmas' ? '🎅' : '👻';
      }
      return name;
    },

    // ========================================
    // NEW METHODS REQUIRED BY VIEW LAYER
    // ========================================

    /**
     * Get status panel copy
     * Called by ViewLayer.renderStatusPanel()
     * Returns { text, indicatorClass, warning }
     */
    getStatusCopy(derived) {
      const state = derived.state || 'LOADING';
      const isInDegradedMode = derived.isInDegradedMode || false;

      const text = this.getMessage('status', state);

      // Map state to indicator class
      const indicatorClass = `lof-state--${state.toLowerCase()}`;

      // Show warning for DEGRADED or OFFLINE
      let warning = '';
      if (state === 'DEGRADED' || state === 'OFFLINE') {
        warning = this.getMessage('statusWarnings', state);
      }

      return {
        text,
        indicatorClass,
        warning,
      };
    },

    /**
     * Get "no next track" label
     * Called by ViewLayer.renderNowNext()
     * Returns string
     */
    getNoNextTrackLabel() {
      return this.getMessage('labels', 'noNextTrack');
    },

    /**
     * Get empty grid message
     * Called by ViewLayer.renderSongGrid()
     * Returns string
     */
    getEmptyGridMessage() {
      return this.getMessage('labels', 'emptyGrid');
    },

    /**
     * Get speaker button copy
     * Called by ViewLayer.renderSpeakerButton()
     * Returns { enabled, buttonLabel, title, helper }
     */
    getSpeakerCopy(speakerState) {
      const enabled = speakerState.enabled || false;
      const disabledByHeuristic = speakerState.disabledByHeuristic || false;

      let buttonLabel = '';
      let title = '';
      let helper = this.getMessage('speaker.helperText', this._currentTheme) || 
                   this._content.speaker.helperText?.default || 
                   'Tap to play the speakers out front when the show is running.';

      if (disabledByHeuristic) {
        // Speaker is disabled by system
        buttonLabel = this.getMessage('speaker', 'disabledByHeuristic');
        title = buttonLabel;
      } else if (enabled) {
        // Speaker is on
        buttonLabel = this.getMessage('speaker', 'enabled');
        title = buttonLabel;
      } else {
        // Speaker is off but available
        buttonLabel = this.getMessage('speaker', 'disabled');
        title = buttonLabel;
      }

      return {
        enabled: !disabledByHeuristic,
        buttonLabel,
        title,
        helper,
      };
    },
  };

  window.ContentLayer = ContentLayer;
})(window);