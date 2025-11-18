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
    /**
     * GET /wp-json/lof-viewer/v1/fpp/status
     * Proxies to local FPP getStatus endpoint:
     *   http://10.9.7.102/fppjson.php?command=getStatus
     */
    public static function handle_fpp_status( \WP_REST_Request $request ) {
        // Later we can make this configurable, matching your architecture docs.
        $base = get_option( 'lof_viewer_fpp_base' );
        if ( ! is_string( $base ) || '' === trim( $base ) ) {
            $base = 'http://10.9.7.102';
        }

        $base       = untrailingslashit( trim( $base ) );
        $remote_url = $base . '/fppjson.php?command=getStatus';

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
            return new \WP_Error(
                'fpp_http_error',
                $response->get_error_message(),
                array( 'status' => 502 )
            );
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        if ( $code < 200 || $code >= 300 ) {
            return new \WP_Error(
                'fpp_bad_status',
                'FPP responded with HTTP ' . $code,
                array(
                    'status'  => 502,
                    'details' => $body,
                )
            );
        }

        $data = json_decode( $body, true );
        if ( JSON_ERROR_NONE !== json_last_error() ) {
            return new \WP_Error(
                'fpp_bad_json',
                'Invalid JSON from FPP',
                array( 'status' => 502 )
            );
        }

        // Pass FPP JSON straight through
        return rest_ensure_response( $data );
    }

    /**
     * GET /wp-json/lof-viewer/v1/show
     * Proxies Remote Falcon External API "showDetails"
     */
    public static function handle_show( \WP_REST_Request $request ) {
    $token = self::get_rf_bearer_token();
    if ( ! $token ) {
        // No token: return 200 with debug info
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'no_token',
            'message' => 'Remote Falcon bearer token not configured',
        ) );
    }

    $api_base   = self::get_rf_api_base();
    $remote_url = $api_base . '/showDetails'; // from your working setup

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
        // Network/SSL/etc error – return debug JSON, not HTTP 502
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'wp_remote_get',
            'url'     => $remote_url,
            'error'   => $response->get_error_message(),
        ) );
    }

    $code = wp_remote_retrieve_response_code( $response );
    $body = wp_remote_retrieve_body( $response );

    if ( $code < 200 || $code >= 300 ) {
        // RF responded non-2xx – return status + raw body
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'rf_http_status',
            'url'     => $remote_url,
            'status'  => $code,
            'body'    => $body,
        ) );
    }

    $data = json_decode( $body, true );
    if ( json_last_error() !== JSON_ERROR_NONE ) {
        // RF body is not valid JSON – show raw
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'rf_bad_json',
            'url'     => $remote_url,
            'raw'     => $body,
        ) );
    }

    // Happy path: valid RF JSON
    return rest_ensure_response( array(
        'success' => true,
        'url'     => $remote_url,
        'data'    => $data,
    ) );
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
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'no_token',
            'message' => 'Remote Falcon bearer token not configured',
        ) );
    }

    $params     = $request->get_json_params();
    $song_id    = isset( $params['song_id'] ) ? sanitize_text_field( $params['song_id'] ) : '';
    $visitor_id = isset( $params['visitor_id'] ) ? sanitize_text_field( $params['visitor_id'] ) : '';

    if ( empty( $song_id ) ) {
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'missing_song_id',
            'message' => 'Song ID is required',
        ) );
    }

    $api_base   = self::get_rf_api_base();
    $remote_url = $api_base . '/addSequenceToQueue';

    // Map JS payload to RF expected payload
    $rf_payload = array(
        // If RF expects "sequence" instead of "sequenceId", we can flip this later.
        'sequenceId' => $song_id,
    );

    if ( $visitor_id !== '' ) {
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
            'body' => wp_json_encode( $rf_payload ),
        )
    );

    if ( is_wp_error( $response ) ) {
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'wp_remote_post',
            'url'     => $remote_url,
            'error'   => $response->get_error_message(),
        ) );
    }

    $code = wp_remote_retrieve_response_code( $response );
    $body = wp_remote_retrieve_body( $response );

    if ( $code < 200 || $code >= 300 ) {
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'rf_http_status',
            'url'     => $remote_url,
            'status'  => $code,
            'body'    => $body,
        ) );
    }

    $data = json_decode( $body, true );
    if ( json_last_error() !== JSON_ERROR_NONE ) {
        return rest_ensure_response( array(
            'success' => false,
            'where'   => 'rf_bad_json',
            'url'     => $remote_url,
            'raw'     => $body,
        ) );
    }

    return rest_ensure_response( array(
        'success' => true,
        'url'     => $remote_url,
        'data'    => $data,
    ) );
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
