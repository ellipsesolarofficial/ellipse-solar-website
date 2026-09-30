// ============================
// Mobile Navigation
// ============================
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

document.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// ============================
// Header Scroll Effect
// ============================
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
});

// ============================
// Active Nav Link on Scroll
// ============================
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    const y = window.scrollY + 100;
    sections.forEach(s => {
        const link = document.querySelector('.nav__link[href="#' + s.id + '"]');
        if (link) {
            link.classList.toggle('active', y >= s.offsetTop && y < s.offsetTop + s.offsetHeight);
        }
    });
});

// ============================
// Scroll Reveal (no library needed)
// ============================
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target); // animate once only
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

revealElements.forEach(el => revealObserver.observe(el));

// ============================
// FAQ Accordion
// ============================
document.querySelectorAll('.faq__item').forEach(item => {
    item.querySelector('.faq__q').addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        document.querySelectorAll('.faq__item').forEach(i => i.classList.remove('active'));
        if (!isOpen) item.classList.add('active');
    });
});

// ============================
// Counter Animation
// ============================
const statsSection = document.querySelector('.stats');
let counted = false;

if (statsSection) {
    new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !counted) {
            counted = true;
            document.querySelectorAll('.stats__num').forEach(el => {
                const target = +el.dataset.target;
                const step = target / 50;
                let current = 0;
                const tick = () => {
                    current += step;
                    if (current < target) {
                        el.textContent = Math.ceil(current);
                        requestAnimationFrame(tick);
                    } else {
                        el.textContent = target;
                    }
                };
                tick();
            });
        }
    }, { threshold: 0.4 }).observe(statsSection);
}

// ============================
// Contact Form → WhatsApp Redirect
// ============================
document.getElementById('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;

    const name = form.name.value;
    const phone = form.phone.value;
    const pincode = form.pincode.value;
    const bill = form.bill.value;

    const message = `Hi Ellipse Solar,\n\nI am interested in solar installation.\n\nName: ${name}\nWhatsApp: ${phone}\nPincode: ${pincode}\nMonthly Bill: ${bill}\n\nPlease share details and a quote.`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/919216054155?text=${encoded}`, '_blank');
});

// ============================
// Popup Form → WhatsApp Redirect
// ============================
document.getElementById('popup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;

    const name = form.name.value;
    const phone = form.phone.value;
    const pincode = form.pincode.value;
    const bill = form.bill.value;

    const message = `Hi Ellipse Solar,\n\nI am interested in solar installation.\n\nName: ${name}\nWhatsApp: ${phone}\nPincode: ${pincode}\nMonthly Bill: ${bill}\n\nPlease share details and a quote.`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/919216054155?text=${encoded}`, '_blank');
    popupOverlay.classList.remove('active');
});

// ============================
// Solar Calculator
// Same sizing method as the sales quotation tool:
// domestic slab rates + 5.15 units per kW per day.
// ============================
const calcBill = document.getElementById('calc-bill');
const calcSlider = document.getElementById('calc-slider');
const calcBtn = document.getElementById('calc-btn');

const tariffSlabs = [
    { uptoUnits: 50, ratePerUnit: 4.75, fixedCharge: 150 },
    { uptoUnits: 150, ratePerUnit: 6.00, fixedCharge: 150 },
    { uptoUnits: 300, ratePerUnit: 7.25, fixedCharge: 200 },
    { uptoUnits: 500, ratePerUnit: 7.95, fixedCharge: 250 },
    { uptoUnits: 99999, ratePerUnit: 8.50, fixedCharge: 300 }
];
const surchargePerUnit = 1;
const unitsPerKWPerDay = 5.15;

function billFromUnits(totalUnits, freeUnits) {
    const billableUnits = freeUnits ? Math.max(0, totalUnits - 100) : totalUnits;
    let energyCharge = 0;
    let fixedCharge = 0;
    let remaining = billableUnits;
    let prevLimit = 0;

    for (const slab of tariffSlabs) {
        if (billableUnits <= slab.uptoUnits) {
            fixedCharge = slab.fixedCharge;
            break;
        }
    }

    for (const slab of tariffSlabs) {
        if (remaining <= 0) break;
        const slabUnits = Math.min(remaining, slab.uptoUnits - prevLimit);
        energyCharge += slabUnits * slab.ratePerUnit;
        remaining -= slabUnits;
        prevLimit = slab.uptoUnits;
    }

    return energyCharge + fixedCharge + billableUnits * surchargePerUnit;
}

function unitsFromBill(billAmount, freeUnits) {
    for (let units = 1; units <= 20000; units++) {
        if (billFromUnits(units, freeUnits) >= billAmount) return units;
    }
    return 20000;
}

function centerSubsidy(kw) {
    if (kw <= 1) return 30000;
    if (kw === 2) return 60000;
    return 78000;
}

function formatUnits(n) {
    return Math.round(n).toLocaleString('en-IN');
}

