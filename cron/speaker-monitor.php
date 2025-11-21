<?php
/**
 * LOF Viewer V2 - Speaker Monitor Cron Script
 * 
 * Standalone script for system cron (not WP-Cron).
 * Handles speaker state machine: ACTIVE_TIMER → SONG_PROTECTION → OFF
 * Run every 15 seconds via system crontab.
 * 
 * @package LOF_Viewer_V2
 * @version 0.2.0
 */

// Load WordPress
$wp_load_path = dirname(dirname(dirname(dirname(__FILE__)))) . '/wp-load.php';

if (!file_exists($wp_load_path)) {
    error_log('[LOF Speaker Monitor] Could not find wp-load.php');
    exit(1);
}

require_once $wp_load_path;

// Run monitor
lof_speaker_monitor_check();

/**
 * Main monitor function
 */
function lof_speaker_monitor_check() {
    $state = get_option('lof_viewer_v2_speaker_state', array());
    $config = get_option('lof_viewer_v2_speaker_config', array());
    $now = time();
    
    // Default config values
    $config = array_merge(array(
        'fpp_host' => get_option('lof_viewer_fpp_base', 'http://10.9.7.102'),
        'off_script' => 'speaker-amp-off.sh',
    ), $config);
    
    // Nothing to do if speaker off
    if (!isset($state['status']) || $state['status'] !== 'on') {
        return;
    }
    
    $mode = $state['mode'] ?? 'ACTIVE_TIMER';
    
    // === MODE: ACTIVE_TIMER ===
    if ($mode === 'ACTIVE_TIMER') {
        lof_monitor_active_timer($state, $config, $now);
    }
    // === MODE: SONG_PROTECTION ===
    else if ($mode === 'SONG_PROTECTION') {
        lof_monitor_song_protection($state, $config, $now);
    }
    // === MODE: FPP_GRACE_PERIOD ===
    else if ($mode === 'FPP_GRACE_PERIOD') {
        lof_monitor_grace_period($state, $config, $now);
    }
}

/**
 * Monitor ACTIVE_TIMER mode
 */
function lof_monitor_active_timer($state, $config, $now) {
    $remaining = $state['expires_at'] - $now;
    
    // Timer not expired yet
    if ($remaining > 0) {
        return;
    }
    
    // Timer expired - check FPP
    $fpp = lof_check_fpp_status($config['fpp_host']);
    
    if (!$fpp['success']) {
        // FPP unreachable - enter grace period
        $state['mode'] = 'FPP_GRACE_PERIOD';
        $state['grace_started_at'] = $now;
        update_option('lof_viewer_v2_speaker_state', $state);
        error_log('[LOF Speaker Monitor] FPP unreachable - entering grace period');
        return;
    }
    
    // Check if song playing
    if (lof_is_song_playing($fpp['data'])) {
        // Song playing - enter protection mode
        $state['mode'] = 'SONG_PROTECTION';
        $state['protected_sequence'] = $fpp['data']['current_sequence'];
        $state['protected_song'] = $fpp['data']['current_song'];
        update_option('lof_viewer_v2_speaker_state', $state);
        error_log('[LOF Speaker Monitor] PROTECTION: ' . $fpp['data']['current_song']);
        return;
    } else {
        // No song - turn off immediately
        lof_turn_off_speaker($state, $config);
        error_log('[LOF Speaker Monitor] Timer expired, no song - turned off');
        return;
    }
}

/**
 * Monitor SONG_PROTECTION mode
 */
