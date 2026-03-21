# Hybrid-Rebuild-Plan für die VDS-Core-Engine

## Zielbild

Dieses Dokument definiert einen kontrollierten hybriden Neuaufbau des Plugins. Die bestehende UI, die Shortcode-Ausgabe, die Sidebar, der Breakdown, der PDF-Export und die Admin-Konfiguration bleiben als Integrationshülle möglichst erhalten. Die fachliche Kernlogik wird jedoch schrittweise aus der historisch gewachsenen Mischarchitektur herausgelöst und in eine klar abgegrenzte, VDS-geführte Core-Engine überführt.

Leitprinzipien:

- Kein Redesign.
- Kein kompletter Rewrite des Frontends.
- Keine weitere Vermischung aus Alt-Heuristik und neuer Fachlogik ohne explizite Adapter-Schicht.
- VDS-Gagenkompass 2025 ist die führende fachliche Quelle.
- Nutzung definiert die Gage; UI, Breakdown, Hinweise und Export werden aus derselben Engine gespeist.

## A. IST-Analyse

### 1. Wiederverwendbare Bausteine

#### UI und Shortcode-Struktur

Beibehaltbar sind insbesondere:

- Der gesamte Shortcode-Container mit linker Eingabespalte und rechter Sidebar.
- Die bestehende Format-/Projektwahl, inkl. abhängiger Select-Felder.
- Die VDS-spezifischen Spezialfelder (`paid/unpaid`, Nutzungskontext, Medium, Zusatzterritorien, Zusatzjahre, Zusatzmotive, Session-Hours, Reminder-Faktor, Unlimited-Flags).
- Die rechte Sidebar mit Nutzungsrechte-Box, Breakdown, Ergebnisdarstellung und Export-Trigger.
- Die Modal-Struktur des PDF-Exports.
- Tutorial-/Guide-/Reset-Interaktionen.

Diese Struktur ist bereits UI-seitig ausreichend modular, um künftig über einen UI-Adapter statt über direkte Fachheuristiken gespeist zu werden.

#### State / Restore / Reset

Stabil wiederverwendbar erscheinen:

- Die bestehende lokale Persistenz über `localStorage`.
- Die Sammellogik für Spezialzustände (`srcGetVdsSpecialState`).
- Die generelle State-Erzeugung aus UI-Feldern.
- Restore-/Reset-Mechaniken und die bestehende Verdrahtung der DOM-Events.

Diese Teile sollten nicht neu erfunden, sondern an ein neues normiertes Engine-State-Schema adaptiert werden.

#### Export / PDF

Weiterverwendbar sind:

- Die Export-Modal-Logik.
- Die jsPDF-/AutoTable-basierte PDF-Erstellung.
- Die Sammlung optionaler Angebotsangaben.
- Die bestehende Breakdown-/Range-Ausgabe als Grundlage für spätere Engine-getriebene Exportdaten.

Der Export braucht primär eine neue Datenquelle, aber keinen kompletten Neuaufbau der Oberfläche.

#### Admin / JSON / Konfiguration

Teilweise wiederverwendbar sind:

- Die Admin-Seite mit JSON-basierter Konfigurationspflege.
- Das Konzept eines versionierten JSON-Bootstraps.
- Das bereits eingeführte Mapping-Blueprint-Artefakt.
- Die PHP-Bootstrap-Übergabe via `src_get_frontend_bootstrap_data()`.

#### Bereits angelegte VDS-Ansätze

Wertvoll als Vorarbeit sind:

- `config/vds-gagenkompass-2025.mapping.json` als autoritativer Blueprint-Ansatz.
- `docs/vds-gagenkompass-2025-mapping.md` als fachliches Vor-Mapping.
- Die VDS-Normalisierung in JS (`srcNormalizeRatesData`).
- Die Unterscheidung von Taxonomie, Cases, Pricing-Arten und Spezialzuständen.
- Erste Cross-Reference-Ideen über `srcResolveVdsScenario()`.

### 2. Kritische Altsysteme und Problemzonen

#### Fachlich problematische Altlogik

Die kritischsten Punkte sind:

- `srcComputeSingleProjectResult()` bündelt Pricing, Routing, Lizenzlogik, Expertenhinweise, Addons, Breakdown und UI-nahe Textbildung in einer einzigen großen Rechenfunktion.
- `srcNormalizeRatesData()` vereint Fallback-Migration, Schema-Reparatur, Taxonomie-Rekonstruktion und Blueprint-Übersetzung in einer einzigen Kompatibilitätsfunktion.
- Fachlogik ist teils deklarativ im JSON modelliert, teils hartkodiert in JS-Defaults (`SRC_VDS_DEFAULT_EXTRAS`) und teils nochmals als UI-Sonderlogik in Conditions kodiert.

#### Verfälschende Fallbacks

Fachlich riskant sind insbesondere:

- Blueprint-Cases werden auf alte generische `flat`-, `tiered`-, `per_minute`- oder `expert`-Strukturen zurückgefaltet, wodurch VDS-spezifische Semantik verloren geht.
- Expert-/Proposal-Fälle werden zu Schein-Automatiken verdichtet, obwohl sie eigentlich Advisory-/Proposal-Logik benötigen.
- Unlimited-Nutzung wird aktuell über harte Multiplikatoren angenähert, ohne saubere Modellierung von Anrechnung, Korridor und Expertenfreigabe.
- Games, Hörbuch, Session Fee, Reminder, Paketfälle und Folgeverwertungen werden teilweise nur als heuristische Aufschläge behandelt.
- `followup` spiegelt aktuell im Kern einfach nochmals die aktuelle Gage, statt als sauberer VDS-Ereignistyp modelliert zu sein.

#### Historisch vermischte Recalc-Pfade

Aktuell laufen mehrere Verantwortlichkeiten gleichzeitig durch dieselben Pfade:

- Projektwahl → Routing → effektiver Projektwechsel.
- Preisermittlung → Addons → Lizenztexte → Breakdown → Expertenhinweise.
- Produktions-/Komplexitätslogik → Werbelogik → Rabatt/Express → Studiokosten.
- Paketlogik und Zusatzlizenzen werden teils als fachliche Rechte, teils als reine Rechenaufschläge behandelt.

Damit ist weder klar dokumentiert noch maschinell erzwungen, welcher Pfad fachlich priorisiert ist.

#### Generische Controls, die nicht sauber zur VDS-Logik passen

Die UI-Felder sind nicht alle falsch, aber ihre aktuelle fachliche Bedeutung ist unscharf:

- `price level` ist teils fachlich legitim, teils nur Range-Auswahl.
- `advanced buyout/staffel/exclusivity` wirkt wie Altlogik neben der neuen VDS-Lizenzlogik.
- Social/Event/Internal-Addons existieren parallel zu VDS-Spezialflags und teils ohne saubere Case-Bindung.
- Komplexitätsaufschläge laufen global, obwohl ihre Zulässigkeit möglicherweise case-spezifisch geregelt werden müsste.

#### Unvollständige oder pauschale Sonderfallberechnungen

Besonders zu prüfen bzw. neu zu modellieren sind:

- Reminder-Prozentlogik relativ zum Referenzfall.
- Archivnutzung versus eigenständige Nachverwertung.
- Öffentliche vs. interne vs. werbliche E-Learning-/App-/Podcast-/Telefonie-Szenarien.
- Paketfälle ATV/CTV, Funk/Online, Social-/Event-Erweiterungen.
- Unlimited-/Buyout-Fälle mit Advisory-Kennzeichnung.
- Hörbuch-/Games-/Session-Fee-Fälle mit Vorschlagskalkulation statt Scheingenauigkeit.

### 3. Hauptursachen der aktuellen Architekturprobleme

Die Hauptursachen sind:

1. Historisch gewachsene Mischarchitektur aus PHP-Default-JSON, JS-Fallbacks und JS-Hardcoding.
2. Zu viele fachliche Entscheidungen innerhalb weniger großer Funktionen.
3. Fehlende Trennung zwischen Entscheidungslogik, Preislogik, Lizenzlogik, Advisory-Logik und UI-Ausgabe.
4. Kein einheitliches Engine-Ergebnisobjekt, das UI, Breakdown, Lizenzhinweise und Export gleichermaßen versorgt.
5. Übergangslösungen, die den VDS-Blueprint zwar einführen, ihn aber noch nicht vollständig als führende Runtime-Quelle behandeln.

## B. Zielarchitektur

### 1. Zielmodule

#### VDS Core Engine

Verantwortung:

- nimmt normierten Input-State entgegen,
- wertet Family/Case/Rule-Konfiguration aus,
- berechnet ein kanonisches Ergebnisobjekt,
- behandelt keine DOM- oder PDF-spezifischen Details.

