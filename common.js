// ============================================================
//  UTILITIES
// ============================================================
function copyEmail() {
    navigator.clipboard.writeText("whoisyoonkr@gmail.com").then(() => {
        alert("이메일 주소가 복사되었습니다!\n원하시는 메일에서 붙여넣기 해주세요.");
    }).catch(() => {
        alert("복사에 실패했습니다. whoisyoonkr@gmail.com으로 연락주세요.");
    });
}

// ============================================================
//  COLOR MAP  (전체명 + 재보궐 약칭 통합)
// ============================================================
const colorMap = {
    // 전체명 — 광역단체장 / 교육감 / 기초단체장 지도
    "서울특별시":         "#ae1932",
    "부산광역시":         "#e5007f",
    "대구광역시":         "#008837",
    "인천광역시":         "#0079c1",
    "전남광주통합특별시": "#f78711",
    "대전광역시":         "#00ae4d",
    "울산광역시":         "#008c95",
    "세종특별자치시":     "#01a0c6",
    "경기도":             "#004097",
    "강원특별자치도":     "#d50037",
    "충청북도":           "#724598",
    "충청남도":           "#8c8c70",
    "전북특별자치도":     "#024694",
    "경상북도":           "#0071bb",
    "경상남도":           "#f15a38",
    "제주특별자치도":     "#868686",
    // 약칭 — 재보궐 지도 (전남·광주 분리, 동일 색상)
    "서울": "#ae1932",
    "부산": "#e5007f",
    "대구": "#008837",
    "인천": "#0079c1",
    "광주": "#f78711",
    "전남": "#f78711",
    "대전": "#00ae4d",
    "울산": "#008c95",
    "세종": "#01a0c6",
    "경기": "#004097",
    "강원": "#d50037",
    "충북": "#724598",
    "충남": "#8c8c70",
    "전북": "#024694",
    "경북": "#0071bb",
    "경남": "#f15a38",
    "제주": "#868686",
};

/**
 * 지역명 → 색상
 * 전체명("서울특별시"), 약칭("서울"), 복합명("경기도 수원시", "경기 평택을") 모두 처리
 */
function getRegionColor(name) {
    if (!name) return "#ccc";
    if (colorMap[name]) return colorMap[name];
    return colorMap[name.split(" ")[0]] || "#777";
}

// ============================================================
//  PARTY COLORS
// ============================================================
const partyColors = {
    "더불어민주당": "#003B96",
    "국민의힘":     "#E61E2B",
    "개혁신당":     "#FF7210",
    "진보당":       "#D6001C",
    "여성의당":     "#6400AA",
    "자유통일당":   "#E24A49",
    "정의당":       "#FFED00",
    "국민연합":     "#EC008B",
    "무소속":       "#666666",
    "조국혁신당":   "#0073CF",
    "기본소득당":   "#00D2C3",
    "새미래민주당": "#51BDC5",
    "자유와혁신":   "#A50034",
};

// ============================================================
//  YOON HELPERS
// ============================================================

/** YOON 페이지 앵커 ID 생성 */
function makeYoonAnchorId(election, name) {
    return "yoon-" + election + "-" + name.trim();
}

/** infoBox D3 선택자에 YOON 배지 추가 */
function appendYoonBadge(infoBox, election, name) {
    const anchorId = makeYoonAnchorId(election, name);
    const badge = infoBox.append("a")
        .attr("class", "yoon-badge")
        .attr("href", "yoon.html#" + encodeURIComponent(anchorId));
    badge.append("img").attr("class", "yoon-badge-icon").attr("src", "favicon.png").attr("alt", "");
    badge.append("span").text("YOON");
}

