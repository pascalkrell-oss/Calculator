/* Smart Rate Calculator V7 Logic */

// Globale Variablen für State-Management
let srcRatesData = {}; 
let calculatedMinutes = 0;
let currentResult = { low:0, mid:0, high:0 };
let dynamicLicenseText = "";
let pendingMainAmountUpdate = null;
let mainAmountAnimationToken = 0;
let mainAmountFallbackTimer = null;
let lastValidMainAmountText = "";
let mainAmountExitListener = null;

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
            tipEl.innerText = e.target.getAttribute('data-tip');
            tipEl.classList.add('is-visible');
            // Initial Pos
            const rect = e.target.getBoundingClientRect();
            tipEl.style.top = (rect.top - tipEl.offsetHeight - 10) + 'px';
            tipEl.style.left = (rect.left + (rect.width/2) - (tipEl.offsetWidth/2)) + 'px';
        });
        icon.addEventListener('mouseleave', () => tipEl.classList.remove('is-visible'));
    });

    // Erster UI Check
    srcUIUpdate();
    srcAuditRatesAgainstVDS();
});

/* --- HELPER FUNCTIONS --- */

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
    const ignoreKeys = new Set(['rights_guidance', 'options_by_project']);
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
    row.style.display = allow ? '' : 'none';
    if(!allow) {
        const toggle = document.getElementById('src-cutdown');
        if(toggle && toggle.checked) {
            toggle.checked = false;
            srcSetOptionRowState(toggle);
        }
    }
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
    if(licSection) licSection.classList.add('src-hidden');
    
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
    if(document.getElementById('src-manual-time-check').checked) {
        let val = document.getElementById('src-manual-minutes').value;
        val = val.replace(',', '.');
        mins = parseFloat(val) || 0;
        document.getElementById('src-char-count').innerText = '-';
    } else {
        const txt = document.getElementById('src-text').value;
        const chars = txt.length;
        mins = chars / 900; 
        document.getElementById('src-char-count').innerText = chars;
    }
    const m = Math.floor(mins);
    const s = Math.round((mins - m) * 60);
    document.getElementById('src-min-count').innerText = `${m}:${s.toString().padStart(2,'0')}`;
    calculatedMinutes = mins;
    srcCalc();
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

