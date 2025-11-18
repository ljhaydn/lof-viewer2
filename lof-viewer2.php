<?php
/**
 * Plugin Name: Lights on Falcon Viewer v2
 * Description: Viewer v2 microframework for Lights on Falcon (Remote Falcon + FPP + LOF).
 * Version:     0.1.0
 * Author:      Joe Hayden
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'LOF_VIEWER2_VERSION', '0.1.0' );
define( 'LOF_VIEWER2_PLUGIN_FILE', __FILE__ );
define( 'LOF_VIEWER2_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'LOF_VIEWER2_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// -----------------------------------------------------------------------------
// Include REST proxy class (Remote Falcon JWT/Bearer lives there)
// -----------------------------------------------------------------------------
require_once LOF_VIEWER2_PLUGIN_DIR . 'includes/class-lof-viewer2-rest.php';

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------
add_action( 'plugins_loaded', 'lof_viewer2_init' );

function lof_viewer2_init() {
    // Initialize REST routes
    LOF_Viewer2_REST::init();
}

// -----------------------------------------------------------------------------
// Shortcode [lof_viewer_v2]
// Outputs the HTML shell that matches viewer_v2_spec + our data-lof attributes
// -----------------------------------------------------------------------------
add_shortcode( 'lof_viewer_v2', 'lof_viewer2_shortcode' );

function lof_viewer2_shortcode( $atts ) {
    // Attributes (you can extend these later)
    $atts = shortcode_atts(
        array(
            'theme' => 'christmas',
        ),
        $atts,
        'lof_viewer_v2'
    );

    // Enqueue assets for this shortcode
    lof_viewer2_enqueue_assets( $atts['theme'] );

    // HTML shell – MUST match what the JS ViewLayer expects
    ob_start();
    ?>
    <div class="lof-viewer-shell">
        <div class="lof-viewer" data-lof="viewer-root">

            <!-- Status Panel -->
            <section class="lof-status" data-lof="status-panel">
                <div class="lof-status-indicator-wrapper">
                    <div class="lof-state-indicator lof-state--loading" data-lof="state-indicator"></div>
                </div>
                <div class="lof-status-text-wrapper">
                    <div class="lof-status-text" data-lof="status-text">
                        Connecting to the light show...
                    </div>
                    <div class="lof-status-warning" data-lof="connection-warning" style="display: none;"></div>
                </div>
            </section>

            <!-- Messages / Toasts -->
            <section class="lof-messages" data-lof="messages" aria-live="polite"></section>

            <!-- Now Playing / Up Next -->
            <section class="lof-now-next">
                <div class="lof-now-playing" data-lof="now-playing">
                    <div class="lof-section-title">
                        <span>Now Playing</span>
                    </div>
                    <div class="lof-track-info">
                        <div class="lof-track-title" data-lof="np-title"></div>
                        <div class="lof-track-artist" data-lof="np-artist"></div>
                    </div>
                    <div class="lof-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100">
                        <div class="lof-progress-bar__inner" data-lof="np-progress"></div>
                    </div>
                </div>

                <div class="lof-up-next" data-lof="up-next">
                    <div class="lof-section-title">
                        <span>Up Next</span>
                    </div>
                    <div class="lof-track-info">
                        <div class="lof-track-title" data-lof="next-title"></div>
                        <div class="lof-track-artist" data-lof="next-artist"></div>
                    </div>
                </div>
            </section>

            <!-- Actions: Surprise Me + Speaker -->
            <section class="lof-actions">
                <button type="button"
                    class="lof-button lof-button--primary"
                    data-lof="surprise-me">
                    Surprise Me!
                </button>

                <button type="button"
                    class="lof-button lof-button--speaker lof-button--off"
                    data-lof="speaker-toggle"
                    aria-pressed="false">
                    <span data-lof="speaker-label">Speaker Off</span>
                </button>
            </section>

            <!-- Song Grid -->
            <section class="lof-grid-section">
                <div class="lof-section-title">
                    <span>Pick a song</span>
                </div>
                <div class="lof-grid" data-lof="song-grid">
                    <!-- Tiles injected by JS -->
                </div>
            </section>

            <!-- Queue -->
            <section class="lof-queue" data-lof="queue" style="display: none;">
                <div class="lof-section-title">
                    <span>Request Queue</span>
                </div>
                <ol class="lof-queue-list" data-lof="queue-list">
                    <!-- Queue items injected by JS -->
                </ol>
            </section>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// -----------------------------------------------------------------------------
// Enqueue CSS/JS and inject LOF_CONFIG
// -----------------------------------------------------------------------------
function lof_viewer2_enqueue_assets( $theme = 'christmas' ) {
    // Only enqueue once per page load
    static $enqueued = false;
    if ( $enqueued ) {
        return;
    }
    $enqueued = true;

    // CSS
    wp_enqueue_style(
        'lof-viewer2-base',
        LOF_VIEWER2_PLUGIN_URL . 'assets/css/lof-base.css',
        array(),
        LOF_VIEWER2_VERSION
    );

    // JS – load in this order:
    // 1) API, 2) State, 3) Content, 4) Theme, 5) View, 6) Interaction, 7) Init

    wp_enqueue_script(
        'lof-viewer2-api',
        LOF_VIEWER2_PLUGIN_URL . 'assets/js/lof-api-layer.js',
        array(),
        LOF_VIEWER2_VERSION,
        true
    );

    wp_enqueue_script(
        'lof-viewer2-state',
        LOF_VIEWER2_PLUGIN_URL . 'assets/js/lof-state-layer.js',
        array( 'lof-viewer2-api' ),
        LOF_VIEWER2_VERSION,
        true
    );

    wp_enqueue_script(
        'lof-viewer2-content',
        LOF_VIEWER2_PLUGIN_URL . 'assets/js/lof-content-layer.js',
        array( 'lof-viewer2-state' ),
        LOF_VIEWER2_VERSION,
        true
    );

    wp_enqueue_script(
        'lof-viewer2-theme',
        LOF_VIEWER2_PLUGIN_URL . 'assets/js/lof-theme-layer.js',
        array( 'lof-viewer2-content' ),
        LOF_VIEWER2_VERSION,
        true
    );

    wp_enqueue_script(
        'lof-viewer2-view',
        LOF_VIEWER2_PLUGIN_URL . 'assets/js/lof-view-layer.js',
        array( 'lof-viewer2-theme' ),
        LOF_VIEWER2_VERSION,
        true
    );

    wp_enqueue_script(
        'lof-viewer2-interaction',
        LOF_VIEWER2_PLUGIN_URL . 'assets/js/lof-interaction-layer.js',
        array( 'lof-viewer2-view' ),
        LOF_VIEWER2_VERSION,
        true
    );

    wp_enqueue_script(
        'lof-viewer2-init',
        LOF_VIEWER2_PLUGIN_URL . 'assets/js/lof-init.js',
        array( 'lof-viewer2-interaction' ),
        LOF_VIEWER2_VERSION,
        true
    );

    // Build LOF_CONFIG – this is what JS reads
    $rf_proxy_base = rest_url( 'lof-viewer/v1' );      // matches RFClient._baseURL
    $lof_base      = rest_url( 'lof/v1' );             // your existing LOF endpoints if already used
    $fpp_base      = 'http://10.9.7.102';              // or a WP proxy if you want to hide LAN

    $config = array(
        'rfProxyBaseUrl'   => untrailingslashit( $rf_proxy_base ),
        'lofBaseUrl'       => untrailingslashit( $lof_base ),
        'fppBaseUrl'       => untrailingslashit( $fpp_base ),
        'theme'            => $theme,
        'debug'            => ( defined( 'WP_DEBUG' ) && WP_DEBUG ),
        'lofInitialConfig' => array(
            'features' => array(
                'requestsEnabled'       => true,
                'surpriseMeEnabled'     => true,
                'speakerControlEnabled' => true,
            ),
        ),
    );

    $inline = 'window.LOF_CONFIG = ' . wp_json_encode( $config ) . ';';

    // Inject LOF_CONFIG BEFORE lof-viewer2-init runs
    wp_add_inline_script( 'lof-viewer2-init', $inline, 'before' );
}
