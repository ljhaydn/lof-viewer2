<?php
/**
 * REST proxy for Lights on Falcon Viewer v2
 * - Proxies Remote Falcon External API via JWT/Bearer token
 * - Proxies FPP /api/fppd/status via WP so the browser never hits the LAN directly
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class LOF_Viewer2_REST {

    const REST_NAMESPACE        = 'lof-viewer/v1';
    const OPTION_RF_API_BASE    = 'lof_viewer_rf_api_base';
    const OPTION_RF_BEARER_KEY  = 'lof_viewer_rf_bearer_token';

    /**
     * Init hooks
     */
    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    /**
     * Register REST routes for viewer v2
     */
    public static function register_routes() {
        register_rest_route(
            self::REST_NAMESPACE,
            '/show',
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'handle_show' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/request',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_request' ),
                'permission_callback' => '__return_true',
            )
        );

        // FPP status proxy: /wp-json/lof-viewer/v1/fpp/status
        register_rest_route(
            self::REST_NAMESPACE,
            '/fpp/status',
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'handle_fpp_status' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * GET /wp-json/lof-viewer/v1/show
     * Proxies Remote Falcon External API "showDetails"
     */
    public static function handle_show( \WP_REST_Request $request ) {
        $token = self::get_rf_bearer_token();
        if ( ! $token ) {
            // No token: return debug info (200 JSON, not 500/502)
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
     * Proxies Remote Falcon External API "addSequenceToQueue"
     *
     * JS sends { song_id, visitor_id } to this endpoint.
     * We map that to RF's expected payload (sequenceId, visitorId).
     */
    public static function handle_request( \WP_REST_Request $request ) {
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

        $params     = $request->get_json_params();
        $song_id    = isset( $params['song_id'] ) ? sanitize_text_field( $params['song_id'] ) : '';
        $visitor_id = isset( $params['visitor_id'] ) ? sanitize_text_field( $params['visitor_id'] ) : '';

        if ( empty( $song_id ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'missing_song_id',
                    'message' => 'Song ID is required',
                )
            );
        }

        $api_base   = self::get_rf_api_base();
        $remote_url = $api_base . '/addSequenceToQueue';

        $rf_payload = array(
            'sequenceId' => $song_id,
        );

        if ( '' !== $visitor_id ) {
            $rf_payload['visitorId'] = $visitor_id;
        }

        $response = wp_remote_post(
            $remote_url,
            array(
                'timeout' => 10,
                'headers' => array(
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer ' . $token,
                ),
                'body'    => wp_json_encode( $rf_payload ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'where'   => 'wp_remote_post',
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
     * GET /wp-json/lof-viewer/v1/fpp/status
     * Proxy to local FPP API endpoint:
     *   http://10.9.7.102/api/fppd/status
     *
     * We return 200 JSON even on error so debugging stays easy.
     */
    public static function handle_fpp_status( \WP_REST_Request $request ) {
        $base = get_option( 'lof_viewer_fpp_base' );
        if ( ! is_string( $base ) || '' === trim( $base ) ) {
            $base = 'http://10.9.7.102';
        }

        $base       = untrailingslashit( trim( $base ) );
        // ✅ Correct FPP API endpoint
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
            // Network/connection/DNS error
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
            // FPP responded non-2xx
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
     * Get RF API base URL from options (with a sensible default)
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
     * Get RF bearer token from options
     */
    protected static function get_rf_bearer_token() {
        $token = get_option( self::OPTION_RF_BEARER_KEY );
        $token = is_string( $token ) ? trim( $token ) : '';
        return $token ?: '';
    }
}
