function copyEmail() {
    navigator.clipboard.writeText("whoisyoonkr@gmail.com").then(() => {
        alert("이메일 주소가 복사되었습니다!\n원하시는 메일에서 붙여넣기 해주세요.");
    }).catch(() => {
        alert("복사에 실패했습니다. whoisyoonkr@gmail.com으로 연락주세요.");
    });
}

const colorMap = {
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

function getRegionColor(name) {
    if (!name) return "#ccc";
    if (colorMap[name]) return colorMap[name];
    return colorMap[name.split(" ")[0]] || "#777";
}

const partyColors = {
    "더불어민주당": "#003B96",
    "국민의힘":     "#E61E2B",
    "개혁신당":     "#FF7210",
    "진보당":       "#D6001C",
    "여성의당":     "#6400AA",
    "자유통일당":   "#E24A49",
    "정의당":       "#FFCC00",
    "국민연합":     "#EC008B",
    "무소속":       "#666666",
    "조국혁신당":   "#0073CF",
    "기본소득당":   "#00D2C3",
    "새미래민주당": "#51BDC5",
    "자유와혁신":   "#A50034",
};

function makeYoonAnchorId(election, name) {
    return "yoon-" + election + "-" + name.trim();
}

function appendYoonBadge(infoBox, election, name) {
    const anchorId = makeYoonAnchorId(election, name);
    const badge = infoBox.append("a")
        .attr("class", "yoon-badge")
        .attr("href", "yoon.html#" + encodeURIComponent(anchorId));
    badge.append("img").attr("class", "yoon-badge-icon").attr("src", "favicon.png").attr("alt", "");
    badge.append("span").text("YOON");
}

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

function initMapZoomAndSyringe({ svg, g, baseScale, maxScale, numSteps, translateX = 40, translateY = 40 }) {
    const wrapper = document.getElementById("map-wrapper");
    const mapW = wrapper ? Math.round(wrapper.getBoundingClientRect().width) : 640;
    const isMobile = mapW < 640;
    const ratio = (mapW > 0 ? mapW : 640) / 640;

    const rawScales = Array.from(
        { length: numSteps },
        (_, i) => baseScale * Math.pow(maxScale / baseScale, i / (numSteps - 1))
    );
    const mobileInitScale = isMobile ? rawScales[Math.min(4, numSteps - 1)] : baseScale;

    const adjBase = baseScale * ratio;
    const adjMax  = maxScale  * ratio;
    const adjTX = isMobile ? mapW * 0.05 : translateX * ratio;
    const adjTY = isMobile ? mapW * 0.10 : translateY * ratio;
    const adjInitScale = mobileInitScale * ratio;

    const scales = Array.from(
        { length: numSteps },
        (_, i) => adjBase * Math.pow(adjMax / adjBase, i / (numSteps - 1))
    );

    const ex0 = -adjTX / adjInitScale;
    const ey0 = -adjTY / adjInitScale;
    const ex1 = (mapW - adjTX) / adjInitScale;
    const ey1 = (mapW - adjTY) / adjInitScale;

    const zoom = d3.zoom()
        .scaleExtent([isMobile ? adjInitScale : adjBase, adjMax])
        .translateExtent([[ex0, ey0], [ex1, ey1]])
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

    const initial = d3.zoomIdentity.translate(adjTX, adjTY).scale(adjInitScale);
    svg.call(zoom).on("dblclick.zoom", null).call(zoom.transform, initial);

    if (isMobile) {
        svg.style('touch-action', 'pan-y');

        zoom.filter(event => {
            if (event.type === 'wheel' && event.ctrlKey) return false;
            if (event.button) return false;
            if (event.type === 'touchstart' && event.touches.length === 1) {
                const t = d3.zoomTransform(svg.node());
                if (Math.abs(t.k - adjInitScale) < 0.01) return false;
            }
            return true;
        });
    }

    return zoom;
}