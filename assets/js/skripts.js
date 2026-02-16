/* Smart Rate Calculator V7 Logic */

// Globale Variablen für State-Management
let srcRatesData = {}; 
let calculatedMinutes = 0;
let estimatedMinutes = 0;
let currentResult = { low:0, mid:0, high:0 };
let dynamicLicenseText = "";
let pendingMainAmountUpdate = null;
let mainAmountAnimationToken = 0;
let mainAmountFallbackTimer = null;
let lastValidMainAmountText = "";
let mainAmountExitListener = null;
let currentBreakdownData = null;
let currentRiskChecks = [];
let currentProjectTips = [];
let stickyRaf = 0;
let compareState = { enabled: false, A: null, B: null, activeTab: 'A' };
let packagesState = null;
let exportModalKeyHandler = null;
let exportModalState = {
    pdf: true,
    email: true,
    breakdown: false,
    risk: false,
    lang: 'de',
    pricing: 'range',
    client: 'direct',
    selectedPackage: 'standard'
};

document.addEventListener('DOMContentLoaded', () => { 
    const iconUrl = (window.srcPluginData && srcPluginData.checkIconUrl) ? String(srcPluginData.checkIconUrl).trim() : '';
    if(iconUrl){
        document.documentElement.style.setProperty('--src-check-icon', `url("${iconUrl}")`);
    }
    // DATEN IMPORTIEREN (Vom PHP übergeben)
    if(typeof srcPluginData !== 'undefined' && srcPluginData.rates) {
        srcRatesData = srcPluginData.rates;
    } else {
        console.error("SRC: Keine Preisdaten geladen.");
    }

    // Initial state logic
    srcSyncOptionRowStates();

    const calcRoot = document.getElementById('src-calc-v6');
    if(calcRoot) {
        calcRoot.addEventListener('change', (event) => {
            const target = event.target;
            if(!target || target.type !== 'checkbox') return;

            if(target.closest('.src-opt-card') || target.closest('.src-option-row')) {
                srcSetOptionRowState(target);
            }

            switch (target.id) {
                case 'src-manual-time-check':
                    srcToggleManualTime();
                    return;
                case 'src-own-studio':
                    srcToggleStudio();
                    return;
                case 'src-layout-mode':
                    srcUIUpdate();
                    srcCalc();
                    return;
                default:
                    break;
            }

            if([
                'src-layout-mode',
                'src-pkg-online',
                'src-pkg-atv',
                'src-lic-social',
                'src-lic-event',
                'src-lic-internal',
                'src-express-toggle',
                'src-cutdown',
                'src-discount-toggle'
            ].includes(target.id)) {
                srcCalc();
            }

            if(target.classList.contains('src-linked-project')) {
                srcCalc();
                srcSyncLinkedProjectsAccordion();
            }
        });
    }
    
    // Attach Tooltip events
    const tipEl = document.getElementById('src-tooltip-fixed');
    document.querySelectorAll('.src-tooltip-icon').forEach(icon => {
        icon.addEventListener('mouseenter', e => {
            if(!tipEl) return;
            const tipText = e.target.getAttribute('data-tip');
            if(!tipText) return;
            tipEl.innerText = tipText;
            tipEl.classList.add('is-visible');
            // Initial Pos
            requestAnimationFrame(() => {
                const rect = e.target.getBoundingClientRect();
                tipEl.style.top = (rect.top - tipEl.offsetHeight - 10) + 'px';
                tipEl.style.left = (rect.left + (rect.width/2) - (tipEl.offsetWidth/2)) + 'px';
            });
        });
        icon.addEventListener('mouseleave', () => {
            if(!tipEl) return;
            tipEl.classList.remove('is-visible');
        });
    });

    const exportModal = document.getElementById('src-export-modal');
    if(exportModal) {
        exportModal.addEventListener('click', (event) => {
            const target = event.target;
            if(target === exportModal || (target && target.hasAttribute('data-modal-close'))) {
                srcCloseExportModal();
            }
        });
    }

    document.querySelectorAll('.src-opt-tile[data-opt], .src-opt-tile[data-opt-group]').forEach(tile => {
        tile.addEventListener('click', () => srcHandleExportTileToggle(tile));
    });

    const exportStartBtn = document.getElementById('src-export-start');
    if(exportStartBtn) {
        exportStartBtn.addEventListener('click', () => srcHandleExportStart());
    }

    const applyEstimateBtn = document.getElementById('src-apply-estimate');
    if(applyEstimateBtn) {
        applyEstimateBtn.addEventListener('click', () => srcApplyScriptEstimate());
    }

    const compareToggle = document.getElementById('src-compare-toggle');
    if(compareToggle) {
        compareToggle.addEventListener('click', () => srcToggleCompare());
    }
    const compareSaveA = document.getElementById('src-compare-save-a');
    if(compareSaveA) {
        compareSaveA.addEventListener('click', () => srcSaveCompareSnapshot('A'));
    }
    const compareSaveB = document.getElementById('src-compare-save-b');
    if(compareSaveB) {
        compareSaveB.addEventListener('click', () => srcSaveCompareSnapshot('B'));
    }

    const buildPackagesBtn = document.getElementById('src-build-packages');
    if(buildPackagesBtn) {
        buildPackagesBtn.addEventListener('click', () => srcRenderPackages());
    }
    const exportPackageSelect = document.getElementById('src-export-package');
    if(exportPackageSelect) {
        exportPackageSelect.addEventListener('change', () => {
            exportModalState.selectedPackage = exportPackageSelect.value;
            srcSyncExportPackageCards();
        });
    }
    document.querySelectorAll('[data-export-package-card]').forEach(card => {
        card.addEventListener('click', () => {
            const pkg = card.getAttribute('data-export-package-card');
            const select = document.getElementById('src-export-package');
            if(select && pkg) {
                select.value = pkg;
                exportModalState.selectedPackage = pkg;
                srcSyncExportPackageCards();
            }
        });
    });

    const durationSlider = document.getElementById('src-time-slider');
    if(durationSlider) {
        durationSlider.addEventListener('input', srcUpdateDurationSliderFill);
        durationSlider.addEventListener('change', srcUpdateDurationSliderFill);
    }
    srcUpdateDurationSliderFill();

    srcSyncExportTiles();
    srcUpdateExportPackageVisibility();
    updateStickyOffset();
    const scheduleStickyOffsetUpdate = () => {
        if(stickyRaf) return;
        stickyRaf = requestAnimationFrame(() => {
            stickyRaf = 0;
            updateStickyOffset();
        });
    };
    window.addEventListener('resize', scheduleStickyOffsetUpdate);
    window.addEventListener('scroll', scheduleStickyOffsetUpdate, { passive: true });

    // Erster UI Check
    const restoredState = srcRestoreStateFromStorage();
    if(!restoredState) {
        srcUIUpdate();
    }
    srcAuditRatesAgainstVDS();
});

/* --- HELPER FUNCTIONS --- */

const SRC_I18N = {
    de: {
        subjectLabel: "Betreff",
        subject: "Angebot Sprecherleistung",
        intro: "Vielen Dank für die Anfrage. Anbei das Angebot auf Basis der aktuellen Angaben.",
        pricingRange: "Preisrahmen (Netto)",
        pricingMean: "Mittelwert (Netto)",
        pricingPackage: "Paketpreis (Netto)",
        assumptions: "Auf Basis VDS Gagenkompass 2025. Alle Preise zzgl. MwSt.",
        project: "Projekt",
        projectNameLabel: "Projektname",
        duration: "Dauer",
        region: "Region",
        modules: "Module",
        length: "Länge",
        addOns: "Zusatzlizenzen/Optionen",
        breakdown: "Rechenweg",
        risks: "Risiko-/Rechte-Check",
        validity: "Gültigkeit",
        scope: "Lieferumfang",
        dateLabel: "Datum",
        customerTypeLabel: "Kundentyp",
        customerTypeDirect: "Direktkunde",
        customerTypeAgency: "Agentur",
        offerNumberLabel: "Angebotsnummer"
    },
    en: {
        subjectLabel: "Subject",
        subject: "Voice Over Offer",
        intro: "Thank you for your request. Below is the offer based on the current inputs.",
        pricingRange: "Price range (net)",
        pricingMean: "Average (net)",
        pricingPackage: "Package price (net)",
        assumptions: "Based on VDS Gagenkompass 2025. All prices excl. VAT.",
        project: "Project",
        projectNameLabel: "Project name",
        duration: "Duration",
        region: "Region",
        modules: "Modules",
        length: "Length",
        addOns: "Add-ons / options",
        breakdown: "Calculation details",
        risks: "Risk/rights check",
        validity: "Validity",
        scope: "Scope of delivery",
        dateLabel: "Date",
        customerTypeLabel: "Customer type",
        customerTypeDirect: "Direct client",
        customerTypeAgency: "Agency",
        offerNumberLabel: "Offer number"
    }
};

const srcToggleCollapse = function(element, isOpen) {
    if(!element) return;
    element.classList.toggle('is-open', Boolean(isOpen));
}

const srcUpdateSidebarCollapse = function() {
    const calcRoot = document.getElementById('src-calc-v6');
    if(!calcRoot) return;
    const hasProject = calcRoot.classList.contains('src-has-project');
    const compareSection = document.querySelector('.src-sidebar-box--compare');
    const packagesSection = document.querySelector('.src-sidebar-box--packages');
    const priceDetailsSection = document.getElementById('src-pricedetails-section');
    const hasPackages = Boolean(packagesState) && Object.keys(packagesState || {}).length > 0;
    calcRoot.classList.toggle('src-has-packages', hasPackages);
    srcToggleCollapse(compareSection, hasProject && compareState.enabled);
    srcToggleCollapse(packagesSection, hasProject);
    srcToggleCollapse(priceDetailsSection, hasProject);
    srcUpdateNotesTipsVisibility(hasProject);
}

const srcSyncLinkedProjectsAccordion = function(options = {}) {
    const linkedProjectsWrap = document.getElementById('src-linked-projects-wrap');
    const linkedAccordion = document.getElementById('src-linked-projects-accordion');
    const linkedInputs = document.querySelectorAll('.src-linked-project');
    const genreSelect = document.getElementById('src-genre');
    const layoutToggle = document.getElementById('src-layout-mode');
    const genre = typeof options.genre === 'string' ? options.genre : (genreSelect ? genreSelect.value : '');
    const layoutMode = typeof options.layoutMode === 'boolean' ? options.layoutMode : Boolean(layoutToggle && layoutToggle.checked);
    const hasGenre = Boolean(genre) && genre !== "0";
    const shouldShow = hasGenre && !layoutMode;
    const hasLinkedChecked = Array.from(linkedInputs).some(input => input.checked);

    if(linkedProjectsWrap) {
        linkedProjectsWrap.style.display = shouldShow ? '' : 'none';
    }
    if(linkedAccordion) {
        linkedAccordion.open = shouldShow && hasLinkedChecked;
    }
}

const srcUpdateNotesTipsVisibility = function(hasProject) {
    const notesSection = document.getElementById('src-notes-tips-section');
    if(!notesSection) return;
    const staticNotes = document.getElementById('src-static-notes');
    if(!hasProject) {
        if(staticNotes) staticNotes.style.display = 'none';
        srcToggleCollapse(notesSection, false);
        notesSection.style.display = 'none';
        return;
    }
    notesSection.style.display = '';
    const hasStaticNotes = Boolean(staticNotes && staticNotes.textContent.trim().length);
    if(staticNotes) {
        staticNotes.style.display = hasStaticNotes ? '' : 'none';
    }
    srcToggleCollapse(notesSection, hasStaticNotes);
}

window.toggleElement = function(id, show) {
    const el = document.getElementById(id);
    if(!el) return;
    if(show) { el.classList.add('open'); if(id.includes('mod')) el.classList.add('with-margin'); } 
    else { el.classList.remove('open'); el.classList.remove('with-margin'); }
}

const srcSetOptionRowState = function(toggleEl) {
    if(!toggleEl) return;
    const row = toggleEl.closest('.src-opt-card, .src-option-row');
    if(!row) return;
    row.classList.toggle('is-on', toggleEl.checked);
    if(toggleEl.hasAttribute('aria-expanded')) {
        toggleEl.setAttribute('aria-expanded', toggleEl.checked ? 'true' : 'false');
    }
}

window.srcHandleOptionToggle = function(toggleId) {
    const toggleEl = document.getElementById(toggleId);
    if(!toggleEl) return;
    srcSetOptionRowState(toggleEl);
}

window.srcSyncOptionRowStates = function() {
    document.querySelectorAll('.src-opt-card .src-toggle-wrapper input[type="checkbox"], .src-option-row .src-toggle-wrapper input[type="checkbox"]').forEach(toggleEl => {
        srcSetOptionRowState(toggleEl);
    });
}

const srcFormatCurrency = function(value) {
    if(!Number.isFinite(value)) return "–";
    return `${Math.round(value)} €`;
}

const srcFormatSignedCurrency = function(value) {
    if(!Number.isFinite(value)) return "";
    const rounded = Math.round(value);
    if(rounded === 0) return "0 €";
    const sign = rounded > 0 ? "+" : "−";
    return `${sign}${Math.abs(rounded)} €`;
}