window.srcCalc = function() {
    const genre = document.getElementById('src-genre').value;
    const finalFeeWrap = document.getElementById('src-final-fee-wrapper');
    const scriptText = document.getElementById('src-text').value || '';
    const hasScript = scriptText.trim().length > 0;

    if(!genre) {
        document.getElementById('src-calc-breakdown').style.display = 'none';
        updateMainAmountAnimated("0 €");
        srcUpdateMeanValue(
            document.getElementById('src-mean-fade'),
            document.getElementById('src-display-range'),
            "Bitte Projekt wählen.."
        );
        document.getElementById('src-license-text').classList.add('hidden');
        const licSection = document.getElementById('src-license-section');
        if(licSection) licSection.classList.add('src-hidden');
        if(finalFeeWrap) finalFeeWrap.style.display = 'none'; // Hide if no genre
        return;
    }
    
    // Show Final Fee Field with Fade In if not already visible
    if(finalFeeWrap && finalFeeWrap.classList.contains('src-hidden-initially')) {
        finalFeeWrap.classList.remove('src-hidden-initially');
        finalFeeWrap.style.display = 'block';
        finalFeeWrap.classList.add('src-fade-in');
    }

    document.getElementById('src-calc-breakdown').style.display = 'block';

    const data = srcRatesData[genre];
    if(!data) return; 

    let base = [0,0,0]; 
    let final = [0,0,0];
    let info = []; 
    let licParts = []; 
    let licMeta = [];
    let licBaseText = "";
    let studioFee = document.getElementById('src-own-studio').checked ? (parseInt(document.getElementById('src-studio-fee').value)||0) : 0;
    const layoutMode = document.getElementById('src-layout-mode').checked;
    
    const lang = document.getElementById('src-language').value;
    let langFactor = 1.0;
    let langLabel = "";
    if(lang === 'en') { langFactor = 1.3; langLabel = " (Englisch)"; }
    if(lang === 'other') { langFactor = 1.5; langLabel = " (Fremdsprache)"; }

    if(layoutMode) {
        final = [250, 300, 350]; 
        info.push("<strong>Pauschale Layout / Casting</strong>");
        info.push("Verwendung: Intern / Pitch");
        licBaseText = "Nur interne Nutzung / Pitch (Keine Veröffentlichung).";
    } else {
        licParts.push("Projekt: " + data.name);
        licBaseText = data.lic || "";

        // ADS
        if(['tv','online_paid','radio','cinema','pos'].includes(genre)) {
            let adName = data.name;
            let adBase = data.base;
            if(genre === 'pos') {
                const posTypeEl = document.getElementById('src-pos-type');
                const posType = posTypeEl ? posTypeEl.value : 'pos_spot';
                const variants = data.variants || {};
                const variant = variants[posType] || variants.pos_spot || variants.ladenfunk;
                if(variant) {
                    adName = variant.name || adName;
                    adBase = variant.base || adBase;
                    if(variant.lic) {
                        licBaseText = variant.lic;
                    }
                    licMeta.push(`POS Typ: ${variant.name || posType}`);
                }
            }
            base = srcEnsurePriceTriple(adBase, base);
            base = base.map(v => Math.round(v * langFactor));
            
            info.push(`Basisgage (${adName}${langLabel}): <strong>${base[1]} €</strong>`);

            const regionInput = document.querySelector('input[name="region"]:checked');
            const region = regionInput ? regionInput.value : 'national';
            let regionMult = 1.0;
            if(region === 'regional') { regionMult = 0.8; info.push(`Gebiet: Regional (x0.8): <strong style="color:green">-${Math.round(base[1]*0.2)} €</strong>`); }
            if(region === 'national') { info.push("Gebiet: National (Basis)"); }
            if(region === 'dach') { regionMult = 2.5; info.push(`Gebiet: DACH (x2.5): <strong>+${Math.round(base[1]*1.5)} €</strong>`); }
            if(region === 'world') { regionMult = 4.0; info.push(`Gebiet: Weltweit (x4.0): <strong>+${Math.round(base[1]*3.0)} €</strong>`); }
            licMeta.push(`Gebiet: ${region === 'regional' ? 'Regional' : region === 'national' ? 'National' : region === 'dach' ? 'DACH' : 'Weltweit'}`);
            
            const years = parseInt(document.getElementById('src-time-slider').value);
            const sliderLabel = document.getElementById('src-slider-val');
            
            let timeMult = 1;
            if(years === 4) { 
                sliderLabel.innerText = "Unlimited";
                timeMult = 4; 
                let intermediate = base[1] * regionMult;
                info.push(`Laufzeit: Unlimited (x4.0): <strong>+${Math.round(intermediate*3)} €</strong>`); 
                licParts.push("Unlimited");
                licMeta.push("Laufzeit: Unlimited");
            } else {
                sliderLabel.innerText = years + (years === 1 ? " Jahr" : " Jahre");
                timeMult = years;
                let intermediate = base[1] * regionMult;
                if(years > 1) { info.push(`Laufzeit: ${years} Jahre (x${years}.0): <strong>+${Math.round(intermediate*(years-1))} €</strong>`); }
                else { info.push("Laufzeit: 1 Jahr"); }
                licParts.push(years + " Jahr(e)");
                licMeta.push(`Laufzeit: ${years} ${years === 1 ? 'Jahr' : 'Jahre'}`);
            }

            if(genre === 'radio' && document.getElementById('src-pkg-online').checked) {
                base = base.map(v => Math.round(v * 1.6));
                info.push("Paket: + Online Audio (x1.6)"); licParts.push("inkl. Online Audio");
                licMeta.push("Paket: Online Audio");
            }
            if(genre === 'online_paid' && document.getElementById('src-pkg-atv').checked) {
                base = base.map(v => Math.round(v * 1.6));
                info.push("Paket: + ATV/CTV (x1.6)"); licParts.push("inkl. ATV/CTV");
                licMeta.push("Paket: ATV/CTV");
            }

            final = base.map(v => Math.round(v * regionMult * timeMult));

            if(document.getElementById('src-cutdown').checked) {
                let oldMid = final[1];
                final = final.map(v => Math.round(v * 0.5));
                info.push(`Cut-down (50%): <strong style="color:green">-${oldMid - final[1]} €</strong>`);
                licParts.push("Typ: Cut-down");
                licMeta.push("Typ: Cut-down");
            }
        } 
        // PHONE
        else if(Array.isArray(data.tiers)) {
            const tierUnit = data.tier_unit || 'minutes';
            const units = tierUnit === 'modules'
                ? (parseInt(document.getElementById('src-phone-count').value, 10) || 1)
                : Math.max(0.1, calculatedMinutes);
            const unitLabel = tierUnit === 'modules' ? 'Module' : 'Min';
            const tier = srcGetTierForUnits(data.tiers, units);
            const tierPrices = tier && tier.p ? tier.p : data.base;
            final = srcEnsurePriceTriple(tierPrices, final).map(v => Math.round(v * langFactor));
            const tierLimit = tier && typeof tier.limit === 'number' ? tier.limit : data.limit;
            const tierLabel = tierLimit ? `bis ${tierLimit} ${unitLabel}` : 'Basis';
            info.push(`Basispreis (${tierLabel}${langLabel}): <strong>${final[1]} €</strong>`);

            const extraConfig = srcGetExtraChunks(data, units, tierLimit, tierUnit === 'modules' ? 1 : 5);
            if(extraConfig.chunks > 0) {
                const extraRates = srcEnsurePriceTriple(data.extra, [0, 0, 0]);
                const extraCost = extraConfig.chunks * extraRates[1];
                final[0] += extraConfig.chunks * extraRates[0];
                final[1] += extraCost;
                final[2] += extraConfig.chunks * extraRates[2];
                const unitSuffix = tierUnit === 'modules' ? 'Modul' : 'Min';
                const unitCount = extraConfig.extraUnit || (tierUnit === 'modules' ? 1 : 5);
                info.push(`Überlänge (+ ${extraConfig.chunks}x ${unitCount} ${unitSuffix}): <strong>+${extraCost} €</strong>`);
            }

            if(tierUnit === 'minutes' && hasScript && calculatedMinutes > 0) {
                final = srcAdjustRangeForScript(final, true);
            }

            const licenseExtras = data.license_extras || {};
            const socialExtra = srcGetLicenseExtraAmount(licenseExtras, 'social_organic');
            const eventExtra = srcGetLicenseExtraAmount(licenseExtras, 'event_pos');
            if(document.getElementById('src-lic-social').checked) {
                const extraRates = socialExtra || [150, 150, 150];
                final = final.map((v, idx) => v + extraRates[idx]);
                info.push(`Social Media: <strong>+${extraRates[1]} €</strong>`);
                licParts.push("+ Social Media");
            }
            if(document.getElementById('src-lic-event').checked) {
                const extraRates = eventExtra || [150, 150, 150];
                final = final.map((v, idx) => v + extraRates[idx]);
                info.push(`Event: <strong>+${extraRates[1]} €</strong>`);
                licParts.push("+ Event");
            }
        }
        // CONTENT
        else {
            const baseData = data.base || data.min;
            final = srcEnsurePriceTriple(baseData, final).map(v => Math.round(v * langFactor));
            info.push(`Basis (Standard${langLabel}): <strong>${final[1]} €</strong>`);
        }
    }

    if(document.getElementById('src-lic-social').checked) { licMeta.push("Zusatzlizenz: Social Media (organisch)"); }
    if(document.getElementById('src-lic-event').checked) { licMeta.push("Zusatzlizenz: Event / Messe / POS"); }

    // ADD ONS
    if(studioFee > 0) {
        final = final.map(v => v + studioFee);
        info.push(`Studiokosten: <strong>+${studioFee} €</strong>`);
    }
    const expressToggle = document.getElementById('src-express-toggle').checked;
    if(expressToggle) {
        const expressType = document.getElementById('src-express-type').value;
        let expressFactor = (expressType === '4h') ? 1.0 : 0.5;
        let expressAmount = Math.round(final[1] * expressFactor);
        final = final.map(v => Math.round(v * (1 + expressFactor)));
        let eLabel = (expressType === '4h') ? "4h (+100%)" : "24h (+50%)";
        info.push(`Express (${eLabel}): <strong>+${expressAmount} €</strong>`);
    }

    // DISCOUNT
    const discountToggle = document.getElementById('src-discount-toggle').checked;
    const discountPct = parseFloat(document.getElementById('src-discount-percent').value) || 0;
    if(discountToggle && discountPct > 0) {
        let disc = Math.round(final[1] * (discountPct/100));
        final = final.map(v => Math.round(v * (1 - discountPct/100)));
        info.push(`Rabatt (${discountPct}%): <strong style="color:green">-${disc} €</strong>`);
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
        if(found) {
            return `<div class="src-breakdown-row"><span><span class="dashicons ${found.icon}"></span> ${line}</span></div>`;
        }
        return `<div class="src-breakdown-row"><span>${line}</span></div>`;
    }).join('');
    
    const rightsGuidance = srcRatesData.rights_guidance || {};
    const defaultGuidance = rightsGuidance.default || {};
    const guidanceEntry = rightsGuidance[layoutMode ? 'default' : genre] || defaultGuidance;
    let guidanceText = guidanceEntry.text || defaultGuidance.text || "";
    if(licBaseText && (layoutMode || !guidanceEntry.text || licBaseText !== (data.lic || ""))) {
        guidanceText = licBaseText;
    }
    if(!guidanceText) {
        guidanceText = "Nutzungsrechte abhängig von Verbreitungsgebiet, Dauer und Zusatzlizenzen. Bitte Projekt auswählen bzw. Konfiguration prüfen.";
    }
    const extras = Object.assign({}, defaultGuidance.extras || {}, guidanceEntry.extras || {});
    const extrasText = [];
    if(document.getElementById('src-lic-social').checked && extras.social_organic) {
        extrasText.push(extras.social_organic);
    }
    if(document.getElementById('src-lic-event').checked && extras.event_pos) {
        extrasText.push(extras.event_pos);
    }
    const extraBlock = extrasText.length ? `<br><span class="src-license-extras">${extrasText.join(' ')}</span>` : "";
    const licMetaText = licMeta.length ? `<br><span class="src-license-meta">${licMeta.join(' · ')}</span>` : "";
    dynamicLicenseText = `${guidanceText || ""}${extraBlock}${licMetaText}`;
    const licBox = document.getElementById('src-license-text');
    const licSection = document.getElementById('src-license-section');
    
    licBox.innerHTML = dynamicLicenseText;
    licBox.classList.remove('hidden');
    licBox.style.display = '';
    if(licSection) licSection.classList.remove('src-hidden');

    currentResult = { low: final[0], mid: final[1], high: final[2] };
    window.srcBreakdown = info;
    srcValidateFinalFee(); 
}

