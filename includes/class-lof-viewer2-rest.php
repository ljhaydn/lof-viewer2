<?php
/**
 * LOF Viewer V2 - REST API Handler
 * 
 * Handles all REST endpoints for RF proxy, FPP proxy, and speaker control.
 * Speaker logic implements invisible caps, song protection, and activity-based timing.
 * 
 * @package LOF_Viewer_V2
 * @version 0.2.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class LOF_Viewer2_REST {
    
    /**
     * Initialize REST routes
     */
    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
    }
    
    /**
     * Register all REST API routes
     */
    public static function register_routes() {
        
        // RF Proxy endpoints
        register_rest_route('lof-viewer/v1', '/show', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'handle_rf_show'),
            'permission_callback' => '__return_true',
        ));
        
        register_rest_route('lof-viewer/v1', '/request', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_rf_request'),
            'permission_callback' => '__return_true',
        ));
        
        register_rest_route('lof-viewer/v1', '/vote', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_rf_vote'),
            'permission_callback' => '__return_true',
        ));
        
        // FPP Proxy endpoints
        register_rest_route('lof-viewer/v1/fpp', '/status', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'handle_fpp_status'),
            'permission_callback' => '__return_true',
        ));
        
        // Speaker control endpoints
        register_rest_route('lof-viewer/v1', '/speaker', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'handle_speaker_status'),
            'permission_callback' => '__return_true',
        ));
        
        register_rest_route('lof-viewer/v1', '/speaker', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_speaker_enable'),
            'permission_callback' => '__return_true',
        ));
        
        register_rest_route('lof-viewer/v1/speaker', '/notify', array(
            'methods' => 'POST',
            'callback' => array(__CLASS__, 'handle_speaker_notify'),
            'permission_callback' => '__return_true',
        ));
    }
    
    // =========================================================================
    // RF PROXY ENDPOINTS
    // =========================================================================
    
    /**
     * Handle RF show details request
     */
    public static function handle_rf_show($request) {
        $rf_base = get_option('lof_viewer_rf_api_base', '');
        $rf_token = get_option('lof_viewer_rf_bearer_token', '');
        
        if (empty($rf_base) || empty($rf_token)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'RF API not configured',
            ), 500);
        }
        
        $url = trailingslashit($rf_base) . 'remoteViewerDetails';
        
        $response = wp_remote_get($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $rf_token,
            ),
            'timeout' => 10,
        ));
        
        if (is_wp_error($response)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $response->get_error_message(),
            ), 500);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return new WP_REST_Response(array(
            'success' => true,
            'data' => $data,
        ), 200);
    }
    
    /**
     * Handle RF song request
     */
    public static function handle_rf_request($request) {
        $params = $request->get_json_params();
        $song_id = $params['song_id'] ?? '';
        $visitor_id = $params['visitor_id'] ?? '';
        
        if (empty($song_id)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'song_id required',
            ), 400);
        }
        
        $rf_base = get_option('lof_viewer_rf_api_base', '');
        $rf_token = get_option('lof_viewer_rf_bearer_token', '');
        
        $url = trailingslashit($rf_base) . 'addSequenceToQueue';
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $rf_token,
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode(array(
                'sequence' => $song_id,
                'visitorId' => $visitor_id,
            )),
            'timeout' => 10,
        ));
        
        if (is_wp_error($response)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $response->get_error_message(),
            ), 500);
        }
        
        $status = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        // Track activity if speaker is on
        self::record_speaker_activity('SONG_REQUEST');
        
        return new WP_REST_Response(array(
            'success' => ($status >= 200 && $status < 300),
            'status' => $status,
            'data' => $data,
        ), $status);
    }
    
    /**
     * Handle RF vote request
     */
    public static function handle_rf_vote($request) {
        $params = $request->get_json_params();
        $song_id = $params['song_id'] ?? '';
        $visitor_id = $params['visitor_id'] ?? '';
        
        if (empty($song_id)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'song_id required',
            ), 400);
        }
        
        $rf_base = get_option('lof_viewer_rf_api_base', '');
        $rf_token = get_option('lof_viewer_rf_bearer_token', '');
        
        $url = trailingslashit($rf_base) . 'addVote';
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $rf_token,
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode(array(
                'sequence' => $song_id,
                'visitorId' => $visitor_id,
            )),
            'timeout' => 10,
        ));
        
        if (is_wp_error($response)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $response->get_error_message(),
            ), 500);
        }
        
        $status = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return new WP_REST_Response(array(
            'success' => ($status >= 200 && $status < 300),
            'status' => $status,
            'data' => $data,
        ), $status);
    }
    
    // =========================================================================
    // FPP PROXY ENDPOINTS
    // =========================================================================
    
    /**
     * Handle FPP status request
     */
    public static function handle_fpp_status($request) {
        $fpp_base = get_option('lof_viewer_fpp_base', 'http://10.9.7.102');
        $url = trailingslashit($fpp_base) . 'api/fppd/status';
        
        $response = wp_remote_get($url, array('timeout' => 5));
        
        if (is_wp_error($response)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $response->get_error_message(),
            ), 500);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return new WP_REST_Response(array(
            'success' => true,
            'data' => $data,
        ), 200);
    }
    
    // =========================================================================
    // SPEAKER CONTROL
    // =========================================================================
    
    /**
     * Get speaker status
     */
    public static function handle_speaker_status($request) {
        $state = self::get_speaker_state();
        $config = self::get_speaker_config();
        $now = time();
        
        // Get FPP status for fppPlaying
        $fpp_data = self::check_fpp_status_internal();
        $fpp_playing = $fpp_data['success'] && self::is_fpp_playing_song($fpp_data['data']);
        
        // Calculate remaining time
        $remaining = 0;
        if ($state['status'] === 'on') {
            if ($state['mode'] === 'ACTIVE_TIMER') {
                $remaining = max(0, $state['expires_at'] - $now);
            } else if ($state['mode'] === 'SONG_PROTECTION' && $fpp_data['success']) {
                $remaining = $fpp_data['data']['seconds_remaining'] ?? 0;
            }
        }
        
        // Determine proximity tier
        $remote_ip = self::get_client_ip();
        $tier_info = self::determine_speaker_tier($remote_ip);
        
        return new WP_REST_Response(array(
            'success' => true,
            'data' => array(
                'enabled' => $state['status'] === 'on',
                'remainingSeconds' => $remaining,
                'sessionStartedAt' => $state['session_started_at'],
                'sessionLifetimeStartedAt' => $state['session_lifetime_started_at'],
                'override' => $state['override'] ?? false,
                'mode' => $state['mode'] ?? 'automatic',
                'message' => $state['message'] ?? '',
                'source' => $state['last_source'] ?? '',
                'fppPlaying' => $fpp_playing,
                'currentSong' => $fpp_data['data']['current_sequence'] ?? null,
                'currentSongAudio' => $fpp_data['data']['current_song'] ?? null,
                'maxSessionReached' => ($now - $state['session_started_at']) >= 900,
                'lifetimeCapReached' => ($now - $state['session_lifetime_started_at']) >= 1800,
                'targetSongForShutoff' => $state['protected_sequence'] ?? null,
                'gracefulShutoff' => $state['mode'] === 'SONG_PROTECTION',
                'proximityTier' => $tier_info['tier'],
                'proximityReason' => $tier_info['reason'],
                'config' => array(
                    'fmFrequency' => $config['fm_frequency'] ?? '107.7',
                    'streamUrl' => $config['stream_url'] ?? '',
                    'noiseCurfewHour' => $config['noise_curfew_hour'] ?? 22,
                    'noiseCurfewEnabled' => $config['noise_curfew_enabled'] ?? true,
                    'noiseCurfewOverride' => $config['noise_curfew_override'] ?? false,
                ),
            ),
        ), 200);
    }
    
    /**
     * Enable/extend speaker
     */
    public static function handle_speaker_enable($request) {
        $params = $request->get_json_params();
        $source = $params['source'] ?? 'viewer';
        $is_extension = $params['extension'] ?? false;
        $proximity_confirmed = $params['proximity_confirmed'] ?? false;
        
        $state = self::get_speaker_state();
        $config = self::get_speaker_config();
        $now = time();
        $remote_ip = self::get_client_ip();
        
        // Per-user anti-spam cooldown
        $user_cooldown_key = 'lof_speaker_cooldown_' . md5($remote_ip);
        $last_press = get_transient($user_cooldown_key);
        
        if ($source !== 'physical' && $last_press && ($now - $last_press) < 5) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'Please wait a moment before pressing again',
                'errorCode' => 'RATE_LIMIT',
            ), 429);
        }
        
        set_transient($user_cooldown_key, $now, 10);
        
        // Check gating (curfew, geo, device, etc)
        $gating = self::check_speaker_gating($config, $state, $source, $remote_ip, $proximity_confirmed);
        
        if (!$gating['allowed']) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => $gating['message'],
                'errorCode' => $gating['code'],
            ), 403);
        }
        
        // Handle extension (activity)
        if ($is_extension && $state['status'] === 'on') {
            self::record_speaker_activity('MANUAL_EXTEND');
            
            return new WP_REST_Response(array(
                'success' => true,
                'data' => array('message' => 'Extended by 5 minutes'),
            ), 200);
        }
        
        // Fresh enable
        if ($state['status'] === 'off' || $state['status'] === '') {
            
            // Reset lifetime if enough time passed or first enable
            if ($state['session_lifetime_started_at'] === 0) {
                $state['session_lifetime_started_at'] = $now;
            }
            
            // Initialize new session
            $state['status'] = 'on';
            $state['mode'] = 'ACTIVE_TIMER';
            $state['session_started_at'] = $now;
            $state['expires_at'] = $now + ($config['duration_seconds'] ?? 300);
            $state['last_source'] = $source;
            $state['protected_sequence'] = null;
            $state['protected_song'] = null;
            $state['last_updated'] = $now;
            
            update_option('lof_viewer_v2_speaker_state', $state);
            
            // Trigger FPP script to turn on amplifier
            self::trigger_fpp_script($config['on_script'] ?? 'speaker-amp-on.sh');
            
            error_log("[LOF Speaker] Enabled by {$source} - 5:00 timer started");
            
            return new WP_REST_Response(array(
                'success' => true,
                'data' => array(
                    'message' => 'Speakers enabled - 5 minutes',
                    'remainingSeconds' => $config['duration_seconds'] ?? 300,
                ),
            ), 200);
        }
        
        // Already on
        return new WP_REST_Response(array(
            'success' => true,
            'data' => array('message' => 'Speakers already active'),
        ), 200);
    }
    
    /**
     * Handle notify from FPP scripts (physical button, amp on/off)
     */
    public static function handle_speaker_notify($request) {
        $params = $request->get_json_params();
        $status = $params['status'] ?? '';
        $source = $params['source'] ?? 'fpp';
        
        $state = self::get_speaker_state();
        $now = time();
        
        if ($status === 'on') {
            // Physical button pressed or script turned on
            if ($state['status'] !== 'on') {
                // Treat as fresh enable
                $state['status'] = 'on';
                $state['mode'] = 'ACTIVE_TIMER';
                $state['session_started_at'] = $now;
                $state['session_lifetime_started_at'] = $now;
                $state['expires_at'] = $now + 300;
                $state['last_source'] = $source;
                $state['last_updated'] = $now;
                
                update_option('lof_viewer_v2_speaker_state', $state);
                
                error_log("[LOF Speaker] Physical button enable detected");
            }
        } else if ($status === 'off') {
            // Script turned off (expected)
            error_log("[LOF Speaker] Amplifier off notification received");
        }
        
        return new WP_REST_Response(array('success' => true), 200);
    }
    
    // =========================================================================
    // SPEAKER HELPER FUNCTIONS
    // =========================================================================
    
    /**
     * Get speaker state from options
     */
    protected static function get_speaker_state() {
        $state = get_option('lof_viewer_v2_speaker_state', array());
        
        // Initialize default state
        $defaults = array(
            'status' => 'off',
            'mode' => 'automatic',
            'session_started_at' => 0,
            'session_lifetime_started_at' => 0,
            'expires_at' => 0,
            'last_source' => '',
            'protected_sequence' => null,
            'protected_song' => null,
            'grace_started_at' => 0,
            'override' => false,
            'message' => '',
            'last_updated' => 0,
        );
        
        return array_merge($defaults, $state);
    }
    
    /**
     * Get speaker configuration
     */
    protected static function get_speaker_config() {
        $config = get_option('lof_viewer_v2_speaker_config', array());
        
        $defaults = array(
            'duration_seconds' => 300,
            'max_session_seconds' => 900,
            'max_lifetime_seconds' => 1800,
            'noise_curfew_hour' => 22,
            'noise_curfew_enabled' => true,
            'noise_curfew_override' => false,
            'fpp_host' => get_option('lof_viewer_fpp_base', 'http://10.9.7.102'),
            'on_script' => 'speaker-amp-on.sh',
            'off_script' => 'speaker-amp-off.sh',
            'fm_frequency' => '107.7',
            'stream_url' => 'https://player.pulsemesh.io/d/G073',
            'geo_whitelist_ips' => array(),
            'geo_override_enabled' => false,
            'geo_override_tier' => 1,
            'device_gating_enabled' => false,
        );
        
        return array_merge($defaults, $config);
    }
    
    /**
     * Check if FPP is playing a song with audio
     */
    protected static function is_fpp_playing_song($fpp_data) {
        return !empty($fpp_data['current_sequence']) && !empty($fpp_data['current_song']);
    }
    
    /**
     * Check FPP status (internal use)
     */
    protected static function check_fpp_status_internal() {
        $fpp_base = get_option('lof_viewer_fpp_base', 'http://10.9.7.102');
        $url = trailingslashit($fpp_base) . 'api/fppd/status';
        
        $response = wp_remote_get($url, array('timeout' => 2));
        
        if (is_wp_error($response)) {
            return array('success' => false, 'error' => $response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return array(
            'success' => true,
            'data' => array(
                'mode_name' => $data['mode_name'] ?? 'unknown',
                'current_sequence' => $data['current_sequence'] ?? '',
                'current_song' => $data['current_song'] ?? '',
                'seconds_played' => $data['seconds_played'] ?? 0,
                'seconds_remaining' => $data['seconds_remaining'] ?? 0,
            ),
        );
    }
    
    /**
     * Record speaker activity (resets timer if conditions met)
     */
    protected static function record_speaker_activity($type) {
        $state = self::get_speaker_state();
        $now = time();
        
        if ($state['status'] !== 'on') {
            return; // Speaker not active
        }
        
        // Check session cap (15 minutes cumulative)
        $session_duration = $now - $state['session_started_at'];
        if ($session_duration >= 900) {
            error_log("[LOF Speaker] Activity ignored - session cap reached");
            return; // Don't reset timer
        }
        
        // Reset timer based on mode
        if ($state['mode'] === 'ACTIVE_TIMER') {
            $state['expires_at'] = $now + 300;
            update_option('lof_viewer_v2_speaker_state', $state);
            error_log("[LOF Speaker] Activity: {$type} - timer reset to 5:00");
            
        } else if ($state['mode'] === 'SONG_PROTECTION') {
            // Activity during protection - return to active timer
            $state['mode'] = 'ACTIVE_TIMER';
            $state['expires_at'] = $now + 300;
            $state['protected_sequence'] = null;
            $state['protected_song'] = null;
            update_option('lof_viewer_v2_speaker_state', $state);
            error_log("[LOF Speaker] Activity during protection - back to ACTIVE_TIMER");
        }
    }
    
    /**
     * Check speaker gating (curfew, geo, device, etc)
     */
    protected static function check_speaker_gating($config, $state, $source, $remote_ip, $proximity_confirmed) {
        
        // Physical button bypasses all gating
        if ($source === 'physical') {
            return array('allowed' => true);
        }
        
        // Override locked mode
        if ($state['override'] && $state['mode'] === 'locked_on') {
            return array(
                'allowed' => false,
                'code' => 'OVERRIDE_LOCKED',
                'message' => 'Viewer control is disabled during this event',
            );
        }
        
        // Noise curfew
        $current_hour = (int) date('G');
        if ($config['noise_curfew_enabled'] && 
            !$config['noise_curfew_override'] && 
            $current_hour >= $config['noise_curfew_hour']) {
            
            return array(
                'allowed' => false,
                'code' => 'NOISE_CURFEW',
                'message' => 'Outdoor speakers end at curfew to be good neighbors',
            );
        }
        
        // FPP reachability
        $fpp = self::check_fpp_status_internal();
        if (!$fpp['success']) {
            return array(
                'allowed' => false,
                'code' => 'FPP_UNREACHABLE',
                'message' => 'The show system is currently offline',
            );
        }
        
        // Geo-gating with whitelist support
        $tier_info = self::determine_speaker_tier($remote_ip);
        
        if ($tier_info['tier'] === 4 || $tier_info['tier'] === 5) {
            // Tier 4/5 blocked unless proximity confirmed
            if (!$proximity_confirmed) {
                return array(
                    'allowed' => false,
                    'code' => 'GEO_BLOCKED',
                    'message' => 'Outdoor speakers only available to guests at the show in Long Beach, CA',
                );
            }
        }
        
        // Device gating (optional)
        if ($config['device_gating_enabled']) {
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
        
        return array('allowed' => true);
    }
    
    /**
     * Determine speaker proximity tier
     */
    protected static function determine_speaker_tier($ip) {
        $config = self::get_speaker_config();
        
        // Check admin override
        if ($config['geo_override_enabled']) {
            return array(
                'tier' => $config['geo_override_tier'] ?? 1,
                'reason' => 'admin_override',
            );
        }
        
        // Check whitelist
        if (in_array($ip, $config['geo_whitelist_ips'])) {
            return array('tier' => 1, 'reason' => 'whitelisted');
        }
        
        // Check LAN
        if (self::is_lan_ip($ip)) {
            return array('tier' => 1, 'reason' => 'lan');
        }
        
        // Cloudflare headers for geo-detection
        $city = $_SERVER['HTTP_CF_IPCITY'] ?? '';
        $region = $_SERVER['HTTP_CF_REGION'] ?? '';
        $country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '';
        $postal = $_SERVER['HTTP_CF_POSTAL_CODE'] ?? '';
        
        // Tier 1: Long Beach / Signal Hill
        if (in_array(strtolower($city), array('long beach', 'signal hill'))) {
            return array('tier' => 1, 'reason' => 'long_beach');
        }
        
        if (strpos($postal, '908') === 0) {
            return array('tier' => 1, 'reason' => 'postal_908');
        }
        
        // Tier 2: Southern California
        if ($region === 'CA' && in_array(strtolower($city), array(
            'los angeles', 'torrance', 'carson', 'compton', 'lakewood', 
            'cerritos', 'bellflower', 'downey', 'norwalk'
        ))) {
            return array('tier' => 2, 'reason' => 'southern_california');
        }
        
        // Tier 3: Rest of California
        if ($region === 'CA') {
            return array('tier' => 3, 'reason' => 'california');
        }
        
        // Tier 4: Rest of US
        if ($country === 'US') {
            return array('tier' => 4, 'reason' => 'out_of_state');
        }
        
        // Tier 5: International
        return array('tier' => 5, 'reason' => 'international');
    }
    
    /**
     * Get client IP (Cloudflare-aware)
     */
    protected static function get_client_ip() {
        $remote_addr = $_SERVER['REMOTE_ADDR'] ?? '';
        
        // If request from Cloudflare, trust X-Forwarded-For
        if (self::is_cloudflare_ip($remote_addr)) {
            $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
            if ($forwarded) {
                $ips = array_map('trim', explode(',', $forwarded));
                $client_ip = $ips[0];
                
                // Check if it's LAN
                if (self::is_lan_ip($client_ip)) {
                    return $client_ip;
                }
            }
        }
        
        // Fall back to Cloudflare connecting IP or remote addr
        return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $remote_addr;
    }
    
    /**
     * Check if IP is LAN
     */
    protected static function is_lan_ip($ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }
        
        $parts = explode('.', $ip);
        if (count($parts) !== 4) {
            return false;
        }
        
        // 10.x.x.x
        if ($parts[0] === '10') {
            return true;
        }
        
        // 192.168.x.x
        if ($parts[0] === '192' && $parts[1] === '168') {
            return true;
        }
        
        // 172.16.x.x - 172.31.x.x
        if ($parts[0] === '172' && $parts[1] >= 16 && $parts[1] <= 31) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if IP is Cloudflare
     */
    protected static function is_cloudflare_ip($ip) {
        // Simplified check - in production, check against Cloudflare IP ranges
        return strpos($ip, '172.') === 0 || strpos($ip, '104.') === 0;
    }
    
    /**
     * Trigger FPP script
     */
    protected static function trigger_fpp_script($script_name) {
        $fpp_base = get_option('lof_viewer_fpp_base', 'http://10.9.7.102');
        $url = trailingslashit($fpp_base) . 'api/command/Run Script/' . urlencode($script_name);
        
        wp_remote_get($url, array('timeout' => 5, 'blocking' => false));
    }
}
