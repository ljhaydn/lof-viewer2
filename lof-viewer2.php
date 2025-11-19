<?php
/**
 * Plugin Name: Lights on Falcon Viewer V2 - Complete (RF + Speaker)
 * Description: Complete V2 viewer with RF integration and Speaker Control
 * Version:     2.0.1
 * Author:      Lights on Falcon
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once plugin_dir_path(__FILE__) . 'includes/class-lof-viewer2-rest.php';

add_action('plugins_loaded', 'lof_viewer2_init');
function lof_viewer2_init() {
    LOF_Viewer2_REST::init();
}

add_action('wp_enqueue_scripts', 'lof_viewer2_enqueue_assets');
function lof_viewer2_enqueue_assets() {
    if (!is_singular()) return;
    
    global $post;
    if (!has_shortcode($post->post_content, 'lof_viewer_v2')) return;
    
    $plugin_url = plugin_dir_url(__FILE__);
    $version = '2.0.1';
    
    wp_enqueue_script('lof-viewer2-api', $plugin_url . 'assets/js/lof-api-layer.js', array(), $version, true);
    wp_enqueue_script('lof-viewer2-state', $plugin_url . 'assets/js/lof-state-layer.js', array('lof-viewer2-api'), $version, true);
    wp_enqueue_script('lof-viewer2-theme', $plugin_url . 'assets/js/lof-theme-layer.js', array('lof-viewer2-state'), $version, true);
    wp_enqueue_script('lof-viewer2-content', $plugin_url . 'assets/js/lof-content-layer.js', array('lof-viewer2-theme'), $version, true);
    wp_enqueue_script('lof-viewer2-view', $plugin_url . 'assets/js/lof-view-layer.js', array('lof-viewer2-content'), $version, true);
    wp_enqueue_script('lof-viewer2-interaction', $plugin_url . 'assets/js/lof-interaction-layer.js', array('lof-viewer2-view'), $version, true);
    wp_enqueue_script('lof-viewer2-init', $plugin_url . 'assets/js/lof-init.js', array('lof-viewer2-interaction'), $version, true);
    wp_enqueue_style('lof-viewer2-style', $plugin_url . 'assets/css/lof-viewer-v2-complete.css', array(), $version);
    
    $config = array(
        'rfProxyBaseUrl' => untrailingslashit(rest_url('lof-viewer/v1')),
        'fppBaseUrl' => untrailingslashit(rest_url('lof-viewer/v1/fpp')),
        'theme' => 'neutral',
        'polling' => array('intervalMs' => 5000, 'maxBackoffMs' => 30000, 'rfDebounceMs' => 500, 'fppDebounceMs' => 500, 'connectionTimeout' => 10000),
        'features' => array('requestsEnabled' => true, 'votingEnabled' => true, 'speakerControlEnabled' => true, 'surpriseMeEnabled' => true, 'fmRadioEnabled' => true, 'streamEnabled' => true, 'proximityHintsEnabled' => true, 'physicalButtonEnabled' => true),
        'speaker' => array('durationSeconds' => 300, 'maxSessionSeconds' => 900, 'extensionWindowSeconds' => 30, 'countdownTickMs' => 1000)
    );
    
    wp_add_inline_script('lof-viewer2-init', 'window.LOF_CONFIG = ' . wp_json_encode($config) . ';', 'before');
}

add_shortcode('lof_viewer_v2', 'lof_viewer2_shortcode');
function lof_viewer2_shortcode() {
    ob_start();
    ?>
    <div id="lof-viewer-v2-root" class="lof-viewer lof-state--loading">
        <section class="lof-status" data-lof="status-panel">
            <div class="lof-status-indicator-wrapper">
                <span class="lof-state-indicator" data-lof="state-indicator"></span>
            </div>
            <div class="lof-status-copy">
                <div class="lof-status-headline" data-lof="status-text">Connecting...</div>
                <div class="lof-status-warning" data-lof="connection-warning" style="display:none;"></div>
            </div>
        </section>
        
        <section class="lof-now-next">
            <div class="lof-now">
                <h2 class="lof-section-title">Now Playing</h2>
                <div class="lof-track">
                    <div class="lof-track-title" data-lof="now-title">Intermission</div>
                    <div class="lof-track-artist" data-lof="now-artist"></div>
                </div>
            </div>
            <div class="lof-next">
                <h3 class="lof-section-subtitle">Up Next</h3>
                <div class="lof-track">
                    <div class="lof-track-title" data-lof="next-title">Loading...</div>
                    <div class="lof-track-artist" data-lof="next-artist"></div>
                </div>
            </div>
        </section>
        
        <section class="lof-grid-section">
            <h2 class="lof-section-title">Request a Song</h2>
            <div class="lof-grid" data-lof="song-grid"></div>
        </section>
        
        <section class="lof-queue-section" data-lof="queue" style="display:none;">
            <h3 class="lof-section-subtitle">Queue</h3>
            <ul class="lof-queue-list" data-lof="queue-list"></ul>
        </section>
        
        <div id="lof-speaker-card" class="lof-speaker-card" style="display:none;">
            <div class="speaker-card-inner">
                <div class="speaker-header"><h2 id="speaker-title" class="speaker-title">Need Sound?</h2></div>
                <div class="speaker-status-section">
                    <p id="speaker-status" class="speaker-status-text"></p>
                    <p id="speaker-message" class="speaker-helper-text"></p>
                </div>
                <div id="speaker-countdown" class="speaker-countdown" style="display:none;">
                    <div class="countdown-display">
                        <span id="countdown-value" class="countdown-value">5:00</span>
                        <span class="countdown-label">remaining</span>
                    </div>
                </div>
                <div class="speaker-actions">
                    <button id="speaker-primary-btn" class="lof-btn lof-btn-primary">Turn On</button>
                </div>
                <div class="speaker-alternatives">
                    <p class="alternatives-label">Can't hear outside?</p>
                    <div class="alternatives-buttons">
                        <button id="fm-info-btn" class="lof-btn lof-btn-text">📻 FM Radio</button>
                        <button id="stream-btn" class="lof-btn lof-btn-text">🎵 Stream</button>
                    </div>
                </div>
                <div id="speaker-hint" class="speaker-hint-container" style="display:none;"></div>
            </div>
        </div>
        
        <div id="fm-modal" class="lof-modal" style="display:none;">
            <div class="lof-modal-overlay" id="fm-modal-overlay"></div>
            <div class="lof-modal-content">
                <div class="lof-modal-header">
                    <h3>📻 FM Radio</h3>
                    <button class="lof-modal-close" id="fm-modal-close">×</button>
                </div>
                <div class="lof-modal-body">
                    <div class="fm-display">
                        <div class="fm-frequency" id="fm-frequency">107.7</div>
                        <div class="fm-label">FM</div>
                    </div>
                    <p class="fm-instructions">Tune to <strong id="fm-frequency-text">107.7 FM</strong></p>
                </div>
            </div>
        </div>
        
        <div id="stream-modal" class="lof-modal" style="display:none;">
            <div class="lof-modal-overlay" id="stream-modal-overlay"></div>
            <div class="lof-modal-content lof-modal-content--wide">
                <div class="lof-modal-header">
                    <h3>🎵 Live Stream</h3>
                    <button class="lof-modal-close" id="stream-modal-close">×</button>
                </div>
                <div class="lof-modal-body">
                    <button id="stream-start-btn" class="lof-btn lof-btn-primary">▶ Start</button>
                    <div id="stream-container" style="display:none;"></div>
                </div>
            </div>
        </div>
        
        <div data-lof="messages" class="lof-messages"></div>
    </div>
    <?php
    return ob_get_clean();
}