// ============================================================
//  CANDIDATE CARD BUILDER
// ============================================================
/**
 * 후보 카드 DOM 생성
 *
 * @param {d3.Selection} container  - 카드를 삽입할 D3 선택자
 * @param {Object}  opts
 * @param {string}  opts.borderColor  - 왼쪽 테두리 색상
 * @param {string}  opts.imgSrc       - 후보 사진 경로
 * @param {*}       [opts.number]     - 기호 (falsy면 미표시)
 * @param {string}  opts.name         - 후보 이름 (한자 없는 순수 이름)
 * @param {string}  [opts.party]      - 정당명 (falsy면 미표시)
 * @param {boolean} [opts.yoon]       - YOON 배지 표시 여부
 * @param {string}  opts.election     - 선거 종류 (앵커 ID 생성용)
 * @param {boolean} [opts.isSearch]   - 검색 결과 카드 여부 (클릭 커서·스타일 추가)
 * @param {string}  [opts.regionLabel]- 지역 뱃지 텍스트 (isSearch일 때 표시)
 * @param {Function}[opts.onClick]    - 클릭 핸들러
 * @returns {d3.Selection} 생성된 card 선택자
 */
function buildCandidateCard(container, {
    borderColor, imgSrc,
    number, name, party,
    yoon, election,
    isSearch = false, regionLabel,
    onClick,
}) {
    const card = container.append("div")
        .attr("class", isSearch ? "candidate-card search-result-candidate" : "candidate-card")
        .style("border-left", `5px solid ${borderColor}`);

    if (onClick) card.on("click", onClick);

    card.append("img")
        .attr("class", "candidate-img")
        .attr("src", imgSrc)
        .attr("onerror", "this.src='images/default.jpg'");

    const infoBox = card.append("div").attr("class", "candidate-info");

    if (regionLabel)    infoBox.append("div").attr("class", "region-badge").text(regionLabel);
    if (number != null) infoBox.append("div").attr("class", "candidate-number").text(`기호 ${number}번`);
    infoBox.append("div").attr("class", "candidate-name").text(name);
    if (party)          infoBox.append("div").attr("class", "candidate-party").style("color", borderColor).text(party);
    if (yoon)           appendYoonBadge(infoBox, election, name);

    return card;
}

// ============================================================
//  MAP ZOOM & SYRINGE UI
// ============================================================
/**
 * 지도 줌 및 주사기(Syringe) UI 연동
 * 모바일에서 wrapper 실제 크기 비율로 scale/translate 자동 보정
 */
function initMapZoomAndSyringe({ svg, g, baseScale, maxScale, numSteps, translateX = 40, translateY = 40 }) {
    // wrapper 실제 픽셀 크기 → 데스크탑 기준(640px) 대비 비율
    const wrapper = document.getElementById("map-wrapper");
    const mapW = wrapper ? Math.round(wrapper.getBoundingClientRect().width) : 640;
    const ratio = (mapW > 0 ? mapW : 640) / 640;

    const adjBase = baseScale * ratio;
    const adjMax  = maxScale  * ratio;
    const adjTX   = translateX * ratio;
    const adjTY   = translateY * ratio;

    const scales = Array.from(
        { length: numSteps },
        (_, i) => adjBase * Math.pow(adjMax / adjBase, i / (numSteps - 1))
    );

    // zoom을 먼저 정의해 tick 클릭 핸들러에서 안전하게 참조
    const zoom = d3.zoom()
        .scaleExtent([adjBase, adjMax])
        .filter(event => {
            if (event.type === "wheel" && event.ctrlKey) return false;
            return !event.button;
        })
        .on("zoom", event => {
            g.attr("transform", event.transform);

            const k = event.transform.k;
            let closestIdx = 0, minDiff = Infinity;
            scales.forEach((s, i) => {
                const d = Math.abs(k - s);
                if (d < minDiff) { minDiff = d; closestIdx = i; }
            });
            ticks.classed("active", (_, i) => i === closestIdx);
        });

    // 주사기 눈금 생성
    const track = d3.select(".syringe-track");
    track.html("");

    const ticks = track.selectAll(".syringe-tick")
        .data(scales)
        .enter()
        .append("div")
        .attr("class", "syringe-tick")
        .style("left", (_, i) => `${(i / (numSteps - 1)) * 100}%`)
        .on("click", (_, d) => {
            svg.transition().duration(600).ease(d3.easeCubicInOut).call(zoom.scaleTo, d);
        });

    ticks.append("div").attr("class", "tick-mark");

    // 초기 위치·배율 설정, 더블클릭 확대 비활성화
    const initial = d3.zoomIdentity.translate(adjTX, adjTY).scale(adjBase);
    svg.call(zoom).on("dblclick.zoom", null).call(zoom.transform, initial);

    return zoom;
}