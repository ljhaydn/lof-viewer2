/**
 * LOF Viewer V2 - API Layer
 * 
 * Responsibility: HTTP communication with WordPress REST endpoints
 * - Returns normalized, predictable data structures
 * - No DOM manipulation
 * - No state management
 * - No business logic
 * 
 * All methods return: { success, timestamp, data, error, errorCode }
 */

const LOFClient = {
  
  // ========================================================================
  // SPEAKER METHODS
  // ========================================================================
  
  /**
   * Get current speaker status
   * @returns {Promise<Object>} Normalized response
   */
  async getSpeakerStatus() {
    const url = '/wp-json/lof-viewer/v1/speaker';
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      return {
        success: response.ok && data.success,
        timestamp: Date.now(),
        data: data.data || null,
        error: data.error || null,
        errorCode: data.errorCode || null
      };
      
    } catch (err) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: err.message || 'Network error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  },
  
  /**
   * Enable or extend speaker session
   * @param {boolean} isExtension - Is this an extension request?
   * @returns {Promise<Object>} Normalized response
   */
  async enableSpeaker(isExtension = false) {
    const url = '/wp-json/lof-viewer/v1/speaker';
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'viewer',
          extension: isExtension
        })
      });
      
      const data = await response.json();
      
      return {
        success: response.ok && data.success,
        timestamp: Date.now(),
        data: data.data || null,
        error: data.error || null,
        errorCode: data.errorCode || null
      };
      
    } catch (err) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: err.message || 'Network error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  },
  
  // ========================================================================
  // REMOTE FALCON METHODS
  // ========================================================================
  
  /**
   * Get RF show details
   * Returns normalized show state including sequences, queue, preferences
   * @returns {Promise<Object>} Normalized response
   */
  async getShowDetails() {
    const url = '/wp-json/lof-viewer/v1/show';
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      return {
        success: response.ok && data.success,
        timestamp: Date.now(),
        data: data.data || null,
        error: data.error || null,
        errorCode: data.errorCode || null
      };
      
    } catch (err) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: err.message || 'Network error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  },
  
  /**
   * Request a song (JUKEBOX mode)
   * @param {string} sequenceId - The sequence name/ID to request
   * @param {string} visitorId - Optional visitor ID for tracking
   * @returns {Promise<Object>} Normalized response
   */
  async requestSong(sequenceId, visitorId = null) {
    const url = '/wp-json/lof-viewer/v1/request';
    
    try {
      const payload = {
        song_id: sequenceId
      };
      
      if (visitorId) {
        payload.visitor_id = visitorId;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      return {
        success: response.ok && data.success,
        timestamp: Date.now(),
        data: data.data || null,
        error: data.error || null,
        errorCode: data.errorCode || null
      };
      
    } catch (err) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: err.message || 'Network error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  },
  
  /**
   * Vote for a song (VOTING mode)
   * @param {string} sequenceId - The sequence name/ID to vote for
   * @param {string} visitorId - Optional visitor ID for tracking
   * @returns {Promise<Object>} Normalized response
   */
  async voteSong(sequenceId, visitorId = null) {
    const url = '/wp-json/lof-viewer/v1/vote';
    
    try {
      const payload = {
        song_id: sequenceId
      };
      
      if (visitorId) {
        payload.visitor_id = visitorId;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      return {
        success: response.ok && data.success,
        timestamp: Date.now(),
        data: data.data || null,
        error: data.error || null,
        errorCode: data.errorCode || null
      };
      
    } catch (err) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: err.message || 'Network error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  },
  
  // ========================================================================
  // FPP METHODS
  // ========================================================================
  
  /**
   * Get FPP status
   * Returns normalized FPP playback state
   * @returns {Promise<Object>} Normalized response
   */
  async getFPPStatus() {
    const url = '/wp-json/lof-viewer/v1/fpp/status';
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      return {
        success: response.ok && data.success,
        timestamp: Date.now(),
        data: data.data || null,
        error: data.error || null,
        errorCode: data.errorCode || null
      };
      
    } catch (err) {
      return {
        success: false,
        timestamp: Date.now(),
        data: null,
        error: err.message || 'Network error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  },
  
  // ========================================================================
  // UTILITY METHODS (STUBBED)
  // ========================================================================
  
  /**
   * Log telemetry data
   * @param {Object} data - Telemetry data to log
   * @returns {Promise<Object>} Normalized response
   */
  async logTelemetry(data) {
    console.debug('[LOFClient] logTelemetry (stubbed):', data);
    return {
      success: true,
      timestamp: Date.now(),
      data: null,
      error: null,
      errorCode: null
    };
  }
};

// Export for module systems or global window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LOFClient;
} else {
  window.LOFClient = LOFClient;
}
