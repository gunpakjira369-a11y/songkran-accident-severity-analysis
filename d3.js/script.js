// เปลี่ยนจาก:
// d3.csv("../data/songkran_51-57_clean.csv")

// ให้เปลี่ยนมาใช้ Link นี้แทน:
d3.csv("https://media.githubusercontent.com/media/gunpakjira369-a11y/songkran-accident-severity-analysis/refs/heads/main/data/songkran_51-57_clean.csv")
  .then(data => {
      console.log("Data loaded:", data.length); // ควรจะเห็นจำนวน 200,000+ รายการ
      // โค้ดสร้าง กราฟ / แผนที่ ของคุณ
  })
  .catch(error => {
      console.error("Error loading CSV:", error);
  });

let allRows = [];
let filteredRows = [];

const $ = (id) => document.getElementById(id);

function cleanText(v) {
    return String(v ?? "").replace(/^\uFEFF/, "").trim();
}

function thaiNum(n) {
    return Number(n || 0).toLocaleString("th-TH");
}

/* =========================
   CSV
========================= */

function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (c === '"') {
            if (quoted && text[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                quoted = !quoted;
            }
        } else if (c === "," && !quoted) {
            row.push(cell);
            cell = "";
        } else if ((c === "\n" || c === "\r") && !quoted) {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell);
            cell = "";

            if (row.some(v => cleanText(v) !== "")) {
                rows.push(row);
            }

            row = [];
        } else {
            cell += c;
        }
    }

    if (cell !== "" || row.length) {
        row.push(cell);

        if (row.some(v => cleanText(v) !== "")) {
            rows.push(row);
        }
    }

    if (!rows.length) return [];

    const headers = rows[0].map(cleanText);

    return rows.slice(1).map(values => {
        const obj = {};

        headers.forEach((h, i) => {
            obj[h] = cleanText(values[i] ?? "");
        });

        return obj;
    });
}

function normalizeRows(rows) {
    return rows.map(d => ({
        festival: cleanText(d["ชื่อเทศกาล"]),
        province: cleanText(d["จังหวัด"]),
        date: cleanText(d["วันที่เกิดเหตุ"]),
        time: cleanText(d["เวลาเกิดเหตุ"]),
        gender: cleanText(d["เพศ"]),
        age: cleanText(d["อายุ"]),
        road: cleanText(d["ถนนที่เกิดเหตุ"]),
        vehicle: cleanText(d["รถผู้บาดเจ็บ"]),
        alcohol: cleanText(d["การดื่มสุรา"]),
        outcome: cleanText(d["ผลการรักษา"])
    }));
}

/* =========================
   DEATH CLASSIFICATION
========================= */

const DEATH_OUTCOMES = new Set([
    "ตายที่เกิดเหตุ",
    "ตายในตึกภายใน 24 ชม. หลังเหตุ",
    "ตายที่ห้องฉุกเฉิน",
    "ตายในตึกหลัง 24 ชม. - 30 วัน",
    "ตายระหว่างนำส่ง",
    "ตายระหว่างส่งต่อ"
]);

function isDeath(outcome) {
    return DEATH_OUTCOMES.has(cleanText(outcome));
}

/* =========================
   TIME
========================= */

function extractHour(value) {
    const text = cleanText(value);

    if (!text || text === "ไม่ทราบ") {
        return null;
    }

    const match = text.match(/^(\d{1,2}):\d{2}/);

    if (!match) {
        return null;
    }

    let hour = Number(match[1]);

    if (hour === 24) {
        hour = 0;
    }

    return hour >= 0 && hour <= 23 ? hour : null;
}

/* =========================
   FILTERS
========================= */

function uniqueValues(field) {
    return [...new Set(
        allRows
            .map(d => d[field])
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "th"));
}

function fillSelect(id, field) {
    const el = $(id);
    if (!el) return;

    el.innerHTML = '<option value="all">ทั้งหมด</option>';

    uniqueValues(field).forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        el.appendChild(option);
    });
}

function setupFilters() {
    [
        ["festivalFilter", "festival"],
        ["provinceFilter", "province"],
        ["genderFilter", "gender"],
        ["alcoholFilter", "alcohol"]
    ].forEach(([id, field]) => fillSelect(id, field));

    [
        "festivalFilter",
        "provinceFilter",
        "genderFilter",
        "alcoholFilter"
    ].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener("change", applyFilters);
    });

    const reset = $("resetBtn");

    if (reset) {
        reset.addEventListener("click", () => {
            [
                "festivalFilter",
                "provinceFilter",
                "genderFilter",
                "alcoholFilter"
            ].forEach(id => {
                const el = $(id);
                if (el) el.value = "all";
            });

            applyFilters();
        });
    }
}