const srcStripHTML = function(str) {
    if(!str) return '';
    const div = document.createElement('div');
    div.innerHTML = String(str);
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

const srcNormalizeAddonLine = function(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const srcDedupeAddonLines = function(lines = []) {
    const seen = new Set();
    return (Array.isArray(lines) ? lines : []).filter(line => {
        const key = srcNormalizeAddonLine(line);
        if(!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const srcGetProjectName = function(projectKey) {
    if(!projectKey) return '';
    return srcRatesData[projectKey] ? srcRatesData[projectKey].name : projectKey;
}

const srcBuildLicenseMetaMarkup = function(metaItems = []) {
    const items = Array.isArray(metaItems) ? metaItems.filter(Boolean) : [];
    const lines = [];
    items.forEach(item => {
        const trimmed = String(item).trim();
        if(!trimmed) return;
        lines.push(`<div class="src-license-line">${trimmed}</div>`);
    });
    if(lines.length === 0) return '';
    return `<div class="src-license-summary">${lines.join('')}</div>`;
}

const srcFormatMinutes = function(minutes) {
    if(!Number.isFinite(minutes)) return "0:00";
    const safeMinutes = Math.max(0, minutes);
    const m = Math.floor(safeMinutes);
    const s = Math.round((safeMinutes - m) * 60);
    return `${m}:${s.toString().padStart(2,'0')}`;
}

const srcGetScriptEstimationConfig = function() {
    const config = srcRatesData.script_estimation || {};
    return {
        wpm: config.wpm || { de: 150, en: 160, other: 150 },
        min: Number.isFinite(config.min_minutes) ? config.min_minutes : 0.1,
        max: Number.isFinite(config.max_minutes) ? config.max_minutes : 20
    };
}

const estimateDurationFromScript = function(scriptText, lang) {
    const cleanText = (scriptText || '').trim();
    const words = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
    const config = srcGetScriptEstimationConfig();
    const wpmConfig = config.wpm || {};
    const wpm = Number.isFinite(wpmConfig[lang]) ? wpmConfig[lang] : (Number.isFinite(wpmConfig.de) ? wpmConfig.de : 150);
    if(words <= 0 || wpm <= 0) {
        return { minutes: 0, words };
    }
    let minutes = words / wpm;
    const minClamp = config.min;
    const maxClamp = config.max;
    if(Number.isFinite(minClamp)) minutes = Math.max(minClamp, minutes);
    if(Number.isFinite(maxClamp)) minutes = Math.min(maxClamp, minutes);
    return { minutes, words };
}

const srcGetComplexityConfig = function() {
    return srcRatesData.complexity_factors || {};
}

const srcGetComplexitySelections = function() {
    return {
        variants: document.getElementById('src-complexity-variants')?.value || '1',
        revisions: document.getElementById('src-complexity-revisions')?.value || '1',
        style: document.getElementById('src-complexity-style')?.value || 'normal',
        timing: document.getElementById('src-complexity-timing')?.value || 'free',
        editing: document.getElementById('src-complexity-editing')?.value || 'none',
        deliverables: document.getElementById('src-complexity-deliverables')?.value || 'single'
    };
}

const srcResolveComplexity = function(selections) {
    const config = srcGetComplexityConfig();
    const corridor = config.corridor || { min: 0.08, max: 0.15 };
    let factor = 1;
    const picks = [];
    ['variants', 'revisions', 'style', 'timing', 'editing', 'deliverables'].forEach(key => {
        const entry = config[key] || {};
        const options = Array.isArray(entry.options) ? entry.options : [];
        const selectedKey = selections[key];
        const option = options.find(opt => opt.key === selectedKey);
        const optionFactor = option && Number.isFinite(option.factor) ? option.factor : 1;
        const optionLabel = option && option.label ? option.label : selectedKey;
        if(optionFactor !== 1) {
            picks.push(`${entry.label || key}: ${optionLabel}`);
        }
        factor *= optionFactor;
    });
    return { factor, corridor, picks };
}

const srcGetStateFromUI = function() {
    const regionInput = document.querySelector('input[name="region"]:checked');
    const genre = document.getElementById('src-genre').value;
    const minutesRaw = Number.isFinite(calculatedMinutes) ? calculatedMinutes : 0;
    const minutes = Math.max(0.1, minutesRaw);
    const scriptText = document.getElementById('src-text').value || '';
    const manualMinutesActive = document.getElementById('src-manual-time-check').checked;
    const complexitySelections = srcGetComplexitySelections();
    const linkedProjects = Array.from(document.querySelectorAll('.src-linked-project:checked')).map(el => el.value);
    const advanced = {
        exclusivity: document.getElementById('src-adv-exclusivity')?.value || 'none',
        buyoutMode: document.getElementById('src-adv-buyout-mode')?.value || 'standard',
        periods: parseInt(document.getElementById('src-adv-periods')?.value, 10) || 1,
        versions: parseInt(document.getElementById('src-adv-versions')?.value, 10) || 1
    };
    return {
        projectKey: genre,
        linkedProjects,
        language: document.getElementById('src-language').value,
        layoutMode: document.getElementById('src-layout-mode').checked,
        posType: document.getElementById('src-pos-type') ? document.getElementById('src-pos-type').value : 'pos_spot',
        region: regionInput ? regionInput.value : 'national',
        duration: parseInt(document.getElementById('src-time-slider').value, 10) || 1,
        packageOnline: document.getElementById('src-pkg-online') ? document.getElementById('src-pkg-online').checked : false,
        packageAtv: document.getElementById('src-pkg-atv') ? document.getElementById('src-pkg-atv').checked : false,
        licenseSocial: document.getElementById('src-lic-social') ? document.getElementById('src-lic-social').checked : false,
        licenseEvent: document.getElementById('src-lic-event') ? document.getElementById('src-lic-event').checked : false,
        licenseInternal: document.getElementById('src-lic-internal') ? document.getElementById('src-lic-internal').checked : false,
        cutdown: document.getElementById('src-cutdown') ? document.getElementById('src-cutdown').checked : false,
        phoneCount: parseInt(document.getElementById('src-phone-count').value, 10) || 1,
        minutes,
        minutesRaw,
        estimatedMinutes,
        manualMinutesActive,
        hasScript: scriptText.trim().length > 0,
        studioFee: document.getElementById('src-own-studio').checked ? (parseInt(document.getElementById('src-studio-fee').value, 10) || 0) : 0,
        expressToggle: document.getElementById('src-express-toggle').checked,
        expressType: document.getElementById('src-express-type').value,
        discountToggle: document.getElementById('src-discount-toggle').checked,
        discountPct: parseFloat(document.getElementById('src-discount-percent').value) || 0,
        discountReason: document.getElementById('src-discount-reason').value || '',
        finalFeeInput: (() => {
            const raw = parseFloat(document.getElementById('src-final-fee-user').value);
            return Number.isFinite(raw) ? raw : null;
        })(),
        complexitySelections,
        advanced
    };
}

const srcGetRegionLabel = function(region) {
    if(region === 'regional') return 'Regional';
    if(region === 'dach') return 'DACH';
    if(region === 'world') return 'Weltweit';
    return 'National';
}

const srcGetDurationLabel = function(duration) {
    const safeDuration = parseInt(duration, 10) || 1;
    return safeDuration === 4 ? 'Unlimited' : `${safeDuration} ${safeDuration === 1 ? 'Jahr' : 'Jahre'}`;
}

const updateLicenseMetaText = function(state = null) {
    const target = document.getElementById('src-license-meta-text');
    if(!target) return;
    const sourceState = state || srcGetStateFromUI();
    target.textContent = `Gebiet: ${srcGetRegionLabel(sourceState.region)} · Laufzeit: ${srcGetDurationLabel(sourceState.duration)}`;
}

const srcUpdateAnimatedValue = function(target, nextText) {
    if(!target) return;
    const current = target.textContent.trim();
    if(current === nextText.trim()) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion) {
        target.textContent = nextText;
        return;
    }
    target.classList.remove('src-amount-enter', 'src-amount-exit');
    const onExit = (event) => {
        if(event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;
        target.removeEventListener('transitionend', onExit);
        target.textContent = nextText;
        target.classList.remove('src-amount-exit');
        requestAnimationFrame(() => {
            target.classList.add('src-amount-enter');
            requestAnimationFrame(() => {
                target.classList.remove('src-amount-enter');
            });
        });
    };
    target.addEventListener('transitionend', onExit);
    requestAnimationFrame(() => {
        target.classList.add('src-amount-exit');
    });
}

const updateMainAmountAnimated = function(nextText) {
    const target = document.getElementById('src-display-total');
    if(!target) return;
    const trimmed = typeof nextText === 'string' ? nextText.trim() : '';
    if(!trimmed) {
        nextText = lastValidMainAmountText || '–';
    }
    if(typeof nextText !== 'string') {
        nextText = lastValidMainAmountText || '–';
    }
    if(typeof nextText === 'string' && nextText.includes('NaN')) {
        console.warn('SRC: Ungültiger Betrag erkannt, behalte letzten Wert.');
        nextText = lastValidMainAmountText || '–';
    }
    pendingMainAmountUpdate = nextText;
    mainAmountAnimationToken += 1;
    const token = mainAmountAnimationToken;
    if(mainAmountFallbackTimer) {
        clearTimeout(mainAmountFallbackTimer);
        mainAmountFallbackTimer = null;
    }
    if(mainAmountExitListener) {
        target.removeEventListener('transitionend', mainAmountExitListener);
        mainAmountExitListener = null;
    }
    target.classList.remove('src-amount-enter', 'src-amount-exit');
    target.style.opacity = '1';
    target.style.transform = 'translateY(0)';
    const applyTotalUpdate = (value) => {
        target.classList.add('is-updating');
        target.textContent = value;
        requestAnimationFrame(() => {
            target.classList.remove('is-updating');
        });
    };
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion) {
        const safeText = pendingMainAmountUpdate || lastValidMainAmountText || '–';
        applyTotalUpdate(safeText);
        lastValidMainAmountText = safeText;
        pendingMainAmountUpdate = null;
        return;
    }
    requestAnimationFrame(() => {
        if(token !== mainAmountAnimationToken) return;
        const safeText = pendingMainAmountUpdate || lastValidMainAmountText || '–';
        pendingMainAmountUpdate = null;
        const current = target.textContent.trim();
        if(current === safeText.trim()) {
            lastValidMainAmountText = safeText;
            return;
        }
        const finalize = () => {
            target.classList.remove('src-amount-enter', 'src-amount-exit');
            target.style.opacity = '1';
            target.style.transform = 'translateY(0)';
            lastValidMainAmountText = safeText;
        };
        const onExit = (event) => {
            if(event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;
            target.removeEventListener('transitionend', onExit);
            mainAmountExitListener = null;
            applyTotalUpdate(safeText);
            target.classList.remove('src-amount-exit');
            requestAnimationFrame(() => {
                target.classList.add('src-amount-enter');
                requestAnimationFrame(() => {
                    target.classList.remove('src-amount-enter');
                    finalize();
                });
            });
        };
        mainAmountExitListener = onExit;
        target.addEventListener('transitionend', onExit);
        requestAnimationFrame(() => {
            target.classList.add('src-amount-exit');
        });
        mainAmountFallbackTimer = setTimeout(() => {
            if(mainAmountExitListener) {
                target.removeEventListener('transitionend', mainAmountExitListener);
                mainAmountExitListener = null;
            }
            if(token !== mainAmountAnimationToken) return;
            applyTotalUpdate(safeText);
            finalize();
        }, 350);
    });
}


const srcPulseTargets = function(selectors, duration = 420) {
    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
            el.classList.remove('src-pulse');
            void el.offsetWidth;
            el.classList.add('src-pulse');
            window.setTimeout(() => {
                el.classList.remove('src-pulse');
            }, duration);
        });
    });
}

const srcUpdateMeanValue = function(wrapper, target, nextText) {
    if(!wrapper || !target) return;
    const current = target.textContent.trim();
    if(current === nextText.trim()) return;
    const applyMeanText = () => {
        const markerMatch = nextText.match(/^Ø Mittelwert:\s*(.+)$/i);
        if(markerMatch) {
            target.innerHTML = `Ø Mittelwert: <span class="src-marker" id="src-mean-value">${markerMatch[1]}</span>`;
            return;
        }
        target.textContent = nextText;
    };
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion) {
        applyMeanText();
        return;
    }
    wrapper.classList.add('is-updating');
    requestAnimationFrame(() => {
        applyMeanText();
        requestAnimationFrame(() => {
            wrapper.classList.remove('is-updating');
        });
    });
}

const srcAdjustRangeForScript = function(values, hasScript) {
    if(!hasScript || !Array.isArray(values) || values.length < 3) return values;
    const min = values[0];
    const mid = values[1];
    const max = values[2];
    if(!Number.isFinite(min) || !Number.isFinite(mid) || !Number.isFinite(max)) return values;
    if(mid <= 0) return values;
    const delta = Math.round(mid * 0.12);
    let low = Math.max(min, mid - delta);
    let high = Math.min(max, mid + delta);
    if(low > mid) low = mid;
    if(high < mid) high = mid;
    return [low, mid, high];
}

const srcEnsurePriceTriple = function(value, fallback = [0, 0, 0]) {
    if(Array.isArray(value) && value.length >= 3) {
        return value.map(v => parseInt(v, 10) || 0);
    }
    if(typeof value === 'number') {
        return [value, value, value];
    }
    return fallback;
}

const srcGetTierForUnits = function(tiers, units) {
    if(!Array.isArray(tiers) || tiers.length === 0) return null;
    const sorted = [...tiers].sort((a, b) => (a.limit || 0) - (b.limit || 0));
    let selected = sorted[sorted.length - 1];
    for(const tier of sorted) {
        if(typeof tier.limit === 'number' && units <= tier.limit) {
            selected = tier;
            break;
        }
    }
    return selected;
}

const srcGetExtraChunks = function(data, units, fallbackLimit, fallbackUnit) {
    if(!data || !data.extra) return { chunks: 0 };
    const extraAfter = (typeof data.extra_after === 'number') ? data.extra_after : (typeof fallbackLimit === 'number' ? fallbackLimit : data.limit);
    if(typeof extraAfter !== 'number' || units <= extraAfter) {
        return { chunks: 0 };
    }
    const extraUnit = (typeof data.extra_unit === 'number') ? data.extra_unit : (typeof fallbackUnit === 'number' ? fallbackUnit : 5);
    const chunks = Math.ceil((units - extraAfter) / extraUnit);
    return { chunks, extraUnit };
}

const srcGetLicenseExtraAmount = function(data, key) {
    if(!data || !key) return null;
    const value = data[key];
    if(value === undefined || value === null) return null;
    return srcEnsurePriceTriple(value, null);
}

const srcAuditRatesAgainstVDS = function() {
    const params = new URLSearchParams(window.location.search);
    if(params.get('src_audit') !== '1') return;
    const expected = (srcPluginData && srcPluginData.vdsExpected) ? srcPluginData.vdsExpected : {};
    const found = srcRatesData || {};
    const ignoreKeys = new Set(['rights_guidance', 'options_by_project', 'project_tips']);
    const fieldsToCheck = ['base', 'tiers', 'extra', 'extra_unit', 'extra_after', 'tier_unit', 'license_extras', 'variants', 'limit', 'per_min', 'min'];
    const diffs = [];

    Object.keys(expected).forEach((projectKey) => {
        if(ignoreKeys.has(projectKey)) return;
        const expectedProject = expected[projectKey];
        const foundProject = found[projectKey];
        if(!foundProject) {
            diffs.push({ project: projectKey, field: 'project', expected: 'present', found: 'missing' });
            return;
        }
        fieldsToCheck.forEach((field) => {
            if(expectedProject[field] === undefined) return;
            const expectedVal = expectedProject[field];
            const foundVal = foundProject[field];
            const expectedStr = JSON.stringify(expectedVal);
            const foundStr = JSON.stringify(foundVal);
            if(expectedStr !== foundStr) {
                diffs.push({ project: projectKey, field, expected: expectedVal, found: foundVal });
            }
        });
    });

    if(diffs.length === 0) {
        console.info('SRC Audit: Keine Abweichungen zwischen VDS-Referenz und src_rates_json gefunden.');
        return;
    }
    console.group('SRC Audit: Abweichungen zwischen VDS-Referenz und src_rates_json');
    diffs.forEach((diff) => {
        console.warn(`[${diff.project}] ${diff.field}: erwartet`, diff.expected, 'gefunden', diff.found);
    });
    console.groupEnd();
}

const srcUpdateCutdownVisibility = function(genre, layoutMode) {
    const row = document.querySelector('.src-opt-card[data-opt="cutdown"], .src-option-row[data-option="cutdown"]');
    if(!row) return;
    const optionsByProject = srcRatesData.options_by_project || {};
    const allow = !layoutMode && optionsByProject[genre] && optionsByProject[genre].allow_cutdown === true;
    srcToggleCollapse(row, allow);
    if(!allow) {
        const toggle = document.getElementById('src-cutdown');
        if(toggle && toggle.checked) {
            toggle.checked = false;
            srcSetOptionRowState(toggle);
        }
    }
}

const srcHasRightsControls = function(genre) {
    if(!genre) return false;
    if(['tv','online_paid','radio','cinema','pos'].includes(genre)) return true;
    if(['imagefilm','explainer','app'].includes(genre)) return true;
    if(['elearning','podcast','audioguide','doku'].includes(genre)) return true;
    return false;
}

const shouldShowRightsSection = function(projectKey, config, state) {
    if(!projectKey || !config || (state && state.layoutMode)) return false;
    const rightsGuidance = config.rights_guidance || {};
    const guidance = rightsGuidance[projectKey] && typeof rightsGuidance[projectKey].text === 'string'
        ? rightsGuidance[projectKey].text.trim()
        : '';
    const hasControls = srcHasRightsControls(projectKey);
    if(['elearning','podcast','audioguide','doku'].includes(projectKey)) {
        return Boolean(guidance) || hasControls;
    }
    if(projectKey === 'phone') {
        return Boolean(guidance) || hasControls;
    }
    return Boolean(guidance) || hasControls;
}

const srcUpdateRightsSectionVisibility = function(genre, layoutMode) {
    const calcRoot = document.getElementById('src-calc-v6');
    if(!calcRoot) return;
    const showRights = shouldShowRightsSection(genre, srcRatesData, { layoutMode });
    calcRoot.classList.toggle('src-show-rights-section', showRights);
    calcRoot.dataset.project = genre || '';
    const rightsCard = document.querySelector('.src-rights-card');
    srcToggleCollapse(rightsCard, showRights);
}

const srcRenderNotesTips = function() {
    const notesWrap = document.getElementById('src-static-notes');
    if(!notesWrap) return;
    const calcRoot = document.getElementById('src-calc-v6');
    const hasProject = Boolean(calcRoot && calcRoot.classList.contains('src-has-project'));
    if(!hasProject) {
        notesWrap.innerHTML = '';
        srcUpdateNotesTipsVisibility(false);
        return;
    }
    const hints = Array.isArray(currentRiskChecks)
        ? currentRiskChecks.map(check => check && check.text).filter(Boolean)
        : [];
    const tips = Array.isArray(currentProjectTips)
        ? currentProjectTips.filter(Boolean)
        : [];
    const hintItems = hints.length ? hints : ['Keine besonderen Hinweise.'];
    const hintMarkup = hintItems.map(item => `<li>${item}</li>`).join('');
    const tipsMarkup = tips.length
        ? `<div class="src-notes-box is-tips"><div class="src-notes-box__head">Tipps</div><ol class="src-notes-box__list">${tips.map(tip => `<li>${tip}</li>`).join('')}</ol></div>`
        : '';
    notesWrap.innerHTML = `<div class="src-notes-box is-hints"><div class="src-notes-box__head">Hinweise</div><ol class="src-notes-box__list">${hintMarkup}</ol></div>${tipsMarkup}`;
    srcUpdateNotesTipsVisibility(true);
}

const srcRenderProjectTips = function(genre) {
    if(!genre) {
        currentProjectTips = [];
        srcRenderNotesTips();
        return;
    }
    const tips = (srcRatesData.project_tips && srcRatesData.project_tips[genre]) || [];
    currentProjectTips = tips.slice(0, 3);
    srcRenderNotesTips();
}

const srcRenderFieldTips = function(genre) {
    const tipsConfig = srcRatesData.field_tips || {};
    const defaultTips = tipsConfig.default || {};
    const projectTips = tipsConfig[genre] || {};
    document.querySelectorAll('.src-field-tip').forEach(icon => {
        const fieldKey = icon.getAttribute('data-field-tip');
        if(!fieldKey) return;
        const tipText = projectTips[fieldKey] || defaultTips[fieldKey] || icon.getAttribute('data-default-tip') || '';
        if(tipText) {
            icon.setAttribute('data-tip', tipText);
            icon.style.display = 'inline-flex';
        } else {
            icon.removeAttribute('data-tip');
            icon.style.display = 'none';
        }
    });
}

const srcRenderBreakdown = function(breakdown) {
    const panel = document.getElementById('src-breakdown-panel');
    if(!panel) return;
    if(!breakdown) {
        panel.innerHTML = '';
        return;
    }
    const base = breakdown.base || {};
    const steps = Array.isArray(breakdown.steps) ? breakdown.steps : [];
    const final = breakdown.final || {};
    const lines = [];
    lines.push(`<div class="src-breakdown-step"><span>Basis</span><strong>${srcFormatCurrency(base.mid)} (${srcFormatCurrency(base.min)}–${srcFormatCurrency(base.max)})</strong></div>`);
    steps.forEach(step => {
        lines.push(`<div class="src-breakdown-step"><span>${step.label}</span><strong>${step.amountOrFactor}</strong></div>`);
    });
    lines.push(`<div class="src-breakdown-summary">Final: ${srcFormatCurrency(final.mid)} (${srcFormatCurrency(final.min)}–${srcFormatCurrency(final.max)})</div>`);
    panel.innerHTML = lines.join('');
}

const srcRenderPriceDetails = function(info, state, result) {
    const list = document.getElementById('src-breakdown-list');
    if(!list) return;
    if(!Array.isArray(info) || info.length === 0) {
        list.innerHTML = `<div class="src-breakdown-row src-price-row">
            <span class="src-breakdown-label src-price-row__label">Bitte Projekt wählen..</span>
            <span class="src-breakdown-value src-price-row__value">—</span>
        </div>`;
        return;
    }
    const rows = info.map((entry, idx) => {
        const labelText = entry.label || '';
        const includedByDefault = /gebiet|verbreitungsgebiet|laufzeit|nutzungsdauer/i.test(labelText);
        const amountRaw = typeof entry.amount === 'number' ? String(entry.amount) : (entry.amount || '').toString().trim();
        const shouldShowIncluded = includedByDefault && (!amountRaw || ['—', '0 €', '0€', '+0 €', '±0 €'].includes(amountRaw));
        const amountText = shouldShowIncluded ? 'inkl.' : (amountRaw || '—');
        const toneClass = entry.tone ? `is-${entry.tone}` : '';
        const lastNormalClass = idx === info.length - 1 ? 'is-last-normal' : '';
        return `<div class="src-breakdown-row src-price-row ${toneClass} ${lastNormalClass}">
            <span class="src-breakdown-label src-price-row__label">${labelText}</span>
            <span class="src-breakdown-value src-price-row__value ${toneClass}">${amountText}</span>
        </div>`;
    });
    const totalValue = Array.isArray(result?.final) && Number.isFinite(result.final[1])
        ? srcFormatCurrency(result.final[1])
        : srcFormatCurrency(currentResult.mid);
    rows.push(`<div class="src-breakdown-row src-price-row is-total">
        <span class="src-breakdown-label src-price-row__label">Summe</span>
        <span class="src-breakdown-value src-price-row__value"><span class="src-marker">${totalValue}</span></span>
    </div>`);
    list.innerHTML = rows.join('');
}

const srcBuildRiskChecks = function(state) {
    const checks = [];
    if(!state || !state.projectKey) return checks;
    if(!state.hasScript && (!state.manualMinutesActive || state.minutesRaw <= 0)) {
        checks.push({ severity: 'info', text: 'Schätzung basiert auf wenigen Angaben. Für eine präzisere Spanne bitte Text oder Dauer ergänzen.' });
    }
    if(['tv','online_paid','radio','cinema','pos'].includes(state.projectKey)) {
        if(state.region === 'world' && state.duration === 4) {
            checks.push({ severity: 'warning', text: 'Worldwide + Unlimited ist ein sehr hoher Buyout. Prüfen, ob beides wirklich nötig ist.' });
        }
        if(state.duration >= 3 && state.region === 'dach') {
            checks.push({ severity: 'info', text: 'Lange Laufzeit + großes Gebiet: ggf. alternative Lizenzstaffel prüfen.' });
        }
    }
    const mediaChannels = [state.packageOnline, state.packageAtv, state.licenseSocial, state.licenseEvent].filter(Boolean).length;
    if(mediaChannels >= 2 && ['tv','online_paid','radio','cinema','pos'].includes(state.projectKey)) {
        checks.push({ severity: 'info', text: 'Mehrkanal-Nutzung aktiv. Prüfen, ob Paket-/Buyout-Logik sauber passt.' });
    }
    if(state.licenseSocial && state.projectKey === 'imagefilm') {
        checks.push({ severity: 'info', text: 'Social Media Zusatzlizenz aktiv. Bitte Scope (organisch vs. paid) im Angebot klar benennen.' });
    }
    if(state.packageAtv && state.projectKey !== 'online_paid') {
        checks.push({ severity: 'info', text: 'ATV/CTV Paket ist typischerweise für Paid Media vorgesehen.' });
    }
    if(state.packageOnline && state.projectKey !== 'radio') {
        checks.push({ severity: 'info', text: 'Online Audio Paket passt typischerweise zu Funkspot-Projekten.' });
    }
    if(state.discountToggle && state.discountPct > 25) {
        checks.push({ severity: 'warning', text: 'Ungewöhnlich hoher Rabatt. Prüfen, ob die Begründung im Angebot klar benannt ist.' });
    }
    return checks;
}

const srcRenderRiskChecks = function(checks) {
    currentRiskChecks = Array.isArray(checks) ? checks : [];
    srcRenderNotesTips();
}

// LEGACY: Compare UI removed; keep logic for now (guarded) to avoid breaking changes.
const srcToggleCompare = function() {
    compareState.enabled = !compareState.enabled;
    const calcRoot = document.getElementById('src-calc-v6');
    if(calcRoot) calcRoot.classList.toggle('src-compare-enabled', compareState.enabled);
    srcUpdateSidebarCollapse();
    renderCompareView();
}

const srcSaveCompareSnapshot = function(slot) {
    const state = srcGetStateFromUI();
    if(!state.projectKey) return;
    const result = srcComputeResult(state);
    compareState[slot] = {
        state,
        result
    };
    compareState.enabled = true;
    const calcRoot = document.getElementById('src-calc-v6');
    if(calcRoot) calcRoot.classList.add('src-compare-enabled');
    srcUpdateSidebarCollapse();
    renderCompareView();
}

const srcComplexitySummary = function(state) {
    if(!state || !state.complexitySelections) return 'Standard';
    const resolved = srcResolveComplexity(state.complexitySelections);
    if(!resolved.picks.length) return 'Standard';
    return resolved.picks.join(', ');
}

const srcCompareDiffList = function(aState, bState) {
    const diffs = [];
    if(aState.region !== bState.region) diffs.push(`Region: ${aState.region} → ${bState.region}`);
    if(aState.duration !== bState.duration) diffs.push(`Dauer: ${aState.duration} → ${bState.duration}`);
    if(aState.language !== bState.language) diffs.push(`Sprache: ${aState.language} → ${bState.language}`);
    if(aState.projectKey === 'phone' && aState.phoneCount !== bState.phoneCount) diffs.push(`Module: ${aState.phoneCount} → ${bState.phoneCount}`);
    if(aState.projectKey !== 'phone' && aState.minutes !== bState.minutes) diffs.push(`Länge: ${aState.minutes.toFixed(2)} → ${bState.minutes.toFixed(2)} Min`);
    if(aState.licenseSocial !== bState.licenseSocial) diffs.push(`Social License: ${aState.licenseSocial ? 'ja' : 'nein'} → ${bState.licenseSocial ? 'ja' : 'nein'}`);
    if(aState.licenseEvent !== bState.licenseEvent) diffs.push(`Event License: ${aState.licenseEvent ? 'ja' : 'nein'} → ${bState.licenseEvent ? 'ja' : 'nein'}`);
    if(aState.licenseInternal !== bState.licenseInternal) diffs.push(`Interne Nutzung: ${aState.licenseInternal ? 'ja' : 'nein'} → ${bState.licenseInternal ? 'ja' : 'nein'}`);
    if(aState.packageOnline !== bState.packageOnline) diffs.push(`Online Audio: ${aState.packageOnline ? 'ja' : 'nein'} → ${bState.packageOnline ? 'ja' : 'nein'}`);
    if(aState.packageAtv !== bState.packageAtv) diffs.push(`ATV/CTV: ${aState.packageAtv ? 'ja' : 'nein'} → ${bState.packageAtv ? 'ja' : 'nein'}`);
    if(aState.cutdown !== bState.cutdown) diffs.push(`Cut-down: ${aState.cutdown ? 'ja' : 'nein'} → ${bState.cutdown ? 'ja' : 'nein'}`);
    const aComplexity = srcComplexitySummary(aState);
    const bComplexity = srcComplexitySummary(bState);
    if(aComplexity !== bComplexity) diffs.push(`Aufwand: ${aComplexity} → ${bComplexity}`);
    return diffs;
}

const renderCompareView = function() {
    const compareBox = document.getElementById('src-compare-view');
    if(!compareBox) return;
    if(!compareState.enabled) {
        compareBox.innerHTML = '';
        return;
    }
    const a = compareState.A;
    const b = compareState.B;
    if(!a || !b) {
        compareBox.innerHTML = '<div class="src-risk-item info">Speichere zwei Szenarien (A &amp; B), um den Vergleich zu sehen.</div>';
        return;
    }
    const deltaMid = b.result.final[1] - a.result.final[1];
    const diffs = srcCompareDiffList(a.state, b.state);
    compareBox.innerHTML = `
        <div class="src-compare-tabs">
            <button class="src-mini-btn" type="button" data-compare-tab="A">Szenario A</button>
            <button class="src-mini-btn" type="button" data-compare-tab="B">Szenario B</button>
        </div>
        <div class="src-compare-grid" data-active="${compareState.activeTab}">
            <div class="src-compare-card" data-compare="A">
                <h4>Szenario A</h4>
                <div>Range: ${srcFormatCurrency(a.result.final[0])}–${srcFormatCurrency(a.result.final[2])}</div>
                <div>Mittelwert: ${srcFormatCurrency(a.result.final[1])}</div>
            </div>
            <div class="src-compare-card" data-compare="B">
                <h4>Szenario B</h4>
                <div>Range: ${srcFormatCurrency(b.result.final[0])}–${srcFormatCurrency(b.result.final[2])}</div>
                <div>Mittelwert: ${srcFormatCurrency(b.result.final[1])}</div>
            </div>
        </div>
        <div class="src-compare-card">
            <div class="src-compare-delta">Δ ${srcFormatCurrency(deltaMid)}</div>
            <div>${diffs.length ? diffs.join('<br>') : 'Keine Unterschiede in den gewählten Inputs.'}</div>
        </div>
    `;
    compareBox.querySelectorAll('[data-compare-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            compareState.activeTab = btn.getAttribute('data-compare-tab');
            const grid = compareBox.querySelector('.src-compare-grid');
            if(grid) grid.setAttribute('data-active', compareState.activeTab);
        });
    });
}

