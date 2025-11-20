<?php
/**
 * REST proxy for Lights on Falcon Viewer v2
 * Merged class: RF + FPP + Speaker endpoints with geo-gating, device gating, and mid-song protection
 */

if (!defined('ABSPATH')) {
    exit;
}

class LOF_Viewer2_REST {

    const REST_NAMESPACE = 'lof-viewer/v1';
    const OPTION_RF_API_BASE = 'lof_viewer_rf_api_base';
    const OPTION_RF_BEARER_KEY = 'lof_viewer_rf_bearer_token';
    const OPTION_FPP_BASE = 'lof_viewer_fpp_base';
    const OPTION_SPEAKER_CONFIG = 'lof_viewer_v2_speaker_config';
    const OPTION_SPEAKER_STATE = 'lof_viewer_v2_speaker_state';

    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
    }

    public static function register_routes() {
        register_rest_route(self::REST_NAMESPACE, '/show', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'handle_show'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::REST_NAMESPACE, '/request', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_request'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::REST_NAMESPACE, '/vote', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_vote'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::REST_NAMESPACE, '/fpp/status', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'handle_fpp_status'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::REST_NAMESPACE, '/speaker', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'handle_speaker_status'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::REST_NAMESPACE, '/speaker', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_speaker_enable'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::REST_NAMESPACE, '/speaker/notify', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_speaker_notify'),
            'permission_callback' => '__return_true',
        ));
    }

    public static function handle_show(\WP_REST_Request $request) {
        $token = self::get_rf_bearer_token();
        if (!$token) {
            return rest_ensure_response(array(
                'success' => false,
                'where' => 'no_token',
                'message' => 'Remote Falcon bearer token not configured',
            ));
        }

        $api_base = self::get_rf_api_base();
        $remote_url = $api_base . '/showDetails';

        $response = wp_remote_get($remote_url, array(
            'timeout' => 10,
            'headers' => array(
                'Accept' => 'application/json',
                'Authorization' => 'Bearer ' . $token,
            ),
        ));

        if (is_wp_error($response)) {
            return rest_ensure_response(array(
                'success' => false,
                'where' => 'wp_remote_get',
                'url' => $remote_url,
                'error' => $response->get_error_message(),
            ));
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($code < 200 || $code >= 300) {
            return rest_ensure_response(array(
                'success' => false,
                'where' => 'rf_http_status',
                'url' => $remote_url,
                'status' => $code,
                'body' => $body,
            ));
        }

        $data = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return rest_ensure_response(array(
                'success' => false,
                'where' => 'rf_bad_json',
                'url' => $remote_url,
                'body' => $body,
            ));
        }

        return rest_ensure_response(array(
            'success' => true,
            'url' => $remote_url,
            'data' => $data,
        ));
    }

    public static function handle_request(\WP_REST_Request $request) {
        $token = self::get_rf_bearer_token();
        if (!$token) {
            return new \WP_Error('rf_no_token', 'Remote Falcon bearer token not configured', array('status' => 500));
        }

        $params = $request->get_json_params();
        $sequence = '';
        if (isset($params['sequence'])) {
            $sequence = sanitize_text_field($params['sequence']);
        } elseif (isset($params['song_id'])) {
            $sequence = sanitize_text_field($params['song_id']);
        }

        if ('' === $sequence) {
            return new \WP_Error('rf_missing_sequence', 'Song / sequence ID is required', array('status' => 400));
        }

        $api_base = self::get_rf_api_base();
        $remote_url = $api_base . '/addSequenceToQueue';

        $rf_payload = array('sequence' => $sequence);
        if (!empty($params['visitor_id'])) {
            $rf_payload['visitorId'] = sanitize_text_field($params['visitor_id']);
        }

        $response = wp_remote_post($remote_url, array(
            'timeout' => 10,
            'headers' => array(
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ),
            'body' => wp_json_encode($rf_payload),
        ));

        if (is_wp_error($response)) {
            return new \WP_Error('rf_http_error', $response->get_error_message(), array('status' => 502));
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $decoded = null;
        }

        return rest_ensure_response(array(
            'status' => $code,
            'data' => $decoded,
        ));
    }

    public static function handle_vote(\WP_REST_Request $request) {
        $token = self::get_rf_bearer_token();
        if (!$token) {
            return new \WP_Error('rf_no_token', 'Remote Falcon bearer token not configured', array('status' => 500));
        }

        $params = $request->get_json_params();
        $sequence = isset($params['song_id']) ? sanitize_text_field($params['song_id']) : '';

        if ('' === $sequence) {
            return new \WP_Error('rf_missing_sequence', 'Song / sequence ID is required', array('status' => 400));
        }

        $api_base = self::get_rf_api_base();
        $remote_url = $api_base . '/voteForSequence';

        $rf_payload = array('sequence' => $sequence);
        if (!empty($params['visitor_id'])) {
            $rf_payload['visitorId'] = sanitize_text_field($params['visitor_id']);
        }

        $response = wp_remote_post($remote_url, array(
            'timeout' => 10,
            'headers' => array(
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ),
            'body' => wp_json_encode($rf_payload),
        ));

        if (is_wp_error($response)) {
            return new \WP_Error('rf_http_error', $response->get_error_message(), array('status' => 502));
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $decoded = null;
        }

        return rest_ensure_response(array(
            'status' => $code,
            'data' => $decoded,
        ));
    }

    public static function handle_fpp_status(\WP_REST_Request $request) {
        $base = get_option(self::OPTION_FPP_BASE);
        if (!is_string($base) || '' === trim($base)) {
            $base = 'http://10.9.7.102';
        }

        $base = untrailingslashit(trim($base));
        $remote_url = $base . '/api/fppd/status';

        $response = wp_remote_get($remote_url, array(
            'timeout' => 5,
            'headers' => array('Accept' => 'application/json'),
        ));

        if (is_wp_error($response)) {
            return rest_ensure_response(array(
                'success' => false,
                'where' => 'wp_remote_get',
                'url' => $remote_url,
                'error' => $response->get_error_message(),
            ));
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($code < 200 || $code >= 300) {
            return rest_ensure_response(array(
                'success' => false,
                'where' => 'fpp_http_status',
                'url' => $remote_url,
                'status' => $code,
                'body' => $body,
            ));
        }

        $data = json_decode($body, true);
        if (JSON_ERROR_NONE !== json_last_error()) {
            return rest_ensure_response(array(
                'success' => false,
                'where' => 'fpp_bad_json',
                'url' => $remote_url,
                'body' => $body,
            ));
        }

        return rest_ensure_response(array(
            'success' => true,
            'url' => $remote_url,
            'data' => $data,
        ));
    }

    public static function handle_speaker_status(\WP_REST_Request $request) {
        $config = self::get_speaker_config();
        $state = self::get_speaker_state();
        $now = time();

        $remaining = max(0, $state['expires_at'] - $now);
        $enabled = ($state['status'] === 'on' && $remaining > 0);

        $fpp_status = self::check_fpp_playing();

        $remote_ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
        $tier_info = self::determine_speaker_tier($remote_ip);

        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'enabled' => $enabled,
                'remainingSeconds' => $remaining,
                'sessionStartedAt' => $state['session_started_at'],
                'sessionLifetimeStartedAt' => $state['session_lifetime_started_at'],
                'override' => $config['mode'] === 'locked_on',
                'mode' => $config['mode'],
                'message' => $config['override_message'],
                'source' => $state['last_source'],
                'fppPlaying' => $fpp_status['playing'],
                'currentSong' => $fpp_status['current_sequence'],
                'currentSongAudio' => $fpp_status['current_song_audio'],
                'maxSessionReached' => $state['max_session_reached'],
                'lifetimeCapReached' => $state['lifetime_cap_reached'],
                'targetSongForShutoff' => $state['target_song_for_shutoff'],
                'gracefulShutoff' => $state['graceful_shutoff'],
                'proximityTier' => $tier_info['tier'],
                'proximityReason' => $tier_info['reason'],
                'config' => array(
                    'fmFrequency' => $config['fm_frequency'],
                    'streamUrl' => $config['stream_url'],
                    'noiseCurfewHour' => $config['noise_curfew_hour'],
                    'noiseCurfewEnabled' => $config['noise_curfew_enabled'],
                    'noiseCurfewOverride' => $config['noise_curfew_override'],
                ),
            ),
        ));
    }

    public static function handle_speaker_enable(\WP_REST_Request $request) {
        $params = $request->get_json_params();
        $source = isset($params['source']) ? sanitize_text_field($params['source']) : 'viewer';
        $is_extension = isset($params['extension']) && $params['extension'];
        $proximity_confirmed = isset($params['proximity_confirmed']) && $params['proximity_confirmed'];

        $config = self::get_speaker_config();
        $state = self::get_speaker_state();
        $now = time();

        $remote_ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');

        $rate_limit_check = self::check_rate_limit($remote_ip, $source);
        if (!$rate_limit_check['allowed']) {
            return rest_ensure_response(array(
                'success' => false,
                'error' => $rate_limit_check['message'],
                'errorCode' => 'RATE_LIMIT',
            ));
        }

        $gating = self::check_speaker_gating($config, $state, $source, $remote_ip, $proximity_confirmed);
        if (!$gating['allowed']) {
            return rest_ensure_response(array(
                'success' => false,
                'error' => $gating['message'],
                'errorCode' => $gating['code'],
            ));
        }

        $remaining = max(0, $state['expires_at'] - $now);
        $is_on = ($state['status'] === 'on' && $remaining > 0);

        if ($is_on && $remaining > $config['extension_window_seconds'] && !$is_extension) {
            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'enabled' => true,
                    'remainingSeconds' => $remaining,
                    'sessionStartedAt' => $state['session_started_at'],
                    'message' => 'Speakers already on',
                ),
            ));
        }

        $script_result = self::trigger_fpp_script($config['on_script'], $config['fpp_host'], $config['fpp_api_key']);
        if (!$script_result['success']) {
            return rest_ensure_response(array(
                'success' => false,
                'error' => 'Failed to trigger speaker script',
                'errorCode' => 'FPP_SCRIPT_FAILED',
            ));
        }

        $session_start = $is_on ? $state['session_started_at'] : $now;
        $lifetime_start = $state['session_lifetime_started_at'] > 0 ? $state['session_lifetime_started_at'] : $now;
        $new_expires = $now + $config['duration_seconds'];

        $state['status'] = 'on';
        $state['expires_at'] = $new_expires;
        $state['session_started_at'] = $session_start;
        $state['session_lifetime_started_at'] = $lifetime_start;
        $state['last_source'] = $source;
        $state['last_updated'] = $now;
        $state['graceful_shutoff'] = false;
        $state['target_song_for_shutoff'] = null;
        $state['max_session_reached'] = false;
        $state['lifetime_cap_reached'] = false;

        self::save_speaker_state($state);
        self::set_rate_limit($remote_ip, $source);

        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'enabled' => true,
                'remainingSeconds' => $config['duration_seconds'],
                'sessionStartedAt' => $session_start,
                'sessionLifetimeStartedAt' => $lifetime_start,
                'message' => $is_extension ? 'Speaker extended' : 'Speaker enabled',
            ),
        ));
    }

    public static function handle_speaker_notify(\WP_REST_Request $request) {
        $params = $request->get_json_params();
        $status = isset($params['status']) ? sanitize_text_field($params['status']) : '';
        $source = isset($params['source']) ? sanitize_text_field($params['source']) : 'fpp';

        $state = self::get_speaker_state();
        $now = time();

        $state['last_notified_status'] = $status;
        $state['last_notified_at'] = $now;

        if ($status === 'on') {
            $config = self::get_speaker_config();
            if ($state['status'] !== 'on') {
                $state['status'] = 'on';
                $state['expires_at'] = $now + $config['duration_seconds'];
                $state['session_started_at'] = $now;
                $state['session_lifetime_started_at'] = $now;
            }
            $state['last_source'] = $source;
            $state['last_updated'] = $now;
        } elseif ($status === 'off') {
            $state['status'] = 'off';
            $state['expires_at'] = $now;
            $state['last_updated'] = $now;
            $state['session_lifetime_started_at'] = 0;
            $state['graceful_shutoff'] = false;
            $state['target_song_for_shutoff'] = null;
            $state['max_session_reached'] = false;
            $state['lifetime_cap_reached'] = false;
        }

        self::save_speaker_state($state);

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Notify received',
        ));
    }

    protected static function get_speaker_config() {
        $config = get_option(self::OPTION_SPEAKER_CONFIG);
        if (!is_array($config)) {
            $config = array();
        }

        return array_merge(array(
            'duration_seconds' => 300,
            'max_session_seconds' => 900,
            'extension_window_seconds' => 30,
            'max_lifetime_seconds' => 1800,
            'noise_curfew_hour' => 22,
            'noise_curfew_enabled' => true,
            'noise_curfew_override' => false,
            'mode' => 'automatic',
            'override_message' => '',
            'fpp_host' => 'http://10.9.7.102',
            'fpp_api_key' => '',
            'on_script' => 'speaker-amp-on.sh',
            'off_script' => 'speaker-amp-off.sh',
            'fm_frequency' => '107.7',
            'stream_url' => 'https://player.pulsemesh.io/d/G073',
            'geo_override_enabled' => false,
            'geo_override_tier' => 1,
            'geo_tier1_cities' => array('Long Beach', 'Signal Hill'),
            'geo_tier1_postal_prefixes' => array('908'),
            'geo_log_detections' => false,
        ), $config);
    }

    protected static function get_speaker_state() {
        $state = get_option(self::OPTION_SPEAKER_STATE);
        if (!is_array($state)) {
            $state = array();
        }

        return array_merge(array(
            'status' => 'off',
            'expires_at' => 0,
            'session_started_at' => 0,
            'session_lifetime_started_at' => 0,
            'last_source' => '',
            'last_updated' => 0,
            'graceful_shutoff' => false,
            'target_song_for_shutoff' => null,
            'max_session_reached' => false,
            'lifetime_cap_reached' => false,
            'last_notified_status' => '',
            'last_notified_at' => 0,
        ), $state);
    }

    protected static function save_speaker_state($state) {
        update_option(self::OPTION_SPEAKER_STATE, $state);
    }

    protected static function check_speaker_gating($config, $state, $source, $remote_ip, $proximity_confirmed) {
        $now = time();
        $current_hour = (int) date('G', $now);

        if ($config['mode'] === 'locked_on' && $source !== 'physical') {
            return array(
                'allowed' => false,
                'code' => 'OVERRIDE_LOCKED',
                'message' => $config['override_message'] ?: 'Speakers locked on for event',
            );
        }

        if ($config['noise_curfew_enabled'] && !$config['noise_curfew_override'] && $current_hour >= $config['noise_curfew_hour']) {
            return array(
                'allowed' => false,
                'code' => 'NOISE_CURFEW',
                'message' => 'Outdoor speakers end at curfew hour',
            );
        }

        $fpp_status = self::check_fpp_playing();
        if (!$fpp_status['reachable']) {
            return array(
                'allowed' => false,
                'code' => 'FPP_UNREACHABLE',
                'message' => 'Speaker control temporarily unavailable',
            );
        }

        if (!$fpp_status['playing']) {
            return array(
                'allowed' => false,
                'code' => 'NOT_PLAYING',
                'message' => 'Speakers only available when show is playing',
            );
        }

        $lifetime_duration = $now - $state['session_lifetime_started_at'];
        if ($state['session_lifetime_started_at'] > 0 && $lifetime_duration >= $config['max_lifetime_seconds']) {
            return array(
                'allowed' => false,
                'code' => 'LIFETIME_CAP_REACHED',
                'message' => 'Maximum session duration reached',
            );
        }

        if ($source !== 'physical') {
            $tier_info = self::determine_speaker_tier($remote_ip);
            
            if ($tier_info['tier'] === 4 || $tier_info['tier'] === 5) {
                return array(
                    'allowed' => false,
                    'code' => 'GEO_BLOCKED',
                    'message' => 'Outdoor speakers only available to guests at the show in Long Beach, CA',
                );
            }

            if (($tier_info['tier'] === 2 || $tier_info['tier'] === 3) && !$proximity_confirmed) {
                return array(
                    'allowed' => false,
                    'code' => 'PROXIMITY_CONFIRMATION_REQUIRED',
                    'message' => 'Please confirm you are at the show',
                );
            }

            $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $is_mobile = preg_match('/Android|iPhone|iPad|iPod/i', $user_agent);
            $is_lan = self::is_lan_ip($remote_ip);

            if (!$is_mobile && !$is_lan) {
                return array(
                    'allowed' => false,
                    'code' => 'DEVICE_BLOCKED',
                    'message' => 'Speaker control available from mobile devices or on-site networks',
                );
            }
        }

        return array('allowed' => true, 'code' => 'OK', 'message' => '');
    }

    protected static function determine_speaker_tier($ip) {
        $config = self::get_speaker_config();

        if ($config['geo_override_enabled']) {
            $tier = $config['geo_override_tier'];
            if ($config['geo_log_detections']) {
                error_log("[LOF Speaker Geo] Override active: tier {$tier}");
            }
            return array('tier' => $tier, 'reason' => 'override');
        }

        if (self::is_lan_ip($ip)) {
            return array('tier' => 1, 'reason' => 'lan');
        }

        $country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '';
        $region = $_SERVER['HTTP_CF_REGION'] ?? '';
        $city = $_SERVER['HTTP_CF_CITY'] ?? '';
        $postal = $_SERVER['HTTP_CF_POSTAL_CODE'] ?? '';

        if ($config['geo_log_detections']) {
            $masked_ip = preg_replace('/\.\d+$/', '.x', $ip);
            error_log(sprintf(
                '[LOF Speaker Geo] IP: %s | Country: %s | Region: %s | City: %s | Postal: %s',
                $masked_ip, $country, $region, $city, $postal
            ));
        }

        if ($country !== 'US') {
            return array('tier' => 5, 'reason' => 'international');
        }

        if ($region !== 'CA') {
            return array('tier' => 4, 'reason' => 'out_of_state');
        }

        foreach ($config['geo_tier1_cities'] as $nearby) {
            if (stripos($city, $nearby) !== false) {
                return array('tier' => 1, 'reason' => 'long_beach_area');
            }
        }

        foreach ($config['geo_tier1_postal_prefixes'] as $prefix) {
            if (substr($postal, 0, strlen($prefix)) === $prefix) {
                return array('tier' => 1, 'reason' => 'long_beach_postal');
            }
        }

        $socal_keywords = array('Los Angeles', 'Orange', 'San Diego', 'Riverside', 'San Bernardino');
        foreach ($socal_keywords as $keyword) {
            if (stripos($city, $keyword) !== false) {
                return array('tier' => 2, 'reason' => 'southern_california');
            }
        }

        return array('tier' => 3, 'reason' => 'california');
    }

    protected static function is_lan_ip($ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }

        $parts = explode('.', $ip);
        if (count($parts) !== 4) {
            return false;
        }

        if ($parts[0] === '10') {
            return true;
        }

        if ($parts[0] === '192' && $parts[1] === '168') {
            return true;
        }

        if ($parts[0] === '172') {
            $second = (int) $parts[1];
            if ($second >= 16 && $second <= 31) {
                return true;
            }
        }

        return false;
    }

    protected static function check_rate_limit($ip, $source) {
        if ($source === 'physical') {
            return array('allowed' => true);
        }

        $cooldown_seconds = 45;
        $cool_key = 'lof_speaker_ip_' . md5($ip);

        if (get_transient($cool_key)) {
            return array(
                'allowed' => false,
                'message' => 'Please wait before enabling speakers again',
            );
        }

        return array('allowed' => true);
    }

    protected static function set_rate_limit($ip, $source) {
        if ($source === 'physical') {
            return;
        }

        $cooldown_seconds = 45;
        $cool_key = 'lof_speaker_ip_' . md5($ip);
        set_transient($cool_key, 1, $cooldown_seconds);
    }

    protected static function check_fpp_playing() {
        $base = get_option(self::OPTION_FPP_BASE, 'http://10.9.7.102');
        $url = untrailingslashit($base) . '/api/fppd/status';

        $response = wp_remote_get($url, array('timeout' => 3));

        if (is_wp_error($response)) {
            return array('reachable' => false, 'playing' => false, 'current_sequence' => null, 'current_song_audio' => null, 'seconds_remaining' => 0);
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (!is_array($data)) {
            return array('reachable' => false, 'playing' => false, 'current_sequence' => null, 'current_song_audio' => null, 'seconds_remaining' => 0);
        }

        $status = isset($data['status_name']) ? $data['status_name'] : (isset($data['mode_name']) ? $data['mode_name'] : '');
        $playing = (stripos($status, 'playing') !== false);
        $current_sequence = isset($data['current_sequence']) ? $data['current_sequence'] : null;
        $current_song = isset($data['current_song']) ? $data['current_song'] : null;
        $seconds_remaining = isset($data['seconds_remaining']) ? (int)$data['seconds_remaining'] : 0;

        return array(
            'reachable' => true,
            'playing' => $playing,
            'current_sequence' => $current_sequence,
            'current_song_audio' => $current_song,
            'seconds_remaining' => $seconds_remaining,
        );
    }

    protected static function trigger_fpp_script($script_name, $fpp_host, $api_key) {
        $url = untrailingslashit($fpp_host) . '/api/command';

        $payload = array(
            'command' => 'Run Script',
            'args' => array($script_name),
        );

        $headers = array(
            'Content-Type' => 'application/json',
        );

        if (!empty($api_key)) {
            $headers['Authorization'] = 'Bearer ' . $api_key;
        }

        $response = wp_remote_post($url, array(
            'timeout' => 5,
            'headers' => $headers,
            'body' => wp_json_encode($payload),
        ));

        if (is_wp_error($response)) {
            return array('success' => false, 'error' => $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        return array('success' => ($code >= 200 && $code < 300));
    }

    protected static function get_rf_api_base() {
        $base = get_option(self::OPTION_RF_API_BASE);
        if (!is_string($base) || '' === trim($base)) {
            $base = 'https://getlitproductions.co/remote-falcon-external-api';
        }
        return untrailingslashit(trim($base));
    }

    protected static function get_rf_bearer_token() {
        $token = get_option(self::OPTION_RF_BEARER_KEY);
        return is_string($token) ? trim($token) : '';
    }
}