function applyFilters() {
    const f = $("festivalFilter")?.value || "all";
    const p = $("provinceFilter")?.value || "all";
    const g = $("genderFilter")?.value || "all";
    const a = $("alcoholFilter")?.value || "all";

    filteredRows = allRows.filter(d =>
        (f === "all" || d.festival === f) &&
        (p === "all" || d.province === p) &&
        (g === "all" || d.gender === g) &&
        (a === "all" || d.alcohol === a)
    );

    updateDashboard();
}

/* =========================
   TOOLTIP
========================= */

function getD3Tooltip() {
    let tip = d3.select("#tooltip");

    if (tip.empty()) {
        tip = d3.select("body")
            .append("div")
            .attr("id", "tooltip")
            .attr("class", "tooltip");
    }

    tip
        .style("position", "fixed")
        .style("z-index", "99999")
        .style("pointer-events", "none");

    return tip;
}

function showD3Tip(event, html) {
    const tip = getD3Tooltip();

    tip
        .html(html)
        .style("display", "block")
        .style("opacity", 1)
        .style("left", `${event.clientX + 15}px`)
        .style("top", `${event.clientY + 15}px`)
        .attr("aria-hidden", "false");
}

function moveD3Tip(event) {
    getD3Tooltip()
        .style("left", `${event.clientX + 15}px`)
        .style("top", `${event.clientY + 15}px`);
}

function hideD3Tip() {
    getD3Tooltip()
        .style("display", "none")
        .style("opacity", 0)
        .attr("aria-hidden", "true");
}

/* =========================
   KPI
========================= */

function updateKPIs() {
    const total = filteredRows.length;
    const deaths = filteredRows.filter(d => isDeath(d.outcome)).length;
    const provinces = new Set(
        filteredRows.map(d => d.province).filter(Boolean)
    ).size;

    $("kpiTotal").textContent = thaiNum(total);
    $("kpiDeaths").textContent = thaiNum(deaths);
    $("kpiRate").textContent =
        total ? `${((deaths / total) * 100).toFixed(2)}%` : "0.00%";
    $("kpiProvinces").textContent = thaiNum(provinces);
}

/* =========================
   SUMMARY
========================= */

