// ==UserScript==
// @name         Neopets Igloo Daily Purchase Tracker
// @namespace    neopets-igloo-tracker
// @version      0.1
// @description  Track Garage Sale Igloo purchases per day
// @author       Safeira
// @match        https://www.neopets.com/winter/igloo.phtml*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DAILY_LIMIT = 10;
    const STORAGE_KEY = "iglooPurchaseLog";
    const NOTIFY_KEY = "iglooNotifySent";
    const NOTIFY_ENABLED_KEY = "iglooNotifyEnabled";
    const COLLAPSE_KEY = "iglooCollapsed";
    const MINIMIZED_KEY = "iglooMinimized";

    /***********************
     * NST DATE HELPERS
     ***********************/
    function getNSTDateParts() {
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Los_Angeles",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });

        const parts = formatter.formatToParts(new Date());
        const obj = {};
        parts.forEach(p => obj[p.type] = p.value);

        return {
            dateKey: `${obj.year}-${obj.month}-${obj.day}`,
            time: `${obj.hour}:${obj.minute}:${obj.second}`
        };
    }

    function getNSTNow() {
        return new Date(
            new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
        );
    }

    /***********************
     * STORAGE
     ***********************/
    function loadData() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    }

    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    /***********************
     * UI
     ***********************/
    function createTrackerPanel() {
        if (document.getElementById("igloo-tracker-panel")) return;

        const panel = document.createElement("div");
        panel.id = "igloo-tracker-panel";
        panel.innerHTML = `
            <div id="igloo-tracker-header" title="Click to collapse/expand items">
                Igloo Purchases
                <span id="igloo-minimize-btn" title="Minimize panel">−</span>
            </div>
            <select id="igloo-tracker-day"></select>
            <ul id="igloo-tracker-items"></ul>
            <div id="igloo-tracker-total"></div>
            <div id="igloo-tracker-reset"></div>
            <label id="igloo-notify-label">
                <input type="checkbox" id="igloo-notify-toggle">
                1-hour reset reminder
            </label>

        `;

        const style = document.createElement("style");
        style.textContent = `
            .item-line {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                align-items: center;
            }

            #igloo-tracker-panel {
                position: fixed;
                top: 80px;
                right: 15px;
                width: 300px;
                background: #ffffff;
                border: 1px solid #d3d3d3;
                border-radius: 10px;
                font-size: 13px;
                color: #222;
                z-index: 9999;
                box-shadow: 0 6px 16px rgba(0,0,0,0.18);
                font-family: Arial, sans-serif;
            }

            #igloo-tracker-header {
                background: #2c3e50;
                color: #fff;
                padding: 8px 10px;
                font-weight: 700;
                text-align: center;
                border-top-left-radius: 10px;
                border-top-right-radius: 10px;
                cursor: pointer;
                user-select: none;
                position: relative;
            }

            #igloo-minimize-btn {
                position: absolute;
                right: 10px;
                top: 7px;
                cursor: pointer;
                font-weight: 700;
                border: 1px solid rgba(255,255,255,0.35);
                padding: 0 7px;
                border-radius: 4px;
                line-height: 16px;
                background: rgba(255,255,255,0.12);
            }

            #igloo-minimize-btn:hover {
                background: rgba(255,255,255,0.22);
            }

            #igloo-tracker-day {
                width: calc(100% - 16px);
                margin: 10px 8px;
                padding: 6px 8px;
                border: 1px solid #c7c7c7;
                border-radius: 6px;
                background: #f8f8f8;
            }

            #igloo-tracker-total {
                padding: 8px 10px;
                font-weight: 700;
                display: flex;
                gap: 8px;
                align-items: center;
                justify-content: space-between;
            }

            .igloo-chip {
                background: #f1f1f1;
                border: 1px solid #d1d1d1;
                border-radius: 999px;
                padding: 3px 8px;
                font-size: 12px;
                color: #333;
            }

            #igloo-tracker-reset {
                padding: 0 10px 8px 10px;
                font-size: 12px;
                opacity: 0.7;
            }

            #igloo-notify-label {
                display: flex;
                gap: 6px;
                align-items: center;
                padding: 0 10px 10px 10px;
                font-size: 12px;
                opacity: 0.85;
            }

            #igloo-tracker-items {
                list-style: none;
                margin: 0;
                padding: 0 10px 10px 10px;
                max-height: 210px;
                overflow-y: auto;
                border-top: 1px solid #eee;
            }

            #igloo-tracker-items li {
                margin: 8px 0;
                padding: 8px;
                border: 1px solid #e5e5e5;
                border-radius: 8px;
                background: #fbfbfb;
            }

            #igloo-tracker-items li strong {
                display: block;
                font-size: 13px;
                margin-bottom: 4px;
            }

            #igloo-tracker-items li .times {
                font-size: 11px;
                opacity: 0.7;
                line-height: 1.35;
                white-space: normal;
            }

            .igloo-warn {
                background: #fff8e1 !important;
            }
            .igloo-limit {
                background: #ffe2e2 !important;
            }

            #igloo-tracker-panel.collapsed #igloo-tracker-items,
            #igloo-tracker-panel.collapsed #igloo-tracker-total,
            #igloo-tracker-panel.collapsed #igloo-tracker-reset,
            #igloo-tracker-panel.collapsed #igloo-notify-label {
                display: none;
            }

            /* minimized icon */
            #igloo-tracker-mini {
                position: fixed;
                top: 90px;
                right: 15px;
                width: 36px;
                height: 36px;
                background: #fff;
                border: 2px solid #c7c7c7;
                border-radius: 8px;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            #igloo-tracker-mini img {
                    width: 32px;
                    height: 32px;
            }
        `;


        document.head.appendChild(style);
        document.body.appendChild(panel);

        document.getElementById("igloo-tracker-day")
            .addEventListener("change", renderSelectedDay);

        document.getElementById("igloo-tracker-header")
            .addEventListener("click", () => {
                //toggleCollapse();
            });

        document.getElementById("igloo-minimize-btn")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                minimizePanel();
            });

        setupCollapseToggle();
        setupNotificationToggle();
        setupMinimizeToggle();
    }

    // no collapsing for now
    /*function toggleCollapse() {
        const panel = document.getElementById("igloo-tracker-panel");
        panel.classList.toggle("collapsed");

        localStorage.setItem(
            COLLAPSE_KEY,
            panel.classList.contains("collapsed") ? "1" : "0"
        );
    }*/

    function createMiniIcon() {
        if (document.getElementById("igloo-tracker-mini")) return;

        const mini = document.createElement("div");
        mini.id = "igloo-tracker-mini";

        const img = document.createElement("img");
        img.src = "https://images.neopets.com/items/toy_plasticigloo.gif";
        img.alt = "Igloo";
        img.style.width = "32px";
        img.style.height = "32px";
        img.style.objectFit = "contain";

        mini.appendChild(img);

        mini.addEventListener("click", () => {
            maximizePanel();
        });

        document.body.appendChild(mini);
    }


    function setupMinimizeToggle() {
        if (localStorage.getItem(MINIMIZED_KEY) === "1") {
            minimizePanel();
        }
    }

    function minimizePanel() {
        const panel = document.getElementById("igloo-tracker-panel");
        if (!panel) return;

        panel.style.display = "none";
        createMiniIcon();
        localStorage.setItem(MINIMIZED_KEY, "1");
    }

    function maximizePanel() {
        const panel = document.getElementById("igloo-tracker-panel");
        const mini = document.getElementById("igloo-tracker-mini");

        if (panel) panel.style.display = "block";
        if (mini) mini.remove();

        localStorage.setItem(MINIMIZED_KEY, "0");
    }

    function setupCollapseToggle() {
        const panel = document.getElementById("igloo-tracker-panel");

        if (localStorage.getItem(COLLAPSE_KEY) === "1") {
            panel.classList.add("collapsed");
        }
    }

    function setupNotificationToggle() {
        const toggle = document.getElementById("igloo-notify-toggle");

        // OFF by default
        toggle.checked = localStorage.getItem(NOTIFY_ENABLED_KEY) === "1";

        toggle.addEventListener("change", () => {
            localStorage.setItem(
                NOTIFY_ENABLED_KEY,
                toggle.checked ? "1" : "0"
            );

            if (toggle.checked && Notification.permission === "default") {
                Notification.requestPermission();
            }
        });
    }

    function getLifetimeTotal() {
        const data = loadData();
        let total = 0;

        Object.values(data).forEach(day => {
            if (day?.total) {
                total += day.total;
            }
        });

        return total;
    }


    function populateDaySelector() {
        const select = document.getElementById("igloo-tracker-day");
        const data = loadData();
        const { dateKey: today } = getNSTDateParts();

        select.innerHTML = "";

        Object.keys(data)
            .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
            .sort((a, b) => b.localeCompare(a))
            .forEach(day => {
                const opt = document.createElement("option");
                opt.value = day;
                opt.textContent = day === today ? `${day} (Today)` : day;
                select.appendChild(opt);
            });

        if (![...select.options].some(o => o.value === today)) {
            const opt = document.createElement("option");
            opt.value = today;
            opt.textContent = `${today} (Today)`;
            select.prepend(opt);
        }

        select.value = today;
    }

    function renderSelectedDay() {
        const day = document.getElementById("igloo-tracker-day").value;
        const allData = loadData();
        const data = allData[day];

        const panel = document.getElementById("igloo-tracker-panel");
        const totalEl = document.getElementById("igloo-tracker-total");
        const listEl = document.getElementById("igloo-tracker-items");

        listEl.innerHTML = "";
        panel.classList.remove("igloo-warn", "igloo-limit");

        const total = data?.total || 0;
        const lifetimeTotal = getLifetimeTotal();

        totalEl.innerHTML = `
            Today: ${total} / ${DAILY_LIMIT}
            <div style="font-size: 11px; opacity: 0.75;">
                Lifetime purchases: ${lifetimeTotal}
            </div>
        `;


        if (total >= DAILY_LIMIT) {
            panel.classList.add("igloo-limit");
        } else if (total >= DAILY_LIMIT - 2) {
            panel.classList.add("igloo-warn");
        }

        if (!data) return;

        Object.values(data.items)
            .sort((a, b) => {
                // If one is unknown, put it last
                if (a.name === "Unknown Item" && b.name !== "Unknown Item") return 1;
                if (b.name === "Unknown Item" && a.name !== "Unknown Item") return -1;

                // Otherwise sort by count
                return b.count - a.count;
            })
            .forEach(item => {
            const li = document.createElement("li");
            const times = item.timestamps.join("<br>");

            li.innerHTML = `
                <span class="item-line">
                    <strong>${item.name}</strong> × ${item.count}
                </span>
                <div class="times">${times}</div>
            `;

            listEl.appendChild(li);
        });
    }


    function renderTodayPanel() {
        populateDaySelector();
        renderSelectedDay();
    }

    /***********************
     * COUNTDOWN
     ***********************/
    function updateResetCountdown() {
        const el = document.getElementById("igloo-tracker-reset");
        if (!el) return;

        const now = getNSTNow();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);

        const diff = midnight - now;
        if (diff <= 0) {
            el.textContent = "Resetting now…";
            return;
        }

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        el.textContent = `Resets in ${h}h ${m}m ${s}s (NST)`;
    }

    /***********************
     * LOGGING
     ***********************/
    function logPurchase(itemId, itemName) {
        const { dateKey, time } = getNSTDateParts();
        const data = loadData();

        if (!data[dateKey]) {
            data[dateKey] = { total: 0, items: {} };
        }

        data[dateKey].total++;

        if (!data[dateKey].items[itemId]) {
            data[dateKey].items[itemId] = {
                name: itemName || "Unknown Item",
                count: 0,
                timestamps: []
            };
        }

        data[dateKey].items[itemId].count++;
        data[dateKey].items[itemId].timestamps.push(time);

        saveData(data);
        renderTodayPanel();
    }

    function markTodayAsFull() {
        const { dateKey } = getNSTDateParts();
        const data = loadData();

        if (!data[dateKey]) {
            data[dateKey] = { total: 0, items: {} };
        }

        // If the total is already >= 10, do nothing
        if (data[dateKey].total >= DAILY_LIMIT) return;

        const remaining = DAILY_LIMIT - data[dateKey].total;

        // Option A (recommended): just set the total to 10
        data[dateKey].total = DAILY_LIMIT;

        // Option B (optional): store an "Unknown" item entry
        if (remaining > 0) {
             if (!data[dateKey].items.unknown) {
                 data[dateKey].items.unknown = {
                     name: "Unknown Item",
                     count: 0,
                     timestamps: []
                 };
             }
             data[dateKey].items.unknown.count += remaining;
        }

        saveData(data);
        renderTodayPanel();
    }

    function checkPageForLimitMessage() {
        const msg = document.body.innerHTML;
        if (msg.includes("cannot get any more items") || msg.includes("cannot buy any more items")) {
            markTodayAsFull();
        }
    }


    /***********************
     * FETCH HOOK
     ***********************/
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        return originalFetch.apply(this, args)
            .then(async response => {
            try {
                const url = args[0];
                if (typeof url === "string" && url.includes("/np-templates/ajax/igloo.php")) {
                    const clone = response.clone();
                    const data = await clone.json();

                    // LIMIT REACHED: set today to 10/10
                    if (data.error && data.errMsg && data.errMsg.includes("cannot buy any more items")) {
                        markTodayAsFull();
                        return response;
                    }

                    if (data.success) {
                        let itemId = "unknown";
                        let itemName = null;

                        if (data.output) {
                            const temp = document.createElement("div");
                            temp.innerHTML = data.output;

                            const img = temp.querySelector("img[src*='/items/']");
                            if (img) {
                                const src = img.getAttribute("src");
                                itemId = src.split("/").pop().replace(/\.\w+$/, "");
                                itemName = img.getAttribute("alt")?.trim() || null;
                            }
                        }

                        logPurchase(itemId, itemName);
                    }
                }
            } catch (e) {
                // ignore
            }
            return response;
        })
            .catch(() => {
            return Promise.reject();
        });
    };


    /***********************
     * NST MIDNIGHT + 1H WARNING
     ***********************/
    function scheduleNSTTimers() {
        const now = getNSTNow();
        const { dateKey } = getNSTDateParts();

        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);

        const oneHourBefore = new Date(midnight.getTime() - 60 * 60 * 1000);

        const data = loadData()[dateKey];
        const total = data?.total || 0;

        if (
            localStorage.getItem(NOTIFY_ENABLED_KEY) === "1" &&
            Notification.permission === "granted" &&
            total < DAILY_LIMIT &&
            !localStorage.getItem(`${NOTIFY_KEY}-${dateKey}`)
        ) {
            const msUntilWarn = oneHourBefore - now;
            if (msUntilWarn > 0) {
                setTimeout(() => {
                    const notif = new Notification("Neopets Igloo Reminder", {
                        body: `Today: ${total}/${DAILY_LIMIT} items bought. 1 hour until NST reset.`,
                        icon: "https://images.neopets.com/items/toy_plasticigloo.gif",
                        badge: "https://images.neopets.com/items/toy_plasticigloo.gif"
                    });

                    notif.onclick = () => {
                        window.focus();
                        window.open("https://www.neopets.com/winter/igloo.phtml?stock=1", "_blank");
                    };
                    localStorage.setItem(`${NOTIFY_KEY}-${dateKey}`, "1");
                }, msUntilWarn);
            }
        }

        setTimeout(() => {
            renderTodayPanel();
            scheduleNSTTimers();
        }, midnight - now + 1000);
    }

    createTrackerPanel();
    renderTodayPanel();
    checkPageForLimitMessage();
    updateResetCountdown();
    setInterval(updateResetCountdown, 1000);
    scheduleNSTTimers();

})();