const srcBuildPackages = function(currentState) {
    const data = srcRatesData[currentState.projectKey] || {};
    const baseState = { ...currentState };
    const hasDurationControl = ['tv','online_paid','radio','cinema','pos'].includes(baseState.projectKey);
    const packageConfig = srcRatesData.packages || {};
    const defaultMeta = {
        basic: ['Min-Preis', hasDurationControl ? 'Dauer: 1 Jahr' : 'Dauer: Standard', 'Ohne Zusatzlizenzen'],
        standard: ['Mittelwert', 'Dauer: aktuell', 'Aktuelle Optionen'],
        premium: ['Max-Preis', hasDurationControl ? 'Dauer: Unlimited' : 'Dauer: Standard', 'inkl. Social/Extras']
    };
    const disableExtras = {
        licenseSocial: false,
        licenseEvent: false,
        licenseInternal: false,
        packageOnline: false,
        packageAtv: false,
        cutdown: false,
        expressToggle: false,
        discountToggle: false,
        discountPct: 0,
        studioFee: 0
    };
    const buildState = (config) => {
        let state = { ...baseState };
        if(config.extras === 'minimal') {
            state = { ...state, ...disableExtras };
        }
        if(config.extras === 'full') {
            state = {
                ...state,
                licenseSocial: Boolean(data.license_extras && data.license_extras.social_organic),
                licenseEvent: Boolean(data.license_extras && data.license_extras.event_pos),
                licenseInternal: Boolean(data.license_extras && data.license_extras.internal_use),
                packageAtv: baseState.projectKey === 'online_paid',
                packageOnline: baseState.projectKey === 'radio'
            };
        }
        if(config.duration === 'short') {
            state.duration = hasDurationControl ? 1 : baseState.duration;
        } else if(config.duration === 'max') {
            state.duration = hasDurationControl ? 4 : baseState.duration;
        } else if(typeof config.duration_years === 'number' && hasDurationControl) {
            state.duration = config.duration_years;
        } else {
            state.duration = baseState.duration;
        }
        return state;
    };
    const packageKeys = ['basic', 'standard', 'premium'];
    const packages = {};
    packageKeys.forEach(key => {
        const config = packageConfig[key] || {};
        const fallback = {
            label: key === 'basic' ? 'Basic' : key === 'premium' ? 'Premium' : 'Standard',
            pricing: key === 'basic' ? 'min' : key === 'premium' ? 'max' : 'mid',
            duration: key === 'basic' ? 'short' : key === 'premium' ? 'max' : 'current',
            extras: key === 'basic' ? 'minimal' : key === 'premium' ? 'full' : 'current'
        };
        const merged = { ...fallback, ...config };
        const pkgState = buildState(merged);
        const result = srcComputeResult(pkgState);
        const pricing = merged.pricing;
        const price = pricing === 'min' ? result.final[0] : pricing === 'max' ? result.final[2] : result.final[1];
        packages[key] = {
            label: merged.label || fallback.label,
            price,
            meta: Array.isArray(merged.meta) ? merged.meta : (defaultMeta[key] || []),
            state: pkgState
        };
    });
    return packages;
}

