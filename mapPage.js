// ============================================================
//  MAP PAGE FACTORY  ·  metro / edu / local / re 공통 로직
// ============================================================
/**
 * @param {Object}   cfg
 * @param {string}   cfg.election        선거 종류 문자열
 * @param {string}   cfg.geoFile         GeoJSON 파일 경로
 * @param {Function} cfg.listRegions     () => string[]
 * @param {Function} cfg.getCandidates   (regionName) => candidate[]
 * @param {Function} cfg.cardOpts        (candidate, displayName) => buildCandidateCard 추가 opts
 * @param {Function} cfg.geoKey          (d3Feature) => string
 *
 * [선택 — 기본값 있음]
 * @param {Function} cfg.candidateName   (candidate) => string
 * @param {Function} cfg.initialFill     (name) => colorString
 * @param {Function} cfg.hasData         (name) => bool
 * @param {Function} cfg.isNoElection    (name) => bool
 * @param {string}   cfg.noElectionMsg
 * @param {Function} cfg.expandTerm      (rawTerm) => expandedTerm
 * @param {Function} cfg.regionMatches   (name, raw, expanded) => bool
 * @param {Function} cfg.setFill         (g, name, color) => void
 * @param {Function} cfg.onGeoLoaded     ({ svg, g, regions, zoom, width, tooltip,
 *                                          setRegionColor, initialFill,
 *                                          getPersisted, deactivateRegion }) => void
 */
