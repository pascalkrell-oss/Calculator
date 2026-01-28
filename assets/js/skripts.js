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
                'src-express-toggle',
                'src-cutdown',
                'src-discount-toggle'
            ].includes(target.id)) {
                srcCalc();
            }
        });
    }
    
    // Attach Tooltip events
    const tipEl = document.getElementById('src-tooltip-fixed');
    document.querySelectorAll('.src-tooltip-icon').forEach(icon => {
        icon.addEventListener('mouseenter', e => {
            const tipText = e.target.getAttribute('data-tip');
            if(!tipText) return;
            tipEl.innerText = tipText;
            tipEl.classList.add('is-visible');
            // Initial Pos
            const rect = e.target.getBoundingClientRect();
            tipEl.style.top = (rect.top - tipEl.offsetHeight - 10) + 'px';
            tipEl.style.left = (rect.left + (rect.width/2) - (tipEl.offsetWidth/2)) + 'px';
        });
        icon.addEventListener('mouseleave', () => tipEl.classList.remove('is-visible'));
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

    srcSyncExportTiles();
    srcUpdateExportPackageVisibility();
    updateStickyOffset();
    window.addEventListener('resize', updateStickyOffset);
    window.addEventListener('scroll', updateStickyOffset, { passive: true });

    // Erster UI Check
    srcUIUpdate();
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
    const hintsSection = document.querySelector('.src-sidebar-box--hints');
    const compareSection = document.querySelector('.src-sidebar-box--compare');
    const packagesSection = document.querySelector('.src-sidebar-box--packages');
    const hasPackages = Boolean(packagesState) && Object.keys(packagesState || {}).length > 0;
    calcRoot.classList.toggle('src-has-packages', hasPackages);
    srcToggleCollapse(hintsSection, hasProject);
    srcToggleCollapse(compareSection, hasProject && compareState.enabled);
    srcToggleCollapse(packagesSection, hasProject);
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
    return {
        projectKey: genre,
        language: document.getElementById('src-language').value,
        layoutMode: document.getElementById('src-layout-mode').checked,
        posType: document.getElementById('src-pos-type') ? document.getElementById('src-pos-type').value : 'pos_spot',
        region: regionInput ? regionInput.value : 'national',
        duration: parseInt(document.getElementById('src-time-slider').value, 10) || 1,
        packageOnline: document.getElementById('src-pkg-online') ? document.getElementById('src-pkg-online').checked : false,
        packageAtv: document.getElementById('src-pkg-atv') ? document.getElementById('src-pkg-atv').checked : false,
        licenseSocial: document.getElementById('src-lic-social') ? document.getElementById('src-lic-social').checked : false,
        licenseEvent: document.getElementById('src-lic-event') ? document.getElementById('src-lic-event').checked : false,
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
        finalFeeInput: parseFloat(document.getElementById('src-final-fee-user').value),
        complexitySelections
    };
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
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion) {
        const safeText = pendingMainAmountUpdate || lastValidMainAmountText || '–';
        target.textContent = safeText;
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
            target.textContent = safeText;
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
            target.textContent = safeText;
            finalize();
        }, 350);
    });
}