const srcRenderPackages = function() {
    const list = document.getElementById('src-packages-list');
    if(!list) return;
    const state = srcGetStateFromUI();
    if(!state.projectKey) {
        list.innerHTML = '';
        packagesState = null;
        srcUpdateSidebarCollapse();
        return;
    }
    packagesState = srcBuildPackages(state);
    const packageSubline = {
        basic: 'Schnell & schlank',
        standard: 'Empfohlene Orientierung',
        premium: 'Maximale Lizenz-/Optionsannahme'
    };
    list.innerHTML = Object.keys(packagesState).map(key => {
        const pkg = packagesState[key];
        const metaItems = Array.isArray(pkg.meta) ? pkg.meta : [];
        const metaReadable = metaItems.length ? metaItems.join(', ') : 'Standardumfang';
        const regionLabel = ({ regional: 'Regional', national: 'National', dach: 'DACH', world: 'Weltweit' })[pkg.state?.region] || '—';
        const durationLabel = ({ 1: '1 Jahr', 2: '2 Jahre', 3: '3 Jahre', 4: 'Unlimited' })[pkg.state?.duration] || '—';
        const explainTier = key === 'basic'
            ? 'Min-Preis (untere Spanne)'
            : (key === 'premium' ? 'Max-Preis (obere Spanne)' : 'Mittelwert (Orientierung)');
        return `
            <div class="src-package-card src-package-card--modern src-package-card--v2">
                <div class="src-package-head">
                    <div class="src-package-left">
                        <div class="src-package-name-row">
                            <div class="src-package-name">${pkg.label}</div>
                            <button class="src-pkg-info" type="button" aria-label="Paketdetails anzeigen"><span aria-hidden="true">i</span></button>
                            <div class="src-pkg-tooltip" role="tooltip">
                                <div class="src-pkg-tooltip__row"><strong>Gebiet:</strong> <span>${regionLabel}</span></div>
                                <div class="src-pkg-tooltip__row"><strong>Laufzeit:</strong> <span>${durationLabel}</span></div>
                                <div class="src-pkg-tooltip__row"><strong>Optionen:</strong> <span>${metaReadable}</span></div>
                                <div class="src-pkg-tooltip__row"><strong>Preislogik:</strong> <span>${explainTier}</span></div>
                            </div>
                        </div>
                        <div class="src-package-subtext">${packageSubline[key] || ''}</div>
                    </div>
                    <div class="src-package-price"><span class="src-marker">${srcFormatCurrency(pkg.price)}</span></div>
                </div>
                <div class="src-package-meta-wrap">
                    <ul class="src-package-meta-list">
                        ${metaItems.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
                <div class="src-package-action">
                    <button class="src-mini-btn" type="button" data-export-package="${key}">Als Angebot exportieren</button>
                </div>
            </div>
        `;
    }).join('');
    list.querySelectorAll('[data-export-package]').forEach(btn => {
        btn.addEventListener('click', () => {
            const pkg = btn.getAttribute('data-export-package');
            srcOpenExportModal({ pricingMode: 'package', selectedPackage: pkg });
        });
    });
    srcUpdateSidebarCollapse();
}

const srcUpdateDurationSliderFill = function() {
    const slider = document.getElementById('src-time-slider');
    if(!slider) return;
    const wrap = slider.closest('.src-slider-container');
    if(!wrap) return;
    const min = parseFloat(slider.min || '0');
    const max = parseFloat(slider.max || '100');
    const value = parseFloat(slider.value || '0');
    const range = max - min;
    const pct = range > 0 ? ((value - min) / range) * 100 : 0;
    wrap.style.setProperty('--src-range-fill', `${pct}%`);

    const dots = wrap.querySelectorAll('.src-range-dot');
    if(!dots.length) return;
    const idx = range > 0 ? Math.round(((value - min) / range) * (dots.length - 1)) : 0;
    dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('is-active', dotIndex === idx);
    });
}

const srcUpdateExportPackageVisibility = function() {
    const wrap = document.getElementById('src-export-package-wrap');
    if(!wrap) return;
    wrap.style.display = exportModalState.pricing === 'package' ? 'block' : 'none';
    srcSyncExportPackageCards();
}

const srcSyncExportPackageCards = function() {
    const select = document.getElementById('src-export-package');
    const selected = select ? select.value : 'standard';
    document.querySelectorAll('[data-export-package-card]').forEach(card => {
        const pkg = card.getAttribute('data-export-package-card');
        card.classList.toggle('is-selected', pkg === selected);
    });
}