#### Decision Layer / Visibility Layer

Verantwortung:

- bestimmt aus dem Input, welche Family und welcher Case fachlich aktiv sind,
- löst Querverweise aus,
- aktiviert/deaktiviert UI-Felder,
- kennzeichnet Pflichtfragen und Folgefragen,
- verhindert unzulässige Steuerkombinationen.

#### Pricing Layer

Verantwortung:

- implementiert klar getrennte Pricing-Handler pro `pricing_mode`, z. B.:
  - `fixed_plus_license_multipliers`
  - `reference_percentage`
  - `tiered_duration`
  - `tiered_modules`
  - `minimum_plus_per_unit`
  - `session_fee_plus_followup_hour`
  - `expert_matrix`
  - `proposal_required`

#### License / Addon Layer

Verantwortung:

- berechnet Lizenzmodule,
- setzt Zusatzterritorien, Zusatzjahre, Zusatzmotive um,
- behandelt Social/Event/Internal-Zusätze nur dort, wo sie fachlich zulässig sind,
- modelliert Folgeverwertung, Archiv, Präsentation, Patronat und Unlimited sauber als Rechte-/Addon-Ereignisse.

#### Cross-Reference Layer

Verantwortung:

- führt Routing-Regeln aus,
- protokolliert, warum von Case A auf Case B verwiesen wurde,
- liefert Redirect-Metadaten an Breakdown und Advisory-Layer.

#### Breakdown Builder

Verantwortung:

- baut aus Engine-Events eine standardisierte Rechenweg-Struktur,
- kennt Templates je Breakdown-Familie,
- rendert keine DOM-Fragmente, sondern liefert reine Breakdown-Daten.

#### Expert / Advisory Layer

Verantwortung:

- markiert Fälle als Vorschlagskalkulation, Expertenfall oder Freigabefall,
- erzeugt Hinweise für UI und Export,
- unterscheidet zwischen „rechenbar“, „rechenbar mit Advisory“ und „nicht scheingenau automatisieren“.

#### UI Adapter Layer

Verantwortung:

- übersetzt DOM-State in Engine-Input,
- übersetzt Engine-Result in bestehende UI-Komponenten,
- hält alte Selektoren, IDs und Rendering-Slots stabil,
- minimiert Änderungen am Shortcode-Markup.

#### Export / PDF Adapter Layer

Verantwortung:

- erzeugt aus demselben Engine-Result die PDF-/Angebotsdaten,
- übernimmt keine eigene fachliche Nachberechnung,
- nutzt die vorhandene Export-UI weiter.

#### State Adapter Layer

Verantwortung:

- serialisiert/deserialisiert normierte Engine-States,
- migriert Alt-Storage auf neue Keys,
- kapselt Restore-/Reset- und Versionierungslogik.

### 2. Ziel-Datenstruktur

Die Runtime sollte auf einer klaren, autoritativen Struktur aufbauen:

- `families`
- `cases`
- `rules`
- `unit_types`
- `visibility_rules`
- `decision_rules`
- `cross_reference_rules`
- `pricing_rules`
- `addon_rules`
- `credit_rules`
- `package_rules`
- `unlimited_usage_rules`
- `expert_flags`
- `breakdown_templates`
- `notes`
- `license_texts`
- `ui_field_catalog`
- `result_templates`

### 3. Kanonisches Engine-Input-Schema

Empfohlenes Input-Modell:

- `selection.family_id`
- `selection.case_id`
- `selection.variant_id`
- `usage.payment_type`
- `usage.context`
- `usage.medium`
- `usage.region`
- `usage.duration_years`
- `usage.language`
- `units.primary_amount`
- `units.secondary_amount`
- `addons[]`
- `packages[]`
- `unlimited_flags`
- `production.complexity`
- `production.script_minutes`
- `production.recording_days`
- `production.session_hours`
- `meta.currency`
- `meta.source`

### 4. Kanonisches Engine-Output-Schema

Ein einziges Ergebnisobjekt speist alle Verbraucher:

- `resolved_case`
- `decision_trace`
- `pricing_result.base`
- `pricing_result.addons`
- `pricing_result.packages`
- `pricing_result.credits`
- `pricing_result.final_range`
- `license_summary`
- `breakdown`
- `advisories`
- `export_payload`
- `ui_visibility`
- `ui_defaults`
- `audit`

