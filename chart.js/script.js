
const CSV_PATH = "../../data/songkran_51-57_clean.csv";

let allRows = [];
let filteredRows = [];
let charts = {};

const $ = id => document.getElementById(id);

function cleanText(v) {
    return String(v ?? "").replace(/^\uFEFF/, "").trim();
}

function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;

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
            if (row.some(v => cleanText(v) !== "")) rows.push(row);
            row = [];
        } else {
            cell += c;
        }
    }

    if (cell !== "" || row.length) {
        row.push(cell);
        if (row.some(v => cleanText(v) !== "")) rows.push(row);
    }

    if (!rows.length) return [];

    const headers = rows[0].map(cleanText);
    return rows.slice(1).map(values => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = cleanText(values[i] ?? ""));
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

// ค่าในไฟล์จริงที่หมายถึงเสียชีวิต
const DEATH_OUTCOMES = new Set([
    "ตายที่เกิดเหตุ",
    "ตายในตึกภายใน 24 ชม. หลังเหตุ",
    "ตายที่ห้องฉุกเฉิน",
    "ตายในตึกหลัง 24 ชม. - 30 วัน",
    "ตายระหว่างนำส่ง",
    "ตายระหว่างส่งต่อ"
]);

const isDeath = outcome => DEATH_OUTCOMES.has(cleanText(outcome));
const thaiNum = n => Number(n || 0).toLocaleString("th-TH");

function uniqueValues(field) {
    return [...new Set(allRows.map(d => d[field]).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "th"));
}

function fillSelect(id, field) {
    const el = $(id);
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

    ["festivalFilter", "provinceFilter", "genderFilter", "alcoholFilter"]
        .forEach(id => $(id).addEventListener("change", applyFilters));

    $("resetBtn").addEventListener("click", () => {
        ["festivalFilter", "provinceFilter", "genderFilter", "alcoholFilter"]
            .forEach(id => $(id).value = "all");
        applyFilters();
    });
}

function applyFilters() {
    const f = $("festivalFilter").value;
    const p = $("provinceFilter").value;
    const g = $("genderFilter").value;
    const a = $("alcoholFilter").value;

    filteredRows = allRows.filter(d =>
        (f === "all" || d.festival === f) &&
        (p === "all" || d.province === p) &&
        (g === "all" || d.gender === g) &&
        (a === "all" || d.alcohol === a)
    );

    updateKPIs();
    updateInsight();
    try { drawFestivalSeverity(); } catch (e) { console.error("Festival chart:", e); }
    try { drawGenderChart(); } catch (e) { console.error("Gender chart:", e); }
    try { drawAlcoholChart(); } catch (e) { console.error("Alcohol chart:", e); }

    try { drawOutcome(); } catch (e) { console.error("Outcome chart:", e); }
    try { drawSeverity(); } catch (e) { console.error("Severity chart:", e); }
    try { drawProvince(); } catch (e) { console.error("Province chart:", e); }
    try { drawHour(); } catch (e) { console.error("Hour chart:", e); }
    try { drawMap(); } catch (e) { console.error("Map:", e); }
}

function updateKPIs() {
    const total = filteredRows.length;
    const deaths = filteredRows.filter(d => isDeath(d.outcome)).length;
    const provinces = new Set(filteredRows.map(d => d.province).filter(Boolean)).size;

    $("kpiTotal").textContent = thaiNum(total);
    $("kpiDeaths").textContent = thaiNum(deaths);
    $("kpiRate").textContent = total ? ((deaths / total) * 100).toFixed(2) + "%" : "0.00%";
    $("kpiProvinces").textContent = thaiNum(provinces);
}