function updateInsight() {
    const total = filteredRows.length;
    const deaths = filteredRows.filter(d => isDeath(d.outcome)).length;
    const alive = total - deaths;
    const rate = total
        ? ((deaths / total) * 100).toFixed(2)
        : "0.00";

    const gender = new Map();

    filteredRows.forEach(d => {
        const key = d.gender || "ไม่ทราบ";
        gender.set(key, (gender.get(key) || 0) + 1);
    });

    const genderText = [...gender.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${thaiNum(v)} ราย`)
        .join(" • ") || "-";

    const alcohol = new Map();

    filteredRows.forEach(d => {
        const key = d.alcohol || "ไม่ทราบ";
        alcohol.set(key, (alcohol.get(key) || 0) + 1);
    });

    const alcoholText = [...alcohol.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${thaiNum(v)} ราย`)
        .join(" • ") || "-";

    const outcomes = new Map();

    filteredRows.forEach(d => {
        const key = d.outcome || "ไม่ทราบ";
        outcomes.set(key, (outcomes.get(key) || 0) + 1);
    });

    const outcomeText = [...outcomes.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${thaiNum(v)} ราย`)
        .join(" • ") || "-";

    const provinces = new Map();

    filteredRows.forEach(d => {
        if (d.province) {
            provinces.set(
                d.province,
                (provinces.get(d.province) || 0) + 1
            );
        }
    });

    const topProvince = [...provinces.entries()]
        .sort((a, b) => b[1] - a[1])[0];

    const hours = Array.from(
        { length: 24 },
        (_, h) => ({ h, value: 0 })
    );

    filteredRows.forEach(d => {
        const h = extractHour(d.time);
        if (h !== null) {
            hours[h].value++;
        }
    });

    const peakHour = [...hours]
        .sort((a, b) => b.value - a.value)[0];

    const festivals = new Map();

    filteredRows.forEach(d => {
        const key = d.festival || "ไม่ทราบ";

        if (!festivals.has(key)) {
            festivals.set(key, {
                total: 0,
                deaths: 0,
                alive: 0
            });
        }

        const f = festivals.get(key);

        f.total++;

        if (isDeath(d.outcome)) {
            f.deaths++;
        } else {
            f.alive++;
        }
    });

    const festivalText = [...festivals.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "th"))
        .map(([k, v]) =>
            `<div class="summary-festival">
                <b>${k}</b> :
                ผู้ประสบเหตุ ${thaiNum(v.total)} ราย |
                ไม่เสียชีวิต ${thaiNum(v.alive)} ราย |
                เสียชีวิต ${thaiNum(v.deaths)} ราย |
                อัตราเสียชีวิต ${
                    v.total
                        ? ((v.deaths / v.total) * 100).toFixed(2)
                        : "0.00"
                }%
            </div>`
        )
        .join("") || "-";

    const el = $("insightText");

    if (!el) return;

    el.innerHTML = `
        <div class="summary-grid">

            <div>
                <b>ผู้ประสบเหตุทั้งหมด</b><br>
                ${thaiNum(total)} ราย
            </div>

            <div>
                <b>ผู้เสียชีวิต</b><br>
                ${thaiNum(deaths)} ราย (${rate}%)
            </div>

            <div>
                <b>ไม่เสียชีวิต</b><br>
                ${thaiNum(alive)} ราย
                (${total ? ((alive / total) * 100).toFixed(2) : "0.00"}%)
            </div>

            <div>
                <b>จังหวัดที่มีผู้ประสบเหตุมากที่สุด</b><br>
                ${
                    topProvince
                        ? `${topProvince[0]} ${thaiNum(topProvince[1])} ราย`
                        : "-"
                }
            </div>

            <div class="wide">
                <b>เพศ</b><br>
                ${genderText}
            </div>

            <div class="wide">
                <b>การดื่มสุรา</b><br>
                ${alcoholText}
            </div>

            <div class="wide">
                <b>ผลการรักษา</b><br>
                ${outcomeText}
            </div>

            <div class="wide">
                <b>ช่วงเวลาที่มีผู้ประสบเหตุมากที่สุด</b><br>
                ${
                    peakHour
                        ? `${String(peakHour.h).padStart(2, "0")}:00 น.
                           จำนวน ${thaiNum(peakHour.value)} ราย`
                        : "-"
                }
            </div>

            <div class="wide">
                <b>จำนวนผู้ประสบเหตุแยกตามเทศกาล</b>
                ${festivalText}
            </div>

        </div>
    `;
}

/* =========================
   CHART HELPERS
========================= */

function chartSVG(id, width = 760, height = 330) {
    const el = document.getElementById(id);

    if (!el) return null;

    el.innerHTML = "";

    return d3.select(el)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");
}

function animateBars(selection, yAccessor, heightAccessor, duration = 850) {
    selection
        .attr("y", yAccessor)
        .attr("height", 0)
        .style("opacity", 0)
        .transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .style("opacity", 1)
        .attr("height", heightAccessor);
}

/* =========================
   OUTCOME
========================= */

function drawOutcome() {
    const svg = chartSVG("outcomeChart", 760, 330);
    if (!svg) return;

    const counts = d3.rollups(
        filteredRows,
        v => v.length,
        d => d.outcome || "ไม่ทราบ"
    )
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    const W = 760;
    const H = 330;
    const margin = {
        top: 15,
        right: 95,
        bottom: 35,
        left: 235
    };

    const y = d3.scaleBand()
        .domain(counts.map(d => d.label))
        .range([margin.top, H - margin.bottom])
        .padding(0.25);

    const x = d3.scaleLinear()
        .domain([0, d3.max(counts, d => d.value) || 1])
        .nice()
        .range([margin.left, W - margin.right]);

    svg.append("g")
        .attr("transform", `translate(0,${H - margin.bottom})`)
        .call(
            d3.axisBottom(x)
                .ticks(5)
                .tickFormat(d3.format(",d"))
        );

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .style("font-family", "Kanit")
        .style("font-size", "12px");

    const bars = svg.selectAll(".outcome-bar")
        .data(counts)
        .join("rect")
        .attr("class", "outcome-bar")
        .attr("x", margin.left)
        .attr("y", d => y(d.label) + y.bandwidth())
        .attr("width", d => x(d.value) - margin.left)
        .attr("height", 0)
        .attr("rx", 5)
        .attr("fill", (d, i) =>
            isDeath(d.label)
                ? "#dc2626"
                : ["#f59e0b", "#8b5cf6", "#06b6d4", "#10b981", "#3b82f6", "#ec4899"][i % 6]
        );

    bars
        .transition()
        .duration(850)
        .ease(d3.easeCubicOut)
        .attr("y", d => y(d.label))
        .attr("height", y.bandwidth());

    bars
        .on("mouseenter", (event, d) => {
            showD3Tip(
                event,
                `<b>${d.label}</b><br>
                 จำนวน: <b>${thaiNum(d.value)}</b> ราย`
            );
        })
        .on("mousemove", moveD3Tip)
        .on("mouseleave", hideD3Tip);

    svg.selectAll(".outcome-label")
        .data(counts)
        .join("text")
        .attr("class", "outcome-label")
        .attr("x", d => x(d.value) + 8)
        .attr("y", d => y(d.label) + y.bandwidth() / 2 + 4)
        .style("font-family", "Kanit")
        .style("font-size", "11px")
        .text(d => thaiNum(d.value));
}

/* =========================
   SEVERITY
========================= */

function drawSeverity() {
    const svg = chartSVG("severityChart", 760, 330);
    if (!svg) return;

    const data = [
        {
            label: "ไม่เสียชีวิต",
            value: filteredRows.filter(d => !isDeath(d.outcome)).length
        },
        {
            label: "เสียชีวิต",
            value: filteredRows.filter(d => isDeath(d.outcome)).length
        }
    ];

    const total = d3.sum(data, d => d.value);

    const pie = d3.pie()
        .sort(null)
        .value(d => d.value);

    const arc = d3.arc()
        .innerRadius(55)
        .outerRadius(105);

    const arcHover = d3.arc()
        .innerRadius(55)
        .outerRadius(116);

    const g = svg.append("g")
        .attr("transform", "translate(380,145)");

    const paths = g.selectAll("path")
        .data(pie(data))
        .join("path")
        .attr("fill", (d, i) =>
            i === 0 ? "#3b82f6" : "#ef4444"
        )
        .attr("stroke", "#fff")
        .attr("stroke-width", 3)
        .each(function(d) {
            this._current = {
                startAngle: d.startAngle,
                endAngle: d.startAngle
            };
        });

    paths
        .transition()
        .duration(1000)
        .ease(d3.easeCubicOut)
        .attrTween("d", function(d) {
            const interpolate = d3.interpolate(this._current, d);
            this._current = interpolate(1);

            return t => arc(interpolate(t));
        });

    paths
        .on("mouseenter", function(event, d) {
            d3.select(this)
                .transition()
                .duration(180)
                .attr("d", arcHover);

            const percent = total
                ? ((d.data.value / total) * 100).toFixed(2)
                : "0.00";

            showD3Tip(
                event,
                `<b>${d.data.label}</b><br>
                 จำนวน: <b>${thaiNum(d.data.value)}</b> ราย<br>
                 สัดส่วน: <b>${percent}%</b>`
            );
        })
        .on("mousemove", moveD3Tip)
        .on("mouseleave", function() {
            d3.select(this)
                .transition()
                .duration(180)
                .attr("d", arc);

            hideD3Tip();
        });

    svg.append("text")
        .attr("x", 380)
        .attr("y", 140)
        .attr("text-anchor", "middle")
        .style("font-family", "Kanit")
        .style("font-size", "20px")
        .style("font-weight", "700")
        .text(thaiNum(total));

    svg.append("text")
        .attr("x", 380)
        .attr("y", 160)
        .attr("text-anchor", "middle")
        .style("font-family", "Kanit")
        .style("font-size", "11px")
        .text("ผู้ประสบเหตุ");

    const legend = svg.append("g")
        .attr("transform", "translate(160,285)");

    data.forEach((d, i) => {
        legend.append("rect")
            .attr("x", i * 210)
            .attr("width", 12)
            .attr("height", 12)
            .attr("rx", 2)
            .attr("fill", i === 0 ? "#3b82f6" : "#ef4444");

        legend.append("text")
            .attr("x", i * 210 + 18)
            .attr("y", 11)
            .style("font-family", "Kanit")
            .style("font-size", "11px")
            .text(`${d.label} ${thaiNum(d.value)}`);
    });
}

/* =========================
   PROVINCE
========================= */

function drawProvince() {
    const svg = chartSVG("provinceChart", 700, 315);
    if (!svg) return;

    const data = d3.rollups(
        filteredRows,
        v => v.length,
        d => d.province || "ไม่ทราบ"
    )
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const W = 700;
    const H = 315;
    const m = {
        top: 15,
        right: 25,
        bottom: 35,
        left: 150
    };

    const y = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([m.top, H - m.bottom])
        .padding(0.22);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 1])
        .nice()
        .range([m.left, W - m.right]);

    svg.append("g")
        .attr("transform", `translate(0,${H - m.bottom})`)
        .call(
            d3.axisBottom(x)
                .ticks(5)
                .tickFormat(d3.format(",d"))
        );

    svg.append("g")
        .attr("transform", `translate(${m.left},0)`)
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .style("font-family", "Kanit")
        .style("font-size", "11px");

    const bars = svg.selectAll(".province-bar")
        .data(data)
        .join("rect")
        .attr("class", "province-bar")
        .attr("x", m.left)
        .attr("y", d => y(d.label))
        .attr("width", 0)
        .attr("height", y.bandwidth())
        .attr("rx", 6)
        .attr("fill", (d, i) => {
            const colors = [
                "#2563eb", "#3b82f6", "#60a5fa",
                "#06b6d4", "#14b8a6", "#10b981",
                "#84cc16", "#f59e0b", "#f97316", "#ef4444"
            ];

            return colors[i];
        });

    bars
        .transition()
        .duration(1000)
        .delay((d, i) => i * 60)
        .ease(d3.easeCubicOut)
        .attr("width", d => x(d.value) - m.left);

    bars
        .on("mouseenter", (event, d) => {
            showD3Tip(
                event,
                `<b>${d.label}</b><br>
                 ผู้ประสบเหตุ: <b>${thaiNum(d.value)}</b> ราย`
            );
        })
        .on("mousemove", moveD3Tip)
        .on("mouseleave", hideD3Tip);

    svg.selectAll(".province-label")
        .data(data)
        .join("text")
        .attr("class", "province-label")
        .attr("x", d => x(d.value) + 8)
        .attr("y", d => y(d.label) + y.bandwidth() / 2 + 4)
        .style("font-family", "Kanit")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .style("opacity", 0)
        .text(d => thaiNum(d.value))
        .transition()
        .duration(1000)
        .delay((d, i) => i * 60 + 300)
        .style("opacity", 1);
}

/* =========================
   HOUR
========================= */

function drawHour() {
    const svg = chartSVG("hourChart", 700, 315);
    if (!svg) return;

    const hours = d3.range(24).map(h => ({
        hour: h,
        value: 0
    }));

    filteredRows.forEach(d => {
        const h = extractHour(d.time);

        if (h !== null) {
            hours[h].value++;
        }
    });

    const W = 700;
    const H = 315;
    const m = {
        top: 20,
        right: 20,
        bottom: 48,
        left: 55
    };

    const x = d3.scaleLinear()
        .domain([0, 23])
        .range([m.left, W - m.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(hours, d => d.value) || 1])
        .nice()
        .range([H - m.bottom, m.top]);

    svg.append("g")
        .attr("transform", `translate(0,${H - m.bottom})`)
        .call(
            d3.axisBottom(x)
                .ticks(12)
                .tickFormat(d => `${String(d).padStart(2, "0")}:00`)
        );

    svg.append("g")
        .attr("transform", `translate(${m.left},0)`)
        .call(
            d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d3.format(",d"))
        );

    const line = d3.line()
        .x(d => x(d.hour))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

    const area = d3.area()
        .x(d => x(d.hour))
        .y0(H - m.bottom)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

    const areaPath = svg.append("path")
        .datum(hours)
        .attr("fill", "#3b82f6")
        .attr("opacity", 0.12)
        .attr("d", area);

    areaPath
        .attr("d", area)
        .attr("opacity", 0)
        .transition()
        .duration(1000)
        .ease(d3.easeCubicOut)
        .attr("opacity", 0.12);

    const path = svg.append("path")
        .datum(hours)
        .attr("fill", "none")
        .attr("stroke", "#2563eb")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("d", line);

    const totalLength = path.node().getTotalLength();

    path
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

    const points = svg.selectAll(".hour-point")
        .data(hours)
        .join("circle")
        .attr("class", "hour-point")
        .attr("cx", d => x(d.hour))
        .attr("cy", d => y(d.value))
        .attr("r", 0)
        .attr("fill", "#2563eb")
        .style("cursor", "pointer");

    points
        .transition()
        .duration(600)
        .delay((d, i) => 900 + i * 20)
        .attr("r", 3.5);

    points
        .on("mouseenter", (event, d) => {
            const hh = `${String(d.hour).padStart(2, "0")}:00`;

            d3.select(event.currentTarget)
                .transition()
                .duration(150)
                .attr("r", 7);

            showD3Tip(
                event,
                `<b>เวลา ${hh} น.</b><br>
                 ผู้ประสบเหตุ: <b>${thaiNum(d.value)}</b> ราย`
            );
        })
        .on("mousemove", moveD3Tip)
        .on("mouseleave", event => {
            d3.select(event.currentTarget)
                .transition()
                .duration(150)
                .attr("r", 3.5);

            hideD3Tip();
        });
}

/* =========================
   FESTIVAL: 2 BARS SIDE BY SIDE
========================= */

function drawFestivalSeverity() {
    const el = document.getElementById("festivalSeverityChart");
    if (!el) return;

    el.innerHTML = "";

    const rows = d3.rollups(
        filteredRows,
        v => ({
            total: v.length,
            deaths: v.filter(d => isDeath(d.outcome)).length
        }),
        d => d.festival || "ไม่ทราบ"
    )
        .map(([festival, s]) => ({
            festival,
            alive: s.total - s.deaths,
            deaths: s.deaths
        }))
        .sort((a, b) =>
            a.festival.localeCompare(b.festival, "th")
        );

    const W = 760;
    const H = 330;
    const m = {
        top: 30,
        right: 30,
        bottom: 55,
        left: 60
    };

    const svg = d3.select(el)
        .append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");

    const x0 = d3.scaleBand()
        .domain(rows.map(d => d.festival))
        .range([m.left, W - m.right])
        .padding(0.22);

    const x1 = d3.scaleBand()
        .domain(["alive", "deaths"])
        .range([0, x0.bandwidth()])
        .padding(0.12);

    const max = d3.max(
        rows,
        d => Math.max(d.alive, d.deaths)
    ) || 1;

    const y = d3.scaleLinear()
        .domain([0, max])
        .nice()
        .range([H - m.bottom, m.top]);

    svg.append("g")
        .attr("transform", `translate(0,${H - m.bottom})`)
        .call(
            d3.axisBottom(x0)
                .tickSize(0)
        )
        .selectAll("text")
        .style("font-family", "Kanit")
        .style("font-size", "11px");

    svg.append("g")
        .attr("transform", `translate(${m.left},0)`)
        .call(
            d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d3.format(",d"))
        );

    const groups = svg.selectAll(".festival-group")
        .data(rows)
        .join("g")
        .attr("class", "festival-group")
        .attr(
            "transform",
            d => `translate(${x0(d.festival)},0)`
        );

    groups.each(function(d) {
        const g = d3.select(this);

        const items = [
            {
                key: "alive",
                label: "ไม่เสียชีวิต",
                value: d.alive,
                color: "#3b82f6"
            },
            {
                key: "deaths",
                label: "เสียชีวิต",
                value: d.deaths,
                color: "#ef4444"
            }
        ];

        items.forEach(item => {
            const bar = g.append("rect")
                .attr("x", x1(item.key))
                .attr("y", H - m.bottom)
                .attr("width", x1.bandwidth())
                .attr("height", 0)
                .attr("rx", 5)
                .attr("fill", item.color)
                .style("cursor", "pointer");

            bar
                .transition()
                .duration(900)
                .delay(100)
                .ease(d3.easeCubicOut)
                .attr("y", y(item.value))
                .attr("height", H - m.bottom - y(item.value));

            bar
                .on("mouseenter", event => {
                    d3.select(event.currentTarget)
                        .transition()
                        .duration(150)
                        .attr(
                            "opacity",
                            0.75
                        );

                    showD3Tip(
                        event,
                        `<b>${d.festival}</b><br>
                         ${item.label}: <b>${thaiNum(item.value)}</b> ราย<br>
                         ผู้ประสบเหตุทั้งหมด: ${thaiNum(d.alive + d.deaths)} ราย`
                    );
                })
                .on("mousemove", moveD3Tip)
                .on("mouseleave", event => {
                    d3.select(event.currentTarget)
                        .transition()
                        .duration(150)
                        .attr("opacity", 1);

                    hideD3Tip();
                });
        });
    });

    const legend = svg.append("g")
        .attr(
            "transform",
            `translate(${m.left},${H - 20})`
        );

    [
        ["ไม่เสียชีวิต", "#3b82f6"],
        ["เสียชีวิต", "#ef4444"]
    ].forEach((item, i) => {
        legend.append("rect")
            .attr("x", i * 130)
            .attr("width", 12)
            .attr("height", 12)
            .attr("rx", 2)
            .attr("fill", item[1]);

        legend.append("text")
            .attr("x", i * 130 + 18)
            .attr("y", 10)
            .style("font-family", "Kanit")
            .style("font-size", "11px")
            .text(item[0]);
    });
}

/* =========================
   GENDER
========================= */

function drawGenderChart() {
    const svg = chartSVG("genderChart", 760, 330);
    if (!svg) return;

    const data = d3.rollups(
        filteredRows,
        v => v.length,
        d => d.gender || "ไม่ทราบ"
    )
        .map(([label, value]) => ({ label, value }));

    const W = 760;
    const H = 330;
    const m = {
        top: 25,
        right: 30,
        bottom: 45,
        left: 70
    };

    const x = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([m.left, W - m.right])
        .padding(0.35);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 1])
        .nice()
        .range([H - m.bottom, m.top]);

    svg.append("g")
        .attr("transform", `translate(0,${H - m.bottom})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("transform", `translate(${m.left},0)`)
        .call(
            d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d3.format(",d"))
        );

    const colors = ["#2563eb", "#ec4899", "#94a3b8"];

    const bars = svg.selectAll(".gender-bar")
        .data(data)
        .join("rect")
        .attr("class", "gender-bar")
        .attr("x", d => x(d.label))
        .attr("y", H - m.bottom)
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("rx", 8)
        .attr("fill", (d, i) => colors[i % colors.length])
        .style("cursor", "pointer");

    bars
        .transition()
        .duration(850)
        .delay((d, i) => i * 100)
        .ease(d3.easeCubicOut)
        .attr("y", d => y(d.value))
        .attr("height", d => H - m.bottom - y(d.value));

    bars
        .on("mouseenter", (event, d) => {
            showD3Tip(
                event,
                `<b>${d.label}</b><br>
                 ผู้ประสบเหตุ: <b>${thaiNum(d.value)}</b> ราย`
            );
        })
        .on("mousemove", moveD3Tip)
        .on("mouseleave", hideD3Tip);

    svg.selectAll(".gender-label")
        .data(data)
        .join("text")
        .attr("class", "gender-label")
        .attr(
            "x",
            d => x(d.label) + x.bandwidth() / 2
        )
        .attr("y", d => y(d.value) - 8)
        .attr("text-anchor", "middle")
        .style("font-family", "Kanit")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("opacity", 0)
        .text(d => thaiNum(d.value))
        .transition()
        .duration(500)
        .delay(700)
        .style("opacity", 1);
}

