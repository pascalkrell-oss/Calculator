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
        array('src-rubik-font'), 
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
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'checkIconUrl' => wp_get_attachment_url(407) ?: ''
    ));

    $src_calc_data = array(
        'rest_fx_url' => esc_url_raw( rest_url('src-calc/v1/fx') ),
    );

    wp_localize_script('src-script', 'SRC_CALC', $src_calc_data);
}
add_action('wp_enqueue_scripts', 'src_enqueue_assets_v7');

add_action('rest_api_init', function () {
    register_rest_route('src-calc/v1', '/fx', array(
        'methods'  => 'GET',
        'callback' => 'src_calc_get_fx_rates_rest',
        'permission_callback' => '__return_true',
    ));
});

function src_calc_get_fx_rates_rest(WP_REST_Request $request) {
    $cache_key = 'src_fx_rates_eur_chf_usd_v1';
    $cached = get_transient($cache_key);
    if (is_array($cached) && isset($cached['CHF'], $cached['USD'], $cached['ts'])) {
        return rest_ensure_response($cached);
    }

    $url = 'https://api.frankfurter.app/latest?from=EUR&to=CHF,USD';

    $resp = wp_remote_get($url, array(
        'timeout' => 8,
        'redirection' => 2,
        'headers' => array('Accept' => 'application/json'),
    ));

    if (is_wp_error($resp)) {
        return rest_ensure_response(array('CHF' => 1, 'USD' => 1, 'ts' => time(), 'source' => 'fallback'));
    }

    $code = wp_remote_retrieve_response_code($resp);
    $body = wp_remote_retrieve_body($resp);
    if ($code !== 200 || empty($body)) {
        return rest_ensure_response(array('CHF' => 1, 'USD' => 1, 'ts' => time(), 'source' => 'fallback'));
    }

    $json = json_decode($body, true);
    $chf = isset($json['rates']['CHF']) ? floatval($json['rates']['CHF']) : 1;
    $usd = isset($json['rates']['USD']) ? floatval($json['rates']['USD']) : 1;

    if ($chf <= 0) {
        $chf = 1;
    }
    if ($usd <= 0) {
        $usd = 1;
    }

    $data = array(
        'CHF' => $chf,
        'USD' => $usd,
        'ts'  => time(),
        'source' => 'server',
    );

    set_transient($cache_key, $data, 24 * HOUR_IN_SECONDS);

    return rest_ensure_response($data);
}

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
    <div class="src-reset-header src-header-flex">
        <div class="src-header-left">
            <button class="src-action-link" onclick="srcStartTutorial()">
                <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Tutorial starten
            </button>
            <span class="src-divider">|</span>
            <button class="src-action-link" onclick="srcOpenGuide()">
                <i class="fa-solid fa-book" aria-hidden="true"></i> Anleitung
            </button>
            <span class="src-divider">|</span>
            <span class="src-currency-label">Währung wählen</span>
            <div class="src-currency-toggle" id="src-currency-toggle" role="group" aria-label="Währung">
                <button type="button" class="src-currency-btn is-active" data-currency="EUR" onclick="srcSetCurrency('EUR')">EUR</button>
                <button type="button" class="src-currency-btn" data-currency="CHF" onclick="srcSetCurrency('CHF')">CHF</button>
                <button type="button" class="src-currency-btn" data-currency="USD" onclick="srcSetCurrency('USD')">USD</button>
            </div>
        </div>
        <button class="src-reset-btn" onclick="srcReset()">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Gagenrechner zurücksetzen
        </button>
    </div>

    <div id="src-calc-v6">
        <div class="src-col-left">
            
            <div class="src-layout-block">
                <div class="src-top-grid">
                <div>
                    <div class="src-section-title"><i class="fa-solid fa-briefcase" aria-hidden="true"></i> Projektart</div>
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
                            <option value="podcast">Podcast (Redaktionell)</option>
                            <option value="doku">TV-Doku / Reportage</option>
                        </optgroup>
                        <optgroup label="Service">
                            <option value="phone">Telefonansage / IVR</option>
                        </optgroup>
                    </select>
                    <span class="src-top-sub">Was wird produziert?</span>
                </div>
                
                <div>
                    <div class="src-section-title"><i class="fa-solid fa-language" aria-hidden="true"></i> Sprache</div>
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
                    <i class="fa-solid fa-align-left" aria-hidden="true"></i> Skript / Länge
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
        </div>

            <div class="src-layout-block">
                <div class="src-left-section src-rights-card src-collapse src-settings-block src-license-settings-block">
                <div class="src-box-header">
                    <div class="src-box-title src-section-title src-license-settings-title">Nutzungsrechte &amp; Lizenzen</div>
                </div>
                <div class="src-rights-inner">
                    <div id="mod-ads" class="src-slide-wrap">
                        <div class="src-light-box-wrapper">
                            <div id="src-pos-type-wrap" class="src-slide-wrap">
                                <div class="src-section-title"><i class="fa-solid fa-store" aria-hidden="true"></i> POS Typ</div>
                                <select id="src-pos-type" class="src-select" onchange="srcCalc()">
                                    <option value="pos_spot">POS Spot (mit Bild)</option>
                                    <option value="ladenfunk">Ladenfunk (ohne Bild)</option>
                                </select>
                                <span class="src-top-sub">Nur bei POS relevant</span>
                            </div>
                            <div class="src-group src-rights-panel src-rights-panel--compact" style="margin-bottom:20px;">
                                <div class="src-section-title" style="margin-bottom:10px;">
                                    <i class="fa-solid fa-location-dot" aria-hidden="true"></i> Verbreitungsgebiet
                                    <span class="src-tooltip-icon src-field-tip" data-field-tip="region" data-default-tip="Tipp: Größere Gebiete bedeuten höhere Reichweite und höhere Lizenzkosten.">?</span>
                                </div>
                                <div class="src-tiles-grid">
                                    <label>
                                        <input type="radio" name="region" value="regional" class="src-tile-input" onchange="srcCalc()">
                                        <div class="src-tile">
                                            <i class="fa-solid fa-location-dot src-tile-icon" aria-hidden="true"></i>
                                            <div class="src-tile-label">Regional</div>
                                        </div>
                                    </label>
                                    <label>
                                        <input type="radio" name="region" value="national" class="src-tile-input" checked onchange="srcCalc()">
                                        <div class="src-tile">
                                            <i class="fa-solid fa-flag src-tile-icon" aria-hidden="true"></i>
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
                                            <i class="fa-solid fa-earth-europe src-tile-icon" aria-hidden="true"></i>
                                            <div class="src-tile-label">Weltweit</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div class="src-group src-rights-panel src-rights-panel--compact" style="margin-bottom:20px;">
                                <div class="src-slider-header">
                                <div class="src-section-title" style="margin:0;">
                                    <i class="fa-solid fa-calendar-days" aria-hidden="true"></i> Nutzungsdauer
                                    <span class="src-tooltip-icon src-field-tip" data-field-tip="duration" data-default-tip="Wie lange darf die Aufnahme genutzt werden? Standard ist 1 Jahr.">?</span>
                                </div>
                                <div id="src-slider-val" class="src-slider-val">1 Jahr</div>
                            </div>
                                <div class="src-slider-container src-range-wrap">
                                    <input type="range" id="src-time-slider" min="1" max="4" value="1" step="1" class="src-slider" oninput="srcCalc()">
                                    <div class="src-range-dots" aria-hidden="true">
                                        <span class="src-range-dot" data-step="0"></span>
                                        <span class="src-range-dot" data-step="1"></span>
                                        <span class="src-range-dot" data-step="2"></span>
                                        <span class="src-range-dot" data-step="3"></span>
                                    </div>
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
                                            <i class="fa-solid fa-cloud src-switch-icon" aria-hidden="true"></i>
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
                                            <i class="fa-solid fa-tv src-switch-icon" aria-hidden="true"></i>
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
                                <div class="src-section-title"><i class="fa-solid fa-plus" aria-hidden="true"></i> Zusatzlizenzen</div>
                                <div class="src-switch-row boxed">
                                    <span class="src-switch-content">
                                        <i class="fa-solid fa-share-nodes src-switch-icon" aria-hidden="true"></i>
                                        <div>
                                            <div class="src-switch-text">Social Media (Organisch)</div>
                                            <div class="src-switch-sub">Zusatzlizenz aktivieren</div>
                                        </div>
                                    </span>
                                    <div class="src-field-inline src-social-inline" id="src-lic-social-level-wrap">
                                        <div class="src-toggle-wrapper">
                                            <input type="checkbox" id="src-social-toggle">
                                            <label class="src-toggle-slider" for="src-social-toggle"></label>
                                        </div>
                                        <div class="src-social-badges" id="src-social-badges"></div>
                                    </div>
                                </div>
                                <div class="src-switch-row boxed">
                                    <span class="src-switch-content">
                                        <i class="fa-solid fa-people-group src-switch-icon" aria-hidden="true"></i>
                                        <div>
                                            <div class="src-switch-text">Event / Messe / POS</div>
                                            <div class="src-switch-sub">Zusatzlizenz aktivieren</div>
                                        </div>
                                    </span>
                                    <div class="src-field-inline src-social-inline" id="src-lic-event-level-wrap">
                                        <div class="src-toggle-wrapper">
                                            <input type="checkbox" id="src-lic-event">
                                            <label class="src-toggle-slider" for="src-lic-event"></label>
                                        </div>
                                        <div class="src-social-badges" id="src-event-badges"></div>
                                    </div>
                                </div>
                                <div class="src-switch-row boxed">
                                    <span class="src-switch-content">
                                        <i class="fa-solid fa-building-columns src-switch-icon" aria-hidden="true"></i>
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
            </div>

            <div class="src-layout-block">
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
            </div>

            <div class="src-layout-block">
                <div id="src-global-settings" class="src-group" style="margin-top:15px; padding-top:15px;">
                <div class="src-section-head">
                    <div class="src-section-head__title">Optionen</div>
                </div>
                <div class="src-opt-card src-collapse" data-opt="cutdown">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <i class="fa-solid fa-repeat src-opt-icon" aria-hidden="true"></i>
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

                <div class="src-opt-card" data-opt="localmode">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <i class="fa-solid fa-location-dot src-opt-icon" aria-hidden="true"></i>
                            <div class="src-opt-text">
                                <div class="src-opt-title">Kleinräumiges Segment (Lokal)</div>
                                <div class="src-opt-sub">Sondertarif für Lokalradio / KMU Online</div>
                            </div>
                        </div>
                        <div class="src-opt-right">
                            <div class="src-toggle-wrapper">
                                <input type="checkbox" id="src-local-mode" aria-expanded="false">
                                <label class="src-toggle-slider" for="src-local-mode"></label>
                            </div>
                        </div>
                    </div>
                    <div class="src-opt-body" data-opt-body>
                        <div class="src-opt-body-text">Eigenständiger Markt für lokale Auswertungen (nur auf Anfrage). Begrenzt auf Radio (Lokal, bis 1 Jahr) oder Online Paid (KMU, max 5.000 Budget, max 3 Monate).</div>
                    </div>
                </div>

                <div class="src-opt-card" data-opt="layout">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <i class="fa-solid fa-pen-to-square src-opt-icon" aria-hidden="true"></i>
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
                            <i class="fa-solid fa-microphone src-opt-icon" aria-hidden="true"></i>
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
                            <div class="src-opt-body-help">Betrag in gewählter Währung</div>
                        </div>
                    </div>
                </div>

                <div class="src-opt-card" data-opt="express">
                    <div class="src-opt-head">
                        <div class="src-opt-left">
                            <i class="fa-solid fa-clock src-opt-icon" aria-hidden="true"></i>
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
                            <i class="fa-solid fa-tag src-opt-icon" aria-hidden="true"></i>
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

        </div>

        <div class="src-col-right">
            <div class="src-sidebar">
                <div class="src-sidebar-sticky" id="srcSidebarSticky">
                    <div class="src-sidebar-section" id="src-kalkulation-section">
                        <div class="src-sidebar-title"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><i class="fa-solid fa-calculator"></i></span><span class="src-title-text">Kalkulation</span></span><span class="src-live-badge">Live-Rechnung</span></div>
                        <div class="src-result-card">
                            <div class="src-price-label">Empfohlene Gage (Netto)</div>
                            <div class="src-price-main-box">
                                <div class="src-price-main">
                                    <div class="src-amount-anim">
                                        <span class="src-amount-anim__value src-total" id="src-display-total">0 EUR</span>
                                    </div>
                                </div>
                            </div>
                            <div class="src-price-meta-row">
                                <div class="src-price-sub">
                                    <div class="src-mean-fade" id="src-mean-fade">
                                        <span id="src-display-range">Ø Mittelwert: <span class="src-marker" id="src-mean-value">0 EUR</span></span>
                                    </div>
                                </div>
                                <div class="src-price-note">Alle Preise zzgl. MwSt.</div>
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

                    <section id="src-license-section" class="src-sidebar-section src-license-section src-license-sidebar src-collapse">
                        <div class="src-sidebar-head src-license-sidebar__head">
                            <div class="src-sidebar-head__left">
                                <span class="src-sidebar-icon src-title-icon" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
                                <h3 class="src-sidebar-title">Nutzungsrechte &amp; Lizenzen</h3>
                            </div>
                        </div>
                        <div class="src-license-sidebar__body">
                            <div id="src-license-text" class="src-license-box src-license-sidebar__text"></div>
                        </div>
                    </section>

                    <div class="src-sidebar-section src-collapse" id="src-pricedetails-section">
                        <div class="src-sidebar-title src-sidebar-title--pricedetails"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><i class="fa-solid fa-list"></i></span><span class="src-title-text">Preis-Details</span></span></div>
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
                        <div class="src-sidebar-title src-sidebar-title--notes"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><i class="fa-solid fa-lightbulb"></i></span><span class="src-title-text">Hinweise &amp; Tipps</span></span></div>
                        <div id="src-static-notes" class="src-notes-tips-box"></div>
                    </div>

                    <div class="src-sidebar-section src-collapse src-sidebar-box--packages" id="src-packages-section">
                        <div class="src-sidebar-title src-sidebar-title--packages"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><i class="fa-solid fa-table-cells-large"></i></span><span class="src-title-text">Pakete</span></span></div>
                        <div class="src-packages-box">
                            <button class="src-mini-btn src-mini-btn--wide" id="src-build-packages" type="button">Pakete erzeugen</button>
                            <div id="src-packages-list"></div>
                        </div>
                    </div>

                    <div class="src-sidebar-section src-info-section" id="src-knowledge-section">
                        <div class="src-sidebar-title src-sidebar-title--knowledge"><span class="src-title-main"><span class="src-title-icon" aria-hidden="true"><i class="fa-solid fa-circle-info"></i></span><span class="src-title-text">Wissenswertes</span></span></div>
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

                    <div id="src-save-section">
                    <div class="src-footer-actions">
                        <button class="src-btn" id="src-offer-save-btn" onclick="srcOpenExportModal()">
                            <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Angebot speichern
                        </button>
                        <div class="src-note-text">
                            <a class="src-vds-link" href="https://www.sprecherverband.de/wp-content/uploads/2025/02/VDS_Gagenkompass_2025.pdf" target="_blank" rel="noopener">Auf Basis VDS Gagenkompass 2025</a>. Alle Preise zzgl. MwSt.
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="src-tooltip-fixed"></div>
    <div id="src-export-modal" class="src-modal-overlay" aria-hidden="true">
        <div class="src-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="srcModalTitle">
            <div class="src-modal__head src-export-modal__head">
                <div>
                    <div class="src-modal__title" id="srcModalTitle">Angebot exportieren</div>
                    <div class="src-modal__subtitle">Wie soll Dein Angebot erstellt werden?</div>
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
                                <input type="text" id="src-export-subject" class="src-input-text" placeholder="Angebotsbetreff (editierbar)">
                                <input type="text" id="src-export-customer-name" class="src-input-text" placeholder="Kund*innenname (editierbar)">
                                <input type="text" id="src-export-customer-address" class="src-input-text" placeholder="Kund*innenadresse (optional)">
                                <input type="text" id="src-export-provider-name" class="src-input-text" placeholder="Eigene Firma / Name (editierbar)">
                                <input type="text" id="src-export-provider-address" class="src-input-text" placeholder="Eigene Adresse (editierbar)">
                                <input type="text" id="src-export-provider-contact" class="src-input-text" placeholder="Eigene Kontaktinfos (E-Mail / Telefon)">
                                <input type="text" id="src-export-projectname" class="src-input-text" placeholder="Projektname (optional)">
                                <input type="text" id="src-export-offer-id" class="src-input-text" placeholder="Angebotsnummer (optional)">
                                <input type="text" id="src-export-date" class="src-input-text" placeholder="Angebotsdatum (TT.MM.JJJJ)">
                                <label class="src-export-inline-field" for="src-export-theme">Angebots-Theme
                                    <select id="src-export-theme" class="src-input-text src-export-select">
                                        <option value="dark">Dunkel</option>
                                        <option value="light">Hell</option>
                                    </select>
                                </label>
                                                                <label class="src-export-inline-field" for="src-export-payment">Zahlungsfrist
                                    <input type="text" id="src-export-payment" class="src-input-text" placeholder="Zahlungsfrist (z.B. 14 Tage)">
                                    <small class="src-export-helper">Zahlungsfrist: Anzahl Tage bis Zahlung fällig.</small>
                                </label>
                                <input type="text" id="src-export-disclaimer" class="src-input-text" placeholder="Rechtlicher Hinweis (optional)">
                                <label class="src-export-logo-field">PDF Ausgabe
                                    <select id="src-export-output-mode" class="src-input-text src-export-select">
                                        <option value="both">PDF + Mailtext</option>
                                        <option value="pdf">Nur PDF Angebot</option>
                                        <option value="email">Nur Mailtext kopieren</option>
                                    </select>
                                </label>
                                <div class="src-export-logo-field">Logo für PDF-Export (nur temporär)
                                    <input type="file" id="src-export-logo" class="src-input-text src-export-logo-input" accept="image/png,image/jpeg">
                                    <div id="src-export-logo-dropzone" class="src-export-logo-dropzone" role="button" tabindex="0" aria-controls="src-export-logo" aria-label="Logo hochladen">
                                        <span id="src-export-logo-name">Logo hochladen (klicken oder Datei hierher ziehen)</span>
                                        <button type="button" id="src-export-logo-remove" class="src-export-logo-remove">Entfernen</button>
                                    </div>
                                </div>
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

    <div id="src-guide-modal" class="src-modal-overlay" aria-hidden="true">
        <div class="src-modal-dialog src-guide-dialog" role="dialog" aria-modal="true">
            
            <div class="src-modal__head src-guide-header-modern">
                <div class="src-guide-header-left">
                    <div class="src-guide-header-icon"><i class="fa-solid fa-book" aria-hidden="true"></i></div>
                    <div>
                        <div class="src-modal__title">Anleitung & Leitfaden</div>
                        <div class="src-modal__subtitle">So kalkulierst Du Sprechergagen professionell</div>
                    </div>
                </div>
                <button class="src-modal__close" type="button" aria-label="Schließen" data-guide-close>×</button>
            </div>

            <div class="src-modal__body src-guide-body">
                
                <div class="src-guide-toc">
                    <div class="src-guide-toc-title">Inhalt</div>
                    <ul>
                        <li><a href="#guide-1">1. Das Verwertungsprinzip</a></li>
                        <li><a href="#guide-2">2. Projektarten & Layout</a></li>
                        <li><a href="#guide-3">3. Skriptlänge & Module</a></li>
                        <li><a href="#guide-4">4. Verbreitungsgebiet & Lokal</a></li>
                        <li><a href="#guide-5">5. Laufzeiten & Buyouts</a></li>
                        <li><a href="#guide-6">6. Zusatzlizenzen & Cut-downs</a></li>
                        <li><a href="#guide-7">7. Optionen, Aufwand & Rabatte</a></li>
                        <li><a href="#guide-8">8. Datenschutz & Sicherheit</a></li>
                    </ul>
                </div>

                <p class="src-guide-intro-text">
                    Willkommen im Leitfaden zur Gagenkalkulation! Die Honorierung von professionellen Sprecherleistungen basiert nicht auf Stundenlöhnen, sondern auf dem Prinzip der <strong>Nutzungsrechte</strong>. Grundlage für alle Berechnungen ist der offizielle <a href="https://www.sprecherverband.de/wp-content/uploads/2025/02/VDS_Gagenkompass_2025.pdf" target="_blank" rel="noopener" class="src-vds-link-inline">VDS Gagenkompass 2025</a>. Diese Anleitung beantwortet alle Fragen zur korrekten Einstellung und Nutzung.
                </p>
                <h3 id="guide-1" class="src-guide-h3"><i class="fa-solid fa-chart-pie src-guide-h3-icon" aria-hidden="true"></i> 1. Das Verwertungsprinzip</h3>
                <p>Man bezahlt primär für die Reichweite und die Zeit, in der eine Marke die Stimme nutzt. Ein Werbespot, der ein Jahr lang national im TV läuft, hat einen deutlich höheren Werbewert als ein reines internes Schulungsvideo. Daher steigen die Kosten exponentiell mit dem Medium, der Verbreitung (Gebiet) und der Laufzeit.</p>

                <h3 id="guide-2" class="src-guide-h3"><i class="fa-solid fa-briefcase src-guide-h3-icon" aria-hidden="true"></i> 2. Projektarten & Layout</h3>
                <p>Die Projektart bestimmt die Grundlage. Paid Media (TV, Funk, Online Ads) basiert auf Reichweiten-Faktoren, während Unpaid Media (Imagefilme, E-Learning) meist nach Textlänge abgerechnet wird.</p>
                <div class="src-guide-tip">
                    <strong>💡 Layout & Pitch (Sonderfall)</strong><br>
                    Wird die Aufnahme lediglich genutzt, um intern eine Idee in einem <span class="src-glossary-term" data-hover="Präsentation einer Idee vor dem Kunden, bevor das eigentliche Projekt final beauftragt wird.">Pitchbild</span> zu präsentieren, wähle in den Optionen <em>"Nur Layout / Pitch"</em>. Hier wird eine stark reduzierte Pauschale ohne Rechte berechnet.
                </div>

                <h3 id="guide-3" class="src-guide-h3"><i class="fa-solid fa-clock src-guide-h3-icon" aria-hidden="true"></i> 3. Skriptlänge & Module</h3>
                <p>Die Länge des Textes ist bei Corporate- oder E-Learning-Projekten essenziell. Das System schätzt die Dauer automatisch, sobald ein Skript eingefügt wird.</p>
                <div class="src-guide-tip">
                    <strong>⏱️ Faustregel & Telefonansagen</strong><br>
                    Kalkuliere pro Minute mit etwa 900 Zeichen (inkl. Leerzeichen). Bei <em>Telefonansagen (IVR)</em> wird nicht nach Länge, sondern nach <span class="src-glossary-term" data-hover="Ein Modul entspricht einer einzelnen, in sich abgeschlossenen Ansage im Telefonsystem.">Modulen</span> abgerechnet. 3 Module sind in der Grundpauschale enthalten.
                </div>

                <h3 id="guide-4" class="src-guide-h3"><i class="fa-solid fa-location-dot src-guide-h3-icon" aria-hidden="true"></i> 4. Verbreitungsgebiet & Lokal</h3>
                <p>Das Gebiet definiert die Ausstrahlungsgrenzen (Regional, National, DACH, Weltweit) und ist für Werbespots hochrelevant.</p>
                <div class="src-guide-tip">
                    <strong>📍 Kleinräumiges Segment (Lokal / KMU)</strong><br>
                    Aktiviere in den Optionen <em>"Kleinräumiges Segment"</em> für Sondertarife, die nicht über reguläre Multiplikatoren laufen. Z.B. "Funkspot (Lokal)" oder "Online Video (Kleinräumig)" für <span class="src-glossary-term" data-hover="Kleine und mittlere Unternehmen mit einem strikt begrenzten Media-Budget (max. 5.000 €).">KMU</span>.
                </div>

                <h3 id="guide-5" class="src-guide-h3"><i class="fa-solid fa-calendar-days src-guide-h3-icon" aria-hidden="true"></i> 5. Laufzeiten & Buyouts</h3>
                <p>Die Standard-Lizenz für Werbung beträgt oft 1 Jahr. Unter "Erweitert" lassen sich komplexe Modelle abbilden:</p>
                <ul>
                    <li><strong><span class="src-glossary-term" data-hover="Ein pauschaler Zuschlag (+25%), um Nutzungsrechte vereinfacht für einen festgelegten Zeitraum abzugelten.">Buyout</span> (einmalig):</strong> Ein Aufschlag von 25% auf die Endsumme.</li>
                    <li><strong>Staffel (Perioden):</strong> Oft gewählt für langfristige Kampagnen, bei denen jede weitere Nutzungsperiode (z.B. ein weiteres Jahr) mit +12% vergünstigt berechnet wird.</li>
                    <li><strong>Unlimited:</strong> Eine zeitlich unbegrenzte Nutzung im Paid-Bereich vervielfacht das Honorar, da die Stimme potenziell für Konkurrenzprodukte blockiert wird.</li>
                </ul>

                <h3 id="guide-6" class="src-guide-h3"><i class="fa-solid fa-plus src-guide-h3-icon" aria-hidden="true"></i> 6. Zusatzlizenzen & Cut-downs</h3>
                <p>Zusätzliche Medienkanäle oder Kurzversionen können dem Projekt flexibel hinzugefügt werden.</p>
                <div class="src-guide-tip">
                    <strong>✂️ Cut-downs, Tag-ons & Pakete</strong><br>
                    Wird aus einem 30-sekündigen Hauptspot noch eine Kurzversion geschnitten, gilt dies als <span class="src-glossary-term" data-hover="Eine gekürzte Version des Hauptspots (oft als 15s Reminder) aus dem gleichen Rohmaterial.">Cut-down</span> (50 % der Gage). Nutze zudem Pakete (z.B. <em>Online Audio</em> für Funkspots), um Cross-Media-Kampagnen branchenüblich abzubilden.
                </div>

                <h3 id="guide-7" class="src-guide-h3"><i class="fa-solid fa-sliders src-guide-h3-icon" aria-hidden="true"></i> 7. Optionen, Aufwand & Rabatte</h3>
                <p>Weitere Projektumstände können die Summe final anpassen:</p>
                <ul>
                    <li><strong>Produktion & Aufwand:</strong> Spezielles <span class="src-glossary-term" data-hover="Die exakte lippensynchrone Anpassung der Sprache an die Bewegungen im Video.">Lipsync</span>, technisches Vokabular oder mehrere Sprachversionen fließen hier als Komplexitätsfaktor ein.</li>
                    <li><strong>Studiokosten:</strong> Produziert und reinigt der Sprecher das Audio im eigenen Studio, greift die Technik-Pauschale.</li>
                    <li><strong>Express & Rabatte:</strong> Für schnelle Lieferungen (4h/24h) gibt es Express-Aufschläge. Rabatte können prozentual inkl. Begründung abgezogen werden.</li>
                    <li><strong>Währungsumrechnung:</strong> Die empfohlenen deutschen Gagen werden ausschließlich zum aktuellen Wechselkurs in CHF bzw. $ umgerechnet. Es werden keine anderen (z.B. schweizerischen/amerikanischen) Preismodelle verwendet.</li>
                </ul>

                <h3 id="guide-8" class="src-guide-h3"><i class="fa-solid fa-lock src-guide-h3-icon" aria-hidden="true"></i> 8. Datenschutz & Sicherheit</h3>
                <p><strong>100% Lokal & Privat:</strong> Alle Deine eingegebenen Daten, Projektinformationen, Skripte und kalkulierten Zahlen werden <strong>niemals</strong> auf unseren Servern gespeichert oder an Dritte übertragen. Die gesamte Berechnung und auch die Erstellung der PDF-Angebote findet ausschließlich lokal in Deinem Browser statt. Deine Daten gehören nur Dir.</p>
                <br>
            </div>
        </div>
    </div>

    <div id="src-tutorial-overlay"></div>
    <div id="src-tutorial-panel" class="src-tutorial-hidden">
        <div class="src-tutorial-panel-inner">
            <div class="src-tutorial-header">
                <span class="src-tutorial-step-badge" id="src-tut-badge">1 / 8</span>
                <h3 id="src-tut-title">Titel</h3>
                <button type="button" class="src-tut-close" onclick="srcEndTutorial()" aria-label="Beenden">×</button>
            </div>
            <p id="src-tut-desc">Beschreibungstext...</p>
            <div class="src-tutorial-footer">
                <div class="src-tutorial-dots" id="src-tut-dots"></div>
                <div class="src-tutorial-nav">
                    <button type="button" id="src-tut-prev" class="src-tut-btn src-tut-btn-secondary" onclick="srcTutPrev()">Zurück</button>
                    <button type="button" id="src-tut-next" class="src-tut-btn src-tut-btn-primary" onclick="srcTutNext()">Weiter <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
                </div>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('smart_rate_calculator', 'src_shortcode_output_v7');