function updateInsight() {
    const total = filteredRows.length;
    const deaths = filteredRows.filter(d => isDeath(d.outcome)).length;
    const alive = total - deaths;
    const rate = total ? ((deaths / total) * 100).toFixed(2) : "0.00";

    const gender = new Map();
    filteredRows.forEach(d => {
        const key=d.gender || "ไม่ทราบ";
        gender.set(key,(gender.get(key)||0)+1);
    });
    const genderText=[...gender.entries()]
        .sort((a,b)=>b[1]-a[1])
        .map(([k,v])=>`${k} ${thaiNum(v)} ราย`).join(" • ") || "-";

    const alcohol = new Map();
    filteredRows.forEach(d => {
        const key=d.alcohol || "ไม่ทราบ";
        alcohol.set(key,(alcohol.get(key)||0)+1);
    });
    const alcoholText=[...alcohol.entries()]
        .sort((a,b)=>b[1]-a[1])
        .map(([k,v])=>`${k} ${thaiNum(v)} ราย`).join(" • ") || "-";

    const outcomes = new Map();
    filteredRows.forEach(d=>{
        const key=d.outcome || "ไม่ทราบ";
        outcomes.set(key,(outcomes.get(key)||0)+1);
    });
    const outcomeText=[...outcomes.entries()]
        .sort((a,b)=>b[1]-a[1])
        .map(([k,v])=>`${k} ${thaiNum(v)} ราย`).join(" • ") || "-";

    const provinces = new Map();
    filteredRows.forEach(d=>{
        if(d.province) provinces.set(d.province,(provinces.get(d.province)||0)+1);
    });
    const topProvince=[...provinces.entries()].sort((a,b)=>b[1]-a[1])[0];

    const hours = Array.from({length:24},(_,h)=>({h,value:0}));
    filteredRows.forEach(d=>{
        const h=extractHour(d.time);
        if(h!==null) hours[h].value++;
    });
    const peakHour=hours.sort((a,b)=>b.value-a.value)[0];

    const festivals = new Map();
    filteredRows.forEach(d=>{
        if(!festivals.has(d.festival)) festivals.set(d.festival,{total:0,deaths:0,alive:0});
        const f=festivals.get(d.festival);
        f.total++;
        if(isDeath(d.outcome)) f.deaths++; else f.alive++;
    });
    const festivalText=[...festivals.entries()]
        .sort((a,b)=>a[0].localeCompare(b[0],"th"))
        .map(([k,v])=>`${k}: ${thaiNum(v.total)} ราย (ไม่เสียชีวิต ${thaiNum(v.alive)}, เสียชีวิต ${thaiNum(v.deaths)})`)
        .join("<br>");

    const el=$("insightText");
    el.innerHTML = `
        <div class="summary-grid">
            <div><b>ผู้ประสบเหตุทั้งหมด</b><br>${thaiNum(total)} ราย</div>
            <div><b>ผู้เสียชีวิต</b><br>${thaiNum(deaths)} ราย (${rate}%)</div>
            <div><b>ไม่เสียชีวิต</b><br>${thaiNum(alive)} ราย (${total ? ((alive/total)*100).toFixed(2) : "0.00"}%)</div>
            <div><b>จังหวัดที่มีข้อมูลมากที่สุด</b><br>${topProvince ? `${topProvince[0]} ${thaiNum(topProvince[1])} ราย` : "-"}</div>
            <div><b>เพศ</b><br>${genderText}</div>
            <div><b>การดื่มสุรา</b><br>${alcoholText}</div>
            <div class="wide"><b>ผลการรักษา</b><br>${outcomeText}</div>
            <div class="wide"><b>ช่วงเวลาที่มีผู้ประสบเหตุมากที่สุด</b><br>${peakHour ? `${String(peakHour.h).padStart(2,"0")}:00 น. จำนวน ${thaiNum(peakHour.value)} ราย` : "-"}</div>
            <div class="wide"><b>จำนวนผู้ประสบเหตุตามเทศกาล</b><br>${festivalText || "-"}</div>
        </div>
    `;
}


function drawYearChart() {
    destroyChart("year");
    const map=new Map();
    filteredRows.forEach(d=>{
        if(!map.has(d.festival)) map.set(d.festival,{total:0,alive:0,deaths:0});
        const x=map.get(d.festival); x.total++;
        if(isDeath(d.outcome)) x.deaths++; else x.alive++;
    });
    const rows=[...map.entries()].map(([festival,v])=>({festival,...v})).sort((a,b)=>a.festival.localeCompare(b.festival,"th"));
    charts.year=new Chart($("yearChart"),{
        type:"bar",
        data:{labels:rows.map(d=>d.festival),datasets:[
            {label:"ทุเลา/หาย",data:rows.map(d=>d.alive),backgroundColor:"#60a5fa",borderRadius:6},
            {label:"เสียชีวิต",data:rows.map(d=>d.deaths),backgroundColor:"#dc2626",borderRadius:6}
        ]},
        options:{responsive:true,maintainAspectRatio:false,animation:{duration:900,easing:"easeOutQuart"},
            plugins:{legend:{position:"bottom",labels:{font:{family:"Kanit"}}}},
            scales:{x:{stacked:false,ticks:{font:{family:"Kanit"}}},y:{stacked:false,ticks:{font:{family:"Kanit"}}}}
        }
    });
}

