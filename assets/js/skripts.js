/* Smart Rate Calculator V7 Logic */

// Globale Variablen für State-Management
let srcRatesData = {}; 
let calculatedMinutes = 0;
let currentResult = { low:0, mid:0, high:0 };
let dynamicLicenseText = "";

document.addEventListener('DOMContentLoaded', () => { 
    // DATEN IMPORTIEREN (Vom PHP übergeben)
    if(typeof srcPluginData !== 'undefined' && srcPluginData.rates) {
        srcRatesData = srcPluginData.rates;
    } else {
        console.error("SRC: Keine Preisdaten geladen.");
    }

    // Initial state logic
    const ownStudio = document.getElementById('src-own-studio');
    const discountTog = document.getElementById('src-discount-toggle');
    const expressTog = document.getElementById('src-express-toggle');
    
    if(ownStudio) toggleElement('src-studio-wrap', ownStudio.checked);
    if(discountTog) toggleElement('src-discount-wrap', discountTog.checked);
    if(expressTog) toggleElement('src-express-wrap', expressTog.checked);
    
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
});

/* --- HELPER FUNCTIONS --- */

window.toggleElement = function(id, show) {
    const el = document.getElementById(id);
    if(!el) return;
    if(show) { el.classList.add('open'); if(id.includes('mod')) el.classList.add('with-margin'); } 
    else { el.classList.remove('open'); el.classList.remove('with-margin'); }
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
    toggleElement('src-studio-wrap', false);
    toggleElement('src-express-wrap', false);
    toggleElement('src-discount-wrap', false);
    
    const licBox = document.getElementById('src-license-text');
    const licSection = document.getElementById('src-license-section');
    licBox.innerHTML = '';
    licBox.classList.remove('hidden');
    licBox.style.display = 'none';
    if(licSection) licSection.classList.add('src-hidden');
    
    srcUIUpdate();
    srcCalc();
}

