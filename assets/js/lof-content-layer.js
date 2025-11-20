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
        cardTitle: {
          default: '🔊 Need Sound?',
          christmas: '🎅 Need Festive Sounds?',
          halloween: '👻 Need Spooky Sounds?',
          locked: '🔒 Event Mode',
          curfew: '🌙 Late Night Audio',
          unavailable: '⚠️ Speaker Unavailable',
          waiting: '⏸️ Show Paused',
          capped: '⏱️ Session Complete',
          proximity_confirm: '📍 Confirm Location',
        },
        buttonLabel: {
          off: '🔊 Turn On Speakers',
          active: '🔊 Speakers Active',
          extension: '⏱️ Still Here? +5 Minutes',
          session_ending: '🎵 Song Finishing...',
          locked: '🔒 Speakers Locked On',
          curfew: '🔇 Speakers Off (Curfew)',
          unavailable: '⚠️ Unavailable',
          waiting: '⏸️ Show Not Active',
          capped: '⏱️ Max Duration Reached',
          proximity_confirm: '✓ Yes, I\'m at the show',
        },
        statusMessage: {
          off: '🎵 Show is live right now!',
          active: '🎵 Show is playing',
          extension: '⏱️ Countdown running',
          session_ending: '🎵 Speakers will turn off after this song',
          locked: 'Speakers are on continuously for tonight\'s event!',
          curfew: 'Outdoor speakers end at curfew to be good neighbors!',
          unavailable: 'Speaker control is temporarily unavailable.',
          waiting: 'Speakers are only available when the show is actively playing.',
          capped: 'Maximum session duration reached. Ready to start fresh?',
          proximity_confirm: 'Are you watching at the show in Long Beach?',
          proximity_tier2: 'You seem a bit far from Long Beach. Are you at the show?',
          proximity_tier3: 'You seem quite far from Long Beach. Are you at the show?',
          proximity_tier4: 'Outdoor speakers only available to guests at the show in Long Beach, CA.',
          proximity_tier5: 'Outdoor speakers only available to on-site guests in Long Beach, California, USA.',
        },
        helperText: {
          off: 'Turn on outdoor speakers if you\'re near the show!',
          active: 'Enjoying the show? Extension button will appear in the last 30 seconds.',
          extension: 'Tap the button above to extend your session by 5 more minutes.',
          session_ending: 'This session will end after the current song finishes. Press the button to start a new session!',
          locked: 'Viewer control is disabled during this event.',
          curfew: 'Listen via FM or the audio stream instead.',
          unavailable: 'Try again in a moment, or use FM/stream options below.',
          waiting: 'The show will resume shortly. Check back in a few minutes!',
          capped: 'You\'ve reached the 30-minute maximum. Press the button to start a fresh 5-minute session!',
          proximity_confirm: 'Confirm you\'re watching on-site to enable outdoor speakers.',
          proximity_tier1: 'You\'re nearby! Turn on the outdoor speakers.',
          proximity_tier2: 'Not at the show? Listen via FM or audio stream below.',
          proximity_tier3: 'Visiting from afar? Enjoy the show via FM or audio stream!',
          proximity_tier4: 'Desktop users: Speaker control works from mobile devices or on-site networks.',
        },
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
          sessionEnding: 'Speakers will turn off soon. Hit the button to extend!',
          sessionEndingSoon: 'Last 30 seconds! Extend now to keep listening.',
          newSessionReady: 'Session complete! Press the button to start fresh.',
        },
        alternatives: {
          fmLabel: '📻 FM {frequency}',
          streamLabel: '🎵 Audio Stream',
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
      const mode = state.themeMode || 'neutral';
      const displayMode = flags.speaker.displayMode;
      const tier = state.speaker.proximityTier;

      const cardTitle = this._getSpeakerCardTitle(displayMode, mode);
      const primaryButtonLabel = this._getSpeakerButtonLabel(displayMode, flags, mode);
      const proximityConfirmLabel = this.getMessage('speaker', 'buttonLabel', { key: 'proximity_confirm' });
      const statusMessage = this._getSpeakerStatusMessage(displayMode, state, tier, mode);
      const helperText = this._getSpeakerHelperText(displayMode, tier, mode);
      const toasts = this._getSpeakerToasts(mode);

      return {
        cardTitle,
        primaryButtonLabel,
        proximityConfirmLabel,
        extensionButtonLabel: '⏱️ Still Here? +5 Minutes',
        statusMessage,
        helperText,
        countdownLabel: flags.speaker.showCountdown ? `⏱️ ${flags.speaker.countdownValue} remaining` : null,
        alternatives: {
          fmLabel: `📻 FM ${state.speaker.config.fmFrequency}`,
          streamLabel: '🎵 Audio Stream',
          fmHint: 'Listen in your car',
          streamHint: 'Perfectly synced audio',
        },
        toasts,
        proximityHint: this._getProximityHint(tier),
        weatherNotice: null,
        sessionStats: null,
      };
    },

    _getSpeakerCardTitle(displayMode, mode) {
      const titles = this._content.speaker.cardTitle;
      if (displayMode === 'locked') return titles.locked;
      if (displayMode === 'curfew') return titles.curfew;
      if (displayMode === 'unavailable') return titles.unavailable;
      if (displayMode === 'waiting') return titles.waiting;
      if (displayMode === 'capped') return titles.capped;
      if (displayMode === 'proximity_confirm') return titles.proximity_confirm;
      return titles[mode] || titles.default;
    },

    _getSpeakerButtonLabel(displayMode, flags, mode) {
      const labels = this._content.speaker.buttonLabel;
      if (displayMode === 'off') return labels.off;
      if (displayMode === 'active') {
        if (flags.speaker.showCountdown) {
          return `🔊 On for ${flags.speaker.countdownValue}`;
        }
        return labels.active;
      }
      if (displayMode === 'extension') return labels.extension;
      if (displayMode === 'session_ending') return labels.session_ending;
      if (displayMode === 'locked') return labels.locked;
      if (displayMode === 'curfew') return labels.curfew;
      if (displayMode === 'unavailable') return labels.unavailable;
      if (displayMode === 'waiting') return labels.waiting;
      if (displayMode === 'capped') return labels.capped;
      if (displayMode === 'proximity_confirm') return labels.proximity_confirm;
      return labels.off;
    },

    _getSpeakerStatusMessage(displayMode, state, tier, mode) {
      const messages = this._content.speaker.statusMessage;
      
      if (displayMode === 'proximity_confirm') {
        if (tier === 2) return messages.proximity_tier2;
        if (tier === 3) return messages.proximity_tier3;
        return messages.proximity_confirm;
      }

      if (displayMode === 'off' && (tier === 4 || tier === 5)) {
        if (tier === 4) return messages.proximity_tier4;
        if (tier === 5) return messages.proximity_tier5;
      }

      if (state.speaker.currentSong && (displayMode === 'off' || displayMode === 'active')) {
        return `🎵 "${state.speaker.currentSong}" is playing`;
      }

      return messages[displayMode] || messages.off;
    },

    _getSpeakerHelperText(displayMode, tier, mode) {
      const helpers = this._content.speaker.helperText;
      
      if (displayMode === 'proximity_confirm') {
        return helpers.proximity_confirm;
      }

      if (displayMode === 'off') {
        if (tier === 1) return helpers.proximity_tier1;
        if (tier === 2) return helpers.proximity_tier2;
        if (tier === 3) return helpers.proximity_tier3;
        if (tier === 4) return helpers.proximity_tier4;
      }

      return helpers[displayMode] || helpers.off;
    },

    _getSpeakerToasts(mode) {
      const toasts = this._content.speaker.toasts;
      return {
        enableSuccess: toasts.enableSuccess[mode] || toasts.enableSuccess.default,
        extendSuccess: toasts.extendSuccess[mode] || toasts.extendSuccess.default,
        proximityConfirmed: toasts.proximityConfirmed[mode] || toasts.proximityConfirmed.default,
        alreadyOn: toasts.alreadyOn,
        physicalButtonDetected: toasts.physicalButtonDetected,
        sessionEnding: toasts.sessionEnding,
        sessionEndingSoon: toasts.sessionEndingSoon,
        newSessionReady: toasts.newSessionReady,
      };
    },

    _getProximityHint(tier) {
      if (tier === 1) return null;
      if (tier === 2) return 'You seem a bit away from Long Beach';
      if (tier === 3) return 'You seem quite far from Long Beach';
      if (tier === 4) return 'Speakers work best on-site in Long Beach, CA';
      if (tier === 5) return 'Speakers only available to on-site guests in Long Beach, CA, USA';
      return null;
    },
  };

  window.ContentLayer = ContentLayer;
})(window);