function drawGenderChart() {
    destroyChart("gender");
    const map=new Map(); filteredRows.forEach(d=>map.set(d.gender,(map.get(d.gender)||0)+1));
    const rows=[...map.entries()].filter(x=>x[0]);
    charts.gender=new Chart($("genderChart"),{
        type:"doughnut",
        data:{labels:rows.map(x=>x[0]),datasets:[{data:rows.map(x=>x[1]),backgroundColor:["#2563eb","#ec4899","#8b5cf6","#14b8a6"],borderColor:"#fff",borderWidth:3}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:"58%",animation:{duration:900},
            plugins:{
                tooltip:{enabled:true},legend:{position:"bottom",labels:{font:{family:"Kanit"}}}}
        }
    });
}

function drawAlcoholChart() {
    destroyChart("alcohol");
    const map=new Map(); filteredRows.forEach(d=>map.set(d.alcohol,(map.get(d.alcohol)||0)+1));
    const rows=[...map.entries()].filter(x=>x[0]);
    const colors={"ดื่ม":"#ef4444","ไม่ดื่ม":"#10b981","ไม่ทราบ":"#94a3b8"};
    charts.alcohol=new Chart($("alcoholChart"),{
        type:"bar",
        data:{labels:rows.map(x=>x[0]),datasets:[{label:"จำนวนผู้ประสบเหตุ",data:rows.map(x=>x[1]),backgroundColor:rows.map(x=>colors[x[0]]||"#6366f1"),borderRadius:8}]},
        options:{responsive:true,maintainAspectRatio:false,animation:{duration:900,easing:"easeOutQuart"},
            plugins:{
                tooltip:{enabled:true},legend:{display:false}},scales:{x:{ticks:{font:{family:"Kanit"}}},y:{ticks:{font:{family:"Kanit"}}}}
        }
    });
}


async function loadData() {
    try {
        const response = await fetch(CSV_PATH, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`โหลด CSV ไม่สำเร็จ: HTTP ${response.status}`);
        }

        const text = await response.text();
        const parsed = parseCSV(text);

        if (!parsed.length) {
            throw new Error("ไม่พบข้อมูลใน CSV");
        }

        allRows = normalizeRows(parsed);
        filteredRows = [...allRows];

        console.log("CSV loaded:", allRows.length, "rows");
        console.log("Columns:", Object.keys(parsed[0]));

        setupFilters();
        updateKPIs();
        updateInsight();
        try { drawFestivalSeverity(); } catch (e) { console.error("Festival chart:", e); }
        try { drawGenderChart(); } catch (e) { console.error("Gender chart:", e); }
        try { drawAlcoholChart(); } catch (e) { console.error("Alcohol chart:", e); }

        try { drawOutcome(); } catch (e) { console.error("Outcome chart:", e); }
        try { drawSeverity(); } catch (e) { console.error("Severity chart:", e); }
        try { drawProvince(); } catch (e) { console.error("Province chart:", e); }
        try { drawHour(); } catch (e) { console.error("Hour chart:", e); }
        try { drawMap(); } catch (e) { console.error("Map:", e); }

    } catch (error) {
        console.error("CSV ERROR:", error);
        $("insightText").textContent = "เกิดข้อผิดพลาดในการอ่านข้อมูล CSV: " + error.message;
    }
}

function destroyChart(name) {
    if (charts[name]) {
        charts[name].destroy();
        charts[name] = null;
    }
}

const chartFont = { family: "Kanit" };

function drawOutcome() {
    destroyChart("outcome");

    const counts = new Map();
    filteredRows.forEach(d => counts.set(d.outcome, (counts.get(d.outcome) || 0) + 1));

    const rows = [...counts.entries()].sort((a,b) => b[1] - a[1]);
    const labels = rows.map(x => x[0]);
    const values = rows.map(x => x[1]);

    charts.outcome = new Chart($("outcomeChart"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "จำนวนผู้ประสบเหตุ",
                data: values,
                backgroundColor: labels.map(x => isDeath(x) ? "#dc2626" : "#f59e0b"),
                borderRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { font: chartFont } },
                y: { ticks: { font: chartFont } }
            }
        }
    });
}