function lof_monitor_song_protection($state, $config, $now) {
    $fpp = lof_check_fpp_status($config['fpp_host']);
    
    if (!$fpp['success']) {
        // FPP lost during protection - grace period
        $state['mode'] = 'FPP_GRACE_PERIOD';
        $state['grace_started_at'] = $now;
        update_option('lof_viewer_v2_speaker_state', $state);
        error_log('[LOF Speaker Monitor] FPP lost during protection');
        return;
    }
    
    // Check if protected song ended
    if ($fpp['data']['current_sequence'] !== $state['protected_sequence']) {
        
        // Protected song ended - check caps BETWEEN songs
        $session_duration = $now - $state['session_started_at'];
        $lifetime_duration = $now - $state['session_lifetime_started_at'];
        
        $session_capped = ($session_duration >= 900);  // 15 minutes
        $lifetime_capped = ($lifetime_duration >= 1800); // 30 minutes
        
        if ($session_capped || $lifetime_capped) {
            // Cap reached - turn off (don't protect new song)
            lof_turn_off_speaker($state, $config);
            error_log('[LOF Speaker Monitor] Cap reached between songs - turned off');
            return;
        }
        
        // Under cap - check if new song started
        if (lof_is_song_playing($fpp['data'])) {
            // New song - update protection
            $state['protected_sequence'] = $fpp['data']['current_sequence'];
            $state['protected_song'] = $fpp['data']['current_song'];
            update_option('lof_viewer_v2_speaker_state', $state);
            error_log('[LOF Speaker Monitor] Protection updated: ' . $fpp['data']['current_song']);
            return;
        } else {
            // No new song - turn off
            lof_turn_off_speaker($state, $config);
            error_log('[LOF Speaker Monitor] No new song - turned off');
            return;
        }
    }
    
    // Protected song still playing - continue protection
}

/**
 * Monitor FPP_GRACE_PERIOD mode
 */
function lof_monitor_grace_period($state, $config, $now) {
    $grace_duration = $now - $state['grace_started_at'];
    
    // Grace period expired (30 seconds)
    if ($grace_duration > 30) {
        lof_turn_off_speaker($state, $config);
        error_log('[LOF Speaker Monitor] Grace period expired - turned off');
        return;
    }
    
    // Try FPP again
    $fpp = lof_check_fpp_status($config['fpp_host']);
    
    if ($fpp['success']) {
        // FPP recovered
        if (lof_is_song_playing($fpp['data'])) {
            // Song playing - protection mode
            $state['mode'] = 'SONG_PROTECTION';
            $state['protected_sequence'] = $fpp['data']['current_sequence'];
            $state['protected_song'] = $fpp['data']['current_song'];
            update_option('lof_viewer_v2_speaker_state', $state);
            error_log('[LOF Speaker Monitor] FPP recovered - protecting: ' . $fpp['data']['current_song']);
        } else {
            // No song - turn off
            lof_turn_off_speaker($state, $config);
            error_log('[LOF Speaker Monitor] FPP recovered, no song - turned off');
        }
    }
    
    // FPP still unreachable - stay in grace period
}

/**
 * Check FPP status
 */
function lof_check_fpp_status($fpp_host) {
    $url = trailingslashit($fpp_host) . 'api/fppd/status';
    
    $response = wp_remote_get($url, array('timeout' => 2));
    
    if (is_wp_error($response)) {
        return array('success' => false, 'error' => $response->get_error_message());
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (!$data) {
        return array('success' => false, 'error' => 'Invalid JSON response');
    }
    
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
 * Check if FPP is playing a song with audio
 */
function lof_is_song_playing($fpp_data) {
    return !empty($fpp_data['current_sequence']) && !empty($fpp_data['current_song']);
}

/**
 * Turn off speaker
 */
function lof_turn_off_speaker($state, $config) {
    // Trigger FPP script to turn off amplifier
    $fpp_host = $config['fpp_host'];
    $script = $config['off_script'];
    $url = trailingslashit($fpp_host) . 'api/command/Run Script/' . urlencode($script);
    
    wp_remote_get($url, array('timeout' => 5, 'blocking' => false));
    
    // Update state
    $state['status'] = 'off';
    $state['mode'] = 'automatic';
    $state['session_started_at'] = 0;
    $state['expires_at'] = 0;
    $state['protected_sequence'] = null;
    $state['protected_song'] = null;
    $state['grace_started_at'] = 0;
    $state['last_updated'] = time();
    
    // Keep session_lifetime_started_at for lifetime tracking
    
    update_option('lof_viewer_v2_speaker_state', $state);
}
