(function (window) {
  'use strict';

  const RFClient = {
    _baseURL: window.LOF_CONFIG?.rfProxyBaseUrl || '/wp-json/lof-viewer/v1',

    async getShowDetails() {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'RF proxy URL not configured');
      }

      const url = `${this._baseURL}/show`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          return this._error('HTTP_ERROR', `RF proxy returned ${res.status}`);
        }

        const json = await res.json().catch(() => null);

        if (!json || json.success === false) {
          const msg = json?.message || 'Remote Falcon returned an error';
          return this._error('RF_ADAPTER_ERROR', msg);
        }

        const raw = json.data ?? json;
        const normalized = this._normalizeShowDetails(raw);

        return normalized;
      } catch (err) {
        return this._error('NETWORK_ERROR', err.message || String(err));
      }
    },

    async requestSong(songId, visitorId) {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'RF proxy URL not configured');
      }

      const url = `${this._baseURL}/request`;
      const payload = { song_id: songId };
      if (visitorId) {
        payload.visitor_id = visitorId;
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => null);
        return this._normalizeRequestResponse(json);
      } catch (err) {
        return this._error('NETWORK_ERROR', err.message || String(err));
      }
    },

    async voteSong(songId, visitorId) {
      if (!this._baseURL) {
        return this._error('CONFIG_ERROR', 'RF proxy URL not configured');
      }

      const url = `${this._baseURL}/vote`;
      const payload = { song_id: songId };
      if (visitorId) {
        payload.visitor_id = visitorId;
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => null);
        return this._normalizeRequestResponse(json);
      } catch (err) {
        return this._error('NETWORK_ERROR', err.message || String(err));
      }
    },

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

      const rawRequests = Array.isArray(raw.requests) ? raw.requests : [];

      const queue = rawRequests.map((req, index) => {
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

      const nowSeq = findSeqByName(raw.playingNow);
      const nowPlaying = toSong(nowSeq);

      let upNext = null;
      const playingNextRaw = raw.playingNext || '';
      let nextSeq = findSeqByName(playingNextRaw);

      if (!nextSeq && rawRequests.length > 0 && rawRequests[0].sequence) {
        nextSeq = rawRequests[0].sequence;
      }

      upNext = toSong(nextSeq);

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
          currentSongAudio: d.current_song || null,
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

  const LOFClient = {
    _baseURL: '/wp-json/lof-viewer/v1',

    async getSpeakerStatus() {
      const url = `${this._baseURL}/speaker`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        return {
          success: response.ok && data.success,
          timestamp: Date.now(),
          data: data.data || null,
          error: data.error || null,
          errorCode: data.errorCode || null,
        };
      } catch (err) {
        return {
          success: false,
          timestamp: Date.now(),
          data: null,
          error: err.message || 'Network error',
          errorCode: 'NETWORK_ERROR',
        };
      }
    },

    async enableSpeaker(isExtension = false, proximityConfirmed = false) {
      const url = `${this._baseURL}/speaker`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'viewer',
            extension: isExtension,
            proximity_confirmed: proximityConfirmed,
          }),
        });

        const data = await response.json();

        return {
          success: response.ok && data.success,
          timestamp: Date.now(),
          data: data.data || null,
          error: data.error || null,
          errorCode: data.errorCode || null,
        };
      } catch (err) {
        return {
          success: false,
          timestamp: Date.now(),
          data: null,
          error: err.message || 'Network error',
          errorCode: 'NETWORK_ERROR',
        };
      }
    },

    async logTelemetry(data) {
      return Promise.resolve({ success: true, timestamp: Date.now() });
    },
  };

  window.LOF_API = { RFClient, FPPClient, LOFClient };
  window.RFClient = RFClient;
  window.FPPClient = FPPClient;
  window.LOFClient = LOFClient;
})(window);