<?php
/**
 * Plugin Name: Lights on Falcon Viewer v2
 * Description: New microframework-based viewer for Lights on Falcon, integrating Remote Falcon + FPP via WP REST.
 * Version:     0.1.0
 * Author:      Lights on Falcon
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Autoload or require our REST class
 */
require_once plugin_dir_path( __FILE__ ) . 'includes/class-lof-viewer2-rest.php';

/**
 * Init the REST proxy hooks.
 */
add_action( 'plugins_loaded', 'lof_viewer2_init' );

function lof_viewer2_init() {
    LOF_Viewer2_REST::init();
}

/**
 * Enqueue assets and inject LOF_CONFIG for the viewer v2.
 */
function lof_viewer2_enqueue_assets() {
    if ( ! is_singular() ) {
        return;
    }

    global $post;

    // Only load on pages that actually use the viewer shortcode
    if ( ! has_shortcode( $post->post_content, 'lof_viewer_v2' ) ) {
        return;
    }

    $plugin_url = plugin_dir_url( __FILE__ );

    // --- JS microframework layers in dependency order ---

    // 1) API layer: RF + FPP clients
    wp_enqueue_script(
        'lof-viewer2-api',
        $plugin_url . 'assets/js/lof-api-layer.js',
        array(),
        '0.1.0',
        true
    );

    // 2) State layer: central store
    wp_enqueue_script(
        'lof-viewer2-state',
        $plugin_url . 'assets/js/lof-state-layer.js',
        array( 'lof-viewer2-api' ),
        '0.1.0',
        true
    );

    // 3) Theme layer: theming + derived state
    wp_enqueue_script(
        'lof-viewer2-theme',
        $plugin_url . 'assets/js/lof-theme-layer.js',
        array( 'lof-viewer2-state' ),
        '0.1.0',
        true
    );

    // 4) Content layer: copy + labels (used by ViewLayer)
    wp_enqueue_script(
        'lof-viewer2-content',
        $plugin_url . 'assets/js/lof-content-layer.js',
        array( 'lof-viewer2-theme' ),
        '0.1.0',
        true
    );

    // 5) View layer: DOM rendering (depends on ContentLayer)
    wp_enqueue_script(
        'lof-viewer2-view',
        $plugin_url . 'assets/js/lof-view-layer.js',
        array( 'lof-viewer2-content' ),
        '0.1.0',
        true
    );

    // 6) Interaction layer: wiring user events, calls RF/FPP + ViewLayer
    wp_enqueue_script(
        'lof-viewer2-interaction',
        $plugin_url . 'assets/js/lof-interaction-layer.js',
        array( 'lof-viewer2-view' ),
        '0.1.0',
        true
    );

    // 7) Init: bootstraps the whole viewer
    wp_enqueue_script(
        'lof-viewer2-init',
        $plugin_url . 'assets/js/lof-init.js',
        array( 'lof-viewer2-interaction' ),
        '0.1.0',
        true
    );

    // Styles (viewer skin)
    wp_enqueue_style(
        'lof-viewer2-style',
        $plugin_url . 'assets/css/lof-base.css',
        array(),
        '0.1.0'
    );

    // --- LOF_CONFIG passed from PHP into JS ---

    $theme = 'default'; // can be made configurable later

    $rf_proxy_base = rest_url( 'lof-viewer/v1' );      // RF proxy namespace
    $lof_base      = rest_url( 'lof/v1' );             // existing LOF endpoints (if/when used)
    $fpp_base      = rest_url( 'lof-viewer/v1/fpp' );  // FPP proxy namespace

    $config = array(
        'rfProxyBaseUrl'   => untrailingslashit( $rf_proxy_base ),
        'lofBaseUrl'       => untrailingslashit( $lof_base ),
        'fppBaseUrl'       => untrailingslashit( $fpp_base ),
        'theme'            => $theme,
        'polling'          => array(
            'intervalMs'        => 5000,
            'maxBackoffMs'      => 30000,
            'rfDebounceMs'      => 0,
            'fppDebounceMs'     => 0,
            'connectionTimeout' => 10000,
        ),
        'copy'             => array(
            'states' => array(
                'ACTIVE'   => array(
                    'headline' => 'Let’s get lit ✨',
                    'body'     => 'Pick a song, watch the house dance, and keep an eye on the queue.',
                ),
                'DEGRADED' => array(
                    'headline' => 'Connection wobbling like Rudolph’s nose',
                    'body'     => 'Limited connectivity – things may flicker or take a bit longer.',
                ),
                'OFFLINE'  => array(
                    'headline' => 'The show is taking a power nap',
                    'body'     => 'Check back soon – we’re probably rebooting something or adding more chaos.',
                ),
            ),
        ),
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

/**
 * Shortcode to render the viewer root container.
 */
function lof_viewer2_shortcode() {
    ob_start();
    ?>
    <div id="lof-viewer-v2-root" class="lof-viewer-v2-root">
        <!-- Viewer v2 microframework will hydrate this container -->
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'lof_viewer_v2', 'lof_viewer2_shortcode' );