const srcUpdateMeanValue = function(wrapper, target, nextText) {
    if(!wrapper || !target) return;
    const current = target.textContent.trim();
    if(current === nextText.trim()) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion) {
        target.textContent = nextText;
        return;
    }
    wrapper.classList.add('is-updating');
    requestAnimationFrame(() => {
        target.textContent = nextText;
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

const srcRenderProjectTips = function(genre) {
    const tipsWrap = document.getElementById('src-project-tips');
    if(!tipsWrap) return;
    if(tipsWrap) tipsWrap.innerHTML = '';
    srcToggleCollapse(tipsWrap, false);
    if(!genre) {
        return;
    }
    const tips = (srcRatesData.project_tips && srcRatesData.project_tips[genre]) || [];
    const selectedTips = tips.slice(0, 3);
    if(selectedTips.length === 0) {
        return;
    }
    const markup = selectedTips.map(tip => (
        `<div class="src-tip-card"><span class="src-tip-card__icon">i</span><div>${tip}</div></div>`
    )).join('');
    tipsWrap.innerHTML = markup;
    srcToggleCollapse(tipsWrap, true);
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
    const list = document.getElementById('src-risk-list');
    if(!list) return;
    if(!checks || checks.length === 0) {
        list.innerHTML = '<div class="src-risk-item info">Keine besonderen Hinweise.</div>';
        return;
    }
    list.innerHTML = checks.map(check => `<div class="src-risk-item ${check.severity}">${check.text}</div>`).join('');
}

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
    list.innerHTML = Object.keys(packagesState).map(key => {
        const pkg = packagesState[key];
        return `
            <div class="src-package-card">
                <h4>${pkg.label}</h4>
                <div class="src-package-price">${srcFormatCurrency(pkg.price)}</div>
                <div class="src-package-meta">${pkg.meta.join(' · ')}</div>
                <div class="src-package-actions">
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
    const projectName = state.layoutMode ? "Layout / Pitch" : (srcRatesData[state.projectKey] ? srcRatesData[state.projectKey].name : state.projectKey);
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
    parts.push(`${i18n.project}: ${projectName}`);
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
    const addons = [];
    if(state.packageOnline) addons.push('Online Audio');
    if(state.packageAtv) addons.push('ATV/CTV');
    if(state.licenseSocial) addons.push('Social Media');
    if(state.licenseEvent) addons.push('Event / Messe / POS');
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
    
    // Reset Final Fee & Hide it
    document.getElementById('src-final-fee-user').value = '';
    const finalFeeWrap = document.getElementById('src-final-fee-wrapper');
    if(finalFeeWrap) {
        finalFeeWrap.style.display = 'none';
        finalFeeWrap.classList.add('src-hidden-initially');
        finalFeeWrap.classList.remove('src-fade-in');
    }
    srcValidateFinalFee(); 
    
    const toggles = ['src-layout-mode', 'src-own-studio', 'src-express-toggle', 'src-discount-toggle', 'src-cutdown', 'src-lic-social', 'src-lic-event', 'src-pkg-online', 'src-pkg-atv'];
    toggles.forEach(id => { const el = document.getElementById(id); if(el) el.checked = false; });
    
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
    const riskList = document.getElementById('src-risk-list');
    if(riskList) riskList.innerHTML = '';
    const calcRoot = document.getElementById('src-calc-v6');
    if(calcRoot) {
        calcRoot.classList.remove('src-compare-enabled');
        calcRoot.classList.remove('src-has-packages');
    }
    const breakdownBox = document.getElementById('src-calc-breakdown');
    if(breakdownBox) breakdownBox.classList.remove('is-open');
    
    srcUIUpdate();
    srcCalc();
}

window.srcUIUpdate = function() {
    const genre = document.getElementById('src-genre').value;
    const layoutMode = document.getElementById('src-layout-mode').checked;
    const hasGenre = Boolean(genre) && genre !== "0";
    const calcRoot = document.getElementById('src-calc-v6');

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
        toggleElement('mod-ads', ['tv','online_paid','radio','cinema','pos'].includes(genre));
        toggleElement('mod-image', ['imagefilm','explainer','app'].includes(genre));
        toggleElement('mod-phone', genre === 'phone');
        toggleElement('src-pos-type-wrap', genre === 'pos');
        
        toggleElement('src-pkg-online-wrap', genre === 'radio');
        toggleElement('src-pkg-atv-wrap', genre === 'online_paid');
    }
    srcUpdateCutdownVisibility(genre, layoutMode);
    srcSyncOptionRowStates();
    srcAnalyzeText();
    srcUpdateRightsSectionVisibility(genre, layoutMode);
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

const srcComputeResult = function(state) {
    const genre = state.projectKey;
    if(!genre) {
        return { final: [0,0,0], info: [], licenseText: "", breakdown: null, licMeta: [] };
    }
    const data = srcRatesData[genre];
    if(!data) {
        return { final: [0,0,0], info: [], licenseText: "", breakdown: null, licMeta: [] };
    }
    let base = [0,0,0];
    let final = [0,0,0];
    let info = [];
    let licParts = [];
    let licMeta = [];
    let licBaseText = "";
    let breakdownSteps = [];
    let breakdownBase = null;
    const lang = state.language;
    let langFactor = 1.0;
    let langLabel = "";
    if(lang === 'en') { langFactor = 1.3; langLabel = " (Englisch)"; }
    if(lang === 'other') { langFactor = 1.5; langLabel = " (Fremdsprache)"; }

    if(state.layoutMode) {
        final = [250, 300, 350];
        breakdownBase = { min: final[0], mid: final[1], max: final[2] };
        info.push("<strong>Pauschale Layout / Casting</strong>");
        info.push("Verwendung: Intern / Pitch");
        licBaseText = "Nur interne Nutzung / Pitch (Keine Veröffentlichung).";
    } else {
        licParts.push("Projekt: " + data.name);
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
            info.push(`Basisgage (${adName}${langLabel}): <strong>${base[1]} €</strong>`);

            const region = state.region;
            let regionMult = 1.0;
            if(region === 'regional') { regionMult = 0.8; info.push(`Gebiet: Regional (x0.8): <strong style="color:green">-${Math.round(base[1]*0.2)} €</strong>`); }
            if(region === 'national') { info.push("Gebiet: National (Basis)"); }
            if(region === 'dach') { regionMult = 2.5; info.push(`Gebiet: DACH (x2.5): <strong>+${Math.round(base[1]*1.5)} €</strong>`); }
            if(region === 'world') { regionMult = 4.0; info.push(`Gebiet: Weltweit (x4.0): <strong>+${Math.round(base[1]*3.0)} €</strong>`); }
            licMeta.push(`Gebiet: ${region === 'regional' ? 'Regional' : region === 'national' ? 'National' : region === 'dach' ? 'DACH' : 'Weltweit'}`);

            const years = state.duration;
            let timeMult = 1;
            if(years === 4) {
                timeMult = 4;
                let intermediate = base[1] * regionMult;
                info.push(`Laufzeit: Unlimited (x4.0): <strong>+${Math.round(intermediate*3)} €</strong>`);
                licParts.push("Unlimited");
                licMeta.push("Laufzeit: Unlimited");
            } else {
                timeMult = years;
                let intermediate = base[1] * regionMult;
                if(years > 1) { info.push(`Laufzeit: ${years} Jahre (x${years}.0): <strong>+${Math.round(intermediate*(years-1))} €</strong>`); }
                else { info.push("Laufzeit: 1 Jahr"); }
                licParts.push(years + " Jahr(e)");
                licMeta.push(`Laufzeit: ${years} ${years === 1 ? 'Jahr' : 'Jahre'}`);
            }
            breakdownSteps.push({ label: `Region`, amountOrFactor: `x${regionMult}`, effectOnRange: 'multiply' });
            breakdownSteps.push({ label: `Laufzeit`, amountOrFactor: `x${timeMult}`, effectOnRange: 'multiply' });

            if(genre === 'radio' && state.packageOnline) {
                base = base.map(v => Math.round(v * 1.6));
                breakdownSteps.push({ label: "Paket: Online Audio", amountOrFactor: "x1.6", effectOnRange: 'multiply' });
                info.push("Paket: + Online Audio (x1.6)"); licParts.push("inkl. Online Audio");
                licMeta.push("Paket: Online Audio");
            }
            if(genre === 'online_paid' && state.packageAtv) {
                base = base.map(v => Math.round(v * 1.6));
                breakdownSteps.push({ label: "Paket: ATV/CTV", amountOrFactor: "x1.6", effectOnRange: 'multiply' });
                info.push("Paket: + ATV/CTV (x1.6)"); licParts.push("inkl. ATV/CTV");
                licMeta.push("Paket: ATV/CTV");
            }

            final = base.map(v => Math.round(v * regionMult * timeMult));

            if(state.cutdown) {
                let oldMid = final[1];
                final = final.map(v => Math.round(v * 0.5));
                breakdownSteps.push({ label: "Cut-down", amountOrFactor: "x0.5", effectOnRange: 'multiply' });
                info.push(`Cut-down (50%): <strong style="color:green">-${oldMid - final[1]} €</strong>`);
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
            info.push(`Basispreis (${tierLabel}${langLabel}): <strong>${final[1]} €</strong>`);
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
                info.push(`Überlänge (+ ${extraConfig.chunks}x ${unitCount} ${unitSuffix}): <strong>+${extraCost} €</strong>`);
            }

            if(tierUnit === 'minutes' && state.hasScript && state.minutes > 0) {
                final = srcAdjustRangeForScript(final, true);
                breakdownSteps.push({ label: "Skript vorhanden", amountOrFactor: "Range enger", effectOnRange: 'adjust' });
            }

            const licenseExtras = data.license_extras || {};
            const socialExtra = srcGetLicenseExtraAmount(licenseExtras, 'social_organic');
            const eventExtra = srcGetLicenseExtraAmount(licenseExtras, 'event_pos');
            if(state.licenseSocial) {
                const extraRates = socialExtra || [150, 150, 150];
                final = final.map((v, idx) => v + extraRates[idx]);
                breakdownSteps.push({ label: "Social Media", amountOrFactor: `+${extraRates[1]} €`, effectOnRange: 'add' });
                info.push(`Social Media: <strong>+${extraRates[1]} €</strong>`);
                licParts.push("+ Social Media");
            }
            if(state.licenseEvent) {
                const extraRates = eventExtra || [150, 150, 150];
                final = final.map((v, idx) => v + extraRates[idx]);
                breakdownSteps.push({ label: "Event", amountOrFactor: `+${extraRates[1]} €`, effectOnRange: 'add' });
                info.push(`Event: <strong>+${extraRates[1]} €</strong>`);
                licParts.push("+ Event");
            }
        }
        else {
            const baseData = data.base || data.min;
            final = srcEnsurePriceTriple(baseData, final).map(v => Math.round(v * langFactor));
            breakdownBase = { min: final[0], mid: final[1], max: final[2] };
            info.push(`Basis (Standard${langLabel}): <strong>${final[1]} €</strong>`);
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
        const diffText = diff >= 0 ? `+${diff}` : `${diff}`;
        const diffColor = diff >= 0 ? '' : ' style="color:green"';
        info.push(`Produktion & Aufwand (x${factorLabel}): <strong${diffColor}>${diffText} €</strong>`);
    }

    if(state.licenseSocial) { licMeta.push("Zusatzlizenz: Social Media (organisch)"); }
    if(state.licenseEvent) { licMeta.push("Zusatzlizenz: Event / Messe / POS"); }

    if(state.studioFee > 0) {
        final = final.map(v => v + state.studioFee);
        breakdownSteps.push({ label: "Studiokosten", amountOrFactor: `+${state.studioFee} €`, effectOnRange: 'add' });
        info.push(`Studiokosten: <strong>+${state.studioFee} €</strong>`);
    }
    if(state.expressToggle) {
        const expressType = state.expressType;
        let expressFactor = (expressType === '4h') ? 1.0 : 0.5;
        let expressAmount = Math.round(final[1] * expressFactor);
        final = final.map(v => Math.round(v * (1 + expressFactor)));
        let eLabel = (expressType === '4h') ? "4h (+100%)" : "24h (+50%)";
        breakdownSteps.push({ label: `Express ${eLabel}`, amountOrFactor: `+${expressAmount} €`, effectOnRange: 'multiply' });
        info.push(`Express (${eLabel}): <strong>+${expressAmount} €</strong>`);
    }
    if(state.discountToggle && state.discountPct > 0) {
        let disc = Math.round(final[1] * (state.discountPct/100));
        final = final.map(v => Math.round(v * (1 - state.discountPct/100)));
        breakdownSteps.push({ label: `Rabatt ${state.discountPct}%`, amountOrFactor: `-${disc} €`, effectOnRange: 'add' });
        info.push(`Rabatt (${state.discountPct}%): <strong style="color:green">-${disc} €</strong>`);
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
    const extras = Object.assign({}, defaultGuidance.extras || {}, guidanceEntry.extras || {});
    const extrasText = [];
    if(state.licenseSocial && extras.social_organic) {
        extrasText.push(extras.social_organic);
    }
    if(state.licenseEvent && extras.event_pos) {
        extrasText.push(extras.event_pos);
    }
    const extraBlock = extrasText.length ? `<br><span class="src-license-extras">${extrasText.join(' ')}</span>` : "";
    const licMetaText = licMeta.length ? `<br><span class="src-license-meta">${licMeta.join(' · ')}</span>` : "";
    const licenseText = `${guidanceText || ""}${extraBlock}${licMetaText}`;
    return {
        final,
        info,
        licenseText,
        breakdown,
        licMeta
    };
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
        sliderLabel.innerText = state.duration === 4 ? "Unlimited" : `${state.duration} ${state.duration === 1 ? "Jahr" : "Jahre"}`;
    }

    updateMainAmountAnimated(`${final[0]} - ${final[2]} €`);
    srcUpdateMeanValue(
        document.getElementById('src-mean-fade'),
        document.getElementById('src-display-range'),
        `Ø Mittelwert: ${final[1]} €`
    );
    
    // Add Cutdown Icon in Breakdown List if applicable
    const bd = document.getElementById('src-breakdown-list');
    const iconMatches = [
        { match: "Cut-down", icon: "dashicons-editor-cut" }
    ];
    bd.innerHTML = info.map(line => {
        const found = iconMatches.find(entry => line.includes(entry.match));
        const match = line.match(/^(.*)<strong[^>]*>(.*)<\/strong>$/);
        const labelText = match ? match[1].replace(/:\s*$/, '').trim() : line.replace(/<[^>]*>?/gm, '').trim();
        const valueText = match ? match[2].replace(/<\/?strong[^>]*>/g, '').trim() : '';
        const iconMarkup = found ? `<span class="dashicons ${found.icon}"></span>` : '';
        return `<div class="src-breakdown-row"><span class="src-breakdown-label">${iconMarkup}${labelText}</span>${valueText ? `<span class="src-breakdown-value">${valueText}</span>` : ''}</div>`;
    }).join('');
    
    dynamicLicenseText = licText;
    const licBox = document.getElementById('src-license-text');
    const licSection = document.getElementById('src-license-section');
    licBox.innerHTML = dynamicLicenseText;
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
}

window.srcGeneratePDFv6 = function(options = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const lang = options.lang || 'de';
    const i18n = SRC_I18N[lang] || SRC_I18N.de;
    const pricingMode = options.pricingMode || 'range';
    const selectedPackage = options.selectedPackage || 'standard';
    const includeBreakdown = Boolean(options.includeBreakdown);
    const includeRisk = Boolean(options.includeRisk);
    const extraSettings = options.extraSettings || {};

    doc.setFillColor(26, 147, 238);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(lang === 'en' ? 'Offer Overview' : 'Angebotsübersicht', 15, 17);
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text(`${i18n.dateLabel}: ${new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE')}`, 160, 17);

    const state = srcGetStateFromUI();
    const result = srcComputeResult(state);
    const projectName = state.layoutMode ? "Layout / Pitch (Intern)" : (srcRatesData[state.projectKey] ? srcRatesData[state.projectKey].name : state.projectKey);
    let priceLabel = i18n.pricingRange;
    let priceText = `${result.final[0]} € - ${result.final[2]} €`;
    if(pricingMode === 'mean') {
        priceLabel = i18n.pricingMean;
        priceText = `${result.final[1]} €`;
    }
    if(pricingMode === 'package') {
        if(!packagesState) {
            packagesState = srcBuildPackages(state);
        }
        const pkg = packagesState[selectedPackage] || packagesState.standard;
        priceLabel = i18n.pricingPackage;
        priceText = `${pkg.price} € (${pkg.label})`;
    }

    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text(`${i18n.project}: ${extraSettings.projectName ? `${extraSettings.projectName} - ` : ''}${projectName}`, 15, 40);
    doc.setFontSize(12);
    doc.setTextColor(26, 147, 238);
    doc.text(`${priceLabel}: ${priceText}`, 15, 50);
    doc.setFontSize(10);
    doc.setTextColor(50);
    let infoYOffset = 58;
    if(extraSettings.customerType) {
        const typeLabel = extraSettings.customerType === 'agency' ? i18n.customerTypeAgency : i18n.customerTypeDirect;
        doc.text(`${i18n.customerTypeLabel}: ${typeLabel}`, 15, infoYOffset);
        infoYOffset += 6;
    }
    if(extraSettings.offerId) {
        doc.text(`${i18n.offerNumberLabel}: ${extraSettings.offerId}`, 15, infoYOffset);
        infoYOffset += 6;
    }
    if(extraSettings.validity) {
        doc.text(`${i18n.validity}: ${extraSettings.validity}`, 15, infoYOffset);
        infoYOffset += 6;
    }
    if(extraSettings.scope && extraSettings.scope.length) {
        doc.text(`${i18n.scope}: ${extraSettings.scope.join(', ')}`, 15, infoYOffset);
    }

    const rows = (window.srcBreakdown || []).map(t => [t.replace(/<[^>]*>?/gm, '').replace(':', '')]);
    const tableStart = infoYOffset + 7;
    doc.autoTable({ startY: tableStart, head: [['Details']], body: rows, theme: 'grid', headStyles: { fillColor: [26, 147, 238] } });

    let currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 75;
    if(includeBreakdown && currentBreakdownData) {
        doc.setFontSize(11);
        doc.setTextColor(26, 147, 238);
        doc.text(i18n.breakdown, 15, currentY);
        currentY += 6;
        doc.setFontSize(9);
        doc.setTextColor(50);
        const breakdownLines = [
            `Basis: ${currentBreakdownData.base.mid} € (${currentBreakdownData.base.min}–${currentBreakdownData.base.max} €)`
        ].concat(currentBreakdownData.steps.map(step => `${step.label}: ${step.amountOrFactor}`));
        doc.text(doc.splitTextToSize(breakdownLines.join('\n'), 180), 15, currentY);
        currentY += breakdownLines.length * 4 + 6;
    }
    if(includeRisk && currentRiskChecks.length) {
        doc.setFontSize(11);
        doc.setTextColor(26, 147, 238);
        doc.text(i18n.risks, 15, currentY);
        currentY += 6;
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.text(doc.splitTextToSize(currentRiskChecks.map(check => `- ${check.text}`).join('\n'), 180), 15, currentY);
        currentY += currentRiskChecks.length * 4 + 6;
    }

    const cleanLicText = dynamicLicenseText.replace(/<br>/g, "\n").replace(/<strong>|<\/strong>/g, "");
    if(cleanLicText) {
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(doc.splitTextToSize(cleanLicText, 180), 15, currentY);
    }
    if(i18n.assumptions) {
        const noteY = currentY + 12;
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text(doc.splitTextToSize(i18n.assumptions, 180), 15, noteY);
    }
    doc.save('Gagen_Angebot.pdf');
}
