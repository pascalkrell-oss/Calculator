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
        array('jquery', 'jspdf', 'jspdf-autotable'), 
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
        'vdsExpected' => json_decode(src_get_default_json()),
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
                    <select id="src-language" class="src-select" onchange="srcAnalyzeText()">
                        <option value="de">Deutsch (Standard)</option>
                        <option value="en">Englisch (+30%)</option>
                        <option value="other">Fremdsprache (+50%)</option>
                    </select>
                    <span class="src-top-sub">Aufschlag berechnen</span>
                </div>
            </div>
            <div id="src-linked-projects-wrap" class="src-linked-projects">
                <details id="src-linked-projects-accordion" class="src-accordion">
                    <summary class="src-accordion__summary">
                        <span class="src-accordion__text">
                            <span class="src-accordion__title">Weitere Nutzungen / verknüpfte Projekte</span>
                            <span class="src-accordion__sub">Optional: mehrere Projekt-Kontexte kombinieren (z.B. organisch + Ads).</span>
                        </span>
                        <span class="src-accordion__chev" aria-hidden="true"></span>
                    </summary>
                    <div class="src-accordion__content">
                        <div class="src-linked-grid">
                            <label class="src-linked-project-option">
                                <input type="checkbox" class="src-linked-project" value="online_paid">
                                <span>Paid Ads / Kampagne</span>
                            </label>
                            <label class="src-linked-project-option">
                                <input type="checkbox" class="src-linked-project" value="radio">
                                <span>Funkspot</span>
                            </label>
                            <label class="src-linked-project-option">
                                <input type="checkbox" class="src-linked-project" value="pos">
                                <span>POS / Ladenfunk</span>
                            </label>
                            <label class="src-linked-project-option">
                                <input type="checkbox" class="src-linked-project" value="tv">
                                <span>TV Spot</span>
                            </label>
                            <label class="src-linked-project-option">
                                <input type="checkbox" class="src-linked-project" value="cinema">
                                <span>Kino Spot</span>
                            </label>
                        </div>
                    </div>
                </details>
            </div>

            <div class="src-advanced">
                <details id="src-advanced-accordion" class="src-accordion">
                    <summary class="src-accordion__summary">
                        <span class="src-accordion__text">
                            <span class="src-accordion__title">Erweitert</span>
                            <span class="src-accordion__sub">Zusätzliche Vertrags- und Performance-Parameter für mehr Präzision.</span>
                        </span>
                        <span class="src-accordion__chev" aria-hidden="true"></span>
                    </summary>
                    <div class="src-accordion__content">
                        <div class="src-advanced-grid">
                            <div class="src-advanced-item">
                                <label class="src-advanced-label" for="src-adv-exclusivity">Exklusivität / Konkurrenzklausel</label>
                                <select id="src-adv-exclusivity" class="src-select" onchange="srcCalc()">
                                    <option value="none">Keine (0%)</option>
                                    <option value="low">Low (+10%)</option>
                                    <option value="medium">Medium (+20%)</option>
                                    <option value="high">High (+35%)</option>
                                </select>
                            </div>
                            <div class="src-advanced-item">
                                <label class="src-advanced-label" for="src-adv-buyout-mode">Buyout vs. Staffel</label>
                                <select id="src-adv-buyout-mode" class="src-select" onchange="srcUIUpdate(); srcCalc();">
                                    <option value="standard">Standard (wie bisher)</option>
                                    <option value="buyout">Buyout (einmalig) (+25%)</option>
                                    <option value="staffel">Staffel (ab 2. Nutzungsperiode)</option>
                                </select>
                                <div id="src-adv-periods-wrap" class="src-slide-wrap">
                                    <div class="src-advanced-inline">
                                        <label class="src-advanced-label" for="src-adv-periods">Anzahl Perioden</label>
                                        <input type="number" id="src-adv-periods" class="src-input-compact" min="1" max="6" value="1" oninput="srcCalc()">
                                        <span class="src-advanced-sub">Zuschlag je Extra-Periode: +12%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="src-advanced-item">
                                <label class="src-advanced-label" for="src-adv-versions">Sprachversionen</label>
                                <input type="number" id="src-adv-versions" class="src-input-compact" min="1" max="10" value="1" oninput="srcCalc()">
                                <span class="src-advanced-sub">Jede zusätzliche Version: +35% der Sprecherleistung</span>
                            </div>
                        </div>
                        <!-- TODO (Advanced Roadmap):
                            - Agentur-/Vermittlungsprovision
                            - Live-Session/Directed Session Zuschlag
                            - Studio/Remote Recording Differenz
                            - Express/Turnaround (24h/48h)
                            - KI-Training / synthetische Stimme Buyout
                            - Media-Flighting (Paid Ads mit Spend/Impressions Stufen)
                            - Territorium: DACH/EU/Worldwide Stufen, Branchen-Exklusivität
                            - Wiederverwendung/Verlängerungsoptionen mit automatischer Preisfortschreibung
                        -->
                    </div>
                </details>
            </div>

            <div class="src-group" id="src-group-text">
                <div class="src-section-title">
                    <span class="dashicons dashicons-editor-alignleft"></span> Skript / Länge
                    <span class="src-tooltip-icon src-field-tip" data-field-tip="length" data-default-tip="Tipp: Mit Skript kann die Dauer genauer geschätzt werden.">?</span>
                </div>
                <textarea id="src-text" class="src-textarea" placeholder="Skript hier einfügen für automatische Berechnung..." oninput="srcAnalyzeText()"></textarea>
                
                <div class="src-stats">
                    <span><span id="src-char-count">0</span> Zeichen</span>
                    <span>•</span>
                    <span>Ø <span id="src-min-count">0:00</span> Min.</span>
                </div>
                <div id="src-script-estimate" class="src-script-estimate">
                    <span>Aus Skript geschätzt: <strong id="src-script-estimate-value">–</strong></span>
                    <button class="src-mini-btn" type="button" id="src-apply-estimate">Schätzung übernehmen</button>
                </div>

                <div style="margin-top:5px;">
                    <div class="src-switch-row" style="padding: 5px 0;">
                        <span class="src-switch-content">
                            <span class="src-manual-label">Länge manuell eingeben</span>
                        </span>
                        <div class="src-toggle-wrapper">
                            <input type="checkbox" id="src-manual-time-check">
                            <label class="src-toggle-slider" for="src-manual-time-check"></label>
                        </div>
                    </div>
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

            <div class="src-left-section src-rights-card src-collapse">
                <div class="src-box-header">
                    <div class="src-box-title">Nutzungsrechte &amp; Lizenzen</div>
                </div>
                <div class="src-rights-inner">
                    <div id="mod-ads" class="src-slide-wrap">
                        <div class="src-light-box-wrapper">
                            <div id="src-pos-type-wrap" class="src-slide-wrap" style="margin-bottom:15px;">
                                <div class="src-section-title"><span class="dashicons dashicons-admin-site"></span> POS Typ</div>
                                <select id="src-pos-type" class="src-select" onchange="srcCalc()">
                                    <option value="pos_spot">POS Spot (mit Bild)</option>
                                    <option value="ladenfunk">Ladenfunk (ohne Bild)</option>
                                </select>
                                <span class="src-top-sub">Nur bei POS relevant</span>
                            </div>
                            <div class="src-group src-rights-panel src-rights-panel--compact" style="margin-bottom:20px;">
                                <div class="src-section-title" style="margin-bottom:10px;">
                                    <span class="dashicons dashicons-location-alt"></span> Verbreitungsgebiet
                                    <span class="src-tooltip-icon src-field-tip" data-field-tip="region" data-default-tip="Tipp: Größere Gebiete bedeuten höhere Reichweite und höhere Lizenzkosten.">?</span>
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

                            <div class="src-group src-rights-panel src-rights-panel--compact" style="margin-bottom:20px;">
                                <div class="src-slider-header">
                                <div class="src-section-title" style="margin:0;">
                                    <span class="dashicons dashicons-calendar-alt"></span> Nutzungsdauer
                                    <span class="src-tooltip-icon src-field-tip" data-field-tip="duration" data-default-tip="Wie lange darf die Aufnahme genutzt werden? Standard ist 1 Jahr.">?</span>
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
                                    <div class="src-switch-row boxed">
                                        <span class="src-switch-content">
                                            <span class="dashicons dashicons-cloud src-switch-icon"></span>
                                            <div>
                                                <div class="src-switch-text">Paket: Online Audio <span class="src-tooltip-icon" data-tip="Zusätzliche Verwertung im Internet (Audio only) - ca. +60% Aufschlag.">?</span></div>
                                                <div class="src-switch-sub">Zusätzlich zum Funkspot</div>
                                            </div>
                                        </span>
                                        <div class="src-toggle-wrapper">
                                            <input type="checkbox" id="src-pkg-online">
                                            <label class="src-toggle-slider" for="src-pkg-online"></label>
                                        </div>
                                    </div>
                                </div>

                                <div id="src-pkg-atv-wrap" class="src-slide-wrap">
                                    <div class="src-switch-row boxed">
                                        <span class="src-switch-content">
                                            <span class="dashicons dashicons-video-alt3 src-switch-icon"></span>
                                            <div>
                                                <div class="src-switch-text">Paket: ATV/CTV <span class="src-tooltip-icon" data-tip="Addressable TV & Connected TV Nutzung - ca. +60% Aufschlag.">?</span></div>
                                                <div class="src-switch-sub">Addressable TV Add-on</div>
                                            </div>
                                        </span>
                                        <div class="src-toggle-wrapper">
                                            <input type="checkbox" id="src-pkg-atv">
                                            <label class="src-toggle-slider" for="src-pkg-atv"></label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="mod-image" class="src-slide-wrap">
                        <div class="src-subsection">
                            <div class="src-group src-rights-panel" style="margin-bottom:0;">
                                <div class="src-section-title"><span class="dashicons dashicons-plus-alt"></span> Zusatzlizenzen</div>
                                <div class="src-switch-row boxed">
                                    <span class="src-switch-content">
                                        <span class="dashicons dashicons-share src-switch-icon"></span>
                                        <div><div class="src-switch-text">Social Media (Organisch)</div></div>
                                    </span>
                                    <div class="src-toggle-wrapper">
                                        <input type="checkbox" id="src-lic-social">
                                        <label class="src-toggle-slider" for="src-lic-social"></label>
                                    </div>
                                </div>
                                <div class="src-switch-row boxed">
                                    <span class="src-switch-content">
                                        <span class="dashicons dashicons-groups src-switch-icon"></span>
                                        <div><div class="src-switch-text">Event / Messe / POS</div></div>
                                    </span>
                                    <div class="src-toggle-wrapper">
                                        <input type="checkbox" id="src-lic-event">
                                        <label class="src-toggle-slider" for="src-lic-event"></label>
                                    </div>
                                </div>
                                <div class="src-switch-row boxed">
                                    <span class="src-switch-content">
                                        <span class="dashicons dashicons-welcome-learn-more src-switch-icon"></span>
                                        <div><div class="src-switch-text">Interne Nutzung (Mitarbeiterschulung / Intranet)</div></div>
                                    </span>
                                    <div class="src-toggle-wrapper">
                                        <input type="checkbox" id="src-lic-internal">
                                        <label class="src-toggle-slider" for="src-lic-internal"></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="src-group src-complexity-group src-collapse" id="src-complexity-group">
                <div class="src-section-head">
                    <div class="src-section-head__title">Produktion &amp; Aufwand</div>
                </div>
                <div class="src-complexity-grid">
                    <label class="src-complexity-field">
                        <span>Anzahl Versionen/Varianten</span>
                        <select id="src-complexity-variants" class="src-select" onchange="srcCalc()">
                            <option value="1">1</option>
                            <option value="2-3">2–3</option>
                            <option value="4+">4+</option>
                        </select>
                    </label>
                    <label class="src-complexity-field">
                        <span>Korrekturschleifen</span>
                        <select id="src-complexity-revisions" class="src-select" onchange="srcCalc()">
                            <option value="1">inkl. 1</option>
                            <option value="2">2</option>
                            <option value="3+">3+</option>
                        </select>
                    </label>
                    <label class="src-complexity-field">
                        <span>Spezialstil/Schwierigkeit</span>
                        <select id="src-complexity-style" class="src-select" onchange="srcCalc()">
                            <option value="normal">normal</option>
                            <option value="technical">technisch</option>
                            <option value="medical">medizinisch</option>
                            <option value="emotional">sehr emotional</option>
                        </select>
                    </label>
                    <label class="src-complexity-field">
                        <span>Timing/Synchro</span>
                        <select id="src-complexity-timing" class="src-select" onchange="srcCalc()">
                            <option value="free">frei</option>
                            <option value="guided">an Bild grob</option>
                            <option value="lipsync">lipsync</option>
                        </select>
                    </label>
                    <label class="src-complexity-field">
                        <span>Schnitt/Editing</span>
                        <select id="src-complexity-editing" class="src-select" onchange="srcCalc()">
                            <option value="none">keins</option>
                            <option value="basic">Basic</option>
                            <option value="advanced">umfangreich</option>
                        </select>
                    </label>
                    <label class="src-complexity-field">
                        <span>Dateiformate/Deliverables</span>
                        <select id="src-complexity-deliverables" class="src-select" onchange="srcCalc()">
                            <option value="single">ein Format</option>
                            <option value="multiple">mehrere</option>
                        </select>
                    </label>
                </div>
                <div class="src-complexity-note">Alle Angaben sind optional und erhöhen den Aufwand nur, wenn tatsächlich benötigt.</div>
            </div>

            <div id="src-global-settings" class="src-group" style="margin-top:15px; padding-top:15px;">
                <div class="src-section-head">
                    <div class="src-section-head__title">Optionen</div>
                </div>
                <div class="src-opt-card src-collapse" data-opt="cutdown">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <span class="dashicons dashicons-controls-repeat src-opt-icon" aria-hidden="true"></span>
                            <div class="src-opt-text">
                                <div class="src-opt-title">
                                    Cut-down / Reminder
                                    <span class="src-tooltip-icon" data-tip="Aktiviere diese Option, wenn zusätzlich Kurzversionen geplant sind.">?</span>
                                </div>
                                <div class="src-opt-sub">Kurzversionen (Tag-ons, Reminder) kosten 50% der Gage.</div>
                            </div>
                        </div>
                        <div class="src-opt-right">
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-cutdown" aria-expanded="false">
                                <label class="src-toggle-slider" for="src-cutdown"></label>
                            </div>
                        </div>
                    </div>
                    <div class="src-opt-body" data-opt-body>
                        <div class="src-opt-body-text">50% der Gage berechnen.</div>
                    </div>
                </div>

                <div class="src-opt-card" data-opt="layout">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <span class="dashicons dashicons-edit src-opt-icon"></span>
                            <div class="src-opt-text">
                                <div class="src-opt-title">Nur Layout / Pitch</div>
                                <div class="src-opt-sub">Keine Veröffentlichung (Intern)</div>
                            </div>
                        </div>
                        <div class="src-opt-right">
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-layout-mode" aria-expanded="false">
                                <label class="src-toggle-slider" for="src-layout-mode"></label>
                            </div>
                        </div>
                    </div>
                    <div class="src-opt-body" data-opt-body>
                        <div class="src-opt-body-text">Diese Option blendet alle Nutzungsrechte aus und berechnet eine interne Layout-Pauschale.</div>
                    </div>
                </div>

                <div class="src-opt-card" data-opt="studio">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <span class="dashicons dashicons-microphone src-opt-icon"></span>
                            <div class="src-opt-text">
                                <div class="src-opt-title">Eigenes Studio / Remote</div>
                                <div class="src-opt-sub">Technik-Pauschale addieren</div>
                            </div>
                        </div>
                        <div class="src-opt-right">
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-own-studio" aria-expanded="false">
                                <label class="src-toggle-slider" for="src-own-studio"></label>
                            </div>
                        </div>
                    </div>
                    <div class="src-opt-body" data-opt-body>
                        <div class="src-opt-body-row">
                            <input type="number" id="src-studio-fee" value="150" class="src-input-compact" style="padding-right:10px;" oninput="srcCalc()">
                            <div class="src-opt-body-help">Betrag in €</div>
                        </div>
                    </div>
                </div>

                <div class="src-opt-card" data-opt="express">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <span class="dashicons dashicons-clock src-opt-icon"></span>
                            <div class="src-opt-text">
                                <div class="src-opt-title">Express Lieferung</div>
                                <div class="src-opt-sub">Schnellere Abgabe mit Aufpreis</div>
                            </div>
                        </div>
                        <div class="src-opt-right">
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-express-toggle" aria-expanded="false">
                                <label class="src-toggle-slider" for="src-express-toggle"></label>
                            </div>
                        </div>
                    </div>
                    <div class="src-opt-body" data-opt-body>
                        <div class="src-opt-body-row">
                            <select id="src-express-type" class="src-select src-input-compact" onchange="srcCalc()">
                                <option value="24h">Innerhalb 24h (+50%)</option>
                                <option value="4h">Innerhalb 4h (+100%)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="src-opt-card" data-opt="discount">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <span class="dashicons dashicons-tag src-opt-icon"></span>
                            <div class="src-opt-text">
                                <div class="src-opt-title">Rabatt gewähren?</div>
                                <div class="src-opt-sub">Vom Netto-Betrag abziehen</div>
                            </div>
                        </div>
                        <div class="src-opt-right">
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-discount-toggle" aria-expanded="false">
                                <label class="src-toggle-slider" for="src-discount-toggle"></label>
                            </div>
                        </div>
                    </div>
                    <div class="src-opt-body" data-opt-body>
                        <div class="src-discount-grid">
                            <input type="number" id="src-discount-percent" class="src-input-text src-discount-percent" placeholder="%" min="0" max="100" oninput="srcCalc()">
                            <input type="text" id="src-discount-reason" class="src-input-text src-discount-reason" placeholder="Grund (z.B. Neukunde)" oninput="srcCalc()">
                        </div>
                        <span class="src-hint-text">Der Rabatt wird vom Netto-Gesamtbetrag abgezogen.</span>
                    </div>
                </div>
            </div>

        </div>

        <div class="src-col-right">
            <div class="src-sidebar">
                <div class="src-sidebar-sticky" id="srcSidebarSticky">
                    <div class="src-sidebar-section">
                        <div class="src-sidebar-title"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="7" x2="16" y2="7"></line><line x1="8" y1="12" x2="10" y2="12"></line><line x1="14" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="10" y2="16"></line><line x1="14" y1="16" x2="16" y2="16"></line></svg></span><span class="src-title-text">Kalkulation</span></span><span class="src-live-badge">Live-Rechnung</span></div>
                        <div class="src-result-card">
                            <div class="src-price-label">Kalkulierte Gage (Netto)</div>
                            <div class="src-price-main-box">
                                <div class="src-price-main">
                                    <div class="src-amount-anim">
                                        <span class="src-amount-anim__value src-total" id="src-display-total">0 €</span>
                                    </div>
                                </div>
                            </div>
                            <div class="src-price-meta-row">
                                <div class="src-price-sub">
                                    <div class="src-mean-fade" id="src-mean-fade">
                                        <span id="src-display-range">Ø Mittelwert: 0 €</span>
                                    </div>
                                </div>
                                <div class="src-price-note">Alle Preise zzgl. MwSt.</div>
                            </div>
                            <div class="src-compare-controls">
                                <button class="src-mini-btn" id="src-compare-toggle" type="button">Vergleich</button>
                                <button class="src-mini-btn" id="src-compare-save-a" type="button">Als A speichern</button>
                                <button class="src-mini-btn" id="src-compare-save-b" type="button">Als B speichern</button>
                            </div>
                            
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

                    <div id="src-license-section" class="src-sidebar-section src-license-section src-collapse">
                        <div class="src-sidebar-title src-sidebar-title--rights"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.4 8.4-7 9-3.6-.6-7-4-7-9V6l7-3z"></path></svg></span><span class="src-title-text">Nutzungsrechte &amp; Lizenzen</span></span></div>
                        <div id="src-license-text" class="src-license-box"></div>
                    </div>

                    <div class="src-sidebar-section src-collapse" id="src-pricedetails-section">
                        <div class="src-sidebar-title src-sidebar-title--pricedetails"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h10"></path></svg></span><span class="src-title-text">Preis-Details</span></span></div>
                        <div id="src-calc-breakdown" class="src-breakdown-box src-collapse">
                            <div id="src-breakdown-list">
                                <div class="src-breakdown-row">
                                    <div class="src-breakdown-left">
                                        <span class="src-breakdown-label">Bitte Projekt wählen..</span>
                                        <span class="src-breakdown-value">—</span>
                                    </div>
                                    <span class="src-breakdown-formula">—</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="src-sidebar-section src-collapse src-sidebar-box--notes" id="src-notes-tips-section">
                        <div class="src-sidebar-title src-sidebar-title--notes"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8h.01"></path><path d="M11 12h1v4h1"></path></svg></span><span class="src-title-text">Hinweise &amp; Tipps</span></span></div>
                        <div id="src-static-notes" class="src-notes-tips-box"></div>
                    </div>

                    <div class="src-sidebar-section src-collapse src-sidebar-box--compare" id="src-compare-section">
                        <div class="src-sidebar-title src-sidebar-title--compare"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6v14H4z"></path><path d="M14 9h6v10h-6z"></path></svg></span><span class="src-title-text">Vergleich</span></span></div>
                        <div class="src-compare-box" id="src-compare-view"></div>
                    </div>

                    <div class="src-sidebar-section src-collapse src-sidebar-box--packages" id="src-packages-section">
                        <div class="src-sidebar-title src-sidebar-title--packages"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4-8 4-8-4 8-4z"></path><path d="M4 7v10l8 4 8-4V7"></path></svg></span><span class="src-title-text">Pakete</span></span></div>
                        <div class="src-packages-box">
                            <button class="src-mini-btn src-mini-btn--wide" id="src-build-packages" type="button">Pakete erzeugen</button>
                            <div id="src-packages-list"></div>
                        </div>
                    </div>

                    <div class="src-sidebar-section src-info-section">
                        <div class="src-sidebar-title src-sidebar-title--knowledge"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a3 3 0 0 1 3-3h13v18H7a3 3 0 0 0-3 3z"></path><path d="M7 2v18"></path></svg></span><span class="src-title-text">Wissenswertes</span></span></div>
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
                        <button class="src-btn" onclick="srcOpenExportModal()">
                            <span class="dashicons dashicons-pdf"></span> Angebot speichern
                        </button>
                        <div class="src-note-text">
                            Auf Basis VDS Gagenkompass 2025. Alle Preise zzgl. MwSt.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="src-tooltip-fixed"></div>
    <div id="src-export-modal" class="src-modal-overlay" aria-hidden="true">
        <div class="src-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="srcModalTitle">
            <div class="src-modal__head">
                <div>
                    <div class="src-modal__title" id="srcModalTitle">Angebot exportieren</div>
                    <div class="src-modal__subtitle">Wie soll dein Angebot erstellt werden?</div>
                </div>
                <button class="src-modal__close" type="button" aria-label="Schließen" data-modal-close>×</button>
            </div>

            <div class="src-modal__body">
                <div class="src-modal__grid">
                    <button type="button" class="src-opt-tile is-on" data-opt="pdf" aria-pressed="true">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">PDF Angebot</span>
                            <span class="src-opt-tile__sub">Zusammenfassung &amp; Details</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile is-on" data-opt="email" aria-pressed="true">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Mailtext kopieren</span>
                            <span class="src-opt-tile__sub">Kurztext für die E-Mail</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile" data-opt="breakdown" aria-pressed="false">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Rechenweg anhängen</span>
                            <span class="src-opt-tile__sub">Detaillierte Kalkulation</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile" data-opt="risk" aria-pressed="false">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Hinweise anhängen</span>
                            <span class="src-opt-tile__sub">Rechte- &amp; Risiko-Check</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile is-on" data-opt-group="lang" data-value="de" aria-pressed="true">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Sprache: Deutsch</span>
                            <span class="src-opt-tile__sub">Standardversion</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile" data-opt-group="lang" data-value="en" aria-pressed="false">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Sprache: Englisch</span>
                            <span class="src-opt-tile__sub">Internationales Angebot</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile is-on" data-opt-group="pricing" data-value="range" aria-pressed="true">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Preisstrategie: Range</span>
                            <span class="src-opt-tile__sub">Min–Max Spanne</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile" data-opt-group="pricing" data-value="mean" aria-pressed="false">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Preisstrategie: Mittelwert</span>
                            <span class="src-opt-tile__sub">Fester Durchschnittspreis</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile" data-opt-group="pricing" data-value="package" aria-pressed="false">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Preisstrategie: Paket</span>
                            <span class="src-opt-tile__sub">Basic, Standard, Premium</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile is-on" data-opt-group="client" data-value="direct" aria-pressed="true">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Kundentyp: Direktkunde</span>
                            <span class="src-opt-tile__sub">Endkunde / Unternehmen</span>
                        </span>
                    </button>
                    <button type="button" class="src-opt-tile" data-opt-group="client" data-value="agency" aria-pressed="false">
                        <span class="src-opt-tile__check" aria-hidden="true"></span>
                        <span class="src-opt-tile__text">
                            <span class="src-opt-tile__title">Kundentyp: Agentur</span>
                            <span class="src-opt-tile__sub">B2B / Vermittlung</span>
                        </span>
                    </button>
                    <div class="src-opt-tile src-opt-tile--full src-opt-tile--panel" aria-hidden="true">
                        <div class="src-opt-tile__panel">
                            <div class="src-opt-panel-title">Paket auswählen (optional)</div>
                            <div id="src-export-package-wrap" class="src-opt-panel-group">
                                <div class="src-modal-package-grid" role="listbox" aria-label="Paketauswahl">
                                    <button class="src-modal-package-card" type="button" data-export-package-card="basic">Basic</button>
                                    <button class="src-modal-package-card" type="button" data-export-package-card="standard">Standard</button>
                                    <button class="src-modal-package-card" type="button" data-export-package-card="premium">Premium</button>
                                </div>
                                <select id="src-export-package" class="src-select src-sr-only" aria-hidden="true" tabindex="-1">
                                    <option value="basic">Basic</option>
                                    <option value="standard">Standard</option>
                                    <option value="premium">Premium</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="src-opt-tile src-opt-tile--full src-opt-tile--panel" aria-hidden="true">
                        <div class="src-opt-tile__panel">
                            <div class="src-opt-panel-title">Optionale Felder</div>
                            <div class="src-modal-grid">
                                <input type="text" id="src-export-projectname" class="src-input-text" placeholder="Projektname (optional)">
                                <input type="text" id="src-export-offer-id" class="src-input-text" placeholder="Angebotsnummer (optional)">
                                <input type="text" id="src-export-validity" class="src-input-text" placeholder="Gültigkeit (z.B. 14 Tage)">
                            </div>
                            <div class="src-opt-panel-title src-opt-panel-title--small">Lieferumfang (Text)</div>
                            <div class="src-opt-panel-group src-modal-scope">
                                <label class="src-check"><input type="checkbox" class="src-export-scope" value="1 Take"> 1 Take</label>
                                <label class="src-check"><input type="checkbox" class="src-export-scope" value="2 Korrekturen"> 2 Korrekturen</label>
                                <label class="src-check"><input type="checkbox" class="src-export-scope" value="WAV/MP3 Lieferung"> WAV/MP3 Lieferung</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="src-modal__footer">
                <button type="button" class="src-btn src-btn--primary src-btn--full" id="src-export-start">Export starten</button>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('smart_rate_calculator', 'src_shortcode_output_v7');
