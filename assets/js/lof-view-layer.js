/**
 * LOF Viewer V2 - View Layer
 * 
 * Responsibility: DOM manipulation ONLY
 * - Reads from State, Theme, and Content layers
 * - Updates UI based on flags and content
 * - No business logic
 * - No API calls
 * - No state management
 */

const ViewLayer = (() => {
  
  /**
   * Render complete speaker card
   */
  function renderSpeakerCard(state, flags, content) {
    const container = document.getElementById('lof-speaker-card');
    if (!container) {
      console.warn('[ViewLayer] Speaker card container not found');
      return;
    }
    
    // Show/hide entire card
    if (!flags.speaker.showSpeakerButton) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    container.className = flags.speaker.speakerCardClass;
    
    // Update title
    const titleEl = container.querySelector('#speaker-title');
    if (titleEl) {
      titleEl.textContent = content.cardTitle;
    }
    
    // Update status message
    const statusEl = container.querySelector('#speaker-status');
    if (statusEl) {
      statusEl.textContent = content.statusMessage;
    }
    
    // Update helper text
    const helperEl = container.querySelector('#speaker-message');
    if (helperEl) {
      helperEl.textContent = content.helperText;
    }
    
    // Update countdown
    const countdownEl = container.querySelector('#speaker-countdown');
    if (countdownEl) {
      if (flags.speaker.showCountdown) {
        countdownEl.style.display = 'block';
        const valueEl = countdownEl.querySelector('#countdown-value');
        if (valueEl) {
          valueEl.textContent = flags.speaker.countdownValue;
        }
        countdownEl.className = `speaker-countdown ${flags.speaker.countdownClass}`;
      } else {
        countdownEl.style.display = 'none';
      }
    }
    
    // Update primary button
    const primaryBtn = container.querySelector('#speaker-primary-btn');
    if (primaryBtn) {
      primaryBtn.textContent = content.primaryButtonLabel;
      primaryBtn.className = flags.speaker.primaryButtonClass;
      primaryBtn.disabled = !flags.speaker.canClickPrimaryButton;
    }
    
    // Update alternatives
    const fmBtn = container.querySelector('#fm-info-btn');
    if (fmBtn) {
      fmBtn.textContent = content.alternatives.fmLabel;
      if (flags.speaker.emphasizeAlternatives) {
        fmBtn.classList.add('lof-btn-text--emphasized');
      } else {
        fmBtn.classList.remove('lof-btn-text--emphasized');
      }
    }
    
    const streamBtn = container.querySelector('#stream-btn');
    if (streamBtn) {
      streamBtn.textContent = content.alternatives.streamLabel;
      if (flags.speaker.emphasizeAlternatives) {
        streamBtn.classList.add('lof-btn-text--emphasized');
      } else {
        streamBtn.classList.remove('lof-btn-text--emphasized');
      }
    }
    
    // Update proximity hint
    const hintEl = container.querySelector('#speaker-hint');
    if (hintEl) {
      if (content.proximityHint && content.proximityHint.show && flags.speaker.showProximityHint) {
        hintEl.style.display = 'block';
        hintEl.innerHTML = `
          <p class="proximity-hint proximity-hint--${content.proximityHint.emphasis}">
            ${content.proximityHint.message}
          </p>
          ${content.proximityHint.alternative ? `
            <p class="proximity-hint-alt">${content.proximityHint.alternative}</p>
          ` : ''}
        `;
      } else {
        hintEl.style.display = 'none';
      }
    }
  }
  
  /**
   * Show stream modal
   */
  function showStreamModal(streamUrl) {
    const modal = document.getElementById('stream-modal');
    if (!modal) {
      console.warn('[ViewLayer] Stream modal not found');
      return;
    }
    
    modal.style.display = 'flex';
    
    // Reset stream container
    const container = modal.querySelector('#stream-container');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = ''; // Clear any previous iframe
    }
    
    // Store URL for when user clicks "Start Stream"
    modal.dataset.streamUrl = streamUrl;
  }
  
  /**
   * Load stream iframe (after user confirms)
   */
  function loadStreamIframe() {
    const modal = document.getElementById('stream-modal');
    if (!modal) return;
    
    const streamUrl = modal.dataset.streamUrl;
    if (!streamUrl) {
      console.warn('[ViewLayer] No stream URL available');
      return;
    }
    
    const container = modal.querySelector('#stream-container');
    const startBtn = modal.querySelector('#stream-start-btn');
    
    if (!container) return;
    
    // Hide start button, show iframe container
    if (startBtn) {
      startBtn.style.display = 'none';
    }
    
    container.style.display = 'block';
    container.innerHTML = `
      <iframe 
        src="${streamUrl}"
        width="100%"
        height="400"
        frameborder="0"
        allow="autoplay"
        class="lof-stream-iframe">
      </iframe>
    `;
  }
  
  /**
   * Hide stream modal
   */
  function hideStreamModal() {
    const modal = document.getElementById('stream-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
    
    // Stop stream by removing iframe
    const container = modal.querySelector('#stream-container');
    if (container) {
      container.innerHTML = '';
    }
    
    // Reset start button
    const startBtn = modal.querySelector('#stream-start-btn');
    if (startBtn) {
      startBtn.style.display = 'block';
    }
  }
  
  /**
   * Show success toast
   */
  function showSuccess(message) {
    _showToast(message, 'success');
  }
  
  /**
   * Show error toast
   */
  function showError(message) {
    _showToast(message, 'error');
  }
  
  /**
   * Show info toast
   */
  function showInfo(message) {
    _showToast(message, 'info');
  }
  
  /**
   * Generic toast implementation
   */
  function _showToast(message, type = 'info') {
    // Check if toast container exists
    let toastContainer = document.getElementById('lof-toast-container');
    
    if (!toastContainer) {
      // Create toast container if it doesn't exist
      toastContainer = document.createElement('div');
      toastContainer.id = 'lof-toast-container';
      toastContainer.className = 'lof-toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `lof-toast lof-toast--${type}`;
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.classList.add('lof-toast--show');
    }, 10);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.classList.remove('lof-toast--show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4000);
  }
  
  /**
   * Set button loading state
   */
  function setButtonLoading(buttonId, loading) {
    const button = document.getElementById(`${buttonId}-btn`);
    if (!button) return;
    
    if (loading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Loading...';
      button.classList.add('lof-btn--loading');
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
      button.classList.remove('lof-btn--loading');
    }
  }
  
  /**
   * Update entire UI (convenience method)
   */
  function updateUI(state) {
    const flags = ThemeLayer.mapStateToFlags(state);
    const content = ContentLayer.getSpeakerContent(state, flags);
    
    renderSpeakerCard(state, flags, content);
  }
  
  // Public API
  return {
    renderSpeakerCard,
    showStreamModal,
    loadStreamIframe,
    hideStreamModal,
    showSuccess,
    showError,
    showInfo,
    setButtonLoading,
    updateUI
  };
  
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ViewLayer;
} else {
  window.ViewLayer = ViewLayer;
}