window.srcGeneratePDFv6 = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFillColor(26, 147, 238); doc.rect(0, 0, 210, 25, 'F');
    doc.setFontSize(20); doc.setTextColor(255, 255, 255); doc.text("Gagen-Kalkulation", 15, 17);
    doc.setFontSize(10); doc.setTextColor(50); doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 160, 17);

    const sel = document.getElementById('src-genre');
    const layoutMode = document.getElementById('src-layout-mode').checked;
    const title = layoutMode ? "Layout / Pitch (Intern)" : sel.options[sel.selectedIndex].text;
    
    // CHECK IF USER HAS FINAL FEE
    const userFee = parseFloat(document.getElementById('src-final-fee-user').value);
    const finalPriceDisplay = (userFee && !document.getElementById('src-final-fee-user').classList.contains('error')) ? userFee + ' €' : `${currentResult.low} € - ${currentResult.high} €`;

    doc.setTextColor(0); doc.setFontSize(14); doc.text(`Projekt: ${title}`, 15, 40);
    doc.setFontSize(12); doc.setTextColor(26, 147, 238); doc.text(`Kalkulation (Netto): ${finalPriceDisplay}`, 15, 50);

    const rows = (window.srcBreakdown || []).map(t => [t.replace(/<[^>]*>?/gm, '').replace(':', '')]);
    doc.autoTable({ startY: 60, head: [['Details']], body: rows, theme: 'grid', headStyles: { fillColor: [26, 147, 238] } });

    const cleanLicText = dynamicLicenseText.replace(/<br>/g, "\n").replace(/<strong>|<\/strong>/g, "");
    if(cleanLicText) {
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10); doc.setTextColor(0); 
        doc.text(doc.splitTextToSize(cleanLicText, 180), 15, finalY);
    }
    doc.save('Gagen_Angebot.pdf');
}
