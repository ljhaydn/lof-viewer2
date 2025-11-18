// assets/js/lof-api-layer.js
(function (window) {
  'use strict';

  // ------------------------------
  // RFClient – talks to WP REST proxy (JWT lives in PHP)
  // ------------------------------
 const RFClient = {
  _baseURL: window.LOF_CONFIG?.rfProxyBaseUrl || '/wp-json/lof-viewer/v1',

     async getShowDetails() {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'RF proxy URL not configured');
      }

      // We call our WP REST adapter, not RF directly.
      const url = `${this._baseURL}/show`;

      try {
        console.debug('[RFClient] fetching showDetails from', url);

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        console.debug('[RFClient] HTTP status', res.status);

        // If the adapter itself fails (5xx, etc.)
        if (!res.ok) {
          return this._error('HTTP_ERROR', `RF proxy returned ${res.status}`);
        }

        const json = await res.json().catch((err) => {
          console.error('[RFClient] JSON parse error', err);
          return null;
        });

        console.debug('[RFClient] raw JSON', json);

        // Our PHP adapter wraps RF JSON as { success, url, data }
        if (!json || json.success === false) {
          const msg =
            json && json.message
              ? json.message
              : 'Remote Falcon returned an error via LOF adapter';
          return this._error('RF_ADAPTER_ERROR', msg);
        }

        // This is the actual RF showDetails payload (preferences, sequences, etc.)
        const raw = json.data ?? json;

        const normalized = this._normalizeShowDetails(raw);
        console.debug('[RFClient] normalized showDetails', normalized);

        // IMPORTANT: InteractionLayer expects this shape directly:
        // { success, timestamp, data, error, errorCode }
        return normalized;
      } catch (err) {
        console.error('[RFClient] getShowDetails failed', err);
        return this._error('NETWORK_ERROR', err.message || String(err));
      }
    },



    async requestSong(songId, visitorId) {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'RF proxy URL not configured');
      }

      const url = `${this._baseURL}/request`;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song_id: songId, visitor_id: visitorId }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const raw = await res.json();
        return this._normalizeRequestResponse(raw);
      } catch (err) {
        console.error('[RFClient] requestSong failed', err);
        return this._error('NETWORK_ERROR', err.message);
      }
    },

        _normalizeShowDetails(raw) {
      // raw is the RF showDetails JSON:
      // { preferences, sequences, sequenceGroups, requests, votes, playingNow, playingNext, playingNextFromSchedule }

      const sequences = Array.isArray(raw.sequences) ? raw.sequences : [];

      // Helper: find a sequence by its "name" (that's what playingNow/Next use)
      const findSeqByName = (name) =>
        !name ? null : sequences.find((s) => s && s.name === name) || null;

      const nowSeq = findSeqByName(raw.playingNow);
      // If RF provides playingNext, use that; otherwise fall back to schedule-based next
      const nextName =
        raw.playingNext && raw.playingNext !== ''
          ? raw.playingNext
          : raw.playingNextFromSchedule || '';
      const nextSeq = findSeqByName(nextName);

      // Normalize a sequence into our internal "song" shape
      const toSong = (seq) =>
        !seq
          ? null
          : {
              songId: seq.name, // RF "name" is the unique ID
              title: seq.displayName || seq.name || 'Untitled',
              artist: seq.artist || null,
              duration: seq.duration || 0,
              // We don't get per-song elapsed time from this endpoint
              elapsedSeconds: 0,
              category: seq.category || 'general',
              visible: seq.visible !== false,
              active: seq.active !== false,
            };

      const nowPlaying = toSong(nowSeq);
      const upNext = toSong(nextSeq);

      // Requests queue – RF "requests" array may be empty when nobody has queued anything yet.
      const queue = (Array.isArray(raw.requests) ? raw.requests : []).map(
        (req, index) => ({
          // RF schema varies by version; we try a few common keys
          songId:
            req.sequenceName ||
            req.sequence ||
            req.sequenceId ||
            req.name ||
            null,
          title:
            req.displayName ||
            req.sequenceDisplayName ||
            req.title ||
            'Requested song',
          requestedBy:
            req.requestedBy ||
            req.requesterName ||
            req.visitor_name ||
            'Guest',
          position: req.position ?? index + 1,
        })
      );

      // Available songs – filter visible + active sequences
      const availableSongs = sequences
        .filter((s) => s && s.visible !== false && s.active !== false)
        .map((s) => ({
          songId: s.name,
          title: s.displayName || s.name || 'Untitled',
          artist: s.artist || null,
          duration: s.duration || 0,
          category: s.category || 'general',
          isAvailable: true,
          cooldownUntil: null,
        }));

      const prefs = raw.preferences || {};

      // Very simple show status heuristic for now
      const showStatus =
        sequences.length === 0
          ? 'idle'
          : prefs.viewerControlEnabled === false
          ? 'running_no_control'
          : 'active';

      const requestsEnabled = !!prefs.viewerControlEnabled;

      return {
        success: true,
        timestamp: Date.now(),
        data: {
          nowPlaying,
          upNext,
          queue,
          availableSongs,
          showStatus,
          requestsEnabled,
        },
        error: null,
        errorCode: null,
      };
    },


    _normalizeRequestResponse(raw) {
      if (!raw || raw.success === false) {
        return {
          success: false,
          timestamp: Date.now(),
          data: null,
          error: raw?.error || 'Unknown error',
          errorCode: raw?.error_code || 'UNKNOWN',
        };
      }

      return {
        success: true,
        timestamp: Date.now(),
        data: {
          requestId: raw.request_id || '',
          queuePosition: raw.queue_position ?? 0,
          estimatedWaitMinutes: raw.estimated_wait_minutes ?? 0,
        },
        error: null,
        errorCode: null,
      };
    },

    _normalizeStatus(status) {
      const map = {
        running: 'active',
        active: 'active',
        paused: 'paused',
        stopped: 'ended',
        ended: 'ended',
        scheduled: 'scheduled',
      };
      return map[status] || 'ended';
    },

    _error(code, message) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: message,
        errorCode: code,
      };
    },
  };

  // ------------------------------
  // FPPClient – talks to FPP (direct or via your own proxy)
  // ------------------------------
  const FPPClient = {
    _baseURL: window.LOF_CONFIG?.fppBaseUrl || '',

  async getStatus() {
    if (!this._baseURL) {
      return this._error('CONFIG_ERROR', 'FPP base URL not configured');
    }

    // Call the WP proxy: /wp-json/lof-viewer/v1/fpp/status
    const url = `${this._baseURL}/status`;

    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      return this._normalizeStatus(raw);
    } catch (err) {
      console.error('[FPPClient] getStatus failed', err);
      return this._error('NETWORK_ERROR', err.message);
    }
  },

    _normalizeStatus(raw) {
      return {
        success: true,
        timestamp: Date.now(),
        data: {
          mode: raw.fppMode || 'idle',
          currentSequence: raw.current_sequence || null,
          secondsElapsed: raw.seconds_played || 0,
          secondsRemaining: raw.seconds_remaining || 0,
        },
        error: null,
        errorCode: null,
      };
    },

    _error(code, message) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: message,
        errorCode: code,
      };
    },
  };

  // ------------------------------
  // LOFClient – talks to your own LOF endpoints
  // ------------------------------
  const LOFClient = {
    _baseURL: window.LOF_CONFIG?.lofBaseUrl || '',

    async getConfig() {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'LOF base URL not configured');
      }

      const url = `${this._baseURL}/config`;
      try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        return this._normalizeConfig(raw);
      } catch (err) {
        console.error('[LOFClient] getConfig failed', err);
        return this._error('NETWORK_ERROR', err.message);
      }
    },

    async toggleSpeakerOn(enabled) {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'LOF base URL not configured');
      }

      const url = `${this._baseURL}/speaker`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        return {
          success: !!raw.success,
          timestamp: Date.now(),
          data: raw,
          error: raw.success ? null : raw.error || 'Speaker failed',
          errorCode: raw.success ? null : raw.error_code || 'SPEAKER_FAILED',
        };
      } catch (err) {
        console.error('[LOFClient] toggleSpeakerOn failed', err);
        return this._error('NETWORK_ERROR', err.message);
      }
    },

    async logTelemetry(eventData) {
      try {
        if (!this._baseURL) return;
        const url = `${this._baseURL}/telemetry`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      } catch (err) {
        // telemetry failures are non-fatal
        console.warn('[LOFClient] telemetry failed', err);
      }
    },

    _normalizeConfig(raw) {
      return {
        success: true,
        timestamp: Date.now(),
        data: raw,
        error: null,
        errorCode: null,
      };
    },

    _error(code, message) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: message,
        errorCode: code,
      };
    },
  };

  // Expose globals
  window.RFClient = RFClient;
  window.FPPClient = FPPClient;
  window.LOFClient = LOFClient;
})(window);
