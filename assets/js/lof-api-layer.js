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

    _normalizeRequestResponse(json) {
      if (!json) {
        return this._error('RF_REQUEST_ERROR', 'Empty response from RF');
      }

      if (json.success === false) {
        return this._error('RF_REQUEST_ERROR', json.message || 'Request failed');
      }

      return {
        success: true,
        timestamp: Date.now(),
        data: json.data || json,
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
  // FPPClient – talks to FPP (via your own WP proxy)
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
      // raw is whatever /api/fppd/status returns under data
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
  // LOFClient – Lights on Falcon plugin endpoints
  // NEW: For telemetry, speaker control, config
  // ------------------------------
  const LOFClient = {
    _baseURL: window.LOF_CONFIG?.lofBaseUrl || '/wp-json/lof/v1',

    /**
     * Log telemetry event
     * POST /wp-json/lof/v1/telemetry
     */
    async logTelemetry(data) {
      // Stub for now - implement when backend endpoint is ready
      console.debug('[LOFClient] logTelemetry (stubbed):', data);
      
      // When ready, uncomment:
      /*
      const url = `${this._baseURL}/telemetry`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        return { success: true, timestamp: Date.now() };
      } catch (err) {
        console.error('[LOFClient] logTelemetry failed', err);
        return { success: false, error: err.message };
      }
      */
      
      return Promise.resolve({ success: true, timestamp: Date.now() });
    },

    /**
     * Toggle speaker on/off
     * POST /wp-json/lof/v1/speaker
     */
    async toggleSpeakerOn(enabled) {
      // Stub for now - implement when backend endpoint is ready
      console.debug('[LOFClient] toggleSpeakerOn (stubbed):', enabled);
      
      // When ready, uncomment:
      /*
      const url = `${this._baseURL}/speaker`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        const json = await res.json();
        return { success: true, data: json, timestamp: Date.now() };
      } catch (err) {
        console.error('[LOFClient] toggleSpeakerOn failed', err);
        return { success: false, error: err.message };
      }
      */
      
      return Promise.resolve({ success: true, timestamp: Date.now() });
    },

    /**
     * Get LOF configuration
     * GET /wp-json/lof/v1/config
     */
    async getConfig() {
      // Stub for now - implement when backend endpoint is ready
      console.debug('[LOFClient] getConfig (stubbed)');
      
      // When ready, uncomment:
      /*
      const url = `${this._baseURL}/config`;
      try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return { success: true, data: json, timestamp: Date.now() };
      } catch (err) {
        console.error('[LOFClient] getConfig failed', err);
        return { success: false, error: err.message };
      }
      */
      
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

  // ✅ Also expose globals for backwards compatibility
  window.RFClient = RFClient;
  window.FPPClient = FPPClient;
  window.LOFClient = LOFClient;
})(window);