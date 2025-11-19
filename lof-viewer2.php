<?php
/**
 * Plugin Name: Lights on Falcon Viewer V2 - Speaker Edition
 * Description: Complete V2 microframework viewer with Remote Falcon, FPP, and Speaker Control integration
 * Version:     2.0.0
 * Author:      Lights on Falcon
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

// Load unified REST API class
require_once plugin_dir_path(__FILE__) . 'includes/class-lof-viewer2-rest.php';

// Initialize REST API
add_action('plugins_loaded', 'lof_viewer2_init');
function lof_viewer2_init() {
    LOF_Viewer2_REST::init();
}

/**
 * Enqueue all viewer assets and inject LOF_CONFIG
 */
add_action('wp_enqueue_scripts', 'lof_viewer2_enqueue_assets');
function lof_viewer2_enqueue_assets() {
    // Only load on pages with the shortcode
    if (!is_singular()) {
        return;
    }

    global $post;
    if (!has_shortcode($post->post_content, 'lof_viewer_v2')) {
        return;
    }

    $plugin_url = plugin_dir_url(__FILE__);
    $version = '2.0.0';

    // === JAVASCRIPT FILES (7 layers in order) ===
    
    // 1) API Layer
    wp_enqueue_script(
        'lof-viewer2-api',
        $plugin_url . 'assets/js/lof-api-layer.js',
        array(),
        $version,
        true
    );

    // 2) State Layer
    wp_enqueue_script(
        'lof-viewer2-state',
        $plugin_url . 'assets/js/lof-state-layer.js',
        array('lof-viewer2-api'),
        $version,
        true
    );

    // 3) Theme Layer
    wp_enqueue_script(
        'lof-viewer2-theme',
        $plugin_url . 'assets/js/lof-theme-layer.js',
        array('lof-viewer2-state'),
        $version,
        true
    );

    // 4) Content Layer
    wp_enqueue_script(
        'lof-viewer2-content',
        $plugin_url . 'assets/js/lof-content-layer.js',
        array('lof-viewer2-theme'),
        $version,
        true
    );

    // 5) View Layer
    wp_enqueue_script(
        'lof-viewer2-view',
        $plugin_url . 'assets/js/lof-view-layer.js',
        array('lof-viewer2-content'),
        $version,
        true
    );

    // 6) Interaction Layer
    wp_enqueue_script(
        'lof-viewer2-interaction',
        $plugin_url . 'assets/js/lof-interaction-layer.js',
        array('lof-viewer2-view'),
        $version,
        true
    );

    // 7) Init Layer
    wp_enqueue_script(
        'lof-viewer2-init',
        $plugin_url . 'assets/js/lof-init.js',
        array('lof-viewer2-interaction'),
        $version,
        true
    );

    // === CSS ===
    wp_enqueue_style(
        'lof-viewer2-style',
        $plugin_url . 'assets/css/lof-viewer-v2-complete.css',
        array(),
        $version
    );

    // === LOF_CONFIG INJECTION ===
    
    // Determine current theme mode (can be made dynamic via settings)
    $theme = 'neutral'; // Options: 'neutral', 'halloween', 'christmas'
    
    // Get WordPress REST API base URLs
    $rf_proxy_base = rest_url('lof-viewer/v1');
    $fpp_base = rest_url('lof-viewer/v1/fpp');

    $config = array(
        // === REST API ENDPOINTS ===
        'rfProxyBaseUrl' => untrailingslashit($rf_proxy_base),
        'fppBaseUrl' => untrailingslashit($fpp_base),
        
        // === THEME ===
        'theme' => $theme,
        
        // === POLLING CONFIGURATION ===
        'polling' => array(
            'intervalMs' => 5000,           // Poll every 5 seconds
            'maxBackoffMs' => 30000,        // Max backoff for errors
            'rfDebounceMs' => 500,          // Debounce RF requests
            'fppDebounceMs' => 500,         // Debounce FPP requests
            'connectionTimeout' => 10000    // Connection timeout
        ),
        
        // === FEATURE FLAGS ===
        'features' => array(
            'requestsEnabled' => true,          // RF Jukebox requests
            'votingEnabled' => true,            // RF Voting
            'speakerControlEnabled' => true,    // Speaker system
            'surpriseMeEnabled' => true,        // Surprise Me button
            'fmRadioEnabled' => true,           // FM radio modal
            'streamEnabled' => true,            // Audio stream
            'proximityHintsEnabled' => true,    // Proximity estimation
            'physicalButtonEnabled' => true,    // Physical button detection
            'sessionStatsEnabled' => true,      // Session statistics
            'weatherAwarenessEnabled' => false  // Weather integration (future)
        ),
        
        // === COPY/CONTENT (Optional overrides, ContentLayer has defaults) ===
        'copy' => array(),
        
        // === SPEAKER CONFIGURATION (From PHP options, exposed for client-side logic) ===
        'speaker' => array(
            'durationSeconds' => 300,           // 5 minute sessions
            'maxSessionSeconds' => 900,         // 15 minute failsafe
            'extensionWindowSeconds' => 30,     // Last 30s for extension
            'countdownTickMs' => 1000           // Client-side countdown tick rate
        )
    );

    // Inject config as inline script BEFORE init.js runs
    $inline = 'window.LOF_CONFIG = ' . wp_json_encode($config) . ';';
    wp_add_inline_script('lof-viewer2-init', $inline, 'before');
}

/**
 * Shortcode: [lof_viewer_v2]
 * Returns the viewer shell HTML
 */
