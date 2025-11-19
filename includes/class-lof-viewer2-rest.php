<?php
/**
 * LOF Viewer V2 REST API - Unified Gateway
 * 
 * Handles all REST endpoints for Viewer V2:
 * - Remote Falcon proxy (showDetails, request, vote)
 * - FPP status proxy
 * - Speaker control system
 * 
 * All browser JS must go through these endpoints - no direct RF/FPP calls.
 */

if (!defined('ABSPATH')) {
    exit;
}

class LOF_Viewer2_REST {
    
    // REST namespace
    const REST_NAMESPACE = 'lof-viewer/v1';
    
    // RF options
    const OPTION_RF_API_BASE = 'lof_viewer_rf_api_base';
    const OPTION_RF_BEARER_KEY = 'lof_viewer_rf_bearer_token';
    
    // FPP options
    const OPTION_FPP_BASE = 'lof_viewer_fpp_base';
    
    // Speaker options
    const OPTION_SPEAKER_CONFIG = 'lof_viewer_v2_speaker_config';
    const OPTION_SPEAKER_STATE = 'lof_viewer_v2_speaker_state';
    
    /**
     * Initialize REST API
     */
    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        
        // Initialize default speaker config if not exists
        if (!get_option(self::OPTION_SPEAKER_CONFIG)) {
            self::set_default_speaker_config();
        }
    }
    
    /**
     * Register all REST routes
     */
    public static function register_routes() {
        // ====================================
        // REMOTE FALCON ROUTES
        // ====================================
        
        // GET /wp-json/lof-viewer/v1/show
        register_rest_route(self::REST_NAMESPACE, '/show', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'handle_show'],
            'permission_callback' => '__return_true'
        ]);
        
        // POST /wp-json/lof-viewer/v1/request
        register_rest_route(self::REST_NAMESPACE, '/request', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'handle_request'],
            'permission_callback' => '__return_true'
        ]);
        
        // POST /wp-json/lof-viewer/v1/vote
        register_rest_route(self::REST_NAMESPACE, '/vote', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'handle_vote'],
            'permission_callback' => '__return_true'
        ]);
        
        // ====================================
        // FPP ROUTES
        // ====================================
        
        // GET /wp-json/lof-viewer/v1/fpp/status
        register_rest_route(self::REST_NAMESPACE, '/fpp/status', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'handle_fpp_status'],
            'permission_callback' => '__return_true'
        ]);
        
        // ====================================
        // SPEAKER ROUTES
        // ====================================
        
        // GET /wp-json/lof-viewer/v1/speaker
        register_rest_route(self::REST_NAMESPACE, '/speaker', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'handle_get_speaker_status'],
            'permission_callback' => '__return_true'
        ]);
        
        // POST /wp-json/lof-viewer/v1/speaker
        register_rest_route(self::REST_NAMESPACE, '/speaker', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'handle_enable_speaker'],
            'permission_callback' => '__return_true'
        ]);
        
        // POST /wp-json/lof-viewer/v1/speaker/notify
        register_rest_route(self::REST_NAMESPACE, '/speaker/notify', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'handle_speaker_notify'],
            'permission_callback' => '__return_true'
        ]);
    }
    
    // ========================================================================
    // REMOTE FALCON HANDLERS
    // ========================================================================
    
    /**
     * GET /wp-json/lof-viewer/v1/show
     * Proxies RF showDetails and normalizes response
     */
    public static function handle_show($request) {
        $token = self::get_rf_bearer_token();
        if (!$token) {
            return self::error_response('RF_NO_TOKEN', 'Remote Falcon bearer token not configured', 500);
        }
        
        $api_base = self::get_rf_api_base();
        $remote_url = $api_base . '/showDetails';
        
        $response = wp_remote_get($remote_url, [
            'timeout' => 10,
            'headers' => [
                'Accept' => 'application/json',
                'Authorization' => 'Bearer ' . $token
            ]
        ]);
        
        if (is_wp_error($response)) {
            return self::error_response('RF_HTTP_ERROR', $response->get_error_message(), 502);
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($code < 200 || $code >= 300) {
            return self::error_response('RF_HTTP_STATUS_' . $code, 'Remote Falcon returned HTTP ' . $code, 502);
        }
        
        $rf_data = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return self::error_response('RF_BAD_JSON', 'Remote Falcon returned invalid JSON', 502);
        }
        
        // Normalize RF response
        $normalized = self::normalize_rf_show_data($rf_data);
        
        return self::success_response($normalized);
    }
    
    /**
     * POST /wp-json/lof-viewer/v1/request
     * Proxies RF addSequenceToQueue
     */
    public static function handle_request($request) {
        $token = self::get_rf_bearer_token();
        if (!$token) {
            return self::error_response('RF_NO_TOKEN', 'Remote Falcon bearer token not configured', 500);
        }
        
        $params = $request->get_json_params();
        
        // Accept both "song_id" and "sequence" for flexibility
        $sequence = '';
        if (isset($params['sequence'])) {
            $sequence = sanitize_text_field($params['sequence']);
        } elseif (isset($params['song_id'])) {
            $sequence = sanitize_text_field($params['song_id']);
        }
        
        if (empty($sequence)) {
            return self::error_response('MISSING_SEQUENCE', 'Song/sequence ID is required', 400);
        }
        
        $api_base = self::get_rf_api_base();
        $remote_url = $api_base . '/addSequenceToQueue';
        
        // Map to RF payload format
        $rf_payload = [
            'sequence' => $sequence
        ];
        
        if (!empty($params['visitor_id'])) {
            $rf_payload['visitorId'] = sanitize_text_field($params['visitor_id']);
        }
        
        $response = wp_remote_post($remote_url, [
            'timeout' => 10,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => wp_json_encode($rf_payload)
        ]);
        
        if (is_wp_error($response)) {
            return self::error_response('RF_HTTP_ERROR', $response->get_error_message(), 502);
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);
        
        if ($code === 401) {
            return self::error_response('RF_UNAUTHORIZED', 'Remote Falcon authorization failed', 401);
        }
        
        if ($code < 200 || $code >= 300) {
            $message = is_array($decoded) && isset($decoded['message']) ? $decoded['message'] : 'Request failed';
            return self::error_response('RF_HTTP_STATUS_' . $code, $message, 502);
        }
        
        // Return normalized success
        return self::success_response([
            'message' => is_array($decoded) && isset($decoded['message']) ? $decoded['message'] : 'Request added to queue'
        ]);
    }
    
    /**
     * POST /wp-json/lof-viewer/v1/vote
     * Proxies RF voteForSequence
     */
    public static function handle_vote($request) {
        $token = self::get_rf_bearer_token();
        if (!$token) {
            return self::error_response('RF_NO_TOKEN', 'Remote Falcon bearer token not configured', 500);
        }
        
        $params = $request->get_json_params();
        
        // Accept both "song_id" and "sequence"
        $sequence = '';
        if (isset($params['sequence'])) {
            $sequence = sanitize_text_field($params['sequence']);
        } elseif (isset($params['song_id'])) {
            $sequence = sanitize_text_field($params['song_id']);
        }
        
        if (empty($sequence)) {
            return self::error_response('MISSING_SEQUENCE', 'Song/sequence ID is required', 400);
        }
        
        $api_base = self::get_rf_api_base();
        $remote_url = $api_base . '/voteForSequence';
        
        // Map to RF payload format
        $rf_payload = [
            'sequence' => $sequence
        ];
        
        if (!empty($params['visitor_id'])) {
            $rf_payload['visitorId'] = sanitize_text_field($params['visitor_id']);
        }
        
        $response = wp_remote_post($remote_url, [
            'timeout' => 10,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => wp_json_encode($rf_payload)
        ]);
        
        if (is_wp_error($response)) {
            return self::error_response('RF_HTTP_ERROR', $response->get_error_message(), 502);
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);
        
        if ($code === 401) {
            return self::error_response('RF_UNAUTHORIZED', 'Remote Falcon authorization failed', 401);
        }
        
        if ($code < 200 || $code >= 300) {
            $message = is_array($decoded) && isset($decoded['message']) ? $decoded['message'] : 'Vote failed';
            return self::error_response('RF_HTTP_STATUS_' . $code, $message, 502);
        }
        
        // Return normalized success
        return self::success_response([
            'message' => is_array($decoded) && isset($decoded['message']) ? $decoded['message'] : 'Vote recorded'
        ]);
    }
    
    // ========================================================================
    // FPP HANDLERS
    // ========================================================================
    
    /**
     * GET /wp-json/lof-viewer/v1/fpp/status
     * Proxies FPP status endpoint
     */
    public static function handle_fpp_status($request) {
        $fpp_base = self::get_fpp_base();
        $remote_url = $fpp_base . '/api/fppd/status';
        
        $response = wp_remote_get($remote_url, [
            'timeout' => 5,
            'headers' => [
                'Accept' => 'application/json'
            ]
        ]);
        
        if (is_wp_error($response)) {
            return self::error_response('FPP_UNREACHABLE', 'FPP is not reachable', 503);
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($code < 200 || $code >= 300) {
            return self::error_response('FPP_HTTP_STATUS_' . $code, 'FPP returned HTTP ' . $code, 503);
        }
        
        $fpp_data = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return self::error_response('FPP_BAD_JSON', 'FPP returned invalid JSON', 503);
        }
        
        // Normalize FPP response
        $normalized = self::normalize_fpp_status($fpp_data);
        
        return self::success_response($normalized);
    }
    
    // ========================================================================
    // SPEAKER HANDLERS
    // ========================================================================
    
    /**
     * GET /wp-json/lof-viewer/v1/speaker
     * Returns current speaker status with FPP context
     */
    public static function handle_get_speaker_status() {
        $config = get_option(self::OPTION_SPEAKER_CONFIG);
        $state = self::get_speaker_state();
        $now = time();
        
        // Check if timer expired
        $remaining = max(0, $state['expires_at'] - $now);
        $enabled = ($state['status'] === 'on' && $remaining > 0);
        
        // If timer expired but state says on, handle graceful shutoff
        if ($state['status'] === 'on' && $remaining === 0) {
            $enabled = self::handle_timer_expiration($state, $config);
            $remaining = max(0, $state['expires_at'] - $now);
        }
        
        // Get FPP status for context
        $fpp_status = self::get_fpp_status_internal($config['fpp_host']);
        $is_playing = ($fpp_status && $fpp_status['status_name'] === 'playing');
        
        // Get show schedule info
        $schedule_info = self::get_schedule_info($config['fpp_host']);
        
        // Build response
        return new WP_REST_Response([
            'success' => true,
            'data' => [
                'enabled' => $enabled,
                'remainingSeconds' => $remaining,
                'override' => ($config['mode'] === 'locked_on'),
                'mode' => $config['mode'],
                'message' => self::get_speaker_status_message($state, $config, $enabled, $remaining),
                'source' => $state['last_source'],
                'sessionStartedAt' => $state['session_started_at'], // PHP time() in seconds
                'fppPlaying' => $is_playing,
                'currentSong' => $fpp_status['current_sequence'] ?? null,
                'scheduleInfo' => $schedule_info,
                'config' => [
                    'fmFrequency' => $config['fm_frequency'],
                    'streamUrl' => $config['stream_url'],
                    'noiseCurfewHour' => $config['noise_curfew_hour'],
                    'noiseCurfewEnabled' => $config['noise_curfew_enabled'],
                    'noiseCurfewOverride' => $config['noise_curfew_override']
                ]
            ]
        ], 200);
    }
    
    /**
     * POST /wp-json/lof-viewer/v1/speaker
     * Enable or extend speaker session with FPP gating
     */
    public static function handle_enable_speaker($request) {
        $config = get_option(self::OPTION_SPEAKER_CONFIG);
        $state = self::get_speaker_state();
        $now = time();
        
        $source = $request->get_param('source') ?? 'viewer';
        $is_extension = $request->get_param('extension') ?? false;
        
        // CRITICAL: Backend gating with FPP check
        $gating = self::check_speaker_gating($config, $state, $source);
        if (!$gating['allowed']) {
            return new WP_REST_Response([
                'success' => false,
                'error' => $gating['message'],
                'errorCode' => $gating['code'],
                'data' => [
                    'enabled' => false,
                    'remainingSeconds' => 0
                ]
            ], 403);
        }
        
        $remaining = max(0, $state['expires_at'] - $now);
        $currently_on = ($state['status'] === 'on' && $remaining > 0);
        
        // Validate extension request
        if ($is_extension) {
            if (!$currently_on) {
                return self::error_response('NO_ACTIVE_SESSION', 'No active session to extend', 400);
            }
            
            if ($remaining > $config['extension_window_seconds']) {
                return self::error_response('EXTENSION_TOO_EARLY', 'Extension only available in last 30 seconds', 400);
            }
        }
        
        // Check max session limit (15 min)
        $session_duration = $now - $state['session_started_at'];
        if ($currently_on && $session_duration >= $config['max_session_seconds']) {
            return self::error_response('MAX_SESSION_REACHED', 'Maximum session duration reached (15 minutes)', 400);
        }
        
        // If not currently on, call FPP script
        if (!$currently_on) {
            $script_result = self::call_fpp_run_script($config['fpp_host'], $config['on_script'], $config['fpp_api_key']);
            
            if (!$script_result['ok']) {
                return self::error_response('FPP_UNREACHABLE', 'Could not reach speaker controller', 503);
            }
            
            // Initialize new session
            $state['status'] = 'on';
            $state['session_started_at'] = $now;
            $state['expires_at'] = $now + $config['duration_seconds'];
            $state['last_source'] = $source;
            $state['graceful_shutoff'] = false;
            $state['target_song'] = null;
        } else {
            // Extending existing session
            $new_duration = $config['duration_seconds'];
            
            // Check if extension would exceed max session
            $remaining_in_max = $config['max_session_seconds'] - $session_duration;
            if ($new_duration > $remaining_in_max) {
                $new_duration = max(30, $remaining_in_max);
            }
            
            $state['expires_at'] = $now + $new_duration;
            $state['last_source'] = $source;
        }
        
        $state['last_updated'] = $now;
        self::save_speaker_state($state);
        
        $new_remaining = $state['expires_at'] - $now;
        
        $message = $is_extension 
            ? 'Speaker time extended!' 
            : 'Speakers on. Enjoy the music!';
        
        return new WP_REST_Response([
            'success' => true,
            'data' => [
                'enabled' => true,
                'remainingSeconds' => $new_remaining,
                'sessionStartedAt' => $state['session_started_at'],
                'message' => $message,
                'source' => $source
            ]
        ], 200);
    }
    
    /**
     * POST /wp-json/lof-viewer/v1/speaker/notify
     * Webhook for FPP scripts to notify of physical button press
     */
    public static function handle_speaker_notify($request) {
        $config = get_option(self::OPTION_SPEAKER_CONFIG);
        $state = self::get_speaker_state();
        $now = time();
        
        $status = $request->get_param('status') ?? 'on';
        $source = $request->get_param('source') ?? 'physical';
        
        if ($status === 'on') {
            $state['status'] = 'on';
            $state['expires_at'] = $now + $config['duration_seconds'];
            $state['session_started_at'] = $now;
            $state['last_source'] = $source;
            $state['last_notified_status'] = 'on';
            $state['last_notified_at'] = $now;
            $state['last_updated'] = $now;
        } elseif ($status === 'off') {
            $state['status'] = 'off';
            $state['expires_at'] = 0;
            $state['last_source'] = $source;
            $state['last_notified_status'] = 'off';
            $state['last_notified_at'] = $now;
            $state['last_updated'] = $now;
        }
        
        self::save_speaker_state($state);
        
        return new WP_REST_Response([
            'success' => true,
            'message' => 'Notification received'
        ], 200);
    }
    
    // ========================================================================
    // RF NORMALIZATION
    // ========================================================================
    
    /**
     * Normalize Remote Falcon showDetails response
     * Converts RF format to V2 viewer format
     */
    private static function normalize_rf_show_data($rf_data) {
        $normalized = [
            'preferences' => [],
            'sequences' => [],
            'queue' => [],
            'playingNow' => null,
            'playingNext' => null,
            'playingNextFromSchedule' => null,
            'mode' => 'NONE',
            'viewerControlEnabled' => false
        ];
        
        // Extract preferences
        if (isset($rf_data['preferences'])) {
            $prefs = $rf_data['preferences'];
            $normalized['preferences'] = [
                'viewerControlEnabled' => $prefs['viewerControlEnabled'] ?? false,
                'viewerControlMode' => $prefs['viewerControlMode'] ?? 'NONE',
                'resetVotes' => $prefs['resetVotes'] ?? false,
                'jukeboxDepth' => $prefs['jukeboxDepth'] ?? 0,
                'locationCheckMethod' => $prefs['locationCheckMethod'] ?? 'NONE'
            ];
            
            $normalized['viewerControlEnabled'] = $prefs['viewerControlEnabled'] ?? false;
            $normalized['mode'] = $prefs['viewerControlMode'] ?? 'NONE';
        }
        
        // Normalize sequences array
        if (isset($rf_data['sequences']) && is_array($rf_data['sequences'])) {
            foreach ($rf_data['sequences'] as $seq) {
                $normalized['sequences'][] = [
                    'name' => $seq['name'] ?? '',
                    'displayName' => $seq['displayName'] ?? $seq['name'] ?? '',
                    'artist' => $seq['artist'] ?? '',
                    'duration' => $seq['duration'] ?? 0,
                    'index' => $seq['index'] ?? 0,
                    'visibilityCount' => $seq['visibilityCount'] ?? 0,
                    'type' => $seq['type'] ?? 'SONG'
                ];
            }
        }
        
        // CRITICAL: Normalize queue (requests[i].sequence is an OBJECT, not string)
        if (isset($rf_data['requests']) && is_array($rf_data['requests'])) {
            foreach ($rf_data['requests'] as $req) {
                if (isset($req['sequence']) && is_array($req['sequence'])) {
                    $normalized['queue'][] = [
                        'position' => $req['position'] ?? 0,
                        'sequence' => [
                            'name' => $req['sequence']['name'] ?? '',
                            'displayName' => $req['sequence']['displayName'] ?? $req['sequence']['name'] ?? '',
                            'artist' => $req['sequence']['artist'] ?? '',
                            'duration' => $req['sequence']['duration'] ?? 0
                        ],
                        'viewerRequested' => $req['viewerRequested'] ?? false
                    ];
                }
            }
        }
        
        // Current/next songs
        $normalized['playingNow'] = $rf_data['currentSequence'] ?? null;
        $normalized['playingNext'] = $rf_data['playingNext'] ?? null;
        $normalized['playingNextFromSchedule'] = $rf_data['playingNextFromSchedule'] ?? null;
        
        return $normalized;
    }
    
    // ========================================================================
    // FPP NORMALIZATION
    // ========================================================================
    
    /**
     * Normalize FPP status response
     */
    private static function normalize_fpp_status($fpp_data) {
        $status = 'unknown';
        if (isset($fpp_data['status_name'])) {
            $fpp_status = strtolower($fpp_data['status_name']);
            if ($fpp_status === 'playing') {
                $status = 'playing';
            } elseif ($fpp_status === 'idle') {
                $status = 'idle';
            } else {
                $status = 'stopped';
            }
        }
        
        return [
            'status' => $status,
            'currentSequence' => $fpp_data['current_sequence'] ?? null,
            'secondsRemaining' => $fpp_data['seconds_remaining'] ?? 0,
            'playlistName' => $fpp_data['current_playlist']['playlist'] ?? null
        ];
    }
    
    // ========================================================================
    // SPEAKER GATING & LOGIC
    // ========================================================================
    
    /**
     * Check if speaker can be enabled (authoritative backend gating)
     */
    private static function check_speaker_gating($config, $state, $source) {
        // Check 1: Override/locked mode
        if ($config['mode'] === 'locked_on') {
            $message = !empty($config['override_message']) 
                ? $config['override_message'] 
                : 'Speakers are locked on for tonight\'s event.';
            
            return [
                'allowed' => false,
                'code' => 'OVERRIDE_LOCKED',
                'message' => $message
            ];
        }
        
        // Check 2: Noise curfew
        if ($config['noise_curfew_enabled'] && !$config['noise_curfew_override']) {
            $current_hour = (int)date('H');
            if ($current_hour >= $config['noise_curfew_hour']) {
                return [
                    'allowed' => false,
                    'code' => 'NOISE_CURFEW',
                    'message' => 'Outdoor speakers end at ' . $config['noise_curfew_hour'] . ':00 to be good neighbors. Try FM ' . $config['fm_frequency'] . ' or the stream!'
                ];
            }
        }
        
        // Check 3: FPP must be playing (CRITICAL GATING)
        $fpp_status = self::get_fpp_status_internal($config['fpp_host']);
        
        if (!$fpp_status) {
            return [
                'allowed' => false,
                'code' => 'FPP_UNREACHABLE',
                'message' => 'Speaker control is temporarily unavailable.'
            ];
        }
        
        if ($fpp_status['status_name'] !== 'playing') {
            return [
                'allowed' => false,
                'code' => 'NOT_PLAYING',
                'message' => 'Speakers are only available when the show is actively playing.'
            ];
        }
        
        // All checks passed
        return [
            'allowed' => true,
            'code' => 'OK',
            'message' => ''
        ];
    }
    
    /**
     * Handle timer expiration with graceful shutoff
     */
    private static function handle_timer_expiration($state, $config) {
        $now = time();
        
        // Check if we're mid-song
        $fpp_status = self::get_fpp_status_internal($config['fpp_host']);
        
        if ($fpp_status && $fpp_status['status_name'] === 'playing') {
            $remaining = $fpp_status['seconds_remaining'] ?? 0;
            
            if ($remaining > 0 && $remaining < 300) { // Less than 5 min left in song
                // Extend timer to end of song
                $state['expires_at'] = $now + $remaining + 10; // +10s buffer
                $state['graceful_shutoff'] = true;
                $state['target_song'] = $fpp_status['current_sequence'] ?? null;
                self::save_speaker_state($state);
                
                return true; // Still enabled
            }
        }
        
        // Timer expired, no mid-song protection needed
        // Call off script
        self::call_fpp_run_script($config['fpp_host'], $config['off_script'], $config['fpp_api_key']);
        
        $state['status'] = 'off';
        $state['expires_at'] = 0;
        $state['graceful_shutoff'] = false;
        self::save_speaker_state($state);
        
        return false; // Now disabled
    }
    
    /**
     * Get speaker status message
     */
    private static function get_speaker_status_message($state, $config, $enabled, $remaining) {
        if ($config['mode'] === 'locked_on') {
            return $config['override_message'] ?: 'Speakers are on for tonight\'s event!';
        }
        
        if ($enabled) {
            $mins = ceil($remaining / 60);
            if ($mins > 1) {
                return "Speakers on for about {$mins} more minutes. Enjoy the music!";
            }
            return "Speakers on - less than a minute remaining.";
        }
        
        return 'Speakers are off. Tap "Need Sound?" to turn them on!';
    }
    
    // ========================================================================
    // SPEAKER STATE MANAGEMENT
    // ========================================================================
    
    /**
     * Get speaker state from WP options
     */
    private static function get_speaker_state() {
        $state = get_option(self::OPTION_SPEAKER_STATE);
        
        if (!is_array($state)) {
            $state = [];
        }
        
        $defaults = [
            'status' => 'off',
            'expires_at' => 0,
            'session_started_at' => 0,
            'last_source' => '',
            'last_updated' => 0,
            'last_notified_status' => '',
            'last_notified_at' => 0,
            'graceful_shutoff' => false,
            'target_song' => null
        ];
        
        return array_merge($defaults, $state);
    }
    
    /**
     * Save speaker state to WP options
     */
    private static function save_speaker_state($state) {
        update_option(self::OPTION_SPEAKER_STATE, $state, false);
    }
    
    /**
     * Set default speaker configuration
     */
    private static function set_default_speaker_config() {
        $defaults = [
            'duration_seconds' => 300,
            'max_session_seconds' => 900,
            'extension_window_seconds' => 30,
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
            'enable_weather_awareness' => true,
            'enable_proximity_hints' => true,
            'enable_session_stats' => true
        ];
        
        update_option(self::OPTION_SPEAKER_CONFIG, $defaults, false);
    }
    
    // ========================================================================
    // FPP UTILITIES
    // ========================================================================
    
    /**
     * Get FPP status (internal use for gating)
     */
    private static function get_fpp_status_internal($fpp_host) {
        $url = rtrim($fpp_host, '/') . '/api/fppd/status';
        
        $response = wp_remote_get($url, ['timeout' => 3]);
        
        if (is_wp_error($response)) {
            return null;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        return is_array($data) ? $data : null;
    }
    
    /**
     * Get show schedule info from FPP
     */
    private static function get_schedule_info($fpp_host) {
        $url = rtrim($fpp_host, '/') . '/api/schedule';
        
        $response = wp_remote_get($url, ['timeout' => 3]);
        
        if (is_wp_error($response)) {
            return [
                'available' => false,
                'showActive' => false,
                'nextShowStart' => null
            ];
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!is_array($data)) {
            return [
                'available' => false,
                'showActive' => false,
                'nextShowStart' => null
            ];
        }
        
        // Basic schedule parsing (FPP version dependent)
        return [
            'available' => true,
            'showActive' => false,
            'nextShowStart' => null
        ];
    }
    
    /**
     * Call FPP Run Script command
     */
    private static function call_fpp_run_script($fpp_host, $script_name, $api_key = '') {
        $url = rtrim($fpp_host, '/') . '/api/command';
        
        $payload = [
            'command' => 'Run Script',
            'args' => [$script_name]
        ];
        
        $args = [
            'method' => 'POST',
            'timeout' => 5,
            'headers' => [
                'Content-Type' => 'application/json'
            ],
            'body' => wp_json_encode($payload)
        ];
        
        if (!empty($api_key)) {
            $args['headers']['Authorization'] = 'Bearer ' . $api_key;
        }
        
        $response = wp_remote_post($url, $args);
        
        if (is_wp_error($response)) {
            return [
                'ok' => false,
                'error' => $response->get_error_message()
            ];
        }
        
        $code = wp_remote_retrieve_response_code($response);
        
        return [
            'ok' => ($code >= 200 && $code < 300),
            'code' => $code
        ];
    }
    
    // ========================================================================
    // OPTIONS GETTERS
    // ========================================================================
    
    /**
     * Get RF API base URL
     */
    private static function get_rf_api_base() {
        $base = get_option(self::OPTION_RF_API_BASE);
        
        if (!is_string($base) || trim($base) === '') {
            $base = 'https://getlitproductions.co/remote-falcon-external-api';
        }
        
        return untrailingslashit(trim($base));
    }
    
    /**
     * Get RF bearer token
     */
    private static function get_rf_bearer_token() {
        $token = get_option(self::OPTION_RF_BEARER_KEY);
        return is_string($token) ? trim($token) : '';
    }
    
    /**
     * Get FPP base URL
     */
    private static function get_fpp_base() {
        $base = get_option(self::OPTION_FPP_BASE);
        
        if (!is_string($base) || trim($base) === '') {
            $base = 'http://10.9.7.102';
        }
        
        return untrailingslashit(trim($base));
    }
    
    // ========================================================================
    // RESPONSE HELPERS
    // ========================================================================
    
    /**
     * Return normalized success response
     */
    private static function success_response($data, $code = 200) {
        return new WP_REST_Response([
            'success' => true,
            'data' => $data,
            'error' => null,
            'errorCode' => null,
            'timestamp' => time()
        ], $code);
    }
    
    /**
     * Return normalized error response
     */
    private static function error_response($errorCode, $message, $httpCode = 400) {
        return new WP_REST_Response([
            'success' => false,
            'data' => null,
            'error' => $message,
            'errorCode' => $errorCode,
            'timestamp' => time()
        ], $httpCode);
    }
}