window.srcOpenExportModal = function(options = {}) {
    const modal = document.getElementById('src-export-modal');
    if(!modal) return;
    if(modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    if(options.pricingMode) {
        exportModalState.pricing = options.pricingMode;
    }
    if(options.selectedPackage) {
        const select = document.getElementById('src-export-package');
        if(select) select.value = options.selectedPackage;
        exportModalState.selectedPackage = options.selectedPackage;
    }
    srcUpdateExportPackageVisibility();
    srcSyncExportPackageCards();
    srcSyncExportTiles();
    if(!exportModalKeyHandler) {
        exportModalKeyHandler = (event) => {
            if(event.key === 'Escape') {
                srcCloseExportModal();
            }
        };
    }
    document.addEventListener('keydown', exportModalKeyHandler);
}

const srcCloseExportModal = function() {
    const modal = document.getElementById('src-export-modal');
    if(!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if(exportModalKeyHandler) {
        document.removeEventListener('keydown', exportModalKeyHandler);
    }
}

const srcCopyToClipboard = async function(text) {
    if(navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
}

const srcBuildOfferEmailText = function({ lang, pricingMode, selectedPackage, includeBreakdown, includeRisk, extraSettings }) {
    const i18n = SRC_I18N[lang] || SRC_I18N.de;
    const state = srcGetStateFromUI();
    const result = srcComputeResult(state);
    const projectName = state.layoutMode ? "Layout / Pitch" : srcGetProjectName(state.projectKey);
    const linkedProjectNames = Array.from(new Set((state.linkedProjects || []).map(srcGetProjectName).filter(Boolean)));
    const projectLabel = linkedProjectNames.length ? `${projectName} (+ ${linkedProjectNames.join(', ')})` : projectName;
    const pricingLabel = pricingMode === 'mean' ? i18n.pricingMean : pricingMode === 'package' ? i18n.pricingPackage : i18n.pricingRange;
    let priceText = `${result.final[0]} € – ${result.final[2]} €`;
    if(pricingMode === 'mean') {
        priceText = `${result.final[1]} €`;
    }
    if(pricingMode === 'package') {
        if(!packagesState) {
            packagesState = srcBuildPackages(state);
        }
        const pkg = packagesState[selectedPackage] || packagesState.standard;
        priceText = `${pkg.price} € (${pkg.label})`;
    }
    const parts = [];
    parts.push(`${i18n.subjectLabel}: ${i18n.subject}`);
    parts.push('');
    parts.push(i18n.intro);
    parts.push('');
    if(extraSettings.projectName) {
        parts.push(`${i18n.projectNameLabel}: ${extraSettings.projectName}`);
    }
    if(extraSettings.offerId) {
        parts.push(`${i18n.offerNumberLabel}: ${extraSettings.offerId}`);
    }
    parts.push(`${i18n.project}: ${projectLabel}`);
    if(extraSettings.customerType) {
        const typeLabel = extraSettings.customerType === 'agency' ? i18n.customerTypeAgency : i18n.customerTypeDirect;
        parts.push(`${i18n.customerTypeLabel}: ${typeLabel}`);
    }
    if(state.projectKey === 'phone') {
        parts.push(`${i18n.modules}: ${state.phoneCount}`);
    } else {
        parts.push(`${i18n.length}: ${state.minutes.toFixed(2)} Min`);
    }
    if(['tv','online_paid','radio','cinema','pos'].includes(state.projectKey)) {
        parts.push(`${i18n.region}: ${state.region}`);
        parts.push(`${i18n.duration}: ${state.duration === 4 ? 'Unlimited' : `${state.duration} Jahr(e)`}`);
    }
    if(linkedProjectNames.length) {
        parts.push(`Verknüpfte Projekte: ${linkedProjectNames.join(', ')}`);
    }
    const addons = [];
    if(state.packageOnline) addons.push('Online Audio');
    if(state.packageAtv) addons.push('ATV/CTV');
    if(state.licenseSocial) addons.push('Social Media');
    if(state.licenseEvent) addons.push('Event / Messe / POS');
    if(state.licenseInternal) addons.push('Interne Nutzung (Intranet)');
    if(state.cutdown) addons.push('Cut-down');
    if(state.expressToggle) addons.push('Express');
    if(state.studioFee > 0) addons.push('Studio');
    if(addons.length) {
        parts.push(`${i18n.addOns}: ${addons.join(', ')}`);
    }
    if(extraSettings.validity) {
        parts.push(`${i18n.validity}: ${extraSettings.validity}`);
    }
    parts.push(`${pricingLabel}: ${priceText}`);
    if(extraSettings.scope.length) {
        parts.push(`${i18n.scope}: ${extraSettings.scope.join(', ')}`);
    }
    parts.push('');
    parts.push(i18n.assumptions);
    if(includeBreakdown && currentBreakdownData) {
        parts.push('');
        parts.push(`${i18n.breakdown}:`);
        parts.push(`Basis: ${srcFormatCurrency(currentBreakdownData.base.mid)} (${srcFormatCurrency(currentBreakdownData.base.min)}–${srcFormatCurrency(currentBreakdownData.base.max)})`);
        currentBreakdownData.steps.forEach(step => {
            parts.push(`- ${step.label}: ${step.amountOrFactor}`);
        });
    }
    if(includeRisk && currentRiskChecks.length) {
        parts.push('');
        parts.push(`${i18n.risks}:`);
        currentRiskChecks.forEach(check => {
            parts.push(`- ${check.text}`);
        });
    }
    return parts.join('\n');
}

const srcHandleExportStart = async function() {
    const modal = document.getElementById('src-export-modal');
    if(!modal) return;
    const state = srcGetStateFromUI();
    if(!state.projectKey) {
        srcCloseExportModal();
        return;
    }
    const lang = exportModalState.lang || 'de';
    const pricingMode = exportModalState.pricing || 'range';
    const selectedPackage = document.getElementById('src-export-package')?.value || exportModalState.selectedPackage || 'standard';
    const includePdf = exportModalState.pdf;
    const includeEmail = exportModalState.email;
    const includeBreakdown = exportModalState.breakdown;
    const includeRisk = exportModalState.risk;
    const projectName = document.getElementById('src-export-projectname')?.value || '';
    const offerId = document.getElementById('src-export-offer-id')?.value || '';
    const validity = document.getElementById('src-export-validity')?.value || '';
    const scope = Array.from(document.querySelectorAll('.src-export-scope:checked')).map(el => el.value);
    const customerType = exportModalState.client || 'direct';
    const extraSettings = { projectName, validity, scope, customerType, offerId };
    if(includePdf) {
        srcGeneratePDFv6({ lang, pricingMode, selectedPackage, includeBreakdown, includeRisk, extraSettings });
    }
    if(includeEmail) {
        const emailText = srcBuildOfferEmailText({ lang, pricingMode, selectedPackage, includeBreakdown, includeRisk, extraSettings });
        await srcCopyToClipboard(emailText);
    }
    srcCloseExportModal();
}

const srcHandleExportTileToggle = function(tile) {
    if(!tile) return;
    const opt = tile.getAttribute('data-opt');
    const group = tile.getAttribute('data-opt-group');
    const value = tile.getAttribute('data-value');
    if(opt) {
        exportModalState[opt] = !exportModalState[opt];
    }
    if(group && value) {
        exportModalState[group] = value;
    }
    srcSyncExportTiles();
    srcUpdateExportPackageVisibility();
}

const srcSyncExportTiles = function() {
    document.querySelectorAll('.src-opt-tile[data-opt]').forEach(tile => {
        const key = tile.getAttribute('data-opt');
        const isOn = Boolean(exportModalState[key]);
        tile.classList.toggle('is-on', isOn);
        tile.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    });
    document.querySelectorAll('.src-opt-tile[data-opt-group]').forEach(tile => {
        const group = tile.getAttribute('data-opt-group');
        const value = tile.getAttribute('data-value');
        const isOn = exportModalState[group] === value;
        tile.classList.toggle('is-on', isOn);
        tile.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    });
}

window.srcSaveStateToStorage = function() {
    const calcRoot = document.getElementById('src-calc-v6');
    if(!calcRoot || typeof localStorage === 'undefined') return;

    const state = {};
    calcRoot.querySelectorAll('select, textarea, input').forEach((el) => {
        if(!el.id) return;
        const tagName = el.tagName.toLowerCase();
        const type = (el.type || '').toLowerCase();

        if(tagName === 'select' || tagName === 'textarea') {
            state[el.id] = el.value;
            return;
        }

        if(type === 'checkbox' || type === 'radio') {
            state[el.id] = el.checked;
            return;
        }

        if(type === 'number' || type === 'text') {
            state[el.id] = el.value;
        }
    });

    localStorage.setItem('src_calculator_state', JSON.stringify(state));
}

window.srcRestoreStateFromStorage = function() {
    if(typeof localStorage === 'undefined') return false;

    const rawState = localStorage.getItem('src_calculator_state');
    if(!rawState) return false;

    let parsedState = null;
    try {
        parsedState = JSON.parse(rawState);
    } catch (error) {
        console.warn('SRC: Gespeicherter Zustand ist ungültig und wurde verworfen.', error);
        localStorage.removeItem('src_calculator_state');
        return false;
    }

    const calcRoot = document.getElementById('src-calc-v6');
    if(!calcRoot || !parsedState || typeof parsedState !== 'object') return false;

    Object.entries(parsedState).forEach(([id, value]) => {
        const el = calcRoot.querySelector(`#${CSS.escape(id)}`);
        if(!el) return;

        const tagName = el.tagName.toLowerCase();
        const type = (el.type || '').toLowerCase();

        if(type === 'checkbox' || type === 'radio') {
            el.checked = Boolean(value);
            return;
        }

        if(tagName === 'select' || tagName === 'textarea' || type === 'number' || type === 'text') {
            el.value = value == null ? '' : String(value);
        }
    });

    srcUIUpdate();
    srcCalc();
    return true;
}

const updateStickyOffset = function() {
    const selectors = [
        '.site-header.is-sticky',
        'header.sticky',
        '#masthead',
        '.elementor-sticky',
        '.site-header',
        'header'
    ];
    let header = null;
    for(const selector of selectors) {
        header = document.querySelector(selector);
        if(header) break;
    }
    const baseOffset = 12;
    const height = header ? header.getBoundingClientRect().height : 78;
    const offset = Math.max(60, Math.round(height + baseOffset));
    document.documentElement.style.setProperty('--src-sticky-offset', `${offset}px`);
}

window.toggleAccordion = function(head) {
    const item = head.parentElement;
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.src-acc-item').forEach(el => el.classList.remove('open'));
    if(!wasOpen) item.classList.add('open');
}

window.srcReset = function() {
    document.getElementById('src-genre').selectedIndex = 0;
    document.getElementById('src-language').selectedIndex = 0;
    document.getElementById('src-text').value = '';
    const posType = document.getElementById('src-pos-type');
    if(posType) posType.selectedIndex = 0;
    const complexityDefaults = {
        'src-complexity-variants': '1',
        'src-complexity-revisions': '1',
        'src-complexity-style': 'normal',
        'src-complexity-timing': 'free',
        'src-complexity-editing': 'none',
        'src-complexity-deliverables': 'single'
    };
    Object.keys(complexityDefaults).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = complexityDefaults[id];
    });
    
    // Reset Inputs
    document.getElementById('src-manual-time-check').checked = false;
    document.getElementById('src-manual-minutes').value = '';
    document.getElementById('src-time-slider').value = 1;
    document.getElementById('src-slider-val').innerText = "1 Jahr";
    document.getElementById('src-phone-count').value = 1;
    document.getElementById('src-studio-fee').value = 150;
    document.getElementById('src-discount-percent').value = '';
    document.getElementById('src-discount-reason').value = '';
    const exclusivity = document.getElementById('src-adv-exclusivity');
    if(exclusivity) exclusivity.value = 'none';
    const buyoutMode = document.getElementById('src-adv-buyout-mode');
    if(buyoutMode) buyoutMode.value = 'standard';
    const periods = document.getElementById('src-adv-periods');
    if(periods) periods.value = 1;
    const versions = document.getElementById('src-adv-versions');
    if(versions) versions.value = 1;
    
    // Reset Final Fee & Hide it
    document.getElementById('src-final-fee-user').value = '';
    const finalFeeWrap = document.getElementById('src-final-fee-wrapper');
    if(finalFeeWrap) {
        finalFeeWrap.style.display = 'none';
        finalFeeWrap.classList.add('src-hidden-initially');
        finalFeeWrap.classList.remove('src-fade-in');
    }
    srcValidateFinalFee(); 
    
    const toggles = ['src-layout-mode', 'src-own-studio', 'src-express-toggle', 'src-discount-toggle', 'src-cutdown', 'src-lic-social', 'src-lic-event', 'src-lic-internal', 'src-pkg-online', 'src-pkg-atv'];
    toggles.forEach(id => { const el = document.getElementById(id); if(el) el.checked = false; });
    document.querySelectorAll('.src-linked-project').forEach(el => {
        el.checked = false;
    });
    
    document.querySelectorAll('.src-acc-item').forEach(el => el.classList.remove('open'));
    toggleElement('src-manual-input-wrap', false);
    srcSyncOptionRowStates();
    
    const licBox = document.getElementById('src-license-text');
    const licSection = document.getElementById('src-license-section');
    licBox.innerHTML = '';
    licBox.classList.remove('hidden');
    if(licSection) licSection.classList.remove('is-open');

    compareState = { enabled: false, A: null, B: null, activeTab: 'A' };
    packagesState = null;
    const packagesList = document.getElementById('src-packages-list');
    if(packagesList) packagesList.innerHTML = '';
    currentProjectTips = [];
    currentRiskChecks = [];
    const riskList = document.getElementById('src-static-notes');
    if(riskList) riskList.innerHTML = '';
    const calcRoot = document.getElementById('src-calc-v6');
    if(calcRoot) {
        calcRoot.classList.remove('src-compare-enabled');
        calcRoot.classList.remove('src-has-packages');
    }
    const breakdownBox = document.getElementById('src-calc-breakdown');
    if(breakdownBox) breakdownBox.classList.remove('is-open');

    if(typeof localStorage !== 'undefined') {
        localStorage.removeItem('src_calculator_state');
    }

    updateLicenseMetaText({ region: 'national', duration: 1 });
    
    srcUIUpdate();
    srcCalc();
}

window.srcStartTutorial = function() {
    if(!window.driver || !window.driver.js || typeof window.driver.js.driver !== 'function') {
        console.warn('SRC Tutorial: Driver.js ist nicht verfügbar.');
        return;
    }

    const driver = window.driver.js.driver;
    const rightsElement = document.querySelector('#mod-ads') || document.querySelector('.src-license-settings-block');

    const tutorial = driver({
        animate: true,
        opacity: 0.65,
        nextBtnText: 'Weiter',
        prevBtnText: 'Zurück',
        doneBtnText: 'Beenden',
        steps: [
            {
                element: '#src-genre',
                popover: {
                    title: 'Schritt 1: Projektart',
                    description: 'Wähle hier aus, wofür Deine Sprachaufnahme genutzt wird.'
                }
            },
            {
                element: '#src-language',
                popover: {
                    title: 'Schritt 2: Sprache',
                    description: 'Fremdsprachen oder Englisch haben oft einen branchenüblichen Aufschlag.'
                }
            },
            {
                element: '#src-group-text',
                popover: {
                    title: 'Schritt 3: Skript',
                    description: 'Füge Deinen Text ein, um die Länge in Minuten automatisch schätzen zu lassen.'
                }
            },
            {
                element: rightsElement,
                popover: {
                    title: 'Schritt 4: Nutzungsrechte',
                    description: 'Lege hier fest, wo (Gebiet) und wie lange (Dauer) die Aufnahme genutzt werden darf.'
                }
            },
            {
                element: '.src-sidebar-sticky',
                popover: {
                    title: 'Schritt 5: Ergebnis',
                    description: 'Hier siehst Du live die berechnete Spanne und den Mittelwert. Du kannst von hier aus direkt ein PDF generieren!'
                }
            }
        ]
    });

    tutorial.drive();
}

window.srcUIUpdate = function() {
    const genre = document.getElementById('src-genre').value;
    const layoutMode = document.getElementById('src-layout-mode').checked;
    const hasGenre = Boolean(genre) && genre !== "0";
    const hasProject = Boolean(genre);
    const calcRoot = document.getElementById('src-calc-v6');
    const complexityGroup = document.getElementById('src-complexity-group');
    const linkedInputs = document.querySelectorAll('.src-linked-project');
    const advancedAccordion = document.getElementById('src-advanced-accordion');
    const advancedWrap = document.querySelector('.src-advanced');

    if (calcRoot) {
        calcRoot.classList.toggle('src-has-project', hasGenre);
    }

    // TOGGLE GLOBAL SETTINGS VISIBILITY
    const glob = document.getElementById('src-global-settings');
    if(hasGenre) glob.classList.add('active'); else glob.classList.remove('active');
    
    if(layoutMode) {
        toggleElement('mod-ads', false); toggleElement('mod-image', false); toggleElement('mod-phone', false);
        toggleElement('src-pos-type-wrap', false);
    } else {
        toggleElement('mod-ads', ['tv','online_paid','radio','cinema','pos','elearning','podcast','audioguide','doku'].includes(genre));
        toggleElement('mod-image', ['imagefilm','explainer','app','elearning','podcast','audioguide','doku'].includes(genre));
        toggleElement('mod-phone', genre === 'phone');
        toggleElement('src-pos-type-wrap', genre === 'pos');
        
        toggleElement('src-pkg-online-wrap', genre === 'radio');
        toggleElement('src-pkg-atv-wrap', genre === 'online_paid');
    }
    srcUpdateCutdownVisibility(genre, layoutMode);
    srcSyncOptionRowStates();
    srcAnalyzeText();
    const buyoutMode = document.getElementById('src-adv-buyout-mode')?.value || 'standard';
    toggleElement('src-adv-periods-wrap', buyoutMode === 'staffel');
    if(buyoutMode !== 'staffel') {
        const periods = document.getElementById('src-adv-periods');
        if(periods) periods.value = 1;
    }
    const advancedState = {
        exclusivity: document.getElementById('src-adv-exclusivity')?.value || 'none',
        buyoutMode,
        periods: parseInt(document.getElementById('src-adv-periods')?.value, 10) || 1,
        versions: parseInt(document.getElementById('src-adv-versions')?.value, 10) || 1
    };
    const hasAdvancedValues = advancedState.exclusivity !== 'none'
        || advancedState.buyoutMode !== 'standard'
        || advancedState.periods > 1
        || advancedState.versions > 1;
    if(advancedWrap) {
        advancedWrap.style.display = hasProject ? '' : 'none';
    }
    if(advancedAccordion) {
        if(!hasProject) {
            advancedAccordion.open = false;
        } else {
            advancedAccordion.open = hasAdvancedValues;
        }
    }
    srcUpdateRightsSectionVisibility(genre, layoutMode);
    srcToggleCollapse(complexityGroup, hasGenre);
    linkedInputs.forEach(input => {
        const option = input.closest('.src-linked-project-option');
        const isPrimary = input.value === genre;
        if(!hasGenre || layoutMode) {
            input.checked = false;
        }
        if(isPrimary) {
            input.checked = false;
            input.disabled = true;
            if(option) option.classList.add('is-disabled');
        } else {
            input.disabled = false;
            if(option) option.classList.remove('is-disabled');
        }
    });
    srcSyncLinkedProjectsAccordion({ genre, layoutMode });
    srcRenderProjectTips(genre);
    srcRenderFieldTips(genre);
    srcUpdateSidebarCollapse();
}

window.srcToggleManualTime = function() {
    const check = document.getElementById('src-manual-time-check').checked;
    toggleElement('src-manual-input-wrap', check);
    const txt = document.getElementById('src-text');
    if(check) { txt.disabled = true; txt.style.opacity = '0.5'; } else { txt.disabled = false; txt.style.opacity = '1'; }
    srcAnalyzeText();
}

window.srcToggleStudio = function() {
    srcHandleOptionToggle('src-own-studio');
    srcCalc();
}

window.srcAnalyzeText = function() {
    let mins = 0;
    const manualCheck = document.getElementById('src-manual-time-check').checked;
    const txt = document.getElementById('src-text').value || '';
    const lang = document.getElementById('src-language').value || 'de';
    const estimate = estimateDurationFromScript(txt, lang);
    estimatedMinutes = estimate.minutes;
    if(manualCheck) {
        let val = document.getElementById('src-manual-minutes').value;
        val = val.replace(',', '.');
        mins = parseFloat(val) || 0;
        document.getElementById('src-char-count').innerText = '-';
    } else {
        const chars = txt.length;
        document.getElementById('src-char-count').innerText = chars;
        mins = estimate.minutes || 0;
    }
    document.getElementById('src-min-count').innerText = srcFormatMinutes(mins);
    calculatedMinutes = mins;
    srcUpdateScriptEstimateDisplay({
        hasScript: txt.trim().length > 0,
        manualCheck,
        estimatedMinutes
    });
    srcCalc();
}

const srcUpdateScriptEstimateDisplay = function({ hasScript, manualCheck, estimatedMinutes }) {
    const wrap = document.getElementById('src-script-estimate');
    const valueEl = document.getElementById('src-script-estimate-value');
    const btn = document.getElementById('src-apply-estimate');
    if(!wrap || !valueEl) return;
    if(!hasScript) {
        wrap.classList.remove('is-visible');
        if(btn) btn.classList.remove('is-visible');
        return;
    }
    valueEl.textContent = `~${srcFormatMinutes(estimatedMinutes)}`;
    wrap.classList.add('is-visible');
    if(btn) {
        btn.classList.toggle('is-visible', manualCheck);
    }
}

const srcApplyScriptEstimate = function() {
    const manualCheck = document.getElementById('src-manual-time-check');
    const manualInput = document.getElementById('src-manual-minutes');
    if(!manualCheck || !manualInput) return;
    manualCheck.checked = true;
    srcToggleManualTime();
    if(Number.isFinite(estimatedMinutes)) {
        manualInput.value = estimatedMinutes.toFixed(2).replace('.', ',');
    }
    srcAnalyzeText();
}

window.srcValidateFinalFee = function() {
    const input = document.getElementById('src-final-fee-user');
    const msg = document.getElementById('src-final-fee-msg');
    const val = parseFloat(input.value);
    
    if(!val) {
        input.classList.remove('error');
        msg.style.display = 'none';
        return;
    }
    // Check range
    if(val < currentResult.low || val > currentResult.high) {
        input.classList.add('error');
        msg.style.display = 'block';
    } else {
        input.classList.remove('error');
        msg.style.display = 'none';
    }
}

const srcComputeGlobalAddons = function(state, projectKeys) {
    const keys = Array.from(new Set((projectKeys || []).filter(Boolean)));
    const projectNames = keys.map(srcGetProjectName).filter(Boolean);
    const addonDefaults = {
        social_organic: [150, 150, 150],
        event_pos: [150, 150, 150],
        internal_use: [0, 0, 0] // TODO: VDS Wert einsetzen
    };
    const addons = [
        {
            key: 'social_organic',
            stateKey: 'licenseSocial',
            label: 'Zusatzlizenz: Social Media (organisch)'
        },
        {
            key: 'event_pos',
            stateKey: 'licenseEvent',
            label: 'Zusatzlizenz: Event / Messe / POS'
        },
        {
            key: 'internal_use',
            stateKey: 'licenseInternal',
            label: 'Zusatzlizenz: Interne Nutzung (Mitarbeiterschulung / Intranet)'
        }
    ];
    const result = {
        rangeAdd: [0,0,0],
        info: [],
        breakdownSteps: [],
        licenseLines: [],
        extraBlock: ''
    };
    if(!state) return result;
    addons.forEach(addon => {
        if(!state[addon.stateKey]) return;
        const eligibleProjects = keys.filter(key => {
            const data = srcRatesData[key] || {};
            const hasExtra = data.license_extras && data.license_extras[addon.key] !== undefined;
            return Array.isArray(data.tiers) || hasExtra;
        });
        const eligibleNames = eligibleProjects.map(srcGetProjectName).filter(Boolean);
        const scopeNames = eligibleNames.length ? eligibleNames : projectNames;
        const scopeSuffix = scopeNames.length > 1 ? ` (gilt für: ${scopeNames.join(', ')})` : '';
        result.licenseLines.push(`${addon.label}${scopeSuffix}`);
        if(eligibleProjects.length) {
            const rateCandidates = eligibleProjects.map(key => {
                const data = srcRatesData[key] || {};
                const licenseExtras = data.license_extras || {};
                return srcGetLicenseExtraAmount(licenseExtras, addon.key) || addonDefaults[addon.key] || [0, 0, 0];
            });
            const extraRates = rateCandidates.reduce((acc, rates) => {
                return acc.map((value, idx) => Math.max(value, rates[idx] || 0));
            }, [0, 0, 0]);
            result.rangeAdd = result.rangeAdd.map((value, idx) => value + extraRates[idx]);
            result.breakdownSteps.push({
                label: addon.label,
                amountOrFactor: `+${extraRates[1]} €`,
                effectOnRange: 'add'
            });
            const formulaSuffix = scopeNames.length
                ? `Zusatzlizenz (gilt für: ${scopeNames.join(', ')})`
                : 'Zusatzlizenz (global)';
            result.info.push({
                label: addon.label,
                amount: srcFormatSignedCurrency(extraRates[1]),
                formula: formulaSuffix
            });
        }
    });

    const rightsGuidance = srcRatesData.rights_guidance || {};
    const defaultGuidance = rightsGuidance.default || {};
    const extrasText = [];
    keys.forEach(key => {
        const guidanceEntry = rightsGuidance[state.layoutMode ? 'default' : key] || defaultGuidance;
        const extras = Object.assign({}, defaultGuidance.extras || {}, guidanceEntry.extras || {});
        if(state.licenseSocial && extras.social_organic) {
            extrasText.push(extras.social_organic);
        }
        if(state.licenseEvent && extras.event_pos) {
            extrasText.push(extras.event_pos);
        }
        if(state.licenseInternal && extras.internal_use) {
            extrasText.push(extras.internal_use);
        }
    });
    const dedupedExtras = srcDedupeAddonLines(extrasText);
    result.extraBlock = dedupedExtras.length ? `<div class="src-license-extras">${dedupedExtras.join(' ')}</div>` : '';
    result.licenseLines = srcDedupeAddonLines(result.licenseLines);
    return result;
}

const srcComputeSingleProjectResult = function(state, projectKey, options = {}) {
    const applyAddons = options.applyAddons !== false;
    const genre = projectKey;
    if(!genre) {
        return { final: [0,0,0], info: [], licenseText: "", breakdown: null, licMeta: [], guidanceText: '', extraBlock: '', projectName: '' };
    }
    const data = srcRatesData[genre];
    if(!data) {
        return { final: [0,0,0], info: [], licenseText: "", breakdown: null, licMeta: [], guidanceText: '', extraBlock: '', projectName: '' };
    }
    let base = [0,0,0];
    let final = [0,0,0];
    let info = [];
    let licParts = [];
    let licMeta = [];
    let licBaseText = "";
    let breakdownSteps = [];
    let breakdownBase = null;
    const addInfo = function(label, amount = '', formula = '', tone = '') {
        info.push({ label, amount, formula, tone });
    };
    const lang = state.language;
    let langFactor = 1.0;
    let langLabel = "";
    const projectName = srcGetProjectName(genre);
    if(lang === 'en') { langFactor = 1.3; langLabel = " (Englisch)"; }
    if(lang === 'other') { langFactor = 1.5; langLabel = " (Fremdsprache)"; }

    if(state.layoutMode) {
        final = [250, 300, 350];
        breakdownBase = { min: final[0], mid: final[1], max: final[2] };
        addInfo("Pauschale Layout / Casting", srcFormatCurrency(final[1]), "Fixpreis (Layout/Pitch)");
        addInfo("Verwendung", "—", "Intern / Pitch");
        licBaseText = "Nur interne Nutzung / Pitch (Keine Veröffentlichung).";
    } else {
        licParts.push("Projekt: " + projectName);
        licBaseText = data.lic || "";
        if(['tv','online_paid','radio','cinema','pos'].includes(genre)) {
            let adName = data.name;
            let adBase = data.base;
            if(genre === 'pos') {
                const variants = data.variants || {};
                const variant = variants[state.posType] || variants.pos_spot || variants.ladenfunk;
                if(variant) {
                    adName = variant.name || adName;
                    adBase = variant.base || adBase;
                    if(variant.lic) {
                        licBaseText = variant.lic;
                    }
                    licMeta.push(`POS Typ: ${variant.name || state.posType}`);
                }
            }
            base = srcEnsurePriceTriple(adBase, base);
            base = base.map(v => Math.round(v * langFactor));
            breakdownBase = { min: base[0], mid: base[1], max: base[2] };
            if(langFactor !== 1) {
                breakdownSteps.push({ label: `Sprache${langLabel}`, amountOrFactor: `x${langFactor}`, effectOnRange: 'multiply' });
            }
            addInfo(`Grundhonorar (${adName}${langLabel})`, srcFormatCurrency(base[1]), langFactor !== 1 ? `Basis × Sprachfaktor (${langFactor})` : "Basis");

            const region = state.region;
            let regionMult = 1.0;
            if(region === 'regional') { regionMult = 0.8; }
            if(region === 'dach') { regionMult = 2.5; }
            if(region === 'world') { regionMult = 4.0; }
            const regionLabel = region === 'regional' ? 'Regional' : region === 'national' ? 'National' : region === 'dach' ? 'DACH' : 'Weltweit';
            const regionDiff = Math.round(base[1] * (regionMult - 1));
            const regionAmount = regionMult === 1 ? '—' : srcFormatSignedCurrency(regionDiff);
            const regionFormula = regionMult === 1 ? '—' : `Basis × Faktor Gebiet (${regionMult})`;
            addInfo(`Gebiet: ${regionLabel}`, regionAmount, regionFormula, regionDiff < 0 ? 'positive' : '');
            licMeta.push(`Gebiet: ${regionLabel}`);

            const years = state.duration;
            let timeMult = 1;
            if(years === 4) {
                timeMult = 4;
                const intermediate = base[1] * regionMult;
                const timeDiff = Math.round(intermediate * (timeMult - 1));
                addInfo("Laufzeit: Unlimited", srcFormatSignedCurrency(timeDiff), `Zwischensumme × Faktor Laufzeit (${timeMult})`);
                licParts.push("Unlimited");
                licMeta.push("Laufzeit: Unlimited");
            } else {
                timeMult = years;
                const intermediate = base[1] * regionMult;
                const timeDiff = Math.round(intermediate * (timeMult - 1));
                const timeAmount = timeMult === 1 ? '—' : srcFormatSignedCurrency(timeDiff);
                const timeFormula = timeMult === 1 ? '—' : `Zwischensumme × Faktor Laufzeit (${timeMult})`;
                addInfo(`Laufzeit: ${years} ${years === 1 ? 'Jahr' : 'Jahre'}`, timeAmount, timeFormula);
                licParts.push(years + " Jahr(e)");
                licMeta.push(`Laufzeit: ${years} ${years === 1 ? 'Jahr' : 'Jahre'}`);
            }
            breakdownSteps.push({ label: `Region`, amountOrFactor: `x${regionMult}`, effectOnRange: 'multiply' });
            breakdownSteps.push({ label: `Laufzeit`, amountOrFactor: `x${timeMult}`, effectOnRange: 'multiply' });

            if(genre === 'radio' && state.packageOnline) {
                const beforePackage = base[1];
                base = base.map(v => Math.round(v * 1.6));
                breakdownSteps.push({ label: "Paket: Online Audio", amountOrFactor: "x1.6", effectOnRange: 'multiply' });
                addInfo("Paket: Online Audio", srcFormatSignedCurrency(base[1] - beforePackage), "Basis × Paketfaktor (1.6)");
                licParts.push("inkl. Online Audio");
                licMeta.push("Paket: Online Audio");
            }
            if(genre === 'online_paid' && state.packageAtv) {
                const beforePackage = base[1];
                base = base.map(v => Math.round(v * 1.6));
                breakdownSteps.push({ label: "Paket: ATV/CTV", amountOrFactor: "x1.6", effectOnRange: 'multiply' });
                addInfo("Paket: ATV/CTV", srcFormatSignedCurrency(base[1] - beforePackage), "Basis × Paketfaktor (1.6)");
                licParts.push("inkl. ATV/CTV");
                licMeta.push("Paket: ATV/CTV");
            }

            final = base.map(v => Math.round(v * regionMult * timeMult));

            if(state.cutdown) {
                let oldMid = final[1];
                final = final.map(v => Math.round(v * 0.5));
                breakdownSteps.push({ label: "Cut-down", amountOrFactor: "x0.5", effectOnRange: 'multiply' });
                addInfo("Cut-down (50%)", srcFormatSignedCurrency(final[1] - oldMid), "Zwischensumme × 0.5", 'positive');
                licParts.push("Typ: Cut-down");
                licMeta.push("Typ: Cut-down");
            }
        }
        else if(Array.isArray(data.tiers)) {
            const tierUnit = data.tier_unit || 'minutes';
            const units = tierUnit === 'modules'
                ? state.phoneCount
                : Math.max(0.1, state.minutes);
            const unitLabel = tierUnit === 'modules' ? 'Module' : 'Min';
            const tier = srcGetTierForUnits(data.tiers, units);
            const tierPrices = tier && tier.p ? tier.p : data.base;
            final = srcEnsurePriceTriple(tierPrices, final).map(v => Math.round(v * langFactor));
            breakdownBase = { min: final[0], mid: final[1], max: final[2] };
            const tierLimit = tier && typeof tier.limit === 'number' ? tier.limit : data.limit;
            const tierLabel = tierLimit ? `bis ${tierLimit} ${unitLabel}` : 'Basis';
            addInfo(`Grundhonorar (${tierLabel}${langLabel})`, srcFormatCurrency(final[1]), langFactor !== 1 ? `Basis × Sprachfaktor (${langFactor})` : "Basis");
            if(langFactor !== 1) {
                breakdownSteps.push({ label: `Sprache${langLabel}`, amountOrFactor: `x${langFactor}`, effectOnRange: 'multiply' });
            }

            const extraConfig = srcGetExtraChunks(data, units, tierLimit, tierUnit === 'modules' ? 1 : 5);
            if(extraConfig.chunks > 0) {
                const extraRates = srcEnsurePriceTriple(data.extra, [0, 0, 0]);
                const extraCost = extraConfig.chunks * extraRates[1];
                final[0] += extraConfig.chunks * extraRates[0];
                final[1] += extraCost;
                final[2] += extraConfig.chunks * extraRates[2];
                const unitSuffix = tierUnit === 'modules' ? 'Modul' : 'Min';
                const unitCount = extraConfig.extraUnit || (tierUnit === 'modules' ? 1 : 5);
                breakdownSteps.push({ label: `Überlänge ${extraConfig.chunks}x`, amountOrFactor: `+${extraCost} €`, effectOnRange: 'add' });
                addInfo(`Überlänge (+${extraConfig.chunks}× ${unitCount} ${unitSuffix})`, srcFormatSignedCurrency(extraCost), `+${extraConfig.chunks} × ${extraRates[1]} €`);
            }

            if(tierUnit === 'minutes' && state.hasScript && state.minutes > 0) {
                final = srcAdjustRangeForScript(final, true);
                breakdownSteps.push({ label: "Skript vorhanden", amountOrFactor: "Range enger", effectOnRange: 'adjust' });
                addInfo("Skript vorhanden", "—", "Range enger");
            }

            const licenseExtras = data.license_extras || {};
            const socialExtra = srcGetLicenseExtraAmount(licenseExtras, 'social_organic');
            const eventExtra = srcGetLicenseExtraAmount(licenseExtras, 'event_pos');
            const internalExtra = srcGetLicenseExtraAmount(licenseExtras, 'internal_use');
            if(state.licenseSocial && applyAddons) {
                const extraRates = socialExtra || [150, 150, 150];
                final = final.map((v, idx) => v + extraRates[idx]);
                breakdownSteps.push({ label: "Social Media", amountOrFactor: `+${extraRates[1]} €`, effectOnRange: 'add' });
                addInfo("Social Media", srcFormatSignedCurrency(extraRates[1]), "Zusatzlizenz");
                licParts.push("+ Social Media");
            }
            if(state.licenseEvent && applyAddons) {
                const extraRates = eventExtra || [150, 150, 150];
                final = final.map((v, idx) => v + extraRates[idx]);
                breakdownSteps.push({ label: "Event", amountOrFactor: `+${extraRates[1]} €`, effectOnRange: 'add' });
                addInfo("Event / Messe / POS", srcFormatSignedCurrency(extraRates[1]), "Zusatzlizenz");
                licParts.push("+ Event");
            }
            if(state.licenseInternal && applyAddons) {
                const extraRates = internalExtra || [0, 0, 0];
                final = final.map((v, idx) => v + extraRates[idx]);
                breakdownSteps.push({ label: "Interne Nutzung", amountOrFactor: `+${extraRates[1]} €`, effectOnRange: 'add' });
                addInfo("Interne Nutzung (Intranet)", srcFormatSignedCurrency(extraRates[1]), "Zusatzlizenz");
                licParts.push("+ Intern");
            }
        }
        else {
            const baseData = data.base || data.min;
            final = srcEnsurePriceTriple(baseData, final).map(v => Math.round(v * langFactor));
            breakdownBase = { min: final[0], mid: final[1], max: final[2] };
            addInfo(`Grundhonorar (Standard${langLabel})`, srcFormatCurrency(final[1]), langFactor !== 1 ? `Basis × Sprachfaktor (${langFactor})` : "Basis");
        }
    }

    const complexity = srcResolveComplexity(state.complexitySelections || {});
    if(complexity.factor !== 1 && Number.isFinite(final[1])) {
        const baseMid = final[1];
        const corridorMin = Number.isFinite(complexity.corridor?.min) ? complexity.corridor.min : 0.08;
        const corridorMax = Number.isFinite(complexity.corridor?.max) ? complexity.corridor.max : 0.15;
        const adjustedMid = Math.round(baseMid * complexity.factor);
        const adjustedMin = Math.round(adjustedMid * (1 - corridorMin));
        const adjustedMax = Math.round(adjustedMid * (1 + corridorMax));
        final = [adjustedMin, adjustedMid, adjustedMax];
        const factorLabel = complexity.factor.toFixed(2);
        const picksText = complexity.picks.length ? complexity.picks.join(' · ') : 'Standard';
        breakdownSteps.push({ label: "Produktion & Aufwand", amountOrFactor: picksText, effectOnRange: 'note' });
        breakdownSteps.push({ label: "Komplexitätsfaktor", amountOrFactor: `x${factorLabel}`, effectOnRange: 'multiply' });
        const diff = adjustedMid - baseMid;
        const tone = diff < 0 ? 'positive' : '';
        addInfo("Produktion & Aufwand", srcFormatSignedCurrency(diff), `x${factorLabel} (${picksText})`, tone);
    }

    if(applyAddons) {
        if(state.licenseSocial) { licMeta.push("Zusatzlizenz: Social Media (organisch)"); }
        if(state.licenseEvent) { licMeta.push("Zusatzlizenz: Event / Messe / POS"); }
        if(state.licenseInternal) { licMeta.push("Zusatzlizenz: Interne Nutzung (Mitarbeiterschulung / Intranet)"); }
    }

    if(state.studioFee > 0) {
        final = final.map(v => v + state.studioFee);
        breakdownSteps.push({ label: "Studiokosten", amountOrFactor: `+${state.studioFee} €`, effectOnRange: 'add' });
        addInfo("Studiokosten", srcFormatSignedCurrency(state.studioFee), "Fixbetrag");
    }
    if(state.expressToggle) {
        const expressType = state.expressType;
        let expressFactor = (expressType === '4h') ? 1.0 : 0.5;
        let expressAmount = Math.round(final[1] * expressFactor);
        final = final.map(v => Math.round(v * (1 + expressFactor)));
        let eLabel = (expressType === '4h') ? "4h (+100%)" : "24h (+50%)";
        breakdownSteps.push({ label: `Express ${eLabel}`, amountOrFactor: `+${expressAmount} €`, effectOnRange: 'multiply' });
        addInfo(`Express ${eLabel}`, srcFormatSignedCurrency(expressAmount), `Zwischensumme × ${expressFactor + 1}`);
    }
    if(state.discountToggle && state.discountPct > 0) {
        let disc = Math.round(final[1] * (state.discountPct/100));
        final = final.map(v => Math.round(v * (1 - state.discountPct/100)));
        breakdownSteps.push({ label: `Rabatt ${state.discountPct}%`, amountOrFactor: `-${disc} €`, effectOnRange: 'add' });
        addInfo(`Rabatt (${state.discountPct}%)`, srcFormatSignedCurrency(-disc), `Zwischensumme × ${state.discountPct}%`, 'positive');
    }

    if(!breakdownBase) {
        breakdownBase = { min: final[0], mid: final[1], max: final[2] };
    }
    const breakdown = {
        base: breakdownBase,
        steps: breakdownSteps,
        final: { min: final[0], mid: final[1], max: final[2] }
    };

    const rightsGuidance = srcRatesData.rights_guidance || {};
    const defaultGuidance = rightsGuidance.default || {};
    const guidanceEntry = rightsGuidance[state.layoutMode ? 'default' : genre] || defaultGuidance;
    let guidanceText = guidanceEntry.text || defaultGuidance.text || "";
    if(licBaseText && (state.layoutMode || !guidanceEntry.text || licBaseText !== (data.lic || ""))) {
        guidanceText = licBaseText;
    }
    if(!guidanceText) {
        guidanceText = "Nutzungsrechte abhängig von Verbreitungsgebiet, Dauer und Zusatzlizenzen. Bitte Projekt auswählen bzw. Konfiguration prüfen.";
    }
    const regionLabel = srcGetRegionLabel(state.region);
    const durationLabel = srcGetDurationLabel(state.duration);
    guidanceText = guidanceText.replace(/im gewählten Gebiet/gi, regionLabel);
    guidanceText = guidanceText.replace(/Laufzeit wie ausgewählt\./gi, `Laufzeit: ${durationLabel}.`);
    guidanceText = guidanceText.replace(/<br\s*\/?>\s*Gebiet:\s*.*?(?=<br|$)/gi, '');
    guidanceText = guidanceText.replace(/<br\s*\/?>\s*Laufzeit:\s*.*?(?=<br|$)/gi, '');
    guidanceText = guidanceText.replace(/\n\s*Gebiet:\s*.*$/gim, '');
    guidanceText = guidanceText.replace(/\n\s*Laufzeit:\s*.*$/gim, '');
    const extras = Object.assign({}, defaultGuidance.extras || {}, guidanceEntry.extras || {});
    const extrasText = [];
    if(applyAddons) {
        if(state.licenseSocial && extras.social_organic) {
            extrasText.push(extras.social_organic);
        }
        if(state.licenseEvent && extras.event_pos) {
            extrasText.push(extras.event_pos);
        }
        if(state.licenseInternal && extras.internal_use) {
            extrasText.push(extras.internal_use);
        }
    }
    const extraBlock = extrasText.length ? `<div class="src-license-extras">${extrasText.join(' ')}</div>` : "";
    const licMetaText = srcBuildLicenseMetaMarkup(licMeta);
    const licenseText = `${guidanceText || ""}${extraBlock}${licMetaText}`;
    return {
        final,
        info,
        licenseText,
        breakdown,
        licMeta,
        guidanceText,
        extraBlock,
        projectName
    };
}

const srcBuildGlobalAddonMarkup = function(addons) {
    if(!addons) return '';
    const lines = srcDedupeAddonLines(addons.licenseLines || []);
    const linesMarkup = lines.length
        ? `<div class="src-license-addons"><strong>Zusatzlizenzen:</strong> ${lines.join(' · ')}</div>`
        : '';
    return `${linesMarkup}${addons.extraBlock || ''}`;
}

const srcGetAdvancedConfig = function(state) {
    const advanced = state && state.advanced ? state.advanced : {};
    const exclusivityMap = {
        none: 0,
        low: 0.1,
        medium: 0.2,
        high: 0.35
    };
    const buyoutMode = advanced.buyoutMode || 'standard';
    const periodsRaw = parseInt(advanced.periods, 10);
    const versionsRaw = parseInt(advanced.versions, 10);
    const periods = Math.min(6, Math.max(1, Number.isFinite(periodsRaw) ? periodsRaw : 1));
    const versions = Math.min(10, Math.max(1, Number.isFinite(versionsRaw) ? versionsRaw : 1));
    const extraPeriods = Math.max(0, periods - 1);
    return {
        exclusivityPct: exclusivityMap[advanced.exclusivity] ?? 0,
        buyoutMode,
        periods,
        versions,
        extraPeriods,
        staffelPct: buyoutMode === 'staffel' ? extraPeriods * 0.12 : 0,
        buyoutPct: buyoutMode === 'buyout' ? 0.25 : 0
    };
}

const srcBuildAdvancedSummary = function(state) {
    const advanced = state && state.advanced ? state.advanced : {};
    const config = srcGetAdvancedConfig(state);
    const exclusivityLabels = {
        none: 'Keine (0%)',
        low: 'Low (+10%)',
        medium: 'Medium (+20%)',
        high: 'High (+35%)'
    };
    const buyoutLabel = config.buyoutMode === 'buyout'
        ? 'Buyout (einmalig, +25%)'
        : config.buyoutMode === 'staffel'
            ? `Staffel (${config.periods} Perioden, +12% je Extra-Periode)`
            : 'Standard (wie bisher)';
    const projectLines = [
        `Exklusivität: ${exclusivityLabels[advanced.exclusivity] || exclusivityLabels.none}`,
        `Buyout/Staffel: ${buyoutLabel}`,
        `Sprachversionen: ${config.versions}`
    ];
    const rightsLines = [];
    if(config.exclusivityPct > 0) {
        rightsLines.push(`Exklusivität: ${exclusivityLabels[advanced.exclusivity] || exclusivityLabels.none}`);
    }
    if(config.buyoutMode === 'buyout') {
        rightsLines.push('Buyout: einmalig (+25%)');
    }
    if(config.buyoutMode === 'staffel' && config.extraPeriods > 0) {
        rightsLines.push(`Staffel: ${config.periods} Perioden (+${Math.round(config.staffelPct * 100)}%)`);
    }
    return { projectLines, rightsLines };
}

const srcApplyAdvancedAdjustments = function(result, state) {
    if(!result || !state || !state.advanced) return result;
    const config = srcGetAdvancedConfig(state);
    let final = Array.isArray(result.final) ? result.final.slice() : [0, 0, 0];
    const baseRange = final.slice();
    const info = Array.isArray(result.info) ? result.info.slice() : [];
    const breakdown = result.breakdown
        ? {
            base: result.breakdown.base,
            steps: Array.isArray(result.breakdown.steps) ? result.breakdown.steps.slice() : [],
            final: Object.assign({}, result.breakdown.final)
        }
        : null;
    const pushInfo = (label, amount, formula) => {
        info.push({
            label,
            amount: srcFormatSignedCurrency(amount),
            formula
        });
    };
    const appendBreakdown = (label, amount) => {
        if(!breakdown) return;
        breakdown.steps.push({
            label,
            amountOrFactor: srcFormatSignedCurrency(amount),
            effectOnRange: 'add'
        });
    };

    let speakerAddRange = [0, 0, 0];
    const extraVersions = Math.max(0, config.versions - 1);
    if(extraVersions > 0) {
        const pct = 0.35 * extraVersions;
        const addRange = baseRange.map(value => Math.round(value * pct));
        speakerAddRange = speakerAddRange.map((value, idx) => value + addRange[idx]);
        pushInfo(
            `Sprachversionen (${config.versions})`,
            addRange[1],
            `Sprecherleistung × ${Math.round(pct * 100)}%`
        );
        appendBreakdown(`Sprachversionen (${config.versions})`, addRange[1]);
    }
    final = final.map((value, idx) => value + speakerAddRange[idx]);

    if(config.exclusivityPct > 0) {
        const addRange = final.map(value => Math.round(value * config.exclusivityPct));
        final = final.map((value, idx) => value + addRange[idx]);
        pushInfo('Exklusivität', addRange[1], `Zwischensumme × ${Math.round(config.exclusivityPct * 100)}%`);
        appendBreakdown('Exklusivität', addRange[1]);
    }
    if(config.buyoutMode === 'buyout') {
        const addRange = final.map(value => Math.round(value * config.buyoutPct));
        final = final.map((value, idx) => value + addRange[idx]);
        pushInfo('Buyout', addRange[1], `Zwischensumme × ${Math.round(config.buyoutPct * 100)}%`);
        appendBreakdown('Buyout', addRange[1]);
    }
    if(config.buyoutMode === 'staffel' && config.extraPeriods > 0) {
        const addRange = final.map(value => Math.round(value * config.staffelPct));
        final = final.map((value, idx) => value + addRange[idx]);
        pushInfo(
            'Staffel (Perioden × 12%)',
            addRange[1],
            `Zwischensumme × ${Math.round(config.staffelPct * 100)}% (bei ${config.periods} Perioden)`
        );
        appendBreakdown('Staffel (Perioden × 12%)', addRange[1]);
    }

    if(breakdown) {
        breakdown.final = { min: final[0], mid: final[1], max: final[2] };
    }
    return Object.assign({}, result, { final, info, breakdown });
}

const srcComputeResult = function(state) {
    const primaryKey = state.projectKey;
    if(!primaryKey) {
        return { final: [0,0,0], info: [], licenseText: "", breakdown: null, licMeta: [] };
    }
    const linkedProjects = Array.isArray(state.linkedProjects) ? state.linkedProjects : [];
    const uniqueKeys = Array.from(new Set([primaryKey, ...linkedProjects.filter(Boolean)])).filter(Boolean);
    if(uniqueKeys.length === 0) {
        return { final: [0,0,0], info: [], licenseText: "", breakdown: null, licMeta: [] };
    }
    if(uniqueKeys.length === 1) {
        const result = srcComputeSingleProjectResult(state, uniqueKeys[0], { applyAddons: false });
        const projectLabel = `Projekt: ${result.projectName || srcGetProjectName(uniqueKeys[0])}`;
        const headerMeta = srcBuildLicenseMetaMarkup([projectLabel]);
        const addons = srcComputeGlobalAddons(state, uniqueKeys);
        const addonMarkup = srcBuildGlobalAddonMarkup(addons);
        const final = result.final.map((value, idx) => value + addons.rangeAdd[idx]);
        const info = result.info.concat(addons.info || []);
        let breakdown = result.breakdown;
        if(breakdown) {
            breakdown.steps = breakdown.steps.concat(addons.breakdownSteps || []);
            breakdown.final = {
                min: (breakdown.final.min || 0) + addons.rangeAdd[0],
                mid: (breakdown.final.mid || 0) + addons.rangeAdd[1],
                max: (breakdown.final.max || 0) + addons.rangeAdd[2]
            };
        }
        const combined = {
            final,
            info,
            licenseText: `${headerMeta}${result.licenseText}${addonMarkup}`,
            breakdown,
            licMeta: result.licMeta
        };
        return srcApplyAdvancedAdjustments(combined, state);
    }
    let final = [0,0,0];
    let info = [];
    const projectNames = uniqueKeys.map(key => srcGetProjectName(key));
    const headerMeta = srcBuildLicenseMetaMarkup([`Projekt(e): ${projectNames.join(' + ')}`]);
    const licenseSections = [];
    uniqueKeys.forEach((key) => {
        const result = srcComputeSingleProjectResult(state, key, { applyAddons: false });
        final = final.map((value, idx) => value + (result.final[idx] || 0));
        info.push({ label: `Projektblock: ${result.projectName || srcGetProjectName(key)}`, amount: '', formula: '', tone: 'muted' });
        info = info.concat(result.info || []);
        licenseSections.push(`<div class="src-license-project">${result.projectName || srcGetProjectName(key)}</div>${result.licenseText}`);
    });
    const addons = srcComputeGlobalAddons(state, uniqueKeys);
    const addonMarkup = srcBuildGlobalAddonMarkup(addons);
    final = final.map((value, idx) => value + addons.rangeAdd[idx]);
    info = info.concat(addons.info || []);
    const combined = {
        final,
        info,
        licenseText: `${headerMeta}${licenseSections.join('')}${addonMarkup}`,
        breakdown: null,
        licMeta: []
    };
    return srcApplyAdvancedAdjustments(combined, state);
}

window.srcCalc = function() {
    const genre = document.getElementById('src-genre').value;
    const finalFeeWrap = document.getElementById('src-final-fee-wrapper');
    const state = srcGetStateFromUI();

    if(!genre) {
        const breakdownBox = document.getElementById('src-calc-breakdown');
        srcToggleCollapse(breakdownBox, false);
        updateMainAmountAnimated("0 €");
        srcUpdateMeanValue(
            document.getElementById('src-mean-fade'),
            document.getElementById('src-display-range'),
            "Bitte Projekt wählen.."
        );
        srcPulseTargets(['.src-result-card', '.src-price-main-box']);
        document.getElementById('src-license-text').classList.remove('hidden');
        const licSection = document.getElementById('src-license-section');
        if(licSection) licSection.classList.remove('is-open');
        if(finalFeeWrap) finalFeeWrap.style.display = 'none'; // Hide if no genre
        currentBreakdownData = null;
        currentRiskChecks = [];
        srcRenderBreakdown(null);
        srcRenderRiskChecks([]);
        renderCompareView();
        srcUpdateSidebarCollapse();
        updateLicenseMetaText(state);
        srcSaveStateToStorage();
        return;
    }
    
    // Show Final Fee Field with Fade In if not already visible
    if(finalFeeWrap && finalFeeWrap.classList.contains('src-hidden-initially')) {
        finalFeeWrap.classList.remove('src-hidden-initially');
        finalFeeWrap.style.display = 'block';
        finalFeeWrap.classList.add('src-fade-in');
    }

    const breakdownBox = document.getElementById('src-calc-breakdown');
    srcToggleCollapse(breakdownBox, true);
    const result = srcComputeResult(state);
    const final = result.final;
    const info = result.info;
    const licText = result.licenseText;
    currentBreakdownData = result.breakdown;
    currentRiskChecks = srcBuildRiskChecks(state);

    const sliderLabel = document.getElementById('src-slider-val');
    if(sliderLabel) {
        sliderLabel.innerText = srcGetDurationLabel(state.duration);
    }
    srcUpdateDurationSliderFill();
    updateLicenseMetaText(state);

    updateMainAmountAnimated(`${final[0]} - ${final[2]} €`);
    srcUpdateMeanValue(
        document.getElementById('src-mean-fade'),
        document.getElementById('src-display-range'),
        `Ø Mittelwert: ${final[1]} €`
    );
    srcPulseTargets(['.src-result-card', '.src-price-main-box']);
    
    srcRenderPriceDetails(info, state, result);
    
    dynamicLicenseText = licText;
    const regionLabel = ({regional:'Regional', national:'National', dach:'DACH', world:'Weltweit'})[state.region] || '—';
    const durationLabel = ({1:'1 Jahr', 2:'2 Jahre', 3:'3 Jahre', 4:'Unlimited'})[state.duration] || '—';
    const projectName = state.layoutMode ? 'Layout / Pitch' : srcGetProjectName(state.projectKey);
    const linkedProjectNames = Array.from(new Set((state.linkedProjects || []).map(srcGetProjectName).filter(Boolean)));
    const projectLabel = linkedProjectNames.length ? `${projectName} (+ ${linkedProjectNames.join(', ')})` : projectName;
    const guidancePlain = (result.guidanceText || dynamicLicenseText || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const licenseMatch = guidancePlain.match(/Lizenzen?\s*:\s*([^\.\n]+)/i);
    let licenseLabel = licenseMatch ? licenseMatch[1] : guidancePlain;
    licenseLabel = licenseLabel
        .replace(/\bim\s+gewählten\s+Gebiet\b/gi, '')
        .replace(/\b(Laufzeit|Gebiet)\s*:\s*.*$/gi, '')
        .replace(/\b(regional|national|dach|weltweit|unlimited|1\s*jahr|2\s*jahre|3\s*jahre)\b/gi, '')
        .replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, '')
        .trim();
    if(!licenseLabel) {
        licenseLabel = 'laut Auswahl';
    }
    const licenseHtml = `
        <ul class="src-license-list">
            <li><strong>Projekt:</strong> ${projectLabel || '—'}</li>
            <li><strong>Lizenz:</strong> ${licenseLabel}</li>
            <li><strong>Gebiet:</strong> ${regionLabel}</li>
            <li><strong>Laufzeit:</strong> ${durationLabel}</li>
        </ul>
    `;
    const licBox = document.getElementById('src-license-text');
    const licSection = document.getElementById('src-license-section');
    licBox.innerHTML = licenseHtml;
    licBox.classList.remove('hidden');
    licBox.style.display = '';
    if(licSection) srcToggleCollapse(licSection, true);

    currentResult = { low: final[0], mid: final[1], high: final[2] };
    window.srcBreakdown = info;
    srcRenderBreakdown(currentBreakdownData);
    srcRenderRiskChecks(currentRiskChecks);
    renderCompareView();
    if(packagesState) {
        srcRenderPackages();
    }
    srcValidateFinalFee(); 
    srcUpdateSidebarCollapse();
    srcSaveStateToStorage();
}

window.srcGeneratePDFv6 = function(options = {}) {
    if(!window.jspdf || !window.jspdf.jsPDF) {
        console.error('SRC: jsPDF nicht verfügbar.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const lang = options.lang || 'de';
    const i18n = SRC_I18N[lang] || SRC_I18N.de;
    const pricingMode = options.pricingMode || 'range';
    const selectedPackage = options.selectedPackage || 'standard';
    const includeBreakdown = Boolean(options.includeBreakdown);
    const includeRisk = Boolean(options.includeRisk);
    const extraSettings = options.extraSettings || {};

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const columnGap = 10;
    const columnWidth = (pageWidth - (margin * 2) - columnGap) / 2;
    const leftX = margin;
    const rightX = margin + columnWidth + columnGap;
    let currentY = 18;

    const state = srcGetStateFromUI();
    const result = srcComputeResult(state);
    const projectName = state.layoutMode ? "Layout / Pitch (Intern)" : srcGetProjectName(state.projectKey);
    const linkedProjectNames = Array.from(new Set((state.linkedProjects || []).map(srcGetProjectName).filter(Boolean)));
    const projectLabel = linkedProjectNames.length ? `${projectName} (+ ${linkedProjectNames.join(', ')})` : projectName;

    let priceLabel = i18n.pricingRange;
    let priceValue = result.final[1];
    let rangeText = `${result.final[0]}–${result.final[2]} €`;
    let packageLabel = '';
    if(pricingMode === 'mean') {
        priceLabel = i18n.pricingMean;
    }
    if(pricingMode === 'package') {
        if(!packagesState) {
            packagesState = srcBuildPackages(state);
        }
        const pkg = packagesState[selectedPackage] || packagesState.standard;
        priceLabel = i18n.pricingPackage;
        priceValue = parseFloat(pkg.price) || 0;
        packageLabel = pkg.label;
    }

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(lang === 'en' ? 'Offer' : 'Angebot', margin, currentY);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`${i18n.dateLabel}: ${new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE')}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 10;

    const providerLines = [
        'Sprecherleistung / Voice-Over',
        'Kontakt: auf Anfrage',
        'Adresse / USt-ID: optional'
    ];
    const customerType = extraSettings.customerType
        ? (extraSettings.customerType === 'agency' ? i18n.customerTypeAgency : i18n.customerTypeDirect)
        : '';
    const customerLines = [
        extraSettings.projectName ? `Projekt: ${extraSettings.projectName}` : `Projekt: ${projectLabel}`,
        customerType ? `${i18n.customerTypeLabel}: ${customerType}` : '',
        extraSettings.offerId ? `${i18n.offerNumberLabel}: ${extraSettings.offerId}` : '',
        extraSettings.validity ? `${i18n.validity}: ${extraSettings.validity}` : ''
    ].filter(Boolean);

    const drawInfoBlock = (title, lines, x, y) => {
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(title, x, y);
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const text = doc.splitTextToSize(lines.join('\n'), columnWidth);
        doc.text(text, x, y + 5);
        return y + 5 + (text.length * 4);
    };

    const leftEndY = drawInfoBlock(lang === 'en' ? 'Provider' : 'Anbieter', providerLines, leftX, currentY);
    const rightEndY = drawInfoBlock(lang === 'en' ? 'Client' : 'Kunde', customerLines, rightX, currentY);
    currentY = Math.max(leftEndY, rightEndY) + 8;

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${i18n.subjectLabel}: ${i18n.subject}`, margin, currentY);
    currentY += 6;
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const introLines = doc.splitTextToSize(i18n.intro, pageWidth - (margin * 2));
    doc.text(introLines, margin, currentY);
    currentY += introLines.length * 4 + 4;

    const scopeText = extraSettings.scope && extraSettings.scope.length ? `Lieferumfang: ${extraSettings.scope.join(', ')}` : '';
    const advancedSummary = srcBuildAdvancedSummary(state);
    const advancedBlock = advancedSummary.projectLines.length
        ? `Erweitert:\n- ${advancedSummary.projectLines.join('\n- ')}`
        : '';
    const descriptionLines = [
        `${projectLabel}`,
        packageLabel ? `Paket: ${packageLabel}` : '',
        scopeText,
        advancedBlock
    ].filter(Boolean).join('\n');
    const positionRows = [
        [
            '1',
            pricingMode === 'range' ? `${descriptionLines}\nPreisrahmen: ${rangeText}` : descriptionLines,
            '1',
            `${priceValue} €`,
            pricingMode === 'range' ? rangeText : `${priceValue} €`
        ]
    ];

    if(typeof doc.autoTable === 'function') {
        doc.autoTable({
            startY: currentY,
            head: [['Pos.', 'Beschreibung', 'Menge', 'Einzel', 'Gesamt']],
            body: positionRows,
            theme: 'grid',
            headStyles: { fillColor: [26, 147, 238], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 90 },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 25, halign: 'right' }
            }
        });
    }

    currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : currentY + 24;

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(lang === 'en' ? 'Rights & Licenses' : 'Nutzungsrechte & Lizenzen', margin, currentY);
    currentY += 5;
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    const rightsLines = [];
    if(['tv','online_paid','radio','cinema','pos'].includes(state.projectKey)) {
        const regionLabel = state.region === 'regional' ? 'Regional' : state.region === 'national' ? 'National' : state.region === 'dach' ? 'DACH' : 'Weltweit';
        rightsLines.push(`Gebiet: ${regionLabel}`);
        rightsLines.push(`Laufzeit: ${state.duration === 4 ? 'Unlimited' : `${state.duration} ${state.duration === 1 ? 'Jahr' : 'Jahre'}`}`);
    }
    if(linkedProjectNames.length) {
        rightsLines.push(`Verknüpfte Projekte: ${linkedProjectNames.join(', ')}`);
    }
    const addons = [];
    if(state.packageOnline) addons.push('Online Audio');
    if(state.packageAtv) addons.push('ATV/CTV');
    if(state.licenseSocial) addons.push('Social Media');
    if(state.licenseEvent) addons.push('Event / Messe / POS');
    if(state.licenseInternal) addons.push('Interne Nutzung (Intranet)');
    if(addons.length) rightsLines.push(`Zusatz: ${addons.join(', ')}`);
    if(advancedSummary.rightsLines.length) {
        rightsLines.push(`Konditionen: ${advancedSummary.rightsLines.join(' · ')}`);
    }
    const cleanLicenseText = srcStripHTML(dynamicLicenseText);
    if(cleanLicenseText) rightsLines.push(cleanLicenseText);
    doc.text(doc.splitTextToSize(rightsLines.join('\n'), pageWidth - (margin * 2)), margin, currentY);
    currentY += rightsLines.length * 4 + 10;

    const summaryX = pageWidth - margin - 70;
    let summaryY = currentY;
    const subtotal = pricingMode === 'package' ? priceValue : result.final[1];
    const discountPct = state.discountToggle ? state.discountPct : 0;
    const discountedFrom = discountPct > 0 ? Math.round(subtotal / (1 - (discountPct / 100))) : subtotal;
    const discountAmount = discountPct > 0 ? discountedFrom - subtotal : 0;
    const totalLabel = pricingMode === 'range' ? rangeText : `${subtotal} €`;

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(lang === 'en' ? 'Summary' : 'Summen', summaryX, summaryY);
    summaryY += 5;
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Zwischensumme', summaryX, summaryY);
    doc.text(pricingMode === 'range' ? rangeText : `${discountedFrom} €`, pageWidth - margin, summaryY, { align: 'right' });
    summaryY += 4.5;
    if(discountPct > 0) {
        doc.text(`Rabatt (${discountPct}%)`, summaryX, summaryY);
        doc.text(`-${discountAmount} €`, pageWidth - margin, summaryY, { align: 'right' });
        summaryY += 4.5;
    }
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(lang === 'en' ? 'Total (net)' : 'Gesamt (Netto)', summaryX, summaryY);
    doc.text(totalLabel, pageWidth - margin, summaryY, { align: 'right' });
    summaryY += 6;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(i18n.assumptions, summaryX, summaryY);

    currentY = Math.max(currentY, summaryY + 8);

    if(includeBreakdown && currentBreakdownData) {
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(i18n.breakdown, margin, currentY);
        currentY += 5;
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const breakdownLines = [
            `Basis: ${currentBreakdownData.base.mid} € (${currentBreakdownData.base.min}–${currentBreakdownData.base.max} €)`
        ].concat(currentBreakdownData.steps.map(step => `${srcStripHTML(step.label)}: ${srcStripHTML(step.amountOrFactor)}`));
        doc.text(doc.splitTextToSize(breakdownLines.join('\n'), pageWidth - (margin * 2)), margin, currentY);
        currentY += breakdownLines.length * 4 + 6;
    }

    if(includeRisk && currentRiskChecks.length) {
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(i18n.risks, margin, currentY);
        currentY += 5;
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(doc.splitTextToSize(currentRiskChecks.map(check => `- ${srcStripHTML(check.text)}`).join('\n'), pageWidth - (margin * 2)), margin, currentY);
        currentY += currentRiskChecks.length * 4 + 6;
    }

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(lang === 'en' ? 'Payment: 14 days net · Thank you for your trust.' : 'Zahlungsziel: 14 Tage netto · Vielen Dank für Ihr Vertrauen.', margin, pageHeight - 12);

    doc.save('Gagen_Angebot.pdf');
}
