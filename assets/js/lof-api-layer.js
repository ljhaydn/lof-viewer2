// assets/js/lof-api-layer.js
(function (window) {
  'use strict';

  // ------------------------------
  // RFClient – talks to WP REST proxy (JWT lives in PHP)
  // ------------------------------
  const RFClient = {
    // point this at your WP REST proxy, not Remote Falcon directly
    _baseURL: window.LOF_CONFIG?.rfProxyBaseUrl || '/wp-json/lof-viewer/v1',

    async getShowDetails() {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'RF proxy URL not configured');
      }

      const url = `${this._baseURL}/show?t=${Date.now()}`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const raw = await res.json();
        return this._normalizeShowDetails(raw);
      } catch (err) {
        console.error('[RFClient] getShowDetails failed', err);
        return this._error('NETWORK_ERROR', err.message);
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
      return {
        success: true,
        timestamp: Date.now(),
        data: {
          nowPlaying: raw.now_playing
            ? {
                songId: raw.now_playing.id,
                title: raw.now_playing.title,
                artist: raw.now_playing.artist,
                duration: raw.now_playing.duration_seconds || 0,
                elapsedSeconds: raw.now_playing.elapsed || 0,
                category: raw.now_playing.category || 'general',
              }
            : null,
          upNext: raw.up_next
            ? {
                songId: raw.up_next.id,
                title: raw.up_next.title,
                artist: raw.up_next.artist,
                category: raw.up_next.category || 'general',
              }
            : null,
          queue: (raw.queue || []).map((q, index) => ({
            songId: q.id,
            title: q.title,
            requestedBy: q.visitor_name || 'Anonymous',
            position: q.position ?? index + 1,
          })),
          availableSongs: (raw.available_songs || []).map((s) => ({
            songId: s.id,
            title: s.title,
            artist: s.artist,
            duration: s.duration_seconds || 0,
            category: s.category || 'general',
            isAvailable: s.available !== false,
            cooldownUntil: s.cooldown_until || null,
          })),
          showStatus: this._normalizeStatus(raw.show_status),
          requestsEnabled: raw.requests_enabled !== false,
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

      const url = `${this._baseURL}/fppjson.php?command=getStatus`;
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
