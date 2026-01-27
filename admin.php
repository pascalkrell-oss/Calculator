<?php
if ( ! defined( 'ABSPATH' ) ) exit;

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
    if (isset($_POST['src_rates_json']) && check_admin_referer('src_save_settings')) {
        $json_input = wp_unslash($_POST['src_rates_json']);
        
        // Validierung: Ist es valides JSON?
        if(json_decode($json_input) !== null) {
             update_option('src_rates_json', $json_input);
             echo '<div class="notice notice-success is-dismissible"><p>Einstellungen gespeichert!</p></div>';
        } else {
             echo '<div class="notice notice-error is-dismissible"><p>Fehler: Ungültiges JSON Format.</p></div>';
        }
    }

    // Aktuellen Wert holen oder Default
    $current_json = get_option('src_rates_json');
    if (!$current_json) {
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
    /*
     * Phase 0 (Bestandsaufnahme - interne Liste):
     * - tv: admin.php src_get_default_json -> base[]; keine Tiers; keine Zusatzlizenzen (Optionen: Cut-down, Express, Studio, Rabatt).
     * - online_paid: admin.php src_get_default_json -> base[]; keine Tiers; keine Zusatzlizenzen (Optionen: Cut-down, ATV/CTV).
     * - radio: admin.php src_get_default_json -> base[]; keine Tiers; keine Zusatzlizenzen (Optionen: Cut-down, Online Audio Paket).
     * - cinema: admin.php src_get_default_json -> base[]; keine Tiers; keine Zusatzlizenzen (Optionen: Cut-down).
     * - pos: admin.php src_get_default_json -> base[] + variants (pos_spot/ladenfunk); keine Tiers; keine Zusatzlizenzen.
     * - imagefilm: admin.php src_get_default_json -> tiers (2/5 Min) + extra; Zusatzlizenzen: social_organic/event_pos.
     * - explainer: admin.php src_get_default_json -> tiers (2/5 Min) + extra; Zusatzlizenzen: social_organic/event_pos.
     * - app: admin.php src_get_default_json -> tiers (2/5 Min) + extra; Zusatzlizenzen: social_organic/event_pos.
     * - elearning: admin.php src_get_default_json -> tiers (bis 5 Min) + extra; keine Zusatzlizenzen.
     * - audioguide: admin.php src_get_default_json -> tiers (bis 5 Min) + extra; keine Zusatzlizenzen.
     * - podcast: admin.php src_get_default_json -> tiers (bis 5 Min) + extra; keine Zusatzlizenzen.
     * - doku: admin.php src_get_default_json -> min/per_min (Sonderlogik), keine Tiers.
     * - phone: admin.php src_get_default_json -> tiers (bis 3 Module) + extra; keine Zusatzlizenzen.
     */
    return '{
        "tv": { "base": [600, 700, 800], "name": "TV Spot", "lic": "Lizenzen: Lineares TV-Programm im gewählten Gebiet. Laufzeit wie ausgewählt." },
        "online_paid": { "base": [600, 700, 800], "name": "Online Paid Media", "lic": "Lizenzen: Online/Internet Paid Media (Pre-Roll/Ad). Laufzeit wie ausgewählt." },
        "radio": { "base": [450, 500, 550], "name": "Funkspot", "lic": "Lizenzen: Lineares Radio-Programm im gewählten Gebiet. Laufzeit wie ausgewählt." },
        "cinema": { "base": [600, 700, 800], "name": "Kino Spot", "lic": "Lizenzen: Nutzung in Kinos im gewählten Gebiet. Laufzeit wie ausgewählt." },
        "pos": {
            "base": [600, 700, 800],
            "name": "POS / Ladenfunk",
            "variants": {
                "pos_spot": { "name": "POS Spot (mit Bild)", "base": [600, 700, 800], "lic": "Lizenzen: POS Spot (mit Bild) am Point of Sale. Laufzeit wie ausgewählt." },
                "ladenfunk": { "name": "Ladenfunk (ohne Bild)", "base": [450, 550, 650], "lic": "Lizenzen: Ladenfunk (Audio) am Point of Sale. Laufzeit wie ausgewählt." }
            },
            "lic": "Lizenzen: Nutzung am Point of Sale (Ladenlokal). Laufzeit wie ausgewählt."
        },
        "imagefilm": {
            "name": "Imagefilm",
            "tier_unit": "minutes",
            "tiers": [{ "limit": 2, "p": [300, 350, 400] }, { "limit": 5, "p": [350, 450, 500] }],
            "extra": [50, 100, 150],
            "extra_unit": 5,
            "extra_after": 5,
            "license_extras": { "social_organic": 150, "event_pos": 150 },
            "lic": "Lizenzen: Internet Basic (Website, YouTube etc.) - Unpaid Media. Zeitlich unbegrenzt."
        },
        "explainer": {
            "name": "Erklärvideo",
            "tier_unit": "minutes",
            "tiers": [{ "limit": 2, "p": [300, 350, 400] }, { "limit": 5, "p": [350, 450, 500] }],
            "extra": [50, 100, 150],
            "extra_unit": 5,
            "extra_after": 5,
            "license_extras": { "social_organic": 150, "event_pos": 150 },
            "lic": "Lizenzen: Internet Basic (Website, interne Nutzung). Zeitlich unbegrenzt."
        },
        "app": {
            "name": "App",
            "tier_unit": "minutes",
            "tiers": [{ "limit": 2, "p": [300, 400, 450] }, { "limit": 5, "p": [500, 550, 600] }],
            "extra": [100, 125, 150],
            "extra_unit": 5,
            "extra_after": 5,
            "license_extras": { "social_organic": 150, "event_pos": 150 },
            "lic": "Lizenzen: Nutzung innerhalb einer App (kein TTS). Zeitlich unbegrenzt."
        },
        "elearning": {
            "name": "E-Learning",
            "tier_unit": "minutes",
            "tiers": [{ "limit": 5, "p": [300, 350, 400] }],
            "extra": [60, 75, 90],
            "extra_unit": 5,
            "extra_after": 5,
            "lic": "Nur interne Nutzung (Schulung). Keine Veröffentlichung."
        },
        "audioguide": {
            "name": "Audioguide",
            "tier_unit": "minutes",
            "tiers": [{ "limit": 5, "p": [300, 350, 400] }],
            "extra": [60, 75, 90],
            "extra_unit": 5,
            "extra_after": 5,
            "lic": "Nutzung im Guide-System. Zeitlich unbegrenzt."
        },
        "podcast": {
            "name": "Podcast",
            "tier_unit": "minutes",
            "tiers": [{ "limit": 5, "p": [300, 350, 400] }],
            "extra": [60, 75, 90],
            "extra_unit": 5,
            "extra_after": 5,
            "lic": "Redaktioneller Inhalt (1 Folge). Weltweit online."
        },
        "doku": { "name": "Doku / Reportage", "min": [150, 250, 350], "per_min": [10, 15, 20], "lic": "TV-Ausstrahlung / Mediathek (Redaktionell)." },
        "phone": {
            "name": "Telefonansage",
            "tier_unit": "modules",
            "tiers": [{ "limit": 3, "p": [180, 240, 300] }],
            "extra": [50, 60, 70],
            "extra_unit": 1,
            "extra_after": 3,
            "lic": "Nutzung in 1 Telefonanlage. Zeitlich unbegrenzt."
        },
        "rights_guidance": {
            "default": {
                "headline": "Nutzungsrechte & Lizenzen",
                "text": "Die Lizenz richtet sich nach Gebiet, Nutzungsdauer und Zusatzlizenzen. Bitte Projekt auswählen bzw. Konfiguration prüfen.",
                "extras": {
                    "social_organic": "Zusatzlizenz Social Media (organisch) gemäß VDS/Gagenkompass.",
                    "event_pos": "Zusatzlizenz Event/Messe/POS gemäß VDS/Gagenkompass."
                }
            },
            "tv": { "text": "Lizenzen: Lineares TV-Programm im gewählten Gebiet. Laufzeit wie ausgewählt." },
            "online_paid": { "text": "Lizenzen: Online/Internet Paid Media (Pre-Roll/Ad). Laufzeit wie ausgewählt." },
            "radio": { "text": "Lizenzen: Lineares Radio-Programm im gewählten Gebiet. Laufzeit wie ausgewählt." },
            "cinema": { "text": "Lizenzen: Nutzung in Kinos im gewählten Gebiet. Laufzeit wie ausgewählt." },
            "pos": { "text": "Lizenzen: Nutzung am Point of Sale (Ladenlokal). Laufzeit wie ausgewählt." },
            "imagefilm": { "text": "Lizenzen: Internet Basic (Website, YouTube etc.) - Unpaid Media. Zeitlich unbegrenzt." },
            "explainer": { "text": "Lizenzen: Internet Basic (Website, interne Nutzung). Zeitlich unbegrenzt." },
            "app": { "text": "Lizenzen: Nutzung innerhalb einer App (kein TTS). Zeitlich unbegrenzt." },
            "elearning": { "text": "Nur interne Nutzung (Schulung). Keine Veröffentlichung." },
            "audioguide": { "text": "Nutzung im Guide-System. Zeitlich unbegrenzt." },
            "podcast": { "text": "Redaktioneller Inhalt (1 Folge). Weltweit online." },
            "doku": { "text": "TV-Ausstrahlung / Mediathek (Redaktionell)." },
            "phone": { "text": "" }
        },
        "project_tips": {
            "imagefilm": ["Tipp: Für interne Nutzung reicht oft Internet Basic.", "Bei Social Media Zusatzlizenz Projektumfang checken."],
            "tv": ["Tipp: Laufzeit und Gebiet treiben den Preis stark.", "Bei Worldwide + Unlimited lieber prüfen ob nötig."],
            "phone": ["Telefonansagen sind oft modulbasiert kalkuliert.", "Zusatzmodule sauber im Briefing aufführen."]
        },
        "options_by_project": {
            "tv": { "allow_cutdown": true },
            "online_paid": { "allow_cutdown": true },
            "radio": { "allow_cutdown": true },
            "cinema": { "allow_cutdown": true },
            "pos": { "allow_cutdown": true },
            "imagefilm": { "allow_cutdown": false },
            "explainer": { "allow_cutdown": false },
            "app": { "allow_cutdown": false },
            "elearning": { "allow_cutdown": false },
            "audioguide": { "allow_cutdown": false },
            "podcast": { "allow_cutdown": false },
            "doku": { "allow_cutdown": false },
            "phone": { "allow_cutdown": false }
        }
    }';
}