function calculateSavings() {
    const bill = Math.min(100000, Math.max(500, parseInt(calcBill.value, 10) || 3000));
    const freeUnits = document.querySelector('input[name="free-units"]:checked').value === 'yes';
    const monthlyUnits = unitsFromBill(bill, freeUnits);
    const dailyUnits = Math.round((monthlyUnits / 30) * 10) / 10;
    const exactKW = dailyUnits / unitsPerKWPerDay;
    const roundedKW = Math.min(50, Math.max(3, Math.ceil(exactKW)));
    const annualGeneration = Math.round(roundedKW * unitsPerKWPerDay * 365);

    document.getElementById('res-system').textContent = roundedKW + ' kW';
    document.getElementById('res-units').textContent = formatUnits(monthlyUnits) + ' units';
    document.getElementById('res-daily').textContent = dailyUnits + ' units/day';
    document.getElementById('res-annual').textContent = formatUnits(annualGeneration) + ' units';
    document.getElementById('res-subsidy').textContent = '₹' + centerSubsidy(roundedKW).toLocaleString('en-IN');
    document.getElementById('res-state').textContent = 'Up to ₹17,000';

    const note = document.getElementById('res-note');
    if (exactKW > 50) {
        note.textContent = 'This bill is above a 50 kW system, which is the largest standard size we quote. We will design anything larger after a site survey. Central subsidy applies to eligible residential DCR systems.';
    } else {
        note.textContent = 'Standard sizes run from 3 kW to 50 kW. Central subsidy applies to eligible residential DCR systems. A site survey fixes brand, phase, and final price.';
    }
}

calcSlider.addEventListener('input', () => { calcBill.value = calcSlider.value; calculateSavings(); });
calcBill.addEventListener('input', () => {
    const value = parseInt(calcBill.value, 10);
    if (!Number.isNaN(value)) calcSlider.value = Math.min(parseInt(calcSlider.max, 10), Math.max(parseInt(calcSlider.min, 10), value));
    calculateSavings();
});
document.querySelectorAll('input[name="free-units"]').forEach(input => {
    input.addEventListener('change', calculateSavings);
});
calcBtn.addEventListener('click', () => {
    calculateSavings();
    document.getElementById('calc-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ============================
// Popup (shows after 5 seconds)
// ============================
const popupOverlay = document.getElementById('popup-overlay');
const popupClose = document.getElementById('popup-close');

// Show popup after 5 seconds (only once per session)
if (!sessionStorage.getItem('popupShown')) {
    setTimeout(() => {
        popupOverlay.classList.add('active');
        sessionStorage.setItem('popupShown', 'true');
    }, 5000);
}

// Close popup
popupClose.addEventListener('click', () => {
    popupOverlay.classList.remove('active');
});

// Close on overlay click
popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) popupOverlay.classList.remove('active');
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') popupOverlay.classList.remove('active');
});

// ============================
// Smooth Scroll
// ============================
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// Solar field: outlined triangles gathered into an ellipse, plus a sparse drift.
const heroField = document.getElementById('hero-field');
if (heroField) {
    const ctx = heroField.getContext('2d');
    const colors = ['#8052ff', '#ffb829', '#15846e', '#c084fc', '#7aa2ff', '#f472b6'];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let particles = [];
    let width = 0;
    let height = 0;

    function layoutField() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = heroField.clientWidth;
        height = heroField.clientHeight;
        heroField.width = Math.max(1, Math.floor(width * dpr));
        heroField.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const cx = width * 0.74;
        const cy = height * 0.46;
        const rx = Math.min(width, height) * 0.34;
        const ry = rx * 0.78;
        const count = Math.max(80, Math.round((width * height) / 4200));
        particles = [];
        for (let i = 0; i < count; i++) {
            const inSun = Math.random() < 0.78;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.pow(Math.random(), 0.45);
            particles.push({
                x: inSun ? cx + Math.cos(angle) * rx * radius : Math.random() * width,
                y: inSun ? cy + Math.sin(angle) * ry * radius : Math.random() * height,
                size: (inSun ? 2.4 : 1.6) + Math.random() * 2.4,
                rot: Math.random() * Math.PI,
                spin: (Math.random() - 0.5) * 0.008,
                drift: (Math.random() - 0.5) * 0.12,
                color: colors[i % colors.length],
                alpha: inSun ? 0.4 + Math.random() * 0.55 : 0.12 + Math.random() * 0.28
            });
        }
    }

    function drawField() {
        ctx.clearRect(0, 0, width, height);
        for (const particle of particles) {
            if (!reduceMotion) {
                particle.rot += particle.spin;
                particle.y += particle.drift * 0.08;
            }
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rot);
            ctx.globalAlpha = particle.alpha;
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -particle.size);
            ctx.lineTo(particle.size * 0.9, particle.size * 0.58);
            ctx.lineTo(-particle.size * 0.9, particle.size * 0.58);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        if (!reduceMotion) requestAnimationFrame(drawField);
    }

    layoutField();
    drawField();
    window.addEventListener('resize', () => {
        layoutField();
        if (reduceMotion) drawField();
    });
}