add_shortcode('lof_viewer_v2', 'lof_viewer2_shortcode');
function lof_viewer2_shortcode($atts) {
    // Parse shortcode attributes
    $atts = shortcode_atts(array(
        'theme' => 'neutral', // 'neutral', 'halloween', 'christmas'
    ), $atts, 'lof_viewer_v2');

    // Start output buffer
    ob_start();
    ?>
    
    <!-- Lights on Falcon Viewer V2 -->
    <div id="lof-viewer-v2" class="lof-viewer" data-theme="<?php echo esc_attr($atts['theme']); ?>">
      
      <!-- Loading State -->
      <div id="lof-loading" class="lof-loading" style="display: flex;">
        <div class="loading-spinner"></div>
        <p>Loading viewer...</p>
      </div>
      
      <!-- Main Speaker Control Card -->
      <div id="lof-speaker-card" class="lof-speaker-card" style="display: none;">
        <div class="speaker-card-inner">
          
          <div class="speaker-header">
            <h2 id="speaker-title" class="speaker-title">Need Sound?</h2>
          </div>
          
          <div class="speaker-status-section">
            <p id="speaker-status" class="speaker-status-text"></p>
            <p id="speaker-message" class="speaker-helper-text"></p>
          </div>
          
          <div id="speaker-countdown" class="speaker-countdown" style="display: none;">
            <div class="countdown-display">
              <span id="countdown-value" class="countdown-value">5:00</span>
              <span class="countdown-label">remaining</span>
            </div>
          </div>
          
          <div class="speaker-actions">
            <button 
              id="speaker-primary-btn" 
              class="lof-btn lof-btn-primary speaker-btn-primary"
              aria-label="Control speaker">
              Turn On Speakers
            </button>
          </div>
          
          <div class="speaker-alternatives">
            <p class="alternatives-label">Can't hear outside?</p>
            <div class="alternatives-buttons">
              <button 
                id="fm-info-btn" 
                class="lof-btn lof-btn-text"
                aria-label="FM radio information">
                📻 FM Radio
              </button>
              <button 
                id="stream-btn" 
                class="lof-btn lof-btn-text"
                aria-label="Listen to stream">
                🎵 Live Stream
              </button>
            </div>
          </div>
          
          <div id="speaker-hint" class="speaker-hint-container" style="display: none;"></div>
          
        </div>
      </div>
      
      <!-- FM Radio Info Modal -->
      <div id="fm-modal" class="lof-modal" style="display: none;">
        <div class="lof-modal-overlay" id="fm-modal-overlay"></div>
        <div class="lof-modal-content">
          <div class="lof-modal-header">
            <h3>📻 FM Radio</h3>
            <button class="lof-modal-close" id="fm-modal-close" aria-label="Close modal">×</button>
          </div>
          <div class="lof-modal-body">
            <div class="fm-display">
              <div class="fm-frequency" id="fm-frequency">107.7</div>
              <div class="fm-label">FM</div>
            </div>
            <p class="fm-instructions">
              Tune your car or portable radio to <strong id="fm-frequency-text">107.7 FM</strong> 
              to listen to the show from anywhere nearby!
            </p>
            <p class="fm-note">
              <small>📍 Works within about 500 feet of the display</small>
            </p>
          </div>
        </div>
      </div>
      
      <!-- Stream Audio Modal -->
      <div id="stream-modal" class="lof-modal" style="display: none;">
        <div class="lof-modal-overlay" id="stream-modal-overlay"></div>
        <div class="lof-modal-content lof-modal-content--wide">
          <div class="lof-modal-header">
            <h3>🎵 Live Audio Stream</h3>
            <button class="lof-modal-close" id="stream-modal-close" aria-label="Close modal">×</button>
          </div>
          <div class="lof-modal-body">
            <div class="stream-warning">
              <p>
                <strong>🎧 Headphones recommended!</strong> 
                This stream has a slight delay (~5 seconds) compared to the lights.
              </p>
            </div>
            
            <button 
              id="stream-start-btn" 
              class="lof-btn lof-btn-primary stream-start-btn"
              aria-label="Start audio stream">
              ▶ Start Stream
            </button>
            
            <div id="stream-container" class="stream-iframe-container" style="display: none;"></div>
          </div>
        </div>
      </div>
      
      <!-- Toast Notifications -->
      <div id="lof-toast-container" class="lof-toast-container"></div>
      
      <div id="physical-button-toast" class="lof-toast lof-toast--special" style="display: none;">
        <div class="toast-content">
          <span class="toast-icon">👆</span>
          <span class="toast-message">Someone pressed the physical button!</span>
        </div>
      </div>
      
    </div>
    <!-- End Lights on Falcon Viewer V2 -->
    
    <?php
    return ob_get_clean();
}

/**
 * Admin settings page (placeholder for future enhancement)
 */
add_action('admin_menu', 'lof_viewer2_admin_menu');
function lof_viewer2_admin_menu() {
    add_options_page(
        'LOF Viewer V2 Settings',
        'LOF Viewer V2',
        'manage_options',
        'lof-viewer-v2',
        'lof_viewer2_settings_page'
    );
}

function lof_viewer2_settings_page() {
    ?>
    <div class="wrap">
        <h1>Lights on Falcon Viewer V2 Settings</h1>
        <p>Advanced settings and speaker configuration coming soon.</p>
        <p>Current endpoints are configured via class-lof-viewer2-rest.php options.</p>
    </div>
    <?php
}