function drawSeverity() {
    destroyChart("severity");

    const deaths = filteredRows.filter(d => isDeath(d.outcome)).length;
    const alive = filteredRows.length - deaths;

    charts.severity = new Chart($("severityChart"), {
        type: "doughnut",
        data: {
            labels: ["ไม่เสียชีวิต", "เสียชีวิต"],
            datasets: [{
                data: [alive, deaths],
                backgroundColor: ["#f59e0b", "#dc2626"],
                borderWidth: 3,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "58%",
            plugins: { legend: { position: "bottom", labels: { font: chartFont } } }
        }
    });
}

function drawProvince() {
    destroyChart("province");

    const counts = new Map();
    filteredRows.forEach(d => {
        if (d.province) counts.set(d.province, (counts.get(d.province) || 0) + 1);
    });

    const rows = [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0,10);

    charts.province = new Chart($("provinceChart"), {
        type: "bar",
        data: {
            labels: rows.map(x => x[0]),
            datasets: [{
                label: "ผู้ประสบเหตุ",
                data: rows.map(x => x[1]),
                backgroundColor: "#2563eb",
                borderRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { font: chartFont } },
                y: { ticks: { font: chartFont } }
            }
        }
    });
}

function extractHour(value) {
    const match = String(value).match(/(\d{1,2})/);
    if (!match) return null;
    const hour = Number(match[1]);
    return hour >= 0 && hour <= 23 ? hour : null;
}

function drawHour() {
    destroyChart("hour");

    const hours = Array.from({length:24}, (_,h) => ({h, value:0}));

    filteredRows.forEach(d => {
        const h = extractHour(d.time);
        if (h !== null) hours[h].value++;
    });

    charts.hour = new Chart($("hourChart"), {
        type: "line",
        data: {
            labels: hours.map(d => `${String(d.h).padStart(2,"0")}:00`),
            datasets: [{
                label: "ผู้ประสบเหตุ",
                data: hours.map(d => d.value),
                borderColor: "#2563eb",
                backgroundColor: "rgba(37,99,235,.12)",
                fill: true,
                tension: .3,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { font: chartFont } },
                y: { ticks: { font: chartFont } }
            }
        }
    });
}

async function drawMap() {
    const map = document.getElementById("map");
    if (!map || typeof d3 === "undefined") return;

    map.innerHTML = "";

    const GEOJSON_URL = "https://raw.githubusercontent.com/chingchai/OpenGISData-Thailand/master/provinces.geojson";

    let geoData;
    try {
        geoData = await d3.json(GEOJSON_URL);
    } catch (e) {
        map.innerHTML = "<p style='padding:30px;color:#dc2626'>โหลดแผนที่จังหวัดไม่ได้ แต่ส่วนวิเคราะห์ข้อมูลยังใช้งานได้</p>";
        return;
    }

    const width = 900, height = 540;
    const svg = d3.select(map).append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const stats = d3.rollup(
        filteredRows,
        v => ({
            total: v.length,
            deaths: v.filter(d => isDeath(d.outcome)).length
        }),
        d => d.province
    );

    const projection = d3.geoMercator().fitSize([width, height], geoData);
    const path = d3.geoPath(projection);
    const maxDeath = d3.max([...stats.values()], d => d.deaths) || 1;
    const color = d3.scaleSequential(d3.interpolateReds).domain([0, maxDeath]);

    svg.selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("class", "province")
        .attr("d", path)
        .attr("fill", feature => {
            const name = feature.properties.pro_th ||
                         feature.properties.PROV_NAMT ||
                         feature.properties.NAME_1 || "";
            const s = stats.get(name);
            return s ? color(s.deaths) : "#eef1f5";
        })
        .append("title")
        .text(feature => {
            const name = feature.properties.pro_th ||
                         feature.properties.PROV_NAMT ||
                         feature.properties.NAME_1 || "";
            const s = stats.get(name) || {total:0, deaths:0};
            return `${name} | ผู้ประสบเหตุ ${s.total.toLocaleString()} | เสียชีวิต ${s.deaths.toLocaleString()}`;
        });
}


function drawFestivalSeverity() {
    destroyChart("festivalSeverity");

    const counts = new Map();
    filteredRows.forEach(d => {
        if (!counts.has(d.festival)) counts.set(d.festival, {alive:0, deaths:0});
        if (isDeath(d.outcome)) counts.get(d.festival).deaths++;
        else counts.get(d.festival).alive++;
    });

    const rows = [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0],"th"));
    const labels = rows.map(x=>x[0]);

    charts.festivalSeverity = new Chart($("festivalSeverityChart"), {
        type:"bar",
        data:{
            labels,
            datasets:[
                {
                    label:"ไม่เสียชีวิต",
                    data:rows.map(x=>x[1].alive),
                    backgroundColor:"#3b82f6",
                    borderRadius:7,
                    hoverBorderWidth:3
                },
                {
                    label:"เสียชีวิต",
                    data:rows.map(x=>x[1].deaths),
                    backgroundColor:"#ef4444",
                    borderRadius:7,
                    hoverBorderWidth:3
                }
            ]
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            animation:{duration:1000,easing:"easeOutQuart"},
            interaction:{mode:"nearest",intersect:true},
            plugins:{
                legend:{position:"bottom",labels:{font:chartFont}},
                tooltip:{
                    enabled:true,
                    displayColors:true,
                    callbacks:{
                        title:items => `เทศกาล ${labels[items[0].dataIndex]}`,
                        label:ctx=>`${ctx.dataset.label}: ${thaiNum(ctx.raw)} ราย`,
                        afterBody:items=>{
                            const i=items[0]?.dataIndex;
                            if(i==null) return "";
                            const total=rows[i][1].alive+rows[i][1].deaths;
                            return `ทั้งหมด: ${thaiNum(total)} ราย`;
                        }
                    }
                }
            },
            scales:{
                x:{ticks:{font:chartFont}},
                y:{ticks:{font:chartFont}}
            }
        }
    });
}

loadData();
