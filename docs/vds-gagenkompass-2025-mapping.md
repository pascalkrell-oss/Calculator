# VDS-Gagenkompass 2025 – Fachliches Mapping für den Smart Rate Calculator

## Ziel dieses Artefakts

Dieses Dokument übersetzt den VDS-Gagenkompass 2025 in eine fachliche Regel- und Datenarchitektur, ohne das bestehende Frontend aggressiv umzubauen. Es dient als Fundament für Schritt 2: die technische Integration in die bestehende Shortcode-, State-, Recalc-, Export- und Admin-Struktur.

## A. Fachliche Mapping-Analyse

### 1. Hauptkategorien / Family-Ebene

| Family | Zweck im Rechner | Bestehender Anker im Plugin |
| --- | --- | --- |
| Werbung mit Bild | Paid-/lizenzgetriebene Werbeformen mit Motiv-Logik | `SRC_WERBUNG_MIT_BILD_CONFIG`, Werbe-Multiplikatoren |
| Werbung ohne Bild | Audio-Werbung, Funk, Reminder, Ladenfunk, Telefon-Werbespot | `radio`, `pos`-Variante Ladenfunk |
| Webvideo / Imagefilm / Präsentation – Unpaid Media | minutenbasierte Unpaid-/Corporate-Fälle | tiered minute pricing |
| App | App-Vertonung mit möglicher Werbe-Abzweigung | `app` |
| Telefonansage | modulbasierte Ansagen | `phone` |
| E-Learning / Audioguide | interne und öffentliche Lern-/Guideszenarien | `elearning`, `audioguide` |
| Podcast | Verpackung und werbliche Fälle | `podcast` |
| Hörbuch | FAH-/Session-nahe Modelle | bisher nur Platzhalter |
| Games | session- bzw. stundengetriebene Modelle | bisher nur Platzhalter |
| Redaktionelle Inhalte / Doku / TV-Reportage | Mindestgage + Netto-Sendeminute | `doku`, `editorial_tv` |
| Audiodeskription | Mindestgage + Netto-Sendeminute mit AD-Hinweis | `audiodescription` |
| Kleinräumige Nutzung | reduzierte lokale/kleine Auswertung | `kleinraeumig`, Local-Mode für Ads |
| Session Fee | Aufnahmezeit statt Nutzung als Primärlogik | neu als Expertenlayer |
| Unbegrenzte Nutzung | Buyout-/Unlimited-Fälle | bisher über Laufzeitfaktor 4 angenähert |
| Pakete / Rabatte / Sonderfälle | ATV/CTV, Online Audio, Nachgage, Credits | Paket- und Addonlogik vorhanden |

### 2. Unterfälle / Cases

#### Werbung mit Bild

- Online Video Spot Paid.
- Online Video Spot Archivgage.
- Online Video Spot Unpaid → Querverweis zu Imagefilm/Webvideo.
- ATV/CTV Spot.
- TV Spot regional / national.
- TV Reminder als Prozentregel zur Ursprungsgage.
- TV Patronat.
- ATV/CTV Patronat.
- Kino Spot regional / national.
- POS Spot.
- Zusatzterritorium.
- Zusatzjahr.
- Zusatzmotiv.
- Animatic / Narrative / Moodfilm.
- Layoutgage.

#### Werbung ohne Bild

- Funk Spot.
- Funk Reminder.
- Ladenfunk.
- Telefon-Werbespot → Querverweis in Werbelogik.
- Online Audio Spot Paid.
- Online Audio Spot Unpaid → Querverweis zu Webvideo/Imagefilm.

#### Webvideo / Imagefilm / Präsentation – Unpaid Media

- Imagefilm.
- Webvideo Unpaid.
- Erklärvideo.
- Mitarbeiterfilm.
- Awardfilm.
- Präsentation.
- Social-Media-Zusatzlizenz.
- Archiv-/Nachverwertung als Zusatzereignis statt stiller Multiplikation.

#### App

- App-Vertonung.
- In-App Ads → Querverweis zu Werbung mit Bild.

#### Telefonansage

- Telefonansage bis 3 Module.
- Je weiteres Modul.
- Reine Service-/IVR-Ansage.
- Werbliche Telefonansage → Querverweis zu Werbung ohne Bild.

#### E-Learning / Audioguide

- E-Learning intern.
- E-Learning öffentlich.
- Marketing-E-Learning → Querverweis zu Imagefilm/Webvideo.
- Audioguide.

#### Podcast

- Podcast Verpackung.
- Podcast werblich → Querverweis zu Werbung ohne Bild.

#### Hörbuch

- Hörbuch nach FAH.
- Hörbuch als Session-/Stundenmodell, falls projektspezifisch verhandelt.

#### Games

- Games erste Stunde.
- Games Folgestunde.
- Games Session Fee.
- Games werbliche Nutzung → Querverweis zu Werbung mit Bild.

#### Redaktionell / Doku / TV-Reportage

