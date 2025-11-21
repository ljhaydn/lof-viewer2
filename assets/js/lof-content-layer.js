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
        speaker: {
          default: 'Starting speakers...',
          christmas: 'Turning up the caroling...',
          halloween: 'Awakening the sound spirits...',
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
        speaker_enabled: {
          default: 'Speakers enabled for 5 minutes!',
          christmas: '🔊 Ho ho ho! Speakers on for 5 minutes!',
          halloween: '🔊 The speakers awaken for 5 minutes!',
        },
        speaker_extended: {
          default: 'Speaker time extended by 5 minutes!',
          christmas: '⏰ More caroling time! 5 minutes added!',
          halloween: '⏰ The sound spirits linger... 5 minutes more!',
        },
      },

      errors: {
        COOLDOWN: {
          default: 'Please wait {remainingSeconds} seconds before requesting another song.',
          christmas: 'The elves need a break! Wait {remainingSeconds} seconds.',
          halloween: 'The spirits are tired. Wait {remainingSeconds} seconds.',
        },
        SONG_COOLDOWN: {
          default: 'This song was just requested. Please wait {remainingSeconds} seconds.',
          christmas: 'That gift was just opened! Wait {remainingSeconds} seconds.',
          halloween: 'That spell was just cast. Wait {remainingSeconds} seconds.',
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

      // ========================================
      // SPEAKER COPY (ALL STATES)
      // ========================================
      speaker: {
        title: {
          default: '🔊 Outdoor Speakers',
          christmas: '🔊 Hear the Carolers',
          halloween: '🔊 Hear the Haunting',
        },

        // Display mode: OFF (ready to enable)
        off: {
          statusText: {
            default: 'Want to hear the music outside?',
            christmas: 'Want to hear the carols outside?',
            halloween: 'Want to hear the haunting music?',
          },
          buttonLabel: {
            default: 'Turn On Speakers',
            christmas: 'Start the Caroling',
            halloween: 'Awaken the Speakers',
          },
          helperText: {
            default: 'Speakers will play for 5 minutes. You can extend anytime.',
            christmas: '5 minutes of holiday cheer! Can extend anytime.',
            halloween: '5 minutes of spooky sounds. Extend if you dare...',
          },
        },

        // Display mode: CURFEW (blocked by time)
        curfew: {
          statusText: {
            default: 'Speakers are off for the evening.',
            christmas: 'Shh... the neighbors are sleeping! 🌙',
            halloween: 'The night grows too quiet for speakers...',
          },
          buttonLabel: {
            default: 'Speakers Unavailable',
            christmas: 'Silent Night 🔇',
            halloween: 'Silence Reigns 🔇',
          },
          helperText: {
            default: 'Outdoor speakers turn off at curfew time. Try FM or stream!',
            christmas: "Santa's being quiet tonight. Try FM or stream!",
            halloween: 'The speakers rest. Try FM or stream instead.',
          },
        },

        // Display mode: GEO_BLOCKED (proximity gated)
        geo_blocked: {
          statusText: {
            default: 'Speakers are for visitors at the show.',
            christmas: 'Speakers are just for visitors at the North Pole!',
            halloween: 'Speakers are only for those who dare approach...',
          },
          buttonLabel: {
            default: 'Not Available Here',
            christmas: 'Too Far from the Pole',
            halloween: 'Beyond the Veil',
          },
          helperText: {
            default: 'Listen via FM or audio stream instead!',
            christmas: 'Tune in via FM or stream from afar!',
            halloween: 'Hear the sounds via FM or stream...',
          },
        },

        // Display mode: FPP_OFFLINE (show not playing)
        fpp_offline: {
          statusText: {
            default: 'Speakers available when the show is running.',
            christmas: 'Speakers will turn on when the show starts!',
            halloween: 'Speakers await the show to rise...',
          },
          buttonLabel: {
            default: 'Waiting for Show',
            christmas: 'Show Not Started',
            halloween: 'Show Dormant',
          },
          helperText: {
            default: 'Check back when lights are active!',
            christmas: "Check back when Santa's flying!",
            halloween: 'Return when the spirits awaken!',
          },
        },

        // Display mode: ACTIVE (4:00 - 0:31)
        active: {
          statusText: {
            default: 'Speakers are playing outside!',
            christmas: 'The carolers are singing! 🎵',
            halloween: 'The spirits are howling! 🎵',
          },
          buttonLabel: {
            default: 'Speakers On',
            christmas: 'Caroling Active',
            halloween: 'Speakers Haunting',
          },
          helperText: {
            default: '{countdown} remaining. You can extend when under 30 seconds.',
            christmas: '{countdown} of holiday magic left!',
            halloween: '{countdown} of haunting sounds remain...',
          },
          countdownLabel: {
            default: '{countdown}',
            christmas: '{countdown}',
            halloween: '{countdown}',
          },
        },

        // Display mode: EXTENSION (0:30 - 0:01)
        extension: {
          statusText: {
            default: 'Winding down... extend now!',
            christmas: 'The music is fading... extend now!',
            halloween: 'The sounds are fading... extend if you dare!',
          },
          buttonLabel: {
            default: '+ 5 More Minutes',
            christmas: '+ 5 More Minutes of Cheer',
            halloween: '+ 5 More Minutes of Haunting',
          },
          helperText: {
            default: '{countdown} left. Tap to add 5 more minutes!',
            christmas: '{countdown} left! Keep the carols going!',
            halloween: '{countdown} left. Extend the haunting!',
          },
          countdownLabel: {
            default: '{countdown}',
            christmas: '{countdown}',
            halloween: '{countdown}',
          },
        },

        // Display mode: PROTECTION (song finishing)
        protection: {
          statusText: {
            default: 'Letting this song finish...',
            christmas: 'Finishing this carol gracefully...',
            halloween: 'Letting this haunting melody end...',
          },
          buttonLabel: {
            default: 'Finishing Song',
            christmas: 'Ending Gracefully',
            halloween: 'Song Fading',
          },
          helperText: {
            default: '{countdown} until song ends. Speakers will turn off after.',
            christmas: '{countdown} left in this carol.',
            halloween: '{countdown} until the spirits rest.',
          },
          countdownLabel: {
            default: '{countdown}',
            christmas: '{countdown}',
            halloween: '{countdown}',
          },
        },

        // Proximity confirm button
        proximityConfirm: {
          default: '✓ Yes, I'm at the show',
          christmas: "✓ Yes, I'm at the North Pole!",
          halloween: "✓ Yes, I'm here in person!",
        },

        // FM button
        fmButton: {
          default: '📻 FM {frequency}',
          christmas: '📻 Tune to {frequency}',
          halloween: '📻 FM {frequency}',
        },

        // Stream button
        streamButton: {
          default: '🌐 Audio Stream',
          christmas: '🌐 Stream the Carols',
          halloween: '🌐 Stream the Haunting',
        },

        // Alternatives section title
        alternativesTitle: {
          default: 'Listen another way:',
          christmas: 'Other ways to hear:',
          halloween: 'Hear the sounds from afar:',
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

    // ========================================
    // SPEAKER COPY METHODS
    // ========================================

    /**
     * Get speaker card copy based on flags from ThemeLayer
     * Returns { title, statusText, buttonLabel, helperText, countdownLabel, ... }
     */
    getSpeakerCopy(flags) {
      const mode = flags.displayMode || 'off';
      const countdown = this._formatCountdown(flags.countdownValue || 0);

      const title = this.getMessage('speaker.title', this._currentTheme);

      const statusText = this.getMessage(`speaker.${mode}.statusText`, this._currentTheme, {
        countdown,
      });

      const buttonLabel = this.getMessage(`speaker.${mode}.buttonLabel`, this._currentTheme, {
        countdown,
      });

      const helperText = this.getMessage(`speaker.${mode}.helperText`, this._currentTheme, {
        countdown,
      });

      let countdownLabel = '';
      if (flags.showCountdown) {
        countdownLabel = this.getMessage(`speaker.${mode}.countdownLabel`, this._currentTheme, {
          countdown,
        });
      }

      const proximityConfirmLabel = this.getMessage(
        'speaker.proximityConfirm',
        this._currentTheme
      );

      const fmButtonLabel = this.getMessage('speaker.fmButton', this._currentTheme, {
        frequency: flags.fmFrequency || '107.7',
      });

      const streamButtonLabel = this.getMessage('speaker.streamButton', this._currentTheme);

      const alternativesTitle = this.getMessage('speaker.alternativesTitle', this._currentTheme);

      return {
        title,
        statusText,
        buttonLabel,
        helperText,
        countdownLabel,
        proximityConfirmLabel,
        fmButtonLabel,
        streamButtonLabel,
        alternativesTitle,
      };
    },

    _formatCountdown(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
  };

  window.ContentLayer = ContentLayer;
})(window);