/* =========================
   ALCOHOL
========================= */

function drawAlcoholChart() {
    const svg = chartSVG("alcoholChart", 760, 330);
    if (!svg) return;

    const data = d3.rollups(
        filteredRows,
        v => v.length,
        d => d.alcohol || "ไม่ทราบ"
    )
        .map(([label, value]) => ({ label, value }));

    const colors = {
        "ดื่ม": "#ef4444",
        "ไม่ดื่ม": "#10b981",
        "ไม่ทราบ": "#94a3b8"
    };

    const W = 760;
    const H = 330;
    const m = {
        top: 25,
        right: 30,
        bottom: 45,
        left: 70
    };

    const x = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([m.left, W - m.right])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 1])
        .nice()
        .range([H - m.bottom, m.top]);

    svg.append("g")
        .attr("transform", `translate(0,${H - m.bottom})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("transform", `translate(${m.left},0)`)
        .call(
            d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d3.format(",d"))
        );

    const bars = svg.selectAll(".alcohol-bar")
        .data(data)
        .join("rect")
        .attr("class", "alcohol-bar")
        .attr("x", d => x(d.label))
        .attr("y", H - m.bottom)
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("rx", 8)
        .attr("fill", d => colors[d.label] || "#64748b")
        .style("cursor", "pointer");

    bars
        .transition()
        .duration(900)
        .delay((d, i) => i * 100)
        .ease(d3.easeCubicOut)
        .attr("y", d => y(d.value))
        .attr("height", d => H - m.bottom - y(d.value));

    bars
        .on("mouseenter", (event, d) => {
            showD3Tip(
                event,
                `<b>${d.label}</b><br>
                 ผู้ประสบเหตุ: <b>${thaiNum(d.value)}</b> ราย`
            );
        })
        .on("mousemove", moveD3Tip)
        .on("mouseleave", hideD3Tip);

    svg.selectAll(".alcohol-label")
        .data(data)
        .join("text")
        .attr("class", "alcohol-label")
        .attr(
            "x",
            d => x(d.label) + x.bandwidth() / 2
        )
        .attr("y", d => y(d.value) - 8)
        .attr("text-anchor", "middle")
        .style("font-family", "Kanit")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("opacity", 0)
        .text(d => thaiNum(d.value))
        .transition()
        .duration(500)
        .delay(700)
        .style("opacity", 1);
}

/* =========================
   MAP
========================= */

async function drawMap() {
    const map = document.getElementById("map");

    if (!map || typeof d3 === "undefined") {
        return;
    }

    map.innerHTML = "";

    const url =
        "https://raw.githubusercontent.com/chingchai/OpenGISData-Thailand/master/provinces.geojson";

    let geo;

    try {
        geo = await d3.json(url);
    } catch (e) {
        map.innerHTML = `
            <p style="padding:30px;color:#dc2626">
                โหลดแผนที่จังหวัดไม่ได้ แต่ส่วนวิเคราะห์ข้อมูลยังใช้งานได้
            </p>
        `;
        return;
    }

    const width = 900;
    const height = 540;

    const svg = d3.select(map)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");

    const stats = d3.rollup(
        filteredRows,
        v => ({
            total: v.length,
            deaths: v.filter(d => isDeath(d.outcome)).length
        }),
        d => d.province
    );

    const projection = d3.geoMercator()
        .fitSize([width, height], geo);

    const path = d3.geoPath(projection);

    const deathValues = [...stats.values()]
        .map(d => d.deaths)
        .filter(v => v > 0)
        .sort((a, b) => a - b);

    const color = d3.scaleQuantile()
        .domain(
            deathValues.length
                ? deathValues
                : [0, 1]
        )
        .range([
            "#fee2e2",
            "#fca5a5",
            "#f87171",
            "#ef4444",
            "#dc2626",
            "#991b1b",
            "#7f1d1d"
        ]);

    const provinces = svg.selectAll(".province")
        .data(geo.features)
        .join("path")
        .attr("class", "province")
        .attr("d", path)
        .attr("fill", feature => {
            const name =
                feature.properties.pro_th ||
                feature.properties.PROV_NAMT ||
                feature.properties.NAME_1 ||
                "";

            const s = stats.get(name);

            return s && s.deaths > 0
                ? color(s.deaths)
                : "#f1f5f9";
        })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.7)
        .style("opacity", 0)
        .style("cursor", "pointer");

    provinces
        .transition()
        .duration(900)
        .delay((d, i) => i * 8)
        .style("opacity", 1);

    provinces
        .on("mouseenter", function(event, feature) {
            const name =
                feature.properties.pro_th ||
                feature.properties.PROV_NAMT ||
                feature.properties.NAME_1 ||
                "";

            const s = stats.get(name) || {
                total: 0,
                deaths: 0
            };

            d3.select(this)
                .raise()
                .transition()
                .duration(150)
                .attr("stroke", "#111827")
                .attr("stroke-width", 2);

            showD3Tip(
                event,
                `<b>${name}</b><br>
                 ผู้ประสบเหตุ: <b>${thaiNum(s.total)}</b> ราย<br>
                 เสียชีวิต: <b>${thaiNum(s.deaths)}</b> ราย`
            );
        })
        .on("mousemove", moveD3Tip)
        .on("mouseleave", function() {
            d3.select(this)
                .transition()
                .duration(150)
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 0.7);

            hideD3Tip();
        });

    /* Legend */
    const legend = d3.select("#mapLegend");

    if (!legend.empty()) {
        legend.html("");

        const legendWrap = legend
            .append("div")
            .attr("class", "map-legend");

        legendWrap.append("span")
            .text("เสียชีวิตน้อย");

        [
            "#fee2e2",
            "#fca5a5",
            "#f87171",
            "#ef4444",
            "#dc2626",
            "#991b1b",
            "#7f1d1d"
        ].forEach(c => {
            legendWrap.append("i")
                .style("background", c);
        });

        legendWrap.append("span")
            .text("เสียชีวิตมาก");
    }
}

/* =========================
   UPDATE
========================= */

function updateDashboard() {
    updateKPIs();
    updateInsight();

    try {
        drawOutcome();
    } catch (e) {
        console.error("Outcome chart:", e);
    }

    try {
        drawSeverity();
    } catch (e) {
        console.error("Severity chart:", e);
    }

    try {
        drawProvince();
    } catch (e) {
        console.error("Province chart:", e);
    }

    try {
        drawHour();
    } catch (e) {
        console.error("Hour chart:", e);
    }

    try {
        drawFestivalSeverity();
    } catch (e) {
        console.error("Festival chart:", e);
    }

    try {
        drawGenderChart();
    } catch (e) {
        console.error("Gender chart:", e);
    }

    try {
        drawAlcoholChart();
    } catch (e) {
        console.error("Alcohol chart:", e);
    }

    drawMap().catch(e => {
        console.error("Map:", e);
    });
}

/* =========================
   LOAD DATA
========================= */

async function loadData() {
    try {
        const response = await fetch(
            CSV_PATH,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(
                `โหลด CSV ไม่สำเร็จ: HTTP ${response.status}`
            );
        }

        const text = await response.text();
        const parsed = parseCSV(text);

        if (!parsed.length) {
            throw new Error("ไม่พบข้อมูลใน CSV");
        }

        allRows = normalizeRows(parsed);
        filteredRows = [...allRows];

        console.log(
            "CSV loaded:",
            allRows.length,
            "rows"
        );

        console.log(
            "Columns:",
            Object.keys(parsed[0])
        );

        console.log(
            "Outcome values:",
            [...new Set(allRows.map(d => d.outcome))]
        );

        console.log(
            "Death count:",
            allRows.filter(d => isDeath(d.outcome)).length
        );

        setupFilters();
        updateDashboard();

    } catch (error) {
        console.error("CSV ERROR:", error);

        const insight = $("insightText");

        if (insight) {
            insight.innerHTML = `
                <div style="color:#dc2626">
                    เกิดข้อผิดพลาดในการอ่านข้อมูล CSV:
                    ${error.message}
                </div>
            `;
        }
    }
}

loadData();
