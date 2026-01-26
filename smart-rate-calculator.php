<?php
/*
Plugin Name: Smart Rate Calculator (Pro)
Description: V7.0: Professioneller Gagenrechner mit Admin-Interface und optimierter UI.
Version: 7.0.0
Author: Dein Coding-Assistent
*/

if ( ! defined( 'ABSPATH' ) ) exit;

// Pfade definieren
define( 'SRC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SRC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Admin-Interface laden
require_once SRC_PLUGIN_DIR . 'admin.php';

/**
 * 1. Assets (CSS/JS) registrieren und laden
 */
function src_enqueue_assets_v7() {
    if ( ! src_is_calculator_page() ) {
        return;
    }

    wp_enqueue_style('dashicons');
    wp_enqueue_style(
        'src-rubik-font',
        'https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&display=swap',
        array(),
        null
    );
    // CSS laden
    wp_enqueue_style(
        'src-styles', 
        SRC_PLUGIN_URL . 'assets/css/style.css', 
        array('dashicons', 'src-rubik-font'), 
        '7.0.0'
    );

    // Externe PDF Libraries
    wp_enqueue_script('jspdf', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', array(), '2.5.1', true);
    wp_enqueue_script('jspdf-autotable', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js', array('jspdf'), '3.5.28', true);

    // Unser eigenes JS laden
    wp_enqueue_script(
        'src-script', 
        SRC_PLUGIN_URL . 'assets/js/skripts.js', 
        array('jquery', 'jspdf'), 
        '7.0.0', 
        true
    );

    // DATENÜBERGABE: PHP -> JS
    $saved_rates = get_option('src_rates_json');
    if (!$saved_rates) {
        $saved_rates = src_get_default_json(); // Fallback aus admin.php
    }

    wp_localize_script('src-script', 'srcPluginData', array(
        'rates' => json_decode($saved_rates),
        'ajaxUrl' => admin_url('admin-ajax.php')
    ));
}
add_action('wp_enqueue_scripts', 'src_enqueue_assets_v7');

function src_is_calculator_page() {
    if ( is_admin() ) {
        return false;
    }

    if ( is_singular() ) {
        $post = get_post();
        if ( $post instanceof WP_Post ) {
            return has_shortcode( $post->post_content, 'smart_rate_calculator' );
        }
    }

    return false;
}

/**
 * 2. Shortcode Ausgabe
 */
function src_shortcode_output_v7() {
    ob_start();
    ?>
    <div class="src-reset-header">
        <button class="src-reset-btn" onclick="srcReset()">
            <span class="dashicons dashicons-image-rotate"></span> Gagenrechner zurücksetzen
        </button>
    </div>

    <div id="src-calc-v6">
        <div class="src-col-left">
            
            <div class="src-top-grid">
                <div>
                    <div class="src-section-title"><span class="dashicons dashicons-portfolio"></span> Projektart</div>
                    <select id="src-genre" class="src-select" onchange="srcUIUpdate()">
                        <option value="" disabled selected>Bitte auswählen...</option>
                        <optgroup label="Werbung & Kampagne (Paid Media)">
                            <option value="tv">TV Spot</option>
                            <option value="online_paid">Online Paid Media (Pre-Roll/Ad)</option>
                            <option value="radio">Funkspot</option>
                            <option value="cinema">Kino Spot</option>
                            <option value="pos">POS / Ladenfunk</option>
                        </optgroup>
                        <optgroup label="Corporate & Web (Unpaid)">
                            <option value="imagefilm">Imagefilm / Webvideo</option>
                            <option value="explainer">Erklärvideo / Produktfilm</option>
                            <option value="app">App-Vertonung</option>
                        </optgroup>
                        <optgroup label="E-Learning & Content">
                            <option value="elearning">E-Learning / WBT</option>
                            <option value="audioguide">Audioguide</option>
                            <option value="podcast">Podcast</option>
                            <option value="doku">TV-Doku / Reportage</option>
                        </optgroup>
                        <optgroup label="Service">
                            <option value="phone">Telefonansage / IVR</option>
                        </optgroup>
                    </select>
                    <span class="src-top-sub">Was wird produziert?</span>
                </div>
                
                <div>
                    <div class="src-section-title"><span class="dashicons dashicons-translation"></span> Sprache</div>
                    <select id="src-language" class="src-select" onchange="srcCalc()">
                        <option value="de">Deutsch (Standard)</option>
                        <option value="en">Englisch (+30%)</option>
                        <option value="other">Fremdsprache (+50%)</option>
                    </select>
                    <span class="src-top-sub">Aufschlag berechnen</span>
                </div>
            </div>

            <div class="src-group" id="src-group-text">
                <div class="src-section-title"><span class="dashicons dashicons-editor-alignleft"></span> Skript / Länge</div>
                <textarea id="src-text" class="src-textarea" placeholder="Skript hier einfügen für automatische Berechnung..." oninput="srcAnalyzeText()"></textarea>
                
                <div class="src-stats">
                    <span><span id="src-char-count">0</span> Zeichen</span>
                    <span>•</span>
                    <span>Ø <span id="src-min-count">0:00</span> Min.</span>
                </div>

                <div style="margin-top:5px;">
                    <label class="src-switch-row" style="padding: 5px 0;">
                        <span class="src-switch-content">
                            <span class="src-manual-label">Länge manuell eingeben</span>
                        </span>
                        <div class="src-toggle-wrapper">
                            <input type="checkbox" id="src-manual-time-check" onchange="srcToggleManualTime()">
                            <span class="src-toggle-slider"></span>
                        </div>
                    </label>
                    <div id="src-manual-input-wrap" class="src-slide-wrap" style="margin-top:0;">
                         <input type="text" id="src-manual-minutes" class="src-input-text" style="margin-top:5px;" placeholder="Länge in Minuten (z.B. 1,5)" oninput="srcAnalyzeText()">
                    </div>
                </div>
            </div>

            <div id="mod-phone" class="src-slide-wrap">
                <div class="src-light-box-wrapper">
                    <label style="font-size:13px; font-weight:700; color:var(--src-primary); display:block; margin-bottom:5px;">Anzahl der Module / Ansagen</label>
                    <input type="number" id="src-phone-count" class="src-input-text" value="1" min="1" oninput="srcCalc()">
                    <div style="font-size:11px; color:#64748b; margin-top:5px;">Bis zu 3 Module sind in der Pauschale enthalten. Jedes weitere Modul kostet extra.</div>
                </div>
            </div>

            <div id="mod-ads" class="src-slide-wrap">
                <div class="src-light-box-wrapper">
                    <div class="src-group src-rights-panel" style="margin-bottom:20px;">
                        <div class="src-section-title" style="margin-bottom:10px;">
                            <span class="dashicons dashicons-location-alt"></span> Verbreitungsgebiet
                        </div>
                        <div class="src-tiles-grid">
                            <label>
                                <input type="radio" name="region" value="regional" class="src-tile-input" onchange="srcCalc()">
                                <div class="src-tile">
                                    <span class="dashicons dashicons-location src-tile-icon"></span>
                                    <div class="src-tile-label">Regional</div>
                                </div>
                            </label>
                            <label>
                                <input type="radio" name="region" value="national" class="src-tile-input" checked onchange="srcCalc()">
                                <div class="src-tile">
                                    <span class="dashicons dashicons-flag src-tile-icon"></span>
                                    <div class="src-tile-label">National</div>
                                </div>
                            </label>
                            <label>
                                <input type="radio" name="region" value="dach" class="src-tile-input" onchange="srcCalc()">
                                <div class="src-tile">
                                    <span style="font-weight:800; font-size:16px; color:#94a3b8; margin-bottom:4px; display:block;">DACH</span>
                                    <div class="src-tile-label">D-A-CH</div>
                                </div>
                            </label>
                            <label>
                                <input type="radio" name="region" value="world" class="src-tile-input" onchange="srcCalc()">
                                <div class="src-tile">
                                    <span class="dashicons dashicons-admin-site src-tile-icon"></span>
                                    <div class="src-tile-label">Weltweit</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="src-group src-rights-panel" style="margin-bottom:20px;">
                        <div class="src-slider-header">
                            <div class="src-section-title" style="margin:0;">
                                <span class="dashicons dashicons-calendar-alt"></span> Nutzungsdauer 
                                <span class="src-tooltip-icon" data-tip="Wie lange darf die Aufnahme genutzt werden? Standard ist 1 Jahr.">?</span>
                            </div>
                            <div id="src-slider-val" class="src-slider-val">1 Jahr</div>
                        </div>
                        <div class="src-slider-container">
                            <input type="range" id="src-time-slider" min="1" max="4" value="1" step="1" class="src-slider" oninput="srcCalc()">
                        </div>
                        <div class="src-slider-steps">
                            <span>1 Jahr</span>
                            <span>2 Jahre</span>
                            <span>3 Jahre</span>
                            <span>Unlimited</span>
                        </div>
                    </div>

                    <div class="src-group" style="margin-bottom:0;">
                        <div id="src-pkg-online-wrap" class="src-slide-wrap">
                            <label class="src-switch-row boxed">
                                <span class="src-switch-content">
                                    <span class="dashicons dashicons-cloud src-switch-icon"></span>
                                    <div>
                                        <div class="src-switch-text">Paket: Online Audio <span class="src-tooltip-icon" data-tip="Zusätzliche Verwertung im Internet (Audio only) - ca. +60% Aufschlag.">?</span></div>
                                        <div class="src-switch-sub">Zusätzlich zum Funkspot</div>
                                    </div>
                                </span>
                                <div class="src-toggle-wrapper">
                                    <input type="checkbox" id="src-pkg-online" onchange="srcCalc()">
                                    <span class="src-toggle-slider"></span>
                                </div>
                            </label>
                        </div>

                        <div id="src-pkg-atv-wrap" class="src-slide-wrap">
                            <label class="src-switch-row boxed">
                                <span class="src-switch-content">
                                    <span class="dashicons dashicons-video-alt3 src-switch-icon"></span>
                                    <div>
                                        <div class="src-switch-text">Paket: ATV/CTV <span class="src-tooltip-icon" data-tip="Addressable TV & Connected TV Nutzung - ca. +60% Aufschlag.">?</span></div>
                                        <div class="src-switch-sub">Addressable TV Add-on</div>
                                    </div>
                                </span>
                                <div class="src-toggle-wrapper">
                                    <input type="checkbox" id="src-pkg-atv" onchange="srcCalc()">
                                    <span class="src-toggle-slider"></span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div id="mod-image" class="src-slide-wrap">
                <div class="src-light-box-wrapper">
                    <div class="src-group src-rights-panel" style="margin-bottom:0;">
                        <div class="src-section-title"><span class="dashicons dashicons-plus-alt"></span> Zusatzlizenzen</div>
                        <label class="src-switch-row boxed">
                            <span class="src-switch-content">
                                <span class="dashicons dashicons-share src-switch-icon"></span>
                                <div><div class="src-switch-text">Social Media (Organisch)</div></div>
                            </span>
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-lic-social" onchange="srcCalc()">
                                <span class="src-toggle-slider"></span>
                            </div>
                        </label>
                        <label class="src-switch-row boxed">
                            <span class="src-switch-content">
                                <span class="dashicons dashicons-groups src-switch-icon"></span>
                                <div><div class="src-switch-text">Event / Messe / POS</div></div>
                            </span>
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-lic-event" onchange="srcCalc()">
                                <span class="src-toggle-slider"></span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            <div id="src-global-settings" class="src-group" style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:15px;">
                
                <div id="mod-extra-ads" class="src-slide-wrap">
                    <div class="src-cutdown-card">
                        <label class="src-switch-row src-global-toggle-row src-cutdown-row">
                            <span class="src-switch-content">
                                <span class="dashicons dashicons-controls-repeat src-switch-icon" aria-hidden="true"></span>
                                <div>
                                    <div class="src-switch-text">
                                        Cut-down / Reminder
                                        <span class="src-tooltip-icon" data-tip="Aktiviere diese Option, wenn zusätzlich Kurzversionen geplant sind.">?</span>
                                    </div>
                                    <div class="src-switch-sub">Kurzversionen (Tag-ons, Reminder) kosten 50% der Gage.</div>
                                </div>
                            </span>
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-cutdown" onchange="srcCalc()">
                                <span class="src-toggle-slider"></span>
                            </div>
                        </label>
                        <div class="src-cutdown-detail src-switch-detail-wrap">50% der Gage berechnen</div>
                    </div>
                </div>

                <label class="src-switch-row src-global-toggle-row">
                    <span class="src-switch-content">
                        <span class="dashicons dashicons-edit src-switch-icon"></span>
                        <div>
                            <div class="src-switch-text">Nur Layout / Pitch</div>
                            <div class="src-switch-sub">Keine Veröffentlichung (Intern)</div>
                        </div>
                    </span>
                    <div class="src-toggle-wrapper">
                        <input type="checkbox" id="src-layout-mode" onchange="srcCalc()">
                        <span class="src-toggle-slider"></span>
                    </div>
                </label>

                <label class="src-switch-row src-global-toggle-row">
                    <span class="src-switch-content">
                        <span class="dashicons dashicons-microphone src-switch-icon"></span>
                        <div>
                            <div class="src-switch-text">Eigenes Studio / Remote</div>
                            <div class="src-switch-sub">Technik-Pauschale addieren</div>
                        </div>
                    </span>
                    <div class="src-toggle-wrapper">
                        <input type="checkbox" id="src-own-studio" onchange="srcToggleStudio()">
                        <span class="src-toggle-slider"></span>
                    </div>
                </label>
                
                <div id="src-studio-wrap" class="src-slide-wrap">
                    <div class="src-input-compact-wrap src-switch-detail-wrap">
                        <input type="number" id="src-studio-fee" value="150" class="src-input-compact" style="padding-right:10px;" oninput="srcCalc()">
                        <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Betrag in €</div>
                    </div>
                </div>

                <label class="src-switch-row src-global-toggle-row">
                    <span class="src-switch-content">
                        <span class="dashicons dashicons-clock src-switch-icon"></span>
                        <div>
                            <div class="src-switch-text">Express Lieferung</div>
                            <div class="src-switch-sub">Schnellere Abgabe mit Aufpreis</div>
                        </div>
                    </span>
                    <div class="src-toggle-wrapper">
                        <input type="checkbox" id="src-express-toggle" onchange="toggleElement('src-express-wrap', this.checked); srcCalc();">
                        <span class="src-toggle-slider"></span>
                    </div>
                </label>
                <div id="src-express-wrap" class="src-slide-wrap">
                    <div class="src-input-compact-wrap src-switch-detail-wrap">
                        <select id="src-express-type" class="src-select src-input-compact" onchange="srcCalc()">
                            <option value="24h">Innerhalb 24h (+50%)</option>
                            <option value="4h">Innerhalb 4h (+100%)</option>
                        </select>
                    </div>
                </div>
                
                <label class="src-switch-row src-global-toggle-row">
                    <span class="src-switch-content">
                        <span class="dashicons dashicons-tag src-switch-icon"></span>
                        <div>
                            <span class="src-switch-text">Rabatt gewähren?</span>
                            <div class="src-switch-sub">Vom Netto-Betrag abziehen</div>
                        </div>
                    </span>
                    <div class="src-toggle-wrapper">
                        <input type="checkbox" id="src-discount-toggle" onchange="toggleElement('src-discount-wrap', this.checked)">
                        <span class="src-toggle-slider"></span>
                    </div>
                </label>
                
                <div id="src-discount-wrap" class="src-slide-wrap">
                    <div class="src-discount-row src-switch-detail-wrap">
                        <input type="number" id="src-discount-percent" class="src-input-compact src-discount-percent" placeholder="%" min="0" max="100" oninput="srcCalc()">
                        <input type="text" id="src-discount-reason" class="src-input-compact" placeholder="Grund (z.B. Neukunde)" oninput="srcCalc()">
                    </div>
                    <span class="src-hint-text src-switch-detail-wrap">Der Rabatt wird vom Netto-Gesamtbetrag abgezogen.</span>
                </div>
            </div>

        </div>

        <div class="src-col-right">
            
            <div class="src-sidebar-section">
                <div class="src-sidebar-title">Kalkulation</div>
                <div class="src-result-card">
                    <div class="src-price-label">Kalkulierte Gage (Netto)</div>
                    <div class="src-price-main-box">
                        <div class="src-price-main" id="src-display-total">0 €</div>
                    </div>
                    <div class="src-price-sub" id="src-display-range">Mittelwert: 0 €</div>
                    <div class="src-price-note">Alle Preise zzgl. MwSt.</div>
                    
                    <div id="src-final-fee-wrapper" class="src-final-fee-wrap src-hidden-initially">
                        <label class="src-final-fee-label">
                            Dein Angebotspreis (Netto)
                            <span class="src-tooltip-icon" data-tip="Der eingetragene Angebotspreis wird im fertigen Angebot übernommen.">?</span>
                        </label>
                        <input type="number" id="src-final-fee-user" class="src-final-fee-input" placeholder="z.B. 650" oninput="srcValidateFinalFee()">
                        <div id="src-final-fee-msg" class="src-final-fee-msg">Betrag liegt außerhalb der kalkulierten Spanne!</div>
                    </div>
                </div>
            </div>

            <div class="src-sidebar-section">
                <div class="src-sidebar-title src-sidebar-title--pricedetails">Preis-Details</div>
                <div id="src-calc-breakdown" class="src-breakdown-box">
                    <div id="src-breakdown-list">
                        <div class="src-breakdown-row">Bitte Projekt wählen..</div>
                    </div>
                </div>
            </div>

            <div id="src-license-section" class="src-sidebar-section src-license-section src-hidden">
                <div class="src-sidebar-title src-sidebar-title--rights">Nutzungsrechte</div>
                <div id="src-license-text" class="src-license-box"></div>
            </div>

            <div class="src-sidebar-section src-info-section">
                <div class="src-sidebar-title src-sidebar-title--knowledge">Wissenswertes</div>
                <div class="src-info-box">
                    <div class="src-acc-item">
                        <div class="src-acc-head" onclick="toggleAccordion(this)">Berechnungsgrundlage</div>
                        <div class="src-acc-body">
                            Anders als bei stundenbasierten Jobs bezahlst du hier primär für die Nutzung der Aufnahme. Die "Verwertungsrechte" definieren den Preis. Entscheidend sind: Wo läuft es (Medium)? Wie lange (Zeitraum)? Und wo (Gebiet)? Je mehr Reichweite, desto höher die Gage.
                        </div>
                    </div>
                    
                    <div class="src-acc-item">
                        <div class="src-acc-head" onclick="toggleAccordion(this)">Textlänge & Dauer</div>
                        <div class="src-acc-body">
                            Als Faustregel gilt: 900 Zeichen (inkl. Leerzeichen) entsprechen ca. 1 Minute gesprochenem Text. Zahlen und Abkürzungen sollten ausgeschrieben gezählt werden, da sie beim Sprechen länger sind als im geschriebenen Text.
                        </div>
                    </div>

                    <div class="src-acc-item">
                        <div class="src-acc-head" onclick="toggleAccordion(this)">Buyouts & Unlimited</div>
                        <div class="src-acc-body">
                            Ein "Buyout" ist der Einkauf der Nutzungsrechte. Willst du eine Aufnahme zeitlich unbegrenzt nutzen, vervielfacht sich der Basispreis (oft x3 oder x4), da der Sprecher durch die dauerhafte Bindung seine Stimme für Konkurrenzprodukte in diesem Zeitraum oft nicht mehr zur Verfügung stellen kann.
                        </div>
                    </div>

                    <div class="src-acc-item">
                        <div class="src-acc-head" onclick="toggleAccordion(this)">Studio & Technik</div>
                        <div class="src-acc-body">
                            Die reine Sprechergage deckt die kreative Leistung und die Lizenz ab. Technische Leistungen wie Aufnahmeleitung, Schnitt, Cleaning und Datei-Export sind oft separat als Studiokosten ausgewiesen, wenn der Sprecher dies im eigenen Studio übernimmt.
                        </div>
                    </div>

                    <div class="src-acc-item">
                        <div class="src-acc-head" onclick="toggleAccordion(this)">Korrekturen & Revisionen</div>
                        <div class="src-acc-body">
                            Planbare Korrekturschleifen (z.B. 1–2 Takes) sind oft inklusive. Größere Textänderungen oder zusätzliche Versionen sollten jedoch neu kalkuliert werden, da sie zusätzlichen Produktionsaufwand bedeuten.
                        </div>
                    </div>

                    <div class="src-acc-item">
                        <div class="src-acc-head" onclick="toggleAccordion(this)">Exklusivität & Konkurrenzschutz</div>
                        <div class="src-acc-body">
                            Bei längeren Nutzungsrechten oder exklusiven Kampagnen kann ein Konkurrenzschutz gelten. Das verhindert parallele Aufträge in derselben Branche und beeinflusst die Gage entsprechend.
                        </div>
                    </div>
                </div>
            </div>

            <div class="src-footer-actions">
                <button class="src-btn" onclick="srcGeneratePDFv6()">
                    <span class="dashicons dashicons-pdf"></span> Angebot speichern
                </button>
            </div>
            <div class="src-note-text">
                Auf Basis VDS Gagenkompass 2025. Alle Preise zzgl. MwSt.
            </div>
        </div>
    </div>
    <div id="src-tooltip-fixed"></div>
    <?php
    return ob_get_clean();
}
add_shortcode('smart_rate_calculator', 'src_shortcode_output_v7');
