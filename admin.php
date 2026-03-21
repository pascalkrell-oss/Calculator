<?php
if ( ! defined( 'ABSPATH' ) ) exit;

function src_load_vds_mapping_blueprint() {
    $mapping_file = SRC_PLUGIN_DIR . 'config/vds-gagenkompass-2025.mapping.json';

    if ( ! file_exists( $mapping_file ) || ! is_readable( $mapping_file ) ) {
        return array();
    }

    $contents = file_get_contents( $mapping_file );
    if ( false === $contents || '' === $contents ) {
        return array();
    }

    $decoded = json_decode( $contents, true );

    return ( JSON_ERROR_NONE === json_last_error() && is_array( $decoded ) ) ? $decoded : array();
}

// Admin-Menüpunkt hinzufügen
function src_add_admin_menu() {
    add_options_page(
        'Gagenrechner Einstellungen', // Seitentitel
        'Gagenrechner',               // Menütitel
        'manage_options',             // Berechtigung
        'src-calculator-settings',    // Slug
        'src_settings_page_html'      // Callback-Funktion
    );
}
add_action('admin_menu', 'src_add_admin_menu');

// HTML der Einstellungsseite
function src_settings_page_html() {
    // Speichern, wenn Formular gesendet wurde
    if ( isset( $_POST['src_rates_json'] ) && check_admin_referer( 'src_save_settings' ) ) {
        $json_input = wp_unslash( $_POST['src_rates_json'] );
        $decoded    = json_decode( $json_input, true );

        if ( JSON_ERROR_NONE === json_last_error() && is_array( $decoded ) ) {
            update_option( 'src_rates_json', wp_json_encode( $decoded, JSON_UNESCAPED_UNICODE ) );
            echo '<div class="notice notice-success is-dismissible"><p>Einstellungen gespeichert!</p></div>';
        } else {
            echo '<div class="notice notice-error is-dismissible"><p>Fehler: Ungültiges JSON Format.</p></div>';
        }
    }

    // Aktuellen Wert holen oder Default
    $current_json = get_option( 'src_rates_json' );
    if ( ! is_string( $current_json ) || '' === $current_json ) {
        $current_json = src_get_default_json();
    }

    // JSON hübsch formatieren für die Anzeige
    $pretty_json = json_encode(json_decode($current_json), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    ?>
    <div class="wrap">
        <h1>Gagenrechner Konfiguration</h1>
        <p>Hier können Sie die Basispreise und Faktoren für den Rechner anpassen. Bitte achten Sie auf valides JSON Format.</p>
        
        <form method="post" action="">
            <?php wp_nonce_field('src_save_settings'); ?>
            
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">Preis-Konfiguration (JSON)</th>
                    <td>
                        <textarea name="src_rates_json" rows="25" cols="80" style="font-family:monospace; width:100%; background:#f0f0f1;"><?php echo esc_textarea($pretty_json); ?></textarea>
                        <p class="description">Bearbeiten Sie hier die Preise, Limits und Lizenztexte.</p>
                    </td>
                </tr>
            </table>
            
            <?php submit_button(); ?>
        </form>
        
        <div class="card" style="max-width:800px; margin-top:20px;">
            <h3>Anleitung</h3>
            <p><strong>Base:</strong> Array mit [Low, Mid, High] Preisen.<br>
            <strong>Tiers:</strong> Staffelung nach Minuten.<br>
            <strong>Extra:</strong> Kosten für Zusatzminuten oder Module.</p>
        </div>
    </div>
    <?php
}

// Hilfsfunktion: Default JSON Daten (Fallback)
function src_get_default_json() {
    $vds_mapping_blueprint = src_load_vds_mapping_blueprint();

    $config = array(
        'schema_version' => 'vds-2025.1',
        'vds2025' => array(
            'taxonomy' => array(
                'werbung_mit_bild' => array('label' => 'Werbung mit Bild', 'cases' => array('tv', 'online_paid', 'cinema', 'pos')),
                'werbung_ohne_bild' => array('label' => 'Werbung ohne Bild', 'cases' => array('radio')),
                'webvideo_imagefilm_praesentation_unpaid' => array('label' => 'Webvideo, Imagefilm, Präsentation – Unpaid Media', 'cases' => array('imagefilm', 'explainer', 'webvideo_unpaid', 'presentation_unpaid')),
                'app' => array('label' => 'App', 'cases' => array('app')),
                'telefonansage' => array('label' => 'Telefonansage', 'cases' => array('phone')),
                'elearning_audioguide' => array('label' => 'E-Learning, Audioguide', 'cases' => array('elearning', 'audioguide')),
                'podcast' => array('label' => 'Podcast', 'cases' => array('podcast')),
                'hoerbuch' => array('label' => 'Hörbuch', 'cases' => array('audiobook')),
                'games' => array('label' => 'Games', 'cases' => array('games')),
                'redaktionelle_inhalte_doku_tv_reportagen' => array('label' => 'Redaktionelle Inhalte, Dokumentarfilme, TV-Reportagen', 'cases' => array('doku', 'editorial_tv')),
                'audiodeskription_ad' => array('label' => 'Audiodeskription (AD)', 'cases' => array('audiodescription')),
                'kleinraeumig' => array('label' => 'Kleinräumig', 'cases' => array('kleinraeumig'))
            ),
            'license_model' => array(
                'region' => array('regional' => 0.8, 'national' => 1.0, 'dach' => 2.5, 'world' => 4.0),
                'duration_years' => array('1' => 1.0, '2' => 2.0, '3' => 3.0, '4' => 4.0),
                'language' => array('de' => 1.0, 'en' => 1.3, 'other' => 1.5)
            ),
            'cases' => array(
                'tv' => array('category' => 'werbung_mit_bild', 'name' => 'TV Spot', 'pricing' => array('kind' => 'flat', 'base' => array(600, 700, 800)), 'license_type' => 'advertising', 'notes' => array('Lineares TV-Programm im gewählten Gebiet.')),
                'online_paid' => array('category' => 'werbung_mit_bild', 'name' => 'Online Paid Media', 'pricing' => array('kind' => 'flat', 'base' => array(600, 700, 800)), 'license_type' => 'advertising', 'paid' => true, 'notes' => array('Pre-Roll, Story Ads, Social Paid.')),
                'radio' => array('category' => 'werbung_ohne_bild', 'name' => 'Funkspot', 'pricing' => array('kind' => 'flat', 'base' => array(450, 500, 550)), 'license_type' => 'advertising'),
                'cinema' => array('category' => 'werbung_mit_bild', 'name' => 'Kino Spot', 'pricing' => array('kind' => 'flat', 'base' => array(600, 700, 800)), 'license_type' => 'advertising'),
                'pos' => array('category' => 'werbung_mit_bild', 'name' => 'POS / Ladenfunk', 'pricing' => array('kind' => 'flat', 'base' => array(600, 700, 800)), 'license_type' => 'advertising', 'variants' => array('pos_spot' => array('name' => 'POS Spot (mit Bild)', 'base' => array(600,700,800)), 'ladenfunk' => array('name' => 'Ladenfunk (ohne Bild)', 'base' => array(450,550,650)))),
                'imagefilm' => array('category' => 'webvideo_imagefilm_praesentation_unpaid', 'name' => 'Imagefilm', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 2, 'p' => array(300,350,400)), array('limit' => 5, 'p' => array(350,450,500))), 'extra' => array(60,75,90), 'extra_unit' => 1, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'explainer' => array('category' => 'webvideo_imagefilm_praesentation_unpaid', 'name' => 'Erklärvideo', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 2, 'p' => array(300,350,400)), array('limit' => 5, 'p' => array(350,450,500))), 'extra' => array(60,75,90), 'extra_unit' => 1, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'webvideo_unpaid' => array('category' => 'webvideo_imagefilm_praesentation_unpaid', 'name' => 'Webvideo (Unpaid)', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 2, 'p' => array(300,350,400)), array('limit' => 5, 'p' => array(350,450,500))), 'extra' => array(60,75,90), 'extra_unit' => 1, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'presentation_unpaid' => array('category' => 'webvideo_imagefilm_praesentation_unpaid', 'name' => 'Präsentation (Unpaid)', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 2, 'p' => array(300,350,400)), array('limit' => 5, 'p' => array(350,450,500))), 'extra' => array(60,75,90), 'extra_unit' => 1, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'app' => array('category' => 'app', 'name' => 'App Voiceover', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 2, 'p' => array(300,350,400)), array('limit' => 5, 'p' => array(350,450,500))), 'extra' => array(60,75,90), 'extra_unit' => 1, 'extra_after' => 5), 'license_type' => 'mixed'),
                'elearning' => array('category' => 'elearning_audioguide', 'name' => 'E-Learning', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 5, 'p' => array(300,350,400))), 'extra' => array(60,75,90), 'extra_unit' => 5, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'audioguide' => array('category' => 'elearning_audioguide', 'name' => 'Audioguide', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 5, 'p' => array(300,350,400))), 'extra' => array(60,75,90), 'extra_unit' => 5, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'podcast' => array('category' => 'podcast', 'name' => 'Podcast', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 5, 'p' => array(300,350,400))), 'extra' => array(60,75,90), 'extra_unit' => 5, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'audiobook' => array('category' => 'hoerbuch', 'name' => 'Hörbuch', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 5, 'p' => array(300,350,400))), 'extra' => array(60,75,90), 'extra_unit' => 5, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'games' => array('category' => 'games', 'name' => 'Games', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 5, 'p' => array(300,350,400))), 'extra' => array(60,75,90), 'extra_unit' => 5, 'extra_after' => 5), 'license_type' => 'mixed'),
                'doku' => array('category' => 'redaktionelle_inhalte_doku_tv_reportagen', 'name' => 'Doku / Reportage', 'pricing' => array('kind' => 'per_minute', 'min' => array(150,250,350), 'per_min' => array(10,15,20)), 'license_type' => 'editorial'),
                'editorial_tv' => array('category' => 'redaktionelle_inhalte_doku_tv_reportagen', 'name' => 'Redaktioneller TV-Beitrag', 'pricing' => array('kind' => 'per_minute', 'min' => array(150,250,350), 'per_min' => array(10,15,20)), 'license_type' => 'editorial'),
                'audiodescription' => array('category' => 'audiodeskription_ad', 'name' => 'Audiodeskription (AD)', 'pricing' => array('kind' => 'per_minute', 'min' => array(150,250,350), 'per_min' => array(10,15,20)), 'license_type' => 'editorial'),
                'kleinraeumig' => array('category' => 'kleinraeumig', 'name' => 'Kleinräumige Nutzung', 'pricing' => array('kind' => 'tiered', 'unit' => 'minutes', 'tiers' => array(array('limit' => 2, 'p' => array(180,240,300)), array('limit' => 5, 'p' => array(240,300,360))), 'extra' => array(40,55,70), 'extra_unit' => 1, 'extra_after' => 5), 'license_type' => 'unpaid'),
                'phone' => array('category' => 'telefonansage', 'name' => 'Telefonansage', 'pricing' => array('kind' => 'tiered', 'unit' => 'modules', 'tiers' => array(array('limit' => 3, 'p' => array(180,240,300))), 'extra' => array(50,60,70), 'extra_unit' => 1, 'extra_after' => 3), 'license_type' => 'unpaid')
            ),
            'addons' => array(
                'social_organic' => array('levels' => array('low' => 50, 'mid' => 150, 'high' => 250)),
                'event_pos' => array('levels' => array('low' => 50, 'mid' => 150, 'high' => 250)),
                'internal_use' => array('flat' => 120)
            ),
            'mapping_blueprint' => $vds_mapping_blueprint
        ),
        'script_estimation' => array(
            'wpm' => array('de' => 150, 'en' => 160, 'other' => 150),
            'min_minutes' => 0.1,
            'max_minutes' => 20
        ),
        'license_multipliers' => array(
            'default_advertising' => array(
                'region' => array('regional' => 0.8, 'national' => 1.0, 'dach' => 2.5, 'world' => 4.0),
                'duration' => array('1' => 1.0, '2' => 2.0, '3' => 3.0, '4' => 4.0)
            )
        ),
        'complexity_factors' => array(
            'corridor' => array('min' => 0.08, 'max' => 0.15),
            'variants' => array('label' => 'Versionen/Varianten', 'options' => array(array('key' => '1', 'label' => '1', 'factor' => 1.0), array('key' => '2-3', 'label' => '2–3', 'factor' => 1.05), array('key' => '4+', 'label' => '4+', 'factor' => 1.1))),
            'revisions' => array('label' => 'Korrekturschleifen', 'options' => array(array('key' => '1', 'label' => 'inkl. 1', 'factor' => 1.0), array('key' => '2', 'label' => '2', 'factor' => 1.05), array('key' => '3+', 'label' => '3+', 'factor' => 1.1))),
            'style' => array('label' => 'Spezialstil', 'options' => array(array('key' => 'normal', 'label' => 'normal', 'factor' => 1.0), array('key' => 'technical', 'label' => 'technisch', 'factor' => 1.05), array('key' => 'medical', 'label' => 'medizinisch', 'factor' => 1.1), array('key' => 'emotional', 'label' => 'sehr emotional', 'factor' => 1.12))),
            'timing' => array('label' => 'Timing/Synchro', 'options' => array(array('key' => 'free', 'label' => 'frei', 'factor' => 1.0), array('key' => 'guided', 'label' => 'an Bild grob', 'factor' => 1.05), array('key' => 'lipsync', 'label' => 'lipsync', 'factor' => 1.15))),
            'editing' => array('label' => 'Schnitt/Editing', 'options' => array(array('key' => 'none', 'label' => 'keins', 'factor' => 1.0), array('key' => 'basic', 'label' => 'Basic', 'factor' => 1.05), array('key' => 'advanced', 'label' => 'umfangreich', 'factor' => 1.12))),
            'deliverables' => array('label' => 'Deliverables', 'options' => array(array('key' => 'single', 'label' => 'ein Format', 'factor' => 1.0), array('key' => 'multiple', 'label' => 'mehrere', 'factor' => 1.03)))
        ),
        'field_tips' => array(
            'default' => array(
                'length' => 'Tipp: Text oder Dauer eingeben für eine präzisere Schätzung.',
                'region' => 'Tipp: Größere Gebiete erhöhen Reichweite und Lizenzkosten.',
                'duration' => 'Tipp: Längere Nutzungsdauer wirkt wie ein Buyout.'
            )
        ),
        'rights_guidance' => array(
            'default' => array(
                'headline' => 'Nutzungsrechte & Lizenzen',
                'text' => 'Lizenzkosten ergeben sich aus Nutzungsszenario, Gebiet, Dauer und Zusatzmodulen gemäß VDS/Gagenkompass 2025.',
                'extras' => array(
                    'social_organic' => 'Social-Media-Organik wird als Zusatznutzung geführt.',
                    'event_pos' => 'Event/POS-Nutzung ist eine zusätzliche Auswertung.',
                    'internal_use' => 'Interne Nutzung darf nicht mit Paid-Werbung verwechselt werden.'
                )
            )
        ),
        'packages' => array(
            'basic' => array('label' => 'Basic', 'pricing' => 'min', 'duration' => 'short', 'extras' => 'minimal', 'meta' => array('Min-Preis', 'kurze Dauer', 'ohne Extras')),
            'standard' => array('label' => 'Standard', 'pricing' => 'mid', 'duration' => 'current', 'extras' => 'current', 'meta' => array('Mittelwert', 'aktuelle Dauer', 'aktuelle Optionen')),
            'premium' => array('label' => 'Premium', 'pricing' => 'max', 'duration' => 'max', 'extras' => 'full', 'meta' => array('Max-Preis', 'erweiterte Dauer', 'inkl. Extras'))
        )
    );

    foreach ($config['vds2025']['cases'] as $case_key => $case_config) {
        $pricing = isset($case_config['pricing']) ? $case_config['pricing'] : array();
        $config[$case_key] = array(
            'name' => $case_config['name'],
            'base' => isset($pricing['base']) ? $pricing['base'] : array(0,0,0),
            'tier_unit' => isset($pricing['unit']) ? $pricing['unit'] : 'minutes',
            'tiers' => isset($pricing['tiers']) ? $pricing['tiers'] : array(),
            'extra' => isset($pricing['extra']) ? $pricing['extra'] : array(0,0,0),
            'extra_unit' => isset($pricing['extra_unit']) ? $pricing['extra_unit'] : 1,
            'extra_after' => isset($pricing['extra_after']) ? $pricing['extra_after'] : 0,
            'min' => isset($pricing['min']) ? $pricing['min'] : array(0,0,0),
            'per_min' => isset($pricing['per_min']) ? $pricing['per_min'] : array(0,0,0),
            'variants' => isset($case_config['variants']) ? $case_config['variants'] : array(),
            'lic' => implode(' ', isset($case_config['notes']) ? $case_config['notes'] : array())
        );
    }

    return wp_json_encode($config, JSON_UNESCAPED_UNICODE);
}
