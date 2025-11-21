<?php
/**
 * REST proxy for Lights on Falcon Viewer v2
 * - Proxies Remote Falcon External API via JWT/Bearer token
 * - Proxies FPP /api/fppd/status via WP so the browser never hits the LAN directly
 * - Provides speaker control endpoints
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class LOF_Viewer2_REST {

    const REST_NAMESPACE       = 'lof-viewer/v1';
    const OPTION_RF_API_BASE   = 'lof_viewer_rf_api_base';
    const OPTION_RF_BEARER_KEY = 'lof_viewer_rf_bearer_token';

    /**
     * Init hooks.
     */
    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    /**
     * Register REST routes for viewer v2.
     */
    public static function register_routes() {
        // Remote Falcon: showDetails
        register_rest_route(
            self::REST_NAMESPACE,
            '/show',
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'handle_show' ),
                'permission_callback' => '__return_true',
            )
        );

        // Remote Falcon: addSequenceToQueue
        register_rest_route(
            self::REST_NAMESPACE,
            '/request',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_request' ),
                'permission_callback' => '__return_true',
            )
        );

        // FPP status proxy
        register_rest_route(
            self::REST_NAMESPACE,
            '/fpp/status',
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'handle_fpp_status' ),
                'permission_callback' => '__return_true',
            )
        );

        // Speaker status (GET)
        register_rest_route(
            self::REST_NAMESPACE,
            '/speaker',
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'handle_speaker_status' ),
                'permission_callback' => '__return_true',
            )
        );

        // Speaker enable/extend (POST)
        register_rest_route(
            self::REST_NAMESPACE,
            '/speaker',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_speaker_enable' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * GET /wp-json/lof-viewer/v1/show
     * Proxies Remote Falcon External API "showDetails".
     */
    public static function handle_show( \WP_REST_Request $request ) {
        $token = self::get_rf_bearer_token();
        if ( ! $token ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'no_token',
                    'message' => 'Remote Falcon bearer token not configured',
                )
            );
        }

        $api_base   = self::get_rf_api_base();
        $remote_url = $api_base . '/showDetails';

        $response = wp_remote_get(
            $remote_url,
            array(
                'timeout' => 10,
                'headers' => array(
                    'Accept'        => 'application/json',
                    'Authorization' => 'Bearer ' . $token,
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'wp_remote_get',
                    'url'     => $remote_url,
                    'error'   => $response->get_error_message(),
                )
            );
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        if ( $code < 200 || $code >= 300 ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'rf_http_status',
                    'url'     => $remote_url,
                    'status'  => $code,
                    'body'    => $body,
                )
            );
        }

        $data = json_decode( $body, true );
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'rf_bad_json',
                    'url'     => $remote_url,
                    'body'    => $body,
                )
            );
        }

        return rest_ensure_response(
            array(
                'success' => true,
                'url'     => $remote_url,
                'data'    => $data,
            )
        );
    }

    /**
     * POST /wp-json/lof-viewer/v1/request
     * Proxy to Remote Falcon "addSequenceToQueue".
     */
    public static function handle_request( \WP_REST_Request $request ) {
        $token = self::get_rf_bearer_token();
        if ( ! $token ) {
            return new \WP_Error(
                'rf_no_token',
                'Remote Falcon bearer token not configured',
                array( 'status' => 500 )
            );
        }

        $params = $request->get_json_params();

        $sequence = '';
        if ( isset( $params['sequence'] ) ) {
            $sequence = sanitize_text_field( $params['sequence'] );
        } elseif ( isset( $params['song_id'] ) ) {
            $sequence = sanitize_text_field( $params['song_id'] );
        }

        if ( '' === $sequence ) {
            return new \WP_Error(
                'rf_missing_sequence',
                'Song / sequence ID is required',
                array( 'status' => 400 )
            );
        }

        $api_base   = self::get_rf_api_base();
        $remote_url = $api_base . '/addSequenceToQueue';

        $rf_payload = array(
            'sequence' => $sequence,
        );

        if ( ! empty( $params['visitor_id'] ) ) {
            $rf_payload['visitorId'] = sanitize_text_field( $params['visitor_id'] );
        }

        $response = wp_remote_post(
            $remote_url,
            array(
                'timeout' => 10,
                'headers' => array(
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                    'Accept'        => 'application/json',
                ),
                'body'    => wp_json_encode( $rf_payload ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return new \WP_Error(
                'rf_http_error',
                $response->get_error_message(),
                array( 'status' => 502 )
            );
        }

        $code    = wp_remote_retrieve_response_code( $response );
        $body    = wp_remote_retrieve_body( $response );
        $decoded = json_decode( $body, true );

        if ( json_last_error() !== JSON_ERROR_NONE ) {
            $decoded = null;
        }

        return rest_ensure_response(
            array(
                'status' => $code,
                'data'   => $decoded,
            )
        );
    }

    /**
     * GET /wp-json/lof-viewer/v1/fpp/status
     * Proxy to local FPP API endpoint.
     */
    public static function handle_fpp_status( \WP_REST_Request $request ) {
        $base = get_option( 'lof_viewer_fpp_base' );
        if ( ! is_string( $base ) || '' === trim( $base ) ) {
            $base = 'http://10.9.7.102';
        }

        $base       = untrailingslashit( trim( $base ) );
        $remote_url = $base . '/api/fppd/status';

        $response = wp_remote_get(
            $remote_url,
            array(
                'timeout' => 5,
                'headers' => array(
                    'Accept' => 'application/json',
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'wp_remote_get',
                    'url'     => $remote_url,
                    'error'   => $response->get_error_message(),
                )
            );
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        if ( $code < 200 || $code >= 300 ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'fpp_http_status',
                    'url'     => $remote_url,
                    'status'  => $code,
                    'body'    => $body,
                )
            );
        }

        $data = json_decode( $body, true );
        if ( JSON_ERROR_NONE !== json_last_error() ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'fpp_bad_json',
                    'url'     => $remote_url,
                    'body'    => $body,
                )
            );
        }

        return rest_ensure_response(
            array(
                'success' => true,
                'url'     => $remote_url,
                'data'    => $data,
            )
        );
    }

    /**
     * GET /wp-json/lof-viewer/v1/speaker
     * Returns current speaker state.
     */
    public static function handle_speaker_status( \WP_REST_Request $request ) {
        $state = get_option( 'lof_viewer_v2_speaker_state', array() );
        $config = get_option( 'lof_viewer_v2_speaker_config', array() );

        // Defaults
        $state = array_merge(
            array(
                'status'                     => 'off',
                'enabled'                    => false,
                'mode'                       => 'automatic',
                'session_started_at'         => 0,
                'session_lifetime_started_at' => 0,
                'expires_at'                 => 0,
                'override'                   => false,
                'source'                     => null,
                'protected_sequence'         => null,
                'protected_song'             => null,
                'max_session_reached'        => false,
                'lifetime_cap_reached'       => false,
                'target_song_for_shutoff'    => null,
                'graceful_shutoff'           => false,
                'proximity_tier'             => 1,
                'proximity_reason'           => '',
                'last_updated'               => 0,
            ),
            $state
        );

        $config = array_merge(
            array(
                'fm_frequency'           => '107.7',
                'stream_url'             => '',
                'noise_curfew_hour'      => 22,
                'noise_curfew_enabled'   => true,
                'noise_curfew_override'  => false,
            ),
            $config
        );

        // Get FPP status
        $fpp_status = self::get_fpp_status_internal();
        
        // FPP is "playing" when status_name is "playing"
        $fpp_playing = $fpp_status['success'] && $fpp_status['data']['status'] === 'playing';
        
        $current_song = $fpp_status['success'] ? $fpp_status['data']['currentSequence'] : null;
        $current_song_audio = $fpp_status['success'] ? $fpp_status['data']['currentSongAudio'] : null;
        $seconds_remaining = $fpp_status['success'] ? $fpp_status['data']['secondsRemaining'] : 0;

        // Calculate remaining seconds
        $now = time();
        $remaining_seconds = 0;

        if ( $state['enabled'] ) {
            if ( $state['graceful_shutoff'] ) {
                // Protection mode - use FPP time
                $remaining_seconds = $seconds_remaining;
            } else {
                // Active timer mode
                $remaining_seconds = max( 0, $state['expires_at'] - $now );
            }
        }

        // Proximity detection
        $proximity_tier = self::detect_proximity_tier();

        return rest_ensure_response(
            array(
                'success' => true,
                'data'    => array(
                    'enabled'                    => $state['enabled'],
                    'remainingSeconds'           => $remaining_seconds,
                    'sessionStartedAt'           => $state['session_started_at'],
                    'sessionLifetimeStartedAt'   => $state['session_lifetime_started_at'],
                    'override'                   => $state['override'],
                    'mode'                       => $state['mode'],
                    'message'                    => $state['message'] ?? '',
                    'source'                     => $state['source'],
                    'fppPlaying'                 => $fpp_playing,
                    'currentSong'                => $current_song,
                    'currentSongAudio'           => $current_song_audio,
                    'maxSessionReached'          => $state['max_session_reached'],
                    'lifetimeCapReached'         => $state['lifetime_cap_reached'],
                    'targetSongForShutoff'       => $state['target_song_for_shutoff'],
                    'gracefulShutoff'            => $state['graceful_shutoff'],
                    'proximityTier'              => $proximity_tier,
                    'proximityReason'            => self::get_proximity_reason( $proximity_tier ),
                    'config'                     => $config,
                ),
            )
        );
    }

    /**
     * POST /wp-json/lof-viewer/v1/speaker
     * Enable or extend speaker session.
     */
    public static function handle_speaker_enable( \WP_REST_Request $request ) {
        $params = $request->get_json_params();
        $source = isset( $params['source'] ) ? sanitize_text_field( $params['source'] ) : 'viewer';
        $is_extension = ! empty( $params['extension'] );
        $proximity_confirmed = ! empty( $params['proximity_confirmed'] );

        $state = get_option( 'lof_viewer_v2_speaker_state', array() );
        $config = get_option( 'lof_viewer_v2_speaker_config', array() );

        $config = array_merge(
            array(
                'duration_seconds'       => 300,
                'fpp_host'               => get_option( 'lof_viewer_fpp_base', 'http://10.9.7.102' ),
                'on_script'              => 'speaker-amp-on.sh',
                'noise_curfew_hour'      => 22,
                'noise_curfew_enabled'   => true,
                'noise_curfew_override'  => false,
            ),
            $config
        );

        $now = time();
        $current_hour = (int) date( 'G', $now );

        // Check noise curfew
        if ( $config['noise_curfew_enabled'] && ! $config['noise_curfew_override'] && $current_hour >= $config['noise_curfew_hour'] ) {
            return rest_ensure_response(
                array(
                    'success'   => false,
                    'error'     => 'Noise curfew active',
                    'errorCode' => 'NOISE_CURFEW',
                )
            );
        }

        // Check proximity
        $proximity_tier = self::detect_proximity_tier();
        if ( $proximity_tier >= 4 && ! $proximity_confirmed ) {
            return rest_ensure_response(
                array(
                    'success'   => false,
                    'error'     => 'Proximity confirmation required',
                    'errorCode' => 'PROXIMITY_REQUIRED',
                )
            );
        }

        // Check FPP
        $fpp_status = self::get_fpp_status_internal();
        if ( ! $fpp_status['success'] ) {
            return rest_ensure_response(
                array(
                    'success'   => false,
                    'error'     => 'FPP unreachable',
                    'errorCode' => 'FPP_UNREACHABLE',
                )
            );
        }

        // Check if FPP is playing (status_name === "playing")
        if ( $fpp_status['data']['status'] !== 'playing' ) {
            return rest_ensure_response(
                array(
                    'success'   => false,
                    'error'     => 'Show not playing',
                    'errorCode' => 'NOT_PLAYING',
                )
            );
        }

        // Initialize state if needed
        if ( ! isset( $state['status'] ) ) {
            $state = array(
                'status'                     => 'off',
                'enabled'                    => false,
                'mode'                       => 'ACTIVE_TIMER',
                'session_started_at'         => 0,
                'session_lifetime_started_at' => 0,
                'expires_at'                 => 0,
                'override'                   => false,
                'source'                     => null,
                'max_session_reached'        => false,
                'lifetime_cap_reached'       => false,
                'graceful_shutoff'           => false,
            );
        }

        $duration = $config['duration_seconds'];

        if ( $is_extension ) {
            // Extension - check session cap
            $session_duration = $now - $state['session_started_at'];
            if ( $session_duration >= 900 ) {
                return rest_ensure_response(
                    array(
                        'success'   => false,
                        'error'     => 'Session limit reached',
                        'errorCode' => 'SESSION_CAP',
                    )
                );
            }
        }

        // Turn on speaker via FPP
        $fpp_base = untrailingslashit( $config['fpp_host'] );
        $script_url = $fpp_base . '/api/command/Run Script/' . urlencode( $config['on_script'] );

        wp_remote_get( $script_url, array( 'timeout' => 5, 'blocking' => false ) );

        // Update state
        if ( ! $state['enabled'] ) {
            // Fresh enable
            $state['session_started_at'] = $now;
            $state['session_lifetime_started_at'] = $now;
        }

        $state['status'] = 'on';
        $state['enabled'] = true;
        $state['mode'] = 'ACTIVE_TIMER';
        $state['expires_at'] = $now + $duration;
        $state['source'] = $source;
        $state['last_updated'] = $now;
        $state['graceful_shutoff'] = false;

        update_option( 'lof_viewer_v2_speaker_state', $state );

        $message = $is_extension ? 'Speaker extended for 5 more minutes' : 'Speaker enabled for 5 minutes';

        return rest_ensure_response(
            array(
                'success' => true,
                'data'    => array(
                    'enabled'           => true,
                    'remainingSeconds'  => $duration,
                    'sessionStartedAt'  => $state['session_started_at'],
                    'sessionLifetimeStartedAt' => $state['session_lifetime_started_at'],
                    'message'           => $message,
                    'source'            => $source,
                ),
            )
        );
    }

    /**
     * Get FPP status internally (for speaker checks).
     */
    protected static function get_fpp_status_internal() {
        $base = get_option( 'lof_viewer_fpp_base', 'http://10.9.7.102' );
        $base = untrailingslashit( trim( $base ) );
        $remote_url = $base . '/api/fppd/status';

        $response = wp_remote_get( $remote_url, array( 'timeout' => 3 ) );

        if ( is_wp_error( $response ) ) {
            return array( 'success' => false );
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code < 200 || $code >= 300 ) {
            return array( 'success' => false );
        }

        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );

        if ( json_last_error() !== JSON_ERROR_NONE ) {
            return array( 'success' => false );
        }

        return array(
            'success' => true,
            'data'    => array(
                'status'            => $data['status_name'] ?? 'idle',  // "playing", "idle", "paused"
                'mode'              => $data['mode_name'] ?? 'unknown',  // "bridge", "master", etc
                'currentSequence'   => $data['current_sequence'] ?? null,
                'currentSongAudio'  => $data['current_song'] ?? null,
                'secondsRemaining'  => $data['seconds_remaining'] ?? 0,
                'secondsElapsed'    => $data['seconds_played'] ?? 0,
            ),
        );
    }

    /**
     * Detect proximity tier based on IP/location.
     */
    protected static function detect_proximity_tier() {
        // For now, default to Tier 1 (local)
        // In production, check Cloudflare headers, LAN detection, etc.
        return 1;
    }

    /**
     * Get proximity reason text.
     */
    protected static function get_proximity_reason( $tier ) {
        $reasons = array(
            1 => 'Local access',
            2 => 'Southern California',
            3 => 'California',
            4 => 'Outside California',
            5 => 'International',
        );

        return $reasons[ $tier ] ?? 'Unknown';
    }

    /**
     * Get RF API base URL from options.
     */
    protected static function get_rf_api_base() {
        $base = get_option( self::OPTION_RF_API_BASE );

        if ( ! is_string( $base ) || '' === trim( $base ) ) {
            $base = 'https://getlitproductions.co/remote-falcon-external-api';
        }

        $base = untrailingslashit( trim( $base ) );
        return $base;
    }

    /**
     * Get RF bearer token from options.
     */
    protected static function get_rf_bearer_token() {
        $token = get_option( self::OPTION_RF_BEARER_KEY );
        $token = is_string( $token ) ? trim( $token ) : '';
        return $token ?: '';
    }
}