- Doku Kommentar.
- Doku Overvoice.
- TV-Reportage.
- redaktionelle TV-Beiträge.

#### Audiodeskription

- AD mit Mindestgage.
- AD pro Netto-Sendeminute.

#### Kleinräumig / Unlimited / Sonderfälle

- Kleinräumige Online-/Funknutzung.
- Session Fee.
- zeitlich/räumlich/medial unbegrenzte Nutzung.
- Paketfälle.
- Nachgage.
- spätere Zusatzverwertung.

### 3. Querverweis-Engine

Die Querverweise sind als echte Regeln im JSON-Blueprint modelliert, nicht nur als Text. Relevante Regeln:

- Online Video Spot Unpaid → `webvideo_unpaid`.
- Online Audio Spot Unpaid → `webvideo_unpaid`.
- Telefon-Werbespot → `werbung_ohne_bild / telefon_werbespot`.
- Reine Telefonansage bleibt in `telefonansage`.
- In-App Ads → `werbung_mit_bild / online_video_spot`.
- Internes E-Learning bleibt in `elearning_intern`.
- Öffentliches / Marketing-E-Learning → `imagefilm_marketing`.
- Podcast werblich → `funk_spot`.
- Werbliche Nutzung von Games → `online_video_spot`.

### 4. Mengeneinheiten / Unit Types

Das Zielmodell unterscheidet sauber zwischen:

- `motiv` für werbliche Einzelmotive.
- `film` für abgeschlossene Bewegtbildwerke.
- `sendung` / `folge` für redaktionelle oder serielle Formate.
- `modul` für Telefonansagen.
- `minute` für freie Minutenlogik.
- `netto_sendeminute` für Doku/AD.
- `studiostunde` für Games/Session Fee.
- `fah` für Hörbuch nach Final Audio Hour.
- `bis_3_module`, `je_weiteres_modul`, `erste_stunde`, `folgestunde`, `bis_5_min`, `je_weitere_5_min` als abgeleitete Staffel-Unit-Typen.

### 5. Preis- und Staffellogik

Es gibt im Mapping bewusst mehrere Berechnungsmodi:

- `fixed_plus_license_multipliers` für klassische Werbung.
- `reference_percentage` für Reminder.
- `tiered_duration` für Imagefilm, Webvideo, App, E-Learning, Kleinräumig.
- `tiered_modules` für Telefonansage.
- `minimum_plus_per_unit` für Doku / AD.
- `session_fee_plus_followup_hour` für Games.
- `expert_matrix` für Hörbuch / Session Fee.
- `expert_override_or_multiplier_cap` für Unlimited-Fälle.
- `proposal_required` dort, wo der Kompass fachlich Vorschlagskalkulation nahelegt.

### 6. Lizenz- und Addon-Logik

Das Mapping trennt fachlich:

- Basishonorar.
- Lizenzmultiplikatoren.
- echte Zusatzlizenzen.
- spätere Zusatzverwertungen.
- Pakete.
- Anrechnungen/Credits.
- Unlimited-/Buyout-Sonderlogik.

Abgebildete Addons/Regeln:

- Zusatzterritorium.
- Zusatzjahr.
- Zusatzmotiv.
- Reminder.
- Patronat.
- Social Media.
- Präsentationen.
- Archivgage.
- Layoutgage.
- Nachgage.
- Session Fee.
- spätere Zusatzverwertung.
- Paketlogik für Online Audio und ATV/CTV.
- Unlimited Usage mit Expertenfreigabe.

### 7. Sichtbarkeits- und Decision-Logik

Die technische Integration sollte Family- und Case-gesteuert entscheiden:

- Werbe-Fälle zeigen Preisniveau, Gebiet, Laufzeit, Sprache, Varianten.
- Reminder zeigen Pflichtfeld „Referenzfall“ statt eigener Festpreise.
- Telefonansage zeigt Modulzähler, blendet Werbe-Lizenzfelder aus.
- Doku/AD zeigen Netto-Sendeminuten und Mindestgage-Info.
- Games/Hörbuch zeigen Expertenhinweis statt Scheingenauigkeit.
- Cross-Reference-Cases lösen Folgefrage aus: „Ist die Nutzung werblich / paid / öffentlich?“.

### 8. Hinweise / Expertenfälle

Explizit als Expertenfall oder Vorschlagskalkulation zu markieren:

- Reminder-Spannen von 50–100 % ohne Referenzfall.
- Hörbuch nach FAH ohne belastbare projektspezifische Matrix.
- Games mit Session-/Buyout-Kombination.
- Unlimited Buyouts.
- Anrechnungslogik bei späterer Zusatzverwertung.
- komplexe Kampagnen mit mehreren Motiven, Territorien, Flighting und Versionierungen.
- Podcast-Verpackung ohne standardisierte Preiszeile im bestehenden Plugin.

### 9. Breakdown-Logik

Empfohlene Breakdown-Familien:

