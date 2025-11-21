<?php
/**
 * Plugin Name: Lights on Falcon Viewer v2
 * Description: New microframework-based viewer for Lights on Falcon, integrating Remote Falcon + FPP + Speaker via WP REST.
 * Version:     0.2.0
 * Author:      Lights on Falcon
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once plugin_dir_path( __FILE__ ) . 'includes/class-lof-viewer2-rest.php';

add_action( 'plugins_loaded', 'lof_viewer2_init' );
function lof_viewer2_init() {
    LOF_Viewer2_REST::init();
}

function lof_viewer2_enqueue_assets() {
    if ( ! is_singular() ) {
        return;
    }

    global $post;

    if ( ! has_shortcode( $post->post_content, 'lof_viewer_v2' ) ) {
        return;
    }

    $plugin_url = plugin_dir_url( __FILE__ );

    wp_enqueue_script( 'lof-viewer2-api', $plugin_url . 'assets/js/lof-api-layer.js', array(), '0.2.0', true );
    wp_enqueue_script( 'lof-viewer2-state', $plugin_url . 'assets/js/lof-state-layer.js', array( 'lof-viewer2-api' ), '0.2.0', true );
    wp_enqueue_script( 'lof-viewer2-theme', $plugin_url . 'assets/js/lof-theme-layer.js', array( 'lof-viewer2-state' ), '0.2.0', true );
    wp_enqueue_script( 'lof-viewer2-content', $plugin_url . 'assets/js/lof-content-layer.js', array( 'lof-viewer2-theme' ), '0.2.0', true );
    wp_enqueue_script( 'lof-viewer2-view', $plugin_url . 'assets/js/lof-view-layer.js', array( 'lof-viewer2-content' ), '0.2.0', true );
    wp_enqueue_script( 'lof-viewer2-interaction', $plugin_url . 'assets/js/lof-interaction-layer.js', array( 'lof-viewer2-view' ), '0.2.0', true );
    wp_enqueue_script( 'lof-viewer2-init', $plugin_url . 'assets/js/lof-init.js', array( 'lof-viewer2-interaction' ), '0.2.0', true );

    wp_enqueue_style( 'lof-viewer2-style', $plugin_url . 'assets/css/lof-base.css', array(), '0.2.0' );

    $theme = 'christmas';

    $rf_proxy_base = rest_url( 'lof-viewer/v1' );
    $lof_base      = rest_url( 'lof/v1' );
    $fpp_base      = rest_url( 'lof-viewer/v1/fpp' );

    $config = array(
        'rfProxyBaseUrl'   => untrailingslashit( $rf_proxy_base ),
        'lofBaseUrl'       => untrailingslashit( $lof_base ),
        'fppBaseUrl'       => untrailingslashit( $fpp_base ),
        'theme'            => $theme,
        'polling'          => array(
            'intervalMs'        => 3000,
            'maxBackoffMs'      => 30000,
            'rfDebounceMs'      => 0,
            'fppDebounceMs'     => 0,
            'connectionTimeout' => 10000,
        ),
        'copy'             => array(),
        'lofInitialConfig' => array(
            'features' => array(
                'requestsEnabled'       => true,
                'surpriseMeEnabled'     => true,
                'speakerControlEnabled' => true,
            ),
        ),
    );

    $inline = 'window.LOF_CONFIG = ' . wp_json_encode( $config ) . ';';
    wp_add_inline_script( 'lof-viewer2-init', $inline, 'before' );
}
add_action( 'wp_enqueue_scripts', 'lof_viewer2_enqueue_assets' );

function lof_viewer2_shortcode() {
    ob_start();
    ?>
    <div id="lof-viewer-v2-root" class="lof-viewer-shell lof-viewer lof-state--loading">
        
        <!-- STATUS PANEL -->
        <section class="lof-status" data-lof="status-panel">
            <div class="lof-status-indicator-wrapper">
                <span class="lof-state-indicator lof-state--loading" data-lof="state-indicator"></span>
            </div>
            <div class="lof-status-copy">
                <div class="lof-status-headline" data-lof="status-text">Connecting to the light show...</div>
                <div class="lof-status-warning" data-lof="connection-warning" style="display:none;"></div>
            </div>
        </section>

        <!-- NOW / NEXT -->
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
                    <div class="lof-track-title" data-lof="next-title">Tuning the lights…</div>
                    <div class="lof-track-artist" data-lof="next-artist"></div>
                </div>
            </div>
        </section>

        <!-- ACTIONS -->
        <section class="lof-actions">
            <button class="lof-button" type="button" data-lof="surprise-me">Surprise Me!</button>
        </section>

        <!-- SPEAKER CARD -->
        <section class="lof-speaker-card" data-lof="speaker-card" style="display:none;">
            <div class="lof-speaker-header">
                <h3 class="lof-speaker-title" data-lof="speaker-title">🔊 Outdoor Speakers</h3>
            </div>
            
            <div class="lof-speaker-body">
                <!-- Status Text -->
                <div class="lof-speaker-status" data-lof="speaker-status">Loading speaker status...</div>
                
                <!-- Countdown -->
                <div class="lof-speaker-countdown" data-lof="speaker-countdown" style="display:none;">
                    ⏱️ <span data-lof="speaker-countdown-value">5:00</span> remaining
                </div>
                
                <!-- Proximity Confirm Button -->
                <button class="lof-button lof-button--proximity" data-lof="speaker-proximity-btn" style="display:none;">
                    ✓ Yes, I'm at the show
                </button>
                
                <!-- Primary Button -->
                <button class="lof-button lof-button--speaker" data-lof="speaker-primary-btn">
                    Turn On Speakers
                </button>
                
                <!-- Helper Text -->
                <p class="lof-speaker-helper" data-lof="speaker-helper"></p>
                
                <!-- Alternatives (FM/Stream) -->
                <div class="lof-speaker-alternatives" data-lof="speaker-alternatives">
                    <div class="lof-alternatives-title">Listen another way:</div>
                    <div class="lof-alternatives-buttons">
                        <button class="lof-button lof-button--alt" data-lof="fm-btn">
                            📻 FM <span data-lof="fm-frequency">107.7</span>
                        </button>
                        <button class="lof-button lof-button--alt" data-lof="stream-btn">
                            🌐 Audio Stream
                        </button>
                    </div>
                </div>
                
                <!-- Proximity Hint -->
                <div class="lof-speaker-hint" data-lof="speaker-hint" style="display:none;"></div>
            </div>
        </section>

        <!-- SONG GRID -->
        <section class="lof-grid-section">
            <h2 class="lof-section-title">Pick a song</h2>
            <div class="lof-grid" data-lof="song-grid"></div>
        </section>

        <!-- QUEUE -->
        <section class="lof-queue-section" data-lof="queue" style="display:none;">
            <h3 class="lof-section-subtitle">In the queue</h3>
            <ul class="lof-queue-list" data-lof="queue-list"></ul>
        </section>

        <!-- MESSAGES -->
        <div class="lof-messages" data-lof="messages"></div>
        
        <!-- STREAM PLAYER -->
        <div class="lof-stream-player" data-lof="stream-player" style="display:none;">
            <div class="lof-stream-header">
                <span class="lof-stream-title">🎵 Audio Stream</span>
                <div class="lof-stream-controls">
                    <button class="lof-stream-btn" data-lof="stream-minimize-btn">−</button>
                    <button class="lof-stream-btn" data-lof="stream-close-btn">×</button>
                </div>
            </div>
            <div class="lof-stream-content">
                <div class="lof-stream-placeholder" data-lof="stream-placeholder">
                    <p>Ready to start the perfectly synced audio?</p>
                    <button class="lof-button lof-button--primary" data-lof="stream-start-btn">▶ Start Audio</button>
                </div>
                <div class="lof-stream-iframe-container" data-lof="stream-iframe-container" style="display:none;"></div>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'lof_viewer_v2', 'lof_viewer2_shortcode' );