function createMapPage(cfg) {
    const {
        election, geoFile,
        listRegions, getCandidates, cardOpts, geoKey,
        candidateName = c => (c.이름 || '').split('(')[0].trim(),
        initialFill   = () => '#ccc',
        hasData       = () => true,
        isNoElection  = () => false,
        noElectionMsg = '해당 지역에서는 선거가 치러지지 않습니다!',
        expandTerm    = t => t,
        regionMatches = (name, _raw, exp) => name.toLowerCase().includes(exp),
        setFill       = null,
        onGeoLoaded   = () => {},
        baseScale = 0.85, maxScale = 5.0, numSteps = 14,
        translateX = 40, translateY = 40,
    } = cfg;

    // ── 모바일 여부 ──────────────────────────────────────────
    const isMobile = window.innerWidth <= 768;

    // ── 모바일 검색 placeholder 변경 ─────────────────────────
    if (isMobile) {
        const si = document.getElementById("search-input");
        if (si) si.placeholder = "후보 검색";
    }

    // ── 모바일 후보자 카드 높이 균일화 ───────────────────────
    // YOON 배지 유무와 무관하게 모든 카드가 동일 세로 길이를 갖도록
    // 현재까지 관측된 최대 높이(ratchet)를 전역 기준으로 유지한다.
    let maxCardH = 0;

    function equalizeCardHeights() {
        if (!isMobile) return;
        requestAnimationFrame(function() {
            const cards = document.querySelectorAll(
                '#info-wrapper .candidate-card'
            );
            if (!cards.length) return;

            // min-height 초기화 후 자연 높이 측정 (offsetHeight가 reflow 강제)
            cards.forEach(c => { c.style.minHeight = ''; });
            let localMax = 0;
            cards.forEach(c => { localMax = Math.max(localMax, c.offsetHeight); });

            // 전역 최대값 갱신 (감소 없음 — YOON 카드 높이 기억 유지)
            if (localMax > maxCardH) maxCardH = localMax;

            // 전역 최대값을 현재 모든 카드에 적용
            if (maxCardH > 0) {
                cards.forEach(c => { c.style.minHeight = maxCardH + 'px'; });
            }
        });
    }

    // ── 캔버스 크기 ──────────────────────────────────────────
    const mapWrapper = document.getElementById("map-wrapper");
    const rawW = mapWrapper ? Math.round(mapWrapper.getBoundingClientRect().width) : 640;
    const width = rawW > 0 ? rawW : 640, height = width;

    const svg     = d3.select("#map-container").append("svg").attr("width", width).attr("height", height);
    const g       = svg.append("g");
    const tooltip = d3.select("#tooltip");

    let persistentlySelectedName = null;
    const pendingRegion = new URLSearchParams(window.location.search).get('region');

    // ── fill 제어 ────────────────────────────────────────────
    const _fill = setFill
        ? (name, color) => setFill(g, name, color)
        : (name, color) => d3.select(`path[data-name='${name}']`).style("fill", color);

    function setRegionColor(name, color) { _fill(name, color); }

    function deactivateRegion(name) {
        setRegionColor(name, initialFill(name));
        persistentlySelectedName = null;
        updateInfoPanel(null);
    }

    // ── 지역 활성화 ──────────────────────────────────────────
    window.activateRegion = function(name) {
        document.getElementById("search-input").value = "";
        if (persistentlySelectedName)
            setRegionColor(persistentlySelectedName, initialFill(persistentlySelectedName));
        persistentlySelectedName = name;
        setRegionColor(name, getRegionColor(name));
        updateInfoPanel(name);
    };

    // ── 검색 ─────────────────────────────────────────────────
    window.executeSearch = function() {
        const rawTerm = document.getElementById("search-input").value.trim().toLowerCase();
        const iw = d3.select("#info-wrapper");

        if (!rawTerm) { updateInfoPanel(persistentlySelectedName); return; }

        const expanded = expandTerm(rawTerm);

        iw.selectAll(".info-divider,.candidate-list,.search-results,.no-candidate-msg").remove();
        d3.select("#info-title").text(`"${rawTerm}" 검색 결과`);
        d3.select("#info-desc").text("결과를 클릭하면 해당 지역으로 이동합니다.").style("color", "#666");
        iw.append("hr").attr("class", "info-divider");

        const rc = iw.append("div").attr("class", "search-results");
        // 모바일: 지역 섹션 생성 안 함 (후보 검색만)
        const regSec  = isMobile ? null : rc.append("div").attr("class", "results-section");
        const candSec = rc.append("div").attr("class", "results-section");

        const regionResults = [], candidateResults = [];
        listRegions().forEach(rName => {
            // 모바일: 지역 검색 결과 제외
            if (!isMobile && rawTerm.length > 1 && regionMatches(rName, rawTerm, expanded))
                regionResults.push(rName);
            (getCandidates(rName) || []).forEach(c => {
                const name = candidateName(c);
                if (name && name.toLowerCase().includes(rawTerm))
                    candidateResults.push({ regionName: rName, name, candidate: c });
            });
        });

        regionResults.sort((a, b) => a.localeCompare(b));
        candidateResults.sort((a, b) =>
            a.name.localeCompare(b.name) || a.regionName.localeCompare(b.regionName));

        if (regSec) {
            regionResults.forEach(rName => {
                regSec.append("div").attr("class", "search-result-region")
                    .style("border-left", `6px solid ${getRegionColor(rName)}`)
                    .text(`🗺️ ${rName}`)
                    .on("click", () => window.activateRegion(rName));
            });
        }

        candidateResults.forEach(({ regionName, name, candidate: c }) => {
            buildCandidateCard(candSec, {
                ...cardOpts(c, name), name,
                yoon: c.yoon, election,
                isSearch: true, regionLabel: regionName,
                onClick: () => window.activateRegion(regionName),
            });
        });

        if (!regionResults.length && !candidateResults.length)
            rc.append("p").attr("class", "no-candidate-msg").text("검색 결과가 없습니다.");

        equalizeCardHeights();
    };

    // ── 인포패널 갱신 ─────────────────────────────────────────
    function updateInfoPanel(regionName) {
        const iw = d3.select("#info-wrapper");
        iw.selectAll(".info-divider,.candidate-list,.search-results,.no-candidate-msg").remove();

        if (!regionName) {
            d3.select("#info-title").text("내 지역을 클릭해보세요");
            d3.select("#info-desc").text("YOON을 찾아봅시다!").style("color", "#666");
            return;
        }

        d3.select("#info-title").text(regionName);

        if (isNoElection(regionName)) {
            d3.select("#info-desc").text(noElectionMsg).style("color", "#666");
            iw.append("hr").attr("class", "info-divider");
            return;
        }

        const candidates = getCandidates(regionName) || [];
        const hasYoon = candidates.some(c => c.yoon);

        d3.select("#info-desc")
            .text(hasYoon ? "YOON이 발견되었습니다!" : "YOON이 발견되지 않았습니다!")
            .style("color", hasYoon ? "#ae1932" : "#666");
        iw.append("hr").attr("class", "info-divider");

        if (candidates.length) {
            const list = iw.append("div").attr("class", "candidate-list");
            candidates.forEach(c => {
                const name = candidateName(c);
                buildCandidateCard(list, { ...cardOpts(c, name), name, yoon: c.yoon, election });
            });
        } else {
            iw.append("p").attr("class", "no-candidate-msg").text("등록된 후보가 없습니다.");
        }

        equalizeCardHeights();
    }

    // ── 지도 렌더링 ──────────────────────────────────────────
    d3.json(geoFile).then(function(data) {
        const projection = d3.geoIdentity().reflectY(true).fitSize([width, height], data);
        const path       = d3.geoPath().projection(projection);

        const regions = g.selectAll("path")
            .data(data.features).enter()
            .append("path")
            .attr("d", path)
            .attr("class", "land")
            .attr("data-name", d => geoKey(d))
            .style("fill", d => initialFill(geoKey(d)))
            .on("mouseover", function(e, d) {
                const name = geoKey(d);
                tooltip.style("display", "block").html(name);
                if (persistentlySelectedName !== name) setRegionColor(name, getRegionColor(name));
            })
            .on("mousemove", e =>
                tooltip.style("top", `${e.pageY - 10}px`).style("left", `${e.pageX + 10}px`))
            .on("mouseout", function(e, d) {
                const name = geoKey(d);
                tooltip.style("display", "none");
                if (persistentlySelectedName !== name) setRegionColor(name, initialFill(name));
            })
            .on("click", function(e, d) {
                const name = geoKey(d);
                if (!hasData(name)) {
                    const iw = d3.select("#info-wrapper");
                    iw.selectAll(".info-divider,.candidate-list,.search-results,.no-candidate-msg").remove();
                    d3.select("#info-title").text(name);
                    d3.select("#info-desc").text(noElectionMsg).style("color", "#666");
                    iw.append("hr").attr("class", "info-divider");
                    return;
                }
                if (persistentlySelectedName === name) {
                    deactivateRegion(name);
                } else {
                    window.activateRegion(name);
                }
            });

        const zoom = initMapZoomAndSyringe({ svg, g, baseScale, maxScale, numSteps, translateX, translateY });

        onGeoLoaded({
            svg, g, regions, zoom, width, tooltip,
            setRegionColor, initialFill,
            getPersisted:     () => persistentlySelectedName,
            deactivateRegion,
        });

        if (pendingRegion) window.activateRegion(pendingRegion);
    });
}