### 5. Ziel-Datenfluss

1. UI Adapter liest bestehende DOM-Felder.
2. State Adapter baut daraus einen normierten Engine-State.
3. Decision Layer validiert Family/Case, Folgefragen und Visibility.
4. Cross-Reference Layer löst ggf. Routing aus.
5. Pricing Layer berechnet Basishonorar nach `pricing_mode`.
6. License / Addon Layer ergänzt Rechte-, Paket- und Sonderregeln.
7. Expert / Advisory Layer markiert Vorschlags- und Freigabefälle.
8. Breakdown Builder erzeugt standardisierte Steps.
9. UI Adapter rendert Ergebnis, Rechtebox und Breakdown.
10. Export Adapter erzeugt aus demselben Ergebnis das PDF-Modell.

## C. Rebuild-Migrationsplan

### Phase 1 – Architektur einfrieren und Inventar stabilisieren

Ziel:

- Altverhalten dokumentieren,
- bestehende UI/DOM-Schnittstellen fixieren,
- keine weitere Fachlogik mehr ad hoc in UI-Handler einbauen.

Aufgaben:

- Bestehende DOM-IDs, Datenattribute und Seitenelemente als „stabile Integrationsoberfläche“ definieren.
- Alle aktuellen Pricing-Modi, Redirects, Addons und Expert-Fälle inventarisieren.
- Golden-Master-Testmatrix für repräsentative Fälle erstellen.

### Phase 2 – Kanonisches Engine-Schema einführen

Ziel:

- eine normierte Laufzeitstruktur etablieren,
- ohne die UI zu verändern.

Aufgaben:

- `mapping.json` zum autoritativen Fachmodell ausbauen.
- Aus dem bestehenden Blueprint und Alt-JSON eine interne Engine-Config generieren.
- `state -> engine input` und `engine output -> ui/export` Adapter definieren.

Wichtig:

- Noch kein Mischbetrieb auf Ebene einzelner Formeln.
- Entweder liefert der neue Engine-Pfad einen kompletten Fall, oder der Altpfad bleibt für diesen Fall vollständig aktiv.

### Phase 3 – Decision Layer und Cross-Reference Layer extrahieren

Ziel:

- Routing, Sichtbarkeit und Folgefragen aus `srcComputeSingleProjectResult()` herauslösen.

Aufgaben:

- `srcResolveVdsScenario()` in eine deklarative Regel-Auswertung überführen.
- Sichtbarkeitslogik für Felder aus Cases/Rules ableiten.
- Redirects in `decision_trace` dokumentieren.

### Phase 4 – Pricing Layer nach `pricing_mode` modularisieren

Ziel:

- monolithische Berechnung in klar getrennte Handler zerlegen.

Empfohlene Reihenfolge:

1. `fixed_plus_license_multipliers` für klassische Werbefälle.
2. `tiered_duration` für Imagefilm/Webvideo/App/E-Learning/Kleinräumig.
3. `tiered_modules` für Telefonansage.
4. `minimum_plus_per_unit` für Doku/AD.
5. `reference_percentage` für Reminder.
6. `session_fee_plus_followup_hour` und `expert_matrix` für Games/Hörbuch/Session Fee.
7. `proposal_required` / `unlimited_usage_rules` für Advisory-Fälle.

### Phase 5 – License / Addon Layer zentralisieren

Ziel:

- alle Rechte- und Zusatzmodule sauber aus einer Quelle berechnen.

Aufgaben:

- Zusatzterritorien, Zusatzjahre, Zusatzmotive, Social, Event, Präsentation, Archiv, Patronat, Follow-up als explizite Regeltypen modellieren.
- Credit-/Anrechnungslogik und Paketlogik separat von Basis-Pricing halten.
- Unlimited-Fälle mit Advisory-Flag plus nachvollziehbarem Rechenweg ausweisen.

### Phase 6 – Breakdown Builder und Advisory Layer umstellen

Ziel:

- UI-Breakdown und Export nicht mehr aus impliziten Nebenwirkungen, sondern aus Engine-Events speisen.

Aufgaben:

- bestehende Breakdown-UI beibehalten,
- aber nur noch standardisierte Breakdown-Daten rendern.
- Expertenhinweise getrennt von Rechenschritten modellieren.

### Phase 7 – Export/PDF auf Engine-Result umhängen

Ziel:

- kein zweiter fachlicher Berechnungspfad im Export.

