<?php
/**
 * Plugin Name: LOF Viewer V2
 * Description: Lights on Falcon viewer with speaker control
 * Version: 0.2.0
 * Author: Lights on Falcon
 */

if (!defined('ABSPATH')) {
    exit;
}

define('LOF_VIEWER_V2_VERSION', '0.2.0');
define('LOF_VIEWER_V2_PATH', plugin_dir_path(__FILE__));
define('LOF_VIEWER_V2_URL', plugin_dir_url(__FILE__));

// Load REST API handler
require_once LOF_VIEWER_V2_PATH . 'includes/class-lof-viewer2-rest.php';

// Initialize REST routes
add_action('plugins_loaded', function() {
    LOF_Viewer2_REST::init();
});

// Enqueue scripts and styles
add_action('wp_enqueue_scripts', 'lof_viewer_v2_enqueue_assets');

function lof_viewer_v2_enqueue_assets() {
    if (!is_singular() && !is_page()) {
        return;
    }
    
    global $post;
    if (!$post || !has_shortcode($post->post_content, 'lof_viewer_v2')) {
        return;
    }
    
    // CSS
    wp_enqueue_style(
        'lof-viewer-v2',
        LOF_VIEWER_V2_URL . 'assets/css/lof-base.css',
        array(),
        LOF_VIEWER_V2_VERSION
    );
    
    // Core layers (order matters)
    wp_enqueue_script(
        'lof-api-layer',
        LOF_VIEWER_V2_URL . 'assets/js/lof-api-layer.js',
        array(),
        LOF_VIEWER_V2_VERSION,
        true
    );
    
    wp_enqueue_script(
        'lof-state-layer',
        LOF_VIEWER_V2_URL . 'assets/js/lof-state-layer.js',
        array('lof-api-layer'),
        LOF_VIEWER_V2_VERSION,
        true
    );
    
    wp_enqueue_script(
        'lof-theme-layer',
        LOF_VIEWER_V2_URL . 'assets/js/lof-theme-layer.js',
        array('lof-state-layer'),
        LOF_VIEWER_V2_VERSION,
        true
    );
    
    wp_enqueue_script(
        'lof-content-layer',
        LOF_VIEWER_V2_URL . 'assets/js/lof-content-layer.js',
        array('lof-theme-layer'),
        LOF_VIEWER_V2_VERSION,
        true
    );
    
    wp_enqueue_script(
        'lof-view-layer',
        LOF_VIEWER_V2_URL . 'assets/js/lof-view-layer.js',
        array('lof-content-layer'),
        LOF_VIEWER_V2_VERSION,
        true
    );
    
    wp_enqueue_script(
        'lof-interaction-layer',
        LOF_VIEWER_V2_URL . 'assets/js/lof-interaction-layer.js',
        array('lof-view-layer'),
        LOF_VIEWER_V2_VERSION,
        true
    );
    
    wp_enqueue_script(
        'lof-init',
        LOF_VIEWER_V2_URL . 'assets/js/lof-init.js',
        array('lof-interaction-layer'),
        LOF_VIEWER_V2_VERSION,
        true
    );
    
    // Pass config to JS
    $config = array(
        'restBase' => rest_url('lof-viewer/v1'),
        'nonce' => wp_create_nonce('wp_rest'),
        'features' => array(
            'requestsEnabled' => true,
            'surpriseMeEnabled' => true,
            'speakerControlEnabled' => true,
        ),
        'theme' => 'christmas',
        'debug' => defined('WP_DEBUG') && WP_DEBUG,
    );
    
    wp_localize_script('lof-init', 'LOF_CONFIG', $config);
}

// Main shortcode
add_shortcode('lof_viewer_v2', 'lof_viewer_v2_shortcode');

