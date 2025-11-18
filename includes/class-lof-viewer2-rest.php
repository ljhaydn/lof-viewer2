<?php
/**
 * REST proxy for Lights on Falcon Viewer v2
 * - Proxies Remote Falcon External API via JWT/Bearer token
 * - RF API base URL and token are stored as WP options
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
    }

    /**
     * GET /wp-json/lof-viewer/v1/show
     * Proxies Remote Falcon External API "showDetails"
     */
    public static function handle_show( \WP_REST_Request $request ) {
        $token = self::get_rf_bearer_token();
        if ( ! $token ) {
            return new \WP_Error(
                'rf_no_token',
                'Remote Falcon bearer token not configured',
                array( 'status' => 500 )
            );
        }

        $api_base   = self::get_rf_api_base();
        // From your existing plugin: base + /showDetails
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
            return new \WP_Error(
                'rf_http_error',
                $response->get_error_message(),
                array( 'status' => 502 )
            );
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        if ( $code < 200 || $code >= 300 ) {
            return new \WP_Error(
                'rf_bad_status',
                'Remote Falcon responded with HTTP ' . $code,
                array(
                    'status'  => 502,
                    'details' => $body,
                )
            );
        }

        $data = json_decode( $body, true );
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            return new \WP_Error(
                'rf_bad_json',
                'Invalid JSON from Remote Falcon',
                array( 'status' => 502 )
            );
        }

        // Pass RF's JSON through; RFClient._normalizeShowDetails handles shape.
        return rest_ensure_response( $data );
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
            return new \WP_Error(
                'rf_no_token',
                'Remote Falcon bearer token not configured',
                array( 'status' => 500 )
            );
        }

        $params     = $request->get_json_params();
        $song_id    = isset( $params['song_id'] ) ? sanitize_text_field( $params['song_id'] ) : '';
        $visitor_id = isset( $params['visitor_id'] ) ? sanitize_text_field( $params['visitor_id'] ) : '';

        if ( empty( $song_id ) ) {
            return new \WP_Error(
                'rf_missing_song_id',
                'Song ID is required',
                array( 'status' => 400 )
            );
        }

        $api_base   = self::get_rf_api_base();
        // From your existing plugin: base + /addSequenceToQueue
        $remote_url = $api_base . '/addSequenceToQueue';

        // Map our viewer terminology to RF's expected payload.
        $rf_payload = array(
            'sequenceId' => $song_id,
        );

        if ( $visitor_id !== '' ) {
            // If RF supports this, we pass it through; harmless if ignored.
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
            return new \WP_Error(
                'rf_http_error',
                $response->get_error_message(),
                array( 'status' => 502 )
            );
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        if ( $code < 200 || $code >= 300 ) {
            return new \WP_Error(
                'rf_bad_status',
                'Remote Falcon responded with HTTP ' . $code,
                array(
                    'status'  => 502,
                    'details' => $body,
                )
            );
        }

        $data = json_decode( $body, true );
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            return new \WP_Error(
                'rf_bad_json',
                'Invalid JSON from Remote Falcon',
                array( 'status' => 502 )
            );
        }

        return rest_ensure_response( $data );
    }

    /**
     * Get RF API base URL from options (with a sensible default)
     * This should match the "Remote Falcon API Base URL" from your existing config.
     */
    protected static function get_rf_api_base() {
        $base = get_option( self::OPTION_RF_API_BASE );

        if ( ! is_string( $base ) || '' === trim( $base ) ) {
            // Default to your current RF external API url
            $base = 'https://getlitproductions.co/remote-falcon-external-api';
        }

        // Ensure no trailing slash, we append paths manually
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