Aufgaben:

- Exportdaten ausschließlich aus `engineResult.export_payload` generieren.
- PDF nutzt dieselbe Breakdown-, Rechte- und Advisory-Struktur wie die UI.

### Phase 8 – Altpfade gezielt entfernen

Ziel:

- keine Schattenlogik mehr.

Aufgaben:

- pro migriertem Case die alte Logik vollständig abschalten,
- tote Fallbacks entfernen,
- Alt-JSON nur noch über definierte Migrationspfade unterstützen.

## D. Risikominimierung und Vermeidung von Mischbetrieb

### Grundregel

Kein Fall darf gleichzeitig teilweise durch alte und teilweise durch neue Fachlogik bestimmt werden.

### Empfohlenes Vorgehen

- Case-/Family-basierter Feature-Switch auf Runtime-Ebene.
- Für einen migrierten Case liefert ausschließlich die neue Engine das Ergebnisobjekt.
- Alte UI bleibt, aber sie konsumiert nur noch Adapter-Daten.
- Vergleichstests „Alt vs. Neu“ laufen intern, nicht als produktiver Mischmodus.

### Regression-Schutz

Empfohlene Testmatrix:

- je Family mindestens 3 Standardfälle,
- alle Redirect-Fälle,
- Reminder-/Archiv-/Unlimited-/Paket-/Follow-up-Fälle,
- Games/Hörbuch/Session-Fee als Advisory-Fälle,
- Export-Snapshots für 5–10 Referenzszenarien,
- Storage-Restore-Snapshots vor/nach Migration.

## E. DSGVO- und Asset-Architektur

### Ziel

Alle Frontend-Assets sollen ohne externe CDN-Abhängigkeiten geladen werden.

### Anforderungen

- Keine externen Requests für Font Awesome.
- Keine externen Requests für jsPDF.
- Keine externen Requests für AutoTable.
- Perspektivisch auch keine externen Requests für Webfonts.

### Konkreter Architekturplan

1. Bibliotheken in den Plugin-Asset-Baum übernehmen, z. B.:
   - `assets/vendor/fontawesome/...`
   - `assets/vendor/jspdf/...`
   - `assets/vendor/jspdf-autotable/...`
   - optional `assets/vendor/fonts/rubik/...`
2. Enqueue-Registrierung ausschließlich über `SRC_PLUGIN_URL` / `plugins_url()` innerhalb des Plugins.
3. Keine Verwendung von `content_url()` für Plugin-interne Vendor-Dateien.
4. Versionierung über Plugin-Version plus Vendor-Version.
5. Fallback-freies, WordPress-konformes Registrieren mit klaren Handles.
6. Optional: `wp_register_style` / `wp_register_script` vor `wp_enqueue_*`, damit Adapter-Schichten künftig Assets konsistent erweitern können.

### Warum das wichtig ist

Die aktuelle Struktur nutzt noch externe Font-Requests und referenziert lokale Vendor-Dateien nicht konsequent plugin-lokal. Für DSGVO-konformes und robustes Asset-Loading muss dies in Schritt 2 technisch bereinigt werden.

## F. Optional notwendige vorbereitende Codeanpassungen

Für den eigentlichen Hybrid-Rebuild ist kurzfristig keine invasive Codeänderung nötig. Vorrangig erforderlich sind:

- Architektur einfrieren,
- Regelmodell finalisieren,
- Adapter-Schnittstellen definieren,
- Testmatrix aufbauen.

Sinnvolle minimale Vorbereitungen für Schritt 2 wären anschließend:

1. Einführung eines separaten JS-Moduls/Namensraums für `engine`, `adapters` und `rules`.
2. Einführung eines kanonischen `engineResult`-Objekts parallel zur Altberechnung, aber nur für interne Tests.
3. Plugin-lokale Vendor-Ablage für Font Awesome / jsPDF / AutoTable.
4. Explizite Runtime-Versionierung des State-Schemas.

## G. Abschlusscheck

- Kontrollierter hybrider Rebuild ist geplant.
- Die bestehende UI wird nicht unnötig zerstört.
- Eine neue VDS-Core-Architektur mit klaren Modulen ist definiert.
- Der Migrationspfad ist schrittweise und ohne unkontrollierten Mischbetrieb beschrieben.
- Die Grundlage für Schritt 2 ist fachlich und architektonisch sauber vorbereitet.