window.srcUIUpdate = function() {
    const genre = document.getElementById('src-genre').value;
    const layoutMode = document.getElementById('src-layout-mode').checked;
    const hasGenre = genre !== "";

    // TOGGLE GLOBAL SETTINGS VISIBILITY
    const glob = document.getElementById('src-global-settings');
    if(hasGenre) glob.classList.add('active'); else glob.classList.remove('active');
    
    if(layoutMode) {
        toggleElement('mod-ads', false); toggleElement('mod-image', false); toggleElement('mod-phone', false);
        toggleElement('mod-extra-ads', false);
    } else {
        toggleElement('mod-ads', ['tv','online_paid','radio','cinema','pos'].includes(genre));
        toggleElement('mod-image', ['imagefilm','explainer','app'].includes(genre));
        toggleElement('mod-phone', genre === 'phone');
        toggleElement('mod-extra-ads', ['tv','online_paid','radio','cinema','pos'].includes(genre));
        
        toggleElement('src-pkg-online-wrap', genre === 'radio');
        toggleElement('src-pkg-atv-wrap', genre === 'online_paid');
    }
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
    toggleElement('src-studio-wrap', document.getElementById('src-own-studio').checked);
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

    if(!genre) {
        document.getElementById('src-calc-breakdown').style.display = 'none';
        document.getElementById('src-display-total').innerText = "0 €";
        document.getElementById('src-display-range').innerText = "Bitte Projekt wählen..";
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
        licParts.push("Nur interne Nutzung / Pitch (Keine Veröffentlichung)");
    } else {
        licParts.push("Projekt: " + data.name);

        // ADS
        if(['tv','online_paid','radio','cinema','pos'].includes(genre)) {
            base = [...data.base];
            base = base.map(v => Math.round(v * langFactor));
            
            info.push(`Basisgage (${data.name}${langLabel}): <strong>${base[1]} €</strong>`);

            const region = document.querySelector('input[name="region"]:checked').value;
            let regionMult = 1.0;
            if(region === 'regional') { regionMult = 0.8; info.push(`Gebiet: Regional (x0.8): <strong style="color:green">-${Math.round(base[1]*0.2)} €</strong>`); }
            if(region === 'national') { info.push("Gebiet: National (Basis)"); }
            if(region === 'dach') { regionMult = 2.5; info.push(`Gebiet: DACH (x2.5): <strong>+${Math.round(base[1]*1.5)} €</strong>`); }
            if(region === 'world') { regionMult = 4.0; info.push(`Gebiet: Weltweit (x4.0): <strong>+${Math.round(base[1]*3.0)} €</strong>`); }
            
            const years = parseInt(document.getElementById('src-time-slider').value);
            const sliderLabel = document.getElementById('src-slider-val');
            
            let timeMult = 1;
            if(years === 4) { 
                sliderLabel.innerText = "Unlimited";
                timeMult = 4; 
                let intermediate = base[1] * regionMult;
                info.push(`Laufzeit: Unlimited (x4.0): <strong>+${Math.round(intermediate*3)} €</strong>`); 
                licParts.push("Unlimited");
            } else {
                sliderLabel.innerText = years + (years === 1 ? " Jahr" : " Jahre");
                timeMult = years;
                let intermediate = base[1] * regionMult;
                if(years > 1) { info.push(`Laufzeit: ${years} Jahre (x${years}.0): <strong>+${Math.round(intermediate*(years-1))} €</strong>`); }
                else { info.push("Laufzeit: 1 Jahr"); }
                licParts.push(years + " Jahr(e)");
            }

            if(genre === 'radio' && document.getElementById('src-pkg-online').checked) {
                base = base.map(v => Math.round(v * 1.6));
                info.push("Paket: + Online Audio (x1.6)"); licParts.push("inkl. Online Audio");
            }
            if(genre === 'online_paid' && document.getElementById('src-pkg-atv').checked) {
                base = base.map(v => Math.round(v * 1.6));
                info.push("Paket: + ATV/CTV (x1.6)"); licParts.push("inkl. ATV/CTV");
            }

            final = base.map(v => Math.round(v * regionMult * timeMult));

            if(document.getElementById('src-cutdown').checked) {
                let oldMid = final[1];
                final = final.map(v => Math.round(v * 0.5));
                info.push(`Cut-down (50%): <strong style="color:green">-${oldMid - final[1]} €</strong>`);
                licParts.push("Typ: Cut-down");
            }
        } 
        // PHONE
        else if(genre === 'phone') {
            final = data.base.map(v => Math.round(v * langFactor));
            const modules = parseInt(document.getElementById('src-phone-count').value) || 1;
            info.push(`Pauschale (bis 3 Module${langLabel}): <strong>${final[1]} €</strong>`);
            if(modules > 3) {
                let ex = modules - 3; let cost = ex * data.extra[1];
                final[0] += ex * data.extra[0]; final[1] += cost; final[2] += ex * data.extra[2];
                info.push(`+ ${ex} weitere Module: <strong>+${cost} €</strong>`);
            }
        }
        // UNPAID
        else if(['imagefilm','explainer','app'].includes(genre)) {
            let mins = Math.max(0.1, calculatedMinutes);
            let tier = data.tiers[0];
            if(mins > 2 && mins <= 5) tier = data.tiers[1];
            else if(mins > 5) tier = data.tiers[1];

            final = tier.p.map(v => Math.round(v * langFactor));
            info.push(`Basispreis (bis ${tier.limit} Min${langLabel}): <strong>${final[1]} €</strong>`);

            if(mins > 5) {
                const chunks = Math.ceil((mins - 5) / 5);
                let extraCost = chunks * data.extra[1];
                final[0] += chunks * data.extra[0]; final[1] += extraCost; final[2] += chunks * data.extra[2];
                info.push(`Überlänge (+ ${chunks}x 5 Min): <strong>+${extraCost} €</strong>`);
            }
            if(document.getElementById('src-lic-social').checked) { final = final.map(v => v + 150); info.push("Social Media: <strong>+150 €</strong>"); licParts.push("+ Social Media"); }
            if(document.getElementById('src-lic-event').checked) { final = final.map(v => v + 150); info.push("Event: <strong>+150 €</strong>"); licParts.push("+ Event"); }
        } 
        // CONTENT
        else {
            final = data.base.map(v => Math.round(v * langFactor));
            info.push(`Basis (Standard${langLabel}): <strong>${final[1]} €</strong>`);
        }
    }

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

    document.getElementById('src-display-total').innerText = `${final[0]} - ${final[2]} €`;
    document.getElementById('src-display-range').innerText = `Ø Mittelwert: ${final[1]} €`;
    
    // Add Cutdown Icon in Breakdown List if applicable
    const bd = document.getElementById('src-breakdown-list');
    const iconMatches = [
        { match: "Cut-down", icon: "dashicons-editor-cut" },
        { match: "Gebiet:", icon: "dashicons-location-alt" }
    ];
    bd.innerHTML = info.map(line => {
        const found = iconMatches.find(entry => line.includes(entry.match));
        if(found) {
            return `<div class="src-breakdown-row"><span><span class="dashicons ${found.icon}"></span> ${line}</span></div>`;
        }
        return `<div class="src-breakdown-row"><span>${line}</span></div>`;
    }).join('');
    
    dynamicLicenseText = "<strong>Enthaltene Nutzungsrechte:</strong><br>" + licParts.join(', ');
    const licBox = document.getElementById('src-license-text');
    const licSection = document.getElementById('src-license-section');
    
    if(licParts.length > 0 && !layoutMode) {
        licBox.innerHTML = dynamicLicenseText;
        licBox.classList.remove('hidden');
        if(licSection) licSection.classList.remove('src-hidden');
    } else {
        licBox.classList.add('hidden');
        if(licSection) licSection.classList.add('src-hidden');
    }

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
    if(cleanLicText && !layoutMode) {
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10); doc.setTextColor(0); 
        doc.text(doc.splitTextToSize(cleanLicText, 180), 15, finalY);
    }
    doc.save('Gagen_Angebot.pdf');
}