- `advertising_visual`: Basishonorar, Sprache, Gebiet, Laufzeit, Paket, Cut-down, Addons.
- `advertising_audio`: Basishonorar, Gebiet, Laufzeit, Online-Audio-Paket, Addons.
- `tiered_minutes_unpaid`: Minutenstaffel, Überlänge, Addons.
- `modules_plus_increment`: Basis bis 3 Module, weitere Module.
- `minimum_plus_net_minute`: Mindestgage, Netto-Sendeminuten-Zuschlag.
- `session_hour_steps`: erste Stunde, Folgestunde, Session-Fee-Hinweis.
- `buyout_expert`: Referenzfall, Buyout-Hinweis, Expertenfreigabe.
- `packages_and_credits`: Paketfaktor, Credit/Anrechnung, Nachgage-Ereignis.

## B. Architektur-Empfehlung

### Weiterverwendbare bestehende Plugin-Bausteine

- Die PHP-Bootstrap-Logik mit `src_get_frontend_bootstrap_data()` ist als Einspeisepunkt für erweiterte Konfigurationsdaten geeignet.
- Die Admin-JSON-Verwaltung ist bereits das richtige Wartungsmodell für regelbasierte Konfiguration.
- Die JS-Normalisierung `srcNormalizeRatesData()` kann als Kompatibilitätsschicht für alte und neue Schemas dienen.
- `SRC_PROJECT_HIERARCHY` und `SRC_WERBUNG_MIT_BILD_CONFIG` zeigen bereits eine Trennung zwischen Family und Sonderfalllogik.
- `srcComputeSingleProjectResult()` enthält die fachlichen Rechenpfade, die in Schritt 2 schrittweise gegen deklarative `pricing_mode`-/`recalc_rules`-Handler austauschbar sind.
- Die bestehenden Bereiche für Breakdown, Rights Guidance, Zusatzlizenzen, Pakete und Export müssen nicht ersetzt, sondern nur mit dem neuen Layer gespeist werden.

### Neue Mapping-/Regel-Layer

Empfohlen werden drei ergänzende Layer:

1. **Blueprint-Layer**  
   Statische, versionierte Fachdefinitionen (`config/vds-gagenkompass-2025.mapping.json`).

2. **Compatibility-Layer**  
   Übersetzt Blueprint-Daten in das heutige Runtime-Schema (`vds2025.cases`, Flat Keys, Addons, Multipliers).

3. **Rule-Execution-Layer**  
   Späterer Dispatcher, der `pricing_mode`, `cross_reference_rules`, `visibility_rules`, `package_rules`, `credit_rules` und `unlimited_usage_rules` auswertet.

### Technisches Andocken

- Den Blueprint im Default-JSON unter `vds2025.mapping_blueprint` mit ausliefern.
- In Schritt 2 eine JS-Resolver-Schicht einziehen:
  - `srcResolveCaseBlueprint(family, case)`
  - `srcResolveVisibilityRules(state)`
  - `srcResolveCrossReference(state)`
  - `srcComputeByPricingMode(mode, state, blueprint)`
- Bestehende UI-Felder bleiben zunächst bestehen; nur ihre Aktivierung wird künftig blueprint-gesteuert.
- Export-/PDF-Logik sollte später direkt auf `breakdown_templates` und `license_texts` zugreifen.

## C. Datenmodell / Konfigurationsstruktur

Die vorgeschlagene JSON-Struktur deckt mindestens folgende Felder ab:

- `family`
- `case`
- `title`
- `unit_type`
- `pricing_mode`
- `base_rates`
- `rate_tiers`
- `durations`
- `territories`
- `addons`
- `cross_reference_rules`
- `visibility_rules`
- `recalc_rules`
- `notes`
- `license_texts`
- `breakdown_templates`
- `package_rules`
- `credit_rules`
- `unlimited_usage_rules`
- `expert_override_flags`

Zusätzlich sinnvoll:

- `meta` für Versionierung.
- `integration_mode` zur Abgrenzung zwischen „vorbereitet“ und „aktiv ausgewertet“.
- `purpose`/`status` für spätere Redaktion.

## D. Optional notwendige minimale Codeanpassungen

Für diesen ersten Schritt wurden nur minimale, nichtinvasive Änderungen empfohlen:

1. Loader-Funktion für das Blueprint-JSON in `admin.php`.
2. Default-Konfiguration erweitert um `vds2025.mapping_blueprint`.
3. Keine Frontend-Umbauten.
4. Keine Rechenlogik erzwungen umgestellt.

## E. Abschlusscheck

- VDS-Gagenkompass fachlich vollständig als Mapping-Grundlage übersetzt: Ja.
- Querverweise berücksichtigt: Ja, als Regelobjekte.
- Sonderfälle berücksichtigt: Ja, inkl. Reminder, Unlimited, Games, Hörbuch, Nachgage, Zusatzverwertung.
- Datenmodell für Schritt 2 vorbereitet: Ja.
- Bestehende Plugin-Struktur nicht unnötig zerstört: Ja.
