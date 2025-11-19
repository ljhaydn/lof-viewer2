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

        if (!res.ok) {
          return this._error('HTTP_ERROR', `RF proxy returned ${res.status}`);
        }

        const json = await res.json().catch((err) => {
          console.error('[RFClient] JSON parse error', err);
          return null;
        });

        console.debug('[RFClient] raw JSON', json);

        if (!json || json.success === false) {
          const msg =
            json && json.message
              ? json.message
              : 'Remote Falcon returned an error via LOF adapter';
          return this._error('RF_ADAPTER_ERROR', msg);
        }

        const raw = json.data ?? json;

        const normalized = this._normalizeShowDetails(raw);
        console.debug('[RFClient] normalized showDetails', normalized);

        return normalized; // { success, timestamp, data, error, errorCode }
      } catch (err) {
        console.error('[RFClient] getShowDetails failed', err);
        return this._error('NETWORK_ERROR', err.message || String(err));
      }
    },

    /**
     * Request a song via WP REST proxy.
     *
     * @param {string} songId      Remote Falcon sequence name (e.g. "GhostbustersThemeFallOutBoy101825")
     * @param {string|null} visitorId  Optional visitor identifier
     */
    async requestSong(songId, visitorId) {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'RF proxy URL not configured');
      }

      const url = `${this._baseURL}/request`;

      const payload = {
        song_id: songId,
      };
      if (visitorId) {
        payload.visitor_id = visitorId;
      }

      try {
        console.debug('[RFClient] sending requestSong to', url, payload);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch((err) => {
          console.error('[RFClient] requestSong JSON parse error', err);
          return null;
        });

        console.debug('[RFClient] requestSong raw JSON', json);

        return this._normalizeRequestResponse(json);
      } catch (err) {
        console.error('[RFClient] requestSong failed', err);
        return this._error('NETWORK_ERROR', err.message || String(err));
      }
    },

    /**
     * Normalize Remote Falcon showDetails into the Viewer v2 shape.
     * 
     * PORTED FROM V1 VIEWER BEHAVIOR:
     * ================================
     * Remote Falcon External API returns:
     * - playingNow: current sequence name (string)
     * - playingNext: next scheduled sequence name (string)
     * - playingNextFromSchedule: fallback next from schedule (string)
     * - requests: array of queued viewer requests
     *   CRITICAL: Each request has a `sequence` property that is an OBJECT, not a string!
     *   Structure: { sequence: { name, displayName, artist, duration, ... }, position, ... }
     * - votes: array of voting-mode requests (if applicable)
     * - sequences: array of all available sequences
     * 
     * V1 BEHAVIOR FOR UP NEXT:
     * 1. Try to find sequence matching playingNext
     * 2. If not found AND requests.length > 0, use requests[0].sequence OBJECT
     * 3. Fall back to empty
     */
    _normalizeShowDetails(raw) {
      const sequences = Array.isArray(raw.sequences) ? raw.sequences : [];

      const findSeqByName = (name) =>
        !name ? null : sequences.find((s) => s && s.name === name) || null;

      const toSong = (seq) =>
        !seq
          ? null
          : {
              songId: seq.name,
              title: seq.displayName || seq.name || 'Untitled',
              artist: seq.artist || null,
              duration: seq.duration || 0,
              category: seq.category || 'general',
              visible: seq.visible !== false,
              active: seq.active !== false,
              isAvailable: seq.visible !== false && seq.active !== false,
              cooldownUntil: null,
            };

      // ----- Queue -----
      // FIXED: RF's requests array contains objects where `sequence` is an OBJECT, not a string
      const rawRequests = Array.isArray(raw.requests) ? raw.requests : [];
      
      const queue = rawRequests.map((req, index) => {
        // req.sequence is an OBJECT with { name, displayName, artist, duration, ... }
        const seqObj = (req.sequence && typeof req.sequence === 'object') ? req.sequence : {};
        const songId = seqObj.name || null;
        const title = seqObj.displayName || seqObj.name || 'Requested song';
        const artist = seqObj.artist || '';
        
        return {
          songId,
          title,
          artist,
          requestedBy: req.viewerRequested || req.requesterName || req.visitor_name || 'Guest',
          position: (typeof req.position === 'number') ? req.position : index + 1,
        };
      });

      // ----- Now Playing -----
      const nowSeq = findSeqByName(raw.playingNow);
      const nowPlaying = toSong(nowSeq);

      // ----- Up Next -----
      // FIXED: Port v1 logic exactly:
      // 1. Try playingNext from RF
      // 2. If not found AND queue has items, use the first queue item's sequence OBJECT
      let upNext = null;

      const playingNextRaw = raw.playingNext || '';
      let nextSeq = findSeqByName(playingNextRaw);

      // V1 line 643-645: if (!nextSeq && rawRequests.length > 0 && rawRequests[0].sequence)
      if (!nextSeq && rawRequests.length > 0 && rawRequests[0].sequence) {
        // rawRequests[0].sequence is an OBJECT, not a string!
        nextSeq = rawRequests[0].sequence;
      }

      upNext = toSong(nextSeq);

      // ----- Available songs -----
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

    /**
     * Normalize the response from /wp-json/lof-viewer/v1/request.
     *
     * PHP returns: { status: <http status>, data: <decoded RF JSON or null> }
     */
    _normalizeRequestResponse(json) {
      if (!json) {
        return {
          success: false,
          timestamp: Date.now(),
          data: null,
          error: 'Empty response from RF request proxy',
          errorCode: 'RF_REQUEST_EMPTY',
        };
      }

      const status = typeof json.status === 'number' ? json.status : null;
      const data = json.data || null;
      const ok = status !== null && status >= 200 && status < 300;

      let queuePosition = null;
      if (data && typeof data.queuePosition === 'number') {
        queuePosition = data.queuePosition;
      } else if (data && typeof data.queue_position === 'number') {
        queuePosition = data.queue_position;
      }

      return {
        success: ok,
        timestamp: Date.now(),
        data: {
          queuePosition,
          raw: data,
        },
        error: ok ? null : 'Remote Falcon request failed',
        errorCode: ok ? null : 'RF_REQUEST_FAILED',
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
  // FPPClient – talks to FPP (via your own WP proxy)
  // ------------------------------
  const FPPClient = {
    _baseURL: window.LOF_CONFIG?.fppBaseUrl || '/wp-json/lof-viewer/v1/fpp',

    async getStatus() {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'FPP base URL not configured');
      }

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
      const d = raw && raw.data ? raw.data : raw || {};

      return {
        success: true,
        timestamp: Date.now(),
        data: {
          mode: d.mode_name || d.fppMode || 'idle',
          currentSequence: d.current_sequence || null,
          secondsElapsed: d.seconds_played || 0,
          secondsRemaining: d.seconds_remaining || 0,
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
  // LOFClient – Lights on Falcon plugin endpoints (stubs for now)
  // ------------------------------
  const LOFClient = {
    _baseURL: window.LOF_CONFIG?.lofBaseUrl || '/wp-json/lof/v1',

    async logTelemetry(data) {
      console.debug('[LOFClient] logTelemetry (stubbed):', data);
      return Promise.resolve({ success: true, timestamp: Date.now() });
    },

    async toggleSpeakerOn(enabled) {
      console.debug('[LOFClient] toggleSpeakerOn (stubbed):', enabled);
      return Promise.resolve({ success: true, timestamp: Date.now() });
    },

    async getConfig() {
      console.debug('[LOFClient] getConfig (stubbed)');
      return Promise.resolve({ success: true, timestamp: Date.now() });
    },
  };

  // ------------------------------
  // Export into global namespace for other layers
  // ------------------------------
  window.LOF_API = {
    RFClient,
    FPPClient,
    LOFClient,
  };

  window.RFClient = RFClient;
  window.FPPClient = FPPClient;
  window.LOFClient = LOFClient;
})(window);