"use strict";

// Run a feature and gives an error message if fails. Will not stop other features.
function runFeature(name, feature) {
    try {
        feature();
    } catch (error) {
        console.warn("Feature \"" + name + "\" could not start:", error);
    }
}

// Shared helper: runs a callback on load, scroll and resize, at most once per frame.
function onScrollOrResize(callback) {
    let waiting = false;

    function requestUpdate() {
        if (waiting) return;
        waiting = true;
        window.requestAnimationFrame(function () {
            waiting = false;
            callback();
        });
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    callback();
}

/* ==========================================================
   1. DARK / LIGHT MODE
   - Uses the visitor's saved choice, else their device setting
   - Saves the choice in localStorage (wrapped in try/catch,
     because storage can be blocked in private browsing)
   ========================================================== */

const THEME_KEY = "portfolio-theme";

function readSavedTheme() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        return saved === "light" || saved === "dark" ? saved : null;
    } catch (error) {
        return null;
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        // Storage unavailable: the theme still works for this visit.
    }
}

function applyTheme(theme, button) {
    document.documentElement.setAttribute("data-theme", theme);
    button.setAttribute("aria-pressed", String(theme === "dark"));
}

function initThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) return;

    const darkQuery = window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const deviceTheme = function () {
        return darkQuery && darkQuery.matches ? "dark" : "light";
    };

    let theme = readSavedTheme() || deviceTheme();
    applyTheme(theme, button);

    button.addEventListener("click", function () {
        theme = theme === "dark" ? "light" : "dark";
        applyTheme(theme, button);
        saveTheme(theme);
    });

    // If the visitor never chose a theme, follow their device when it changes.
    if (darkQuery && darkQuery.addEventListener) {
        darkQuery.addEventListener("change", function () {
            if (readSavedTheme()) return;
            theme = deviceTheme();
            applyTheme(theme, button);
        });
    }
}

/* ==========================================================
   2. SCREENSHOT LIGHTBOX
   - Click or press Enter/Space on a screenshot to enlarge it
   - Previous / Next buttons and arrow keys move through the
     screenshots of the same project
   - Esc, the Close button, or clicking outside closes it
   - Focus returns to the screenshot that opened it
   ========================================================== */

function initLightbox() {
    const dialog = document.getElementById("lightbox");
    const image = document.getElementById("lightbox-img");
    const caption = document.getElementById("lightbox-caption");
    const counter = document.getElementById("lightbox-counter");
    const closeButton = document.getElementById("lightbox-close");
    const prevButton = document.getElementById("lightbox-prev");
    const nextButton = document.getElementById("lightbox-next");
    const triggers = document.querySelectorAll(".screenshot-button");

    if (!dialog || !image || !triggers.length) return;

    let group = [];          // screenshot buttons of the current project
    let index = 0;           // shows which screenshot of the group is currently displayed
    let lastTrigger = null;  // where to return focus on close

    // show the screenshot at position i (wraps around at both ends)
    function showImage(i) {
        index = (i + group.length) % group.length;

        const thumbnail = group[index].querySelector("img");
        const figcaption = group[index].closest("figure")?.querySelector("figcaption");

        caption.textContent = figcaption ? figcaption.textContent : thumbnail.alt;
        counter.textContent = (index + 1) + " of " + group.length;
        image.alt = thumbnail.alt;
        image.src = thumbnail.src;
    }

    function openLightbox(trigger) {
        const article = trigger.closest("article");
        group = Array.from((article || document).querySelectorAll(".screenshot-button"));
        lastTrigger = trigger;

        // fallback to older browsers without <dialog>: open the image in a new tab instead
        if (typeof dialog.showModal !== "function") {
            window.open(trigger.querySelector("img").src, "_blank", "noopener");
            return;
        }

        // hide the arrows when the project only has one screenshot
        const hasMany = group.length > 1;
        prevButton.hidden = !hasMany;
        nextButton.hidden = !hasMany;

        showImage(group.indexOf(trigger));
        dialog.showModal();
        document.body.classList.add("no-scroll");
    }

    triggers.forEach(function (trigger) {
        trigger.addEventListener("click", function () { openLightbox(trigger); });
    });

    prevButton.addEventListener("click", function () { showImage(index - 1); });
    nextButton.addEventListener("click", function () { showImage(index + 1); });
    closeButton.addEventListener("click", function () { dialog.close(); });

    // arrow keys move between screenshots while the lightbox is open
    dialog.addEventListener("keydown", function (event) {
        if (group.length < 2) return;
        if (event.key === "ArrowLeft") showImage(index - 1);
        if (event.key === "ArrowRight") showImage(index + 1);
    });

    // click outside to close
    dialog.addEventListener("click", function (event) {
        if (event.target === dialog) dialog.close();
    });

    // runs however it was closed (button, Esc key or backdrop)
    dialog.addEventListener("close", function () {
        document.body.classList.remove("no-scroll");
        if (lastTrigger) lastTrigger.focus();
    });

    // messages if a screenshot file is missing or fails to load
    image.addEventListener("error", function () {
        caption.textContent = "Sorry, this screenshot could not be loaded.";
    });
}

