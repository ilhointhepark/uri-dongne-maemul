// 대시보드 클라이언트: listings.json 로드 → 3탭 렌더 + Leaflet/OSM 핀(키 불필요)
let LISTINGS = [];
let MAP = null, MARKERS = [];

async function boot() {
  const data = await fetch("data/listings.json").then(r => r.json()).catch(() => ({listings: []}));
  LISTINGS = (data.listings || []).filter(l => l.matched);
  document.getElementById("updated").textContent = data.updated ? `갱신 ${data.updated}` : "";
  setupTabs();
  setupFilters();
  buildGuFilter();
  initMap();
  render();
}

function buildGuFilter() {
  const gus = [...new Set(LISTINGS.map(l => l.dong).filter(Boolean))].sort();
  const box = document.getElementById("f-gu");
  box.innerHTML = gus.map(g =>
    `<label class="gu-chip"><input type="checkbox" value="${g}" checked>${g.replace(/^서울\s*/, "")}</label>`
  ).join("");
  box.querySelectorAll("input").forEach(cb => cb.addEventListener("change", render));
}

function initMap() {
  const center = LISTINGS.find(l => l.lat && l.lng) || {lat: 37.5172, lng: 127.0473};
  MAP = L.map("map").setView([center.lat, center.lng], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap"
  }).addTo(MAP);
  // flex 컨테이너 크기가 늦게 잡히는 경우 대비해 여러 시점에 재계산
  [100, 400, 900].forEach(ms => setTimeout(() => MAP.invalidateSize(), ms));
  window.addEventListener("resize", () => MAP.invalidateSize());
}

function drawMarkers(rows) {
  if (!MAP) return;
  MARKERS.forEach(m => m.remove()); MARKERS = [];
  rows.filter(r => r.lat && r.lng).forEach(r => {
    const mk = L.marker([r.lat, r.lng]).addTo(MAP).bindPopup(
      `<b>${r.complex}</b><br>${fmtPrice(r.price)} · ${r.area_py}평 ${r.floor}`
      + `<br><a href="${r.url}" target="_blank">매물 보기</a>`);
    MARKERS.push(mk);
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "map" && MAP) setTimeout(() => MAP.invalidateSize(), 0);
    };
  });
}

function setupFilters() {
  ["f-max", "f-dong", "f-sort"].forEach(id =>
    document.getElementById(id).addEventListener("input", render));
}

function currentRows() {
  const max = parseInt(document.getElementById("f-max").value, 10);
  const q = document.getElementById("f-dong").value.trim();
  const sort = document.getElementById("f-sort").value;
  const gus = [...document.querySelectorAll("#f-gu input:checked")].map(c => c.value);
  let rows = LISTINGS.slice();
  if (gus.length) rows = rows.filter(r => gus.includes(r.dong));
  if (!isNaN(max)) rows = rows.filter(r => r.price <= max);
  if (q) rows = rows.filter(r => (r.complex || "").includes(q) || (r.dong || "").includes(q));
  rows.sort((a, b) => {
    if (sort === "discount") return (b.discount_pct ?? -1e9) - (a.discount_pct ?? -1e9);
    if (sort === "price") return a.price - b.price;
    return (b.first_seen || "").localeCompare(a.first_seen || "");
  });
  return rows;
}

function fmtPrice(p) { return p.toLocaleString() + "만"; }
function discBadge(r) {
  if (r.discount_pct == null) return "";
  const cls = r.discount_pct >= 0 ? "down" : "up";
  const sign = r.discount_pct >= 0 ? "▼" : "▲";
  return ` <span class="${cls}">${sign}${Math.abs(r.discount_pct)}%</span>`;
}
function rowHtml(r) {
  const isNew = r.is_new ? `<span class="badge-new">NEW</span> ` : "";
  return `<div class="row" data-lat="${r.lat}" data-lng="${r.lng}">
    ${isNew}<b>${r.complex}</b> ${r.area_py}평 ${r.floor}<br>
    ${fmtPrice(r.price)}${discBadge(r)}
    <a href="${r.url}" target="_blank" style="float:right">보기</a></div>`;
}

function render() {
  const rows = currentRows();
  document.getElementById("map-list").innerHTML = rows.map(rowHtml).join("") || "<p>매칭 매물 없음</p>";
  document.getElementById("deal-grid").innerHTML =
    rows.slice().sort((a,b)=>(b.discount_pct??-1e9)-(a.discount_pct??-1e9))
        .map(r => `<div class="card">${rowHtml(r)}</div>`).join("");
  const newCnt = rows.filter(r => r.is_new).length;
  const lowCnt = rows.filter(r => (r.discount_pct ?? 0) > 0).length;
  document.getElementById("kpis").innerHTML =
    `<div class="kpi"><b>${rows.length}</b>매칭</div>
     <div class="kpi"><b>${newCnt}</b>신규</div>
     <div class="kpi"><b>${lowCnt}</b>실거래가↓</div>`;
  document.getElementById("feed").innerHTML =
    rows.filter(r => r.is_new).map(rowHtml).join("") || "<p>오늘 신규 없음</p>";
  drawMarkers(rows);
}

document.addEventListener("DOMContentLoaded", boot);
