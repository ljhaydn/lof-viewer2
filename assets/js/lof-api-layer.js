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
     * @param {string} songId    Remote Falcon sequence name (e.g. "GhostbustersThemeFallOutBoy101825")
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

    _normalizeShowDetails(raw) {
      const sequences = Array.isArray(raw.sequences) ? raw.sequences : [];

      const findSeqByName = (name) =>
        !name ? null : sequences.find((s) => s && s.name === name) || null;

      const nowSeq = findSeqByName(raw.playingNow);

      const nextName =
        raw.playingNext && raw.playingNext !== ''
          ? raw.playingNext
          : raw.playingNextFromSchedule || '';
      const nextSeq = findSeqByName(nextName);

      const toSong = (seq) =>
        !seq
          ? null
          : {
              songId: seq.name,
              title: seq.displayName || seq.name || 'Untitled',
              artist: seq.artist || null,
              duration: seq.duration || 0,
              elapsedSeconds: 0,
              category: seq.category || 'general',
              visible: seq.visible !== false,
              active: seq.active !== false,
            };

      const nowPlaying = toSong(nowSeq);
      const upNext = toSong(nextSeq);

      const queue = (Array.isArray(raw.requests) ? raw.requests : []).map((req, index) => ({
        songId:
          req.sequenceName || req.sequence || req.sequenceId || req.name || null,
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
      }));

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