/* ==========================================================
   3. ACTIVE NAVIGATION HIGHLIGHT
   - Marks the nav link of the section currently being read
   - Uses aria-current so screen readers get the same information
   - Scroll work is throttled with requestAnimationFrame
   ========================================================== */

function initActiveNav() {
    const links = Array.from(document.querySelectorAll("#nav-links a[href^='#']"));
    const sections = links
        .map(function (link) { return document.querySelector(link.getAttribute("href")); })
        .filter(Boolean);

    if (!sections.length) return;

    const header = document.querySelector("header");

    function update() {
        // a section counts as "current" once it passes this line on the screen
        const headerHeight = header ? header.offsetHeight : 0;
        const line = headerHeight + window.innerHeight * 0.25;

        let current = sections[0];
        sections.forEach(function (section) {
            if (section.getBoundingClientRect().top <= line) current = section;
        });

        // short last section: highlight it once the page is scrolled to the bottom
        const atBottom = window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 2;
        if (atBottom) current = sections[sections.length - 1];

        links.forEach(function (link) {
            if (link.getAttribute("href") === "#" + current.id) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    onScrollOrResize(update);
}

/* ==========================================================
   4. BACK-TO-TOP BUTTON
   - Appears after the visitor scrolls down a little
   - Scrolls to the top (smooth unless reduced motion is set in CSS)
   - Moves focus to the logo so keyboard users are not left
     on a button that has just disappeared
   ========================================================== */

function initBackToTop() {
    const button = document.getElementById("back-to-top");
    if (!button) return;

    const SHOW_AFTER = 600; // pixels scrolled before the button appears

    onScrollOrResize(function () {
        button.hidden = window.scrollY < SHOW_AFTER;
    });

    button.addEventListener("click", function () {
        window.scrollTo({ top: 0 });
        const logo = document.querySelector(".logo");
        if (logo) logo.focus({ preventScroll: true });
    });
}

/* ==========================================================
   5. COPY EMAIL TO CLIPBOARD
   - One click copies the address shown in the contact section
   - Announces the result in a live region for screen readers
   - Shows a helpful message if the clipboard is unavailable
   ========================================================== */

function initCopyEmail() {
    const button = document.getElementById("copy-email");
    const status = document.getElementById("copy-status");
    const emailLink = document.querySelector("#contact a[href^='mailto:']");

    if (!button || !status || !emailLink) return;

    let timer = null;

    function showStatus(message) {
        status.textContent = message;
        clearTimeout(timer);
        timer = setTimeout(function () { status.textContent = ""; }, 3000);
    }

    button.addEventListener("click", async function () {
        const email = emailLink.textContent.trim();
        try {
            await navigator.clipboard.writeText(email);
            showStatus("Email copied to clipboard.");
        } catch (error) {
            showStatus("Could not copy automatically. Please copy it manually.");
        }
    });
}

/* ==========================================================
   6. READING PROGRESS BAR
   - Thin bar under the header that fills as the visitor scrolls
   - Shows how far through the page they are
   - Purely visual, so it is hidden from screen readers in the HTML
   - Reuses the shared onScrollOrResize helper (once per frame)
   ========================================================== */

function initScrollProgress() {
    const bar = document.getElementById("scroll-progress");
    if (!bar) return;

    onScrollOrResize(function () {
        // total distance that can be scrolled (page height minus one screen)
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;

        // 0 = top of page, 1 = bottom of page (guards against a page too short to scroll)
        const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;

        bar.style.transform = "scaleX(" + progress + ")";
    });
}

/* ---------- Initialise ---------- */
// The script tag uses "defer", so the page is already parsed here.
runFeature("Dark mode", initThemeToggle);
runFeature("Lightbox", initLightbox);
runFeature("Active navigation", initActiveNav);
runFeature("Back to top", initBackToTop);
runFeature("Copy email", initCopyEmail);
runFeature("Scroll progress", initScrollProgress);