function lof_viewer_v2_shortcode($atts) {
    $atts = shortcode_atts(array(
        'theme' => 'christmas',
    ), $atts);
    
    ob_start();
    ?>
    <div id="lof-viewer-root" class="lof-viewer lof-theme--<?php echo esc_attr($atts['theme']); ?>">
        
        <!-- Status Bar -->
        <div id="lof-status-bar" class="lof-status-bar">
            <div class="lof-status-indicator" id="lof-status-indicator">
                <span class="lof-status-text" id="lof-status-text">Connecting...</span>
            </div>
        </div>
        
        <!-- Toast Container -->
        <div id="lof-toast-container" class="lof-toast-container"></div>
        
        <!-- Main Content -->
        <div class="lof-content">
            
            <!-- Now Playing / Up Next -->
            <div class="lof-section lof-section--now-playing">
                <div id="lof-now-playing-card" class="lof-card lof-card--now-playing">
                    <h2 class="lof-card-title">Now Playing</h2>
                    <div id="lof-now-playing-content" class="lof-now-playing-content">
                        <div class="lof-skeleton"></div>
                    </div>
                </div>
                
                <div id="lof-up-next-card" class="lof-card lof-card--up-next">
                    <h3 class="lof-card-title">Up Next</h3>
                    <div id="lof-up-next-content" class="lof-up-next-content">
                        <div class="lof-skeleton"></div>
                    </div>
                </div>
            </div>
            
            <!-- Speaker Control Card -->
            <div id="lof-speaker-section" class="lof-section lof-section--speaker">
                <div class="lof-card lof-card--speaker">
                    <div class="lof-speaker-header">
                        <h3 class="lof-card-title">🔊 Outdoor Speakers</h3>
                    </div>
                    
                    <div id="lof-speaker-content" class="lof-speaker-content">
                        
                        <!-- Status Text -->
                        <div id="lof-speaker-status" class="lof-speaker-status">
                            <p id="lof-speaker-status-text">Loading speaker status...</p>
                        </div>
                        
                        <!-- Countdown -->
                        <div id="lof-speaker-countdown-wrapper" class="lof-speaker-countdown-wrapper" style="display: none;">
                            <div id="lof-speaker-countdown" class="lof-speaker-countdown">
                                <span id="lof-speaker-countdown-value">5:00</span>
                                <span class="lof-speaker-countdown-label">remaining</span>
                            </div>
                        </div>
                        
                        <!-- Primary Button -->
                        <button 
                            id="speaker-primary-btn" 
                            class="lof-btn lof-btn--primary lof-btn--speaker"
                            aria-label="Speaker control">
                            🔊 Turn On Speakers
                        </button>
                        
                        <!-- Helper Text -->
                        <p id="lof-speaker-helper" class="lof-speaker-helper"></p>
                        
                        <!-- Alternatives (FM/Stream) -->
                        <div id="lof-speaker-alternatives" class="lof-speaker-alternatives">
                            <div class="lof-alternatives-title">Listen another way:</div>
                            <div class="lof-alternatives-buttons">
                                <button id="fm-info-btn" class="lof-btn lof-btn--secondary lof-btn--small">
                                    📻 FM <span id="fm-frequency">107.7</span>
                                </button>
                                <button id="stream-btn" class="lof-btn lof-btn--secondary lof-btn--small">
                                    🌐 Audio Stream
                                </button>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>
            
            <!-- Queue -->
            <div id="lof-queue-section" class="lof-section lof-section--queue" style="display: none;">
                <div class="lof-card lof-card--queue">
                    <h3 class="lof-card-title" id="lof-queue-title">Request Queue</h3>
                    <div id="lof-queue-list" class="lof-queue-list">
                        <!-- Queue items render here -->
                    </div>
                </div>
            </div>
            
            <!-- Surprise Me -->
            <div id="lof-surprise-section" class="lof-section lof-section--surprise">
                <button 
                    id="surprise-me-btn" 
                    data-lof="surprise-me"
                    class="lof-btn lof-btn--accent lof-btn--large lof-btn--surprise">
                    🎁 Surprise Me!
                </button>
            </div>
            
            <!-- Song Grid -->
            <div id="lof-grid-section" class="lof-section lof-section--grid">
                <h2 class="lof-section-title">Pick a song</h2>
                <div id="lof-song-grid" class="lof-song-grid">
                    <!-- Song tiles render here -->
                    <div class="lof-skeleton lof-skeleton--tile"></div>
                    <div class="lof-skeleton lof-skeleton--tile"></div>
                    <div class="lof-skeleton lof-skeleton--tile"></div>
                </div>
            </div>
            
        </div>
        
        <!-- Stream Player (Mini) -->
        <div id="stream-mini-player" class="lof-stream-player" style="display: none;">
            <div class="lof-stream-header">
                <span class="lof-stream-title">🌐 Audio Stream</span>
                <div class="lof-stream-controls">
                    <button id="stream-minimize-btn" class="lof-btn-icon" aria-label="Minimize">−</button>
                    <button id="stream-close-btn" class="lof-btn-icon" aria-label="Close">×</button>
                </div>
            </div>
            <div class="lof-stream-content">
                <div id="stream-placeholder" class="lof-stream-placeholder">
                    <p>Press play to start streaming</p>
                    <button id="stream-start-btn" class="lof-btn lof-btn--primary">▶ Start Audio</button>
                </div>
                <div id="stream-iframe-wrapper" class="lof-stream-iframe-wrapper" style="display: none;">
                    <!-- Iframe loads here -->
                </div>
            </div>
        </div>
        
    </div>
    <?php
    return ob_get_clean();
}

// Admin notice if no config
add_action('admin_notices', 'lof_viewer_v2_admin_notice');

function lof_viewer_v2_admin_notice() {
    $rf_base = get_option('lof_viewer_rf_api_base', '');
    $rf_token = get_option('lof_viewer_rf_bearer_token', '');
    
    if (empty($rf_base) || empty($rf_token)) {
        ?>
        <div class="notice notice-warning">
            <p>
                <strong>LOF Viewer V2:</strong> 
                Remote Falcon API not configured. 
                Please set <code>lof_viewer_rf_api_base</code> and <code>lof_viewer_rf_bearer_token</code> options.
            </p>
        </div>
        <?php
    }
}