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

    const isMobile = window.innerWidth <= 768;

    function equalizeCardHeights(containerEl) {
        if (!isMobile) return;
        requestAnimationFrame(function() {
            const cards = Array.from(containerEl.querySelectorAll('.candidate-card'));
            if (!cards.length) return;

            cards.forEach(c => { c.style.minHeight = ''; });

            const yoonCards = cards.filter(c => c.querySelector('.yoon-badge'));
            if (!yoonCards.length) return;

            const refH = Math.max(...yoonCards.map(c => c.offsetHeight));
            cards.forEach(c => { c.style.minHeight = refH + 'px'; });
        });
    }

    const mapWrapper = document.getElementById("map-wrapper");
    const rawW = mapWrapper ? Math.round(mapWrapper.getBoundingClientRect().width) : 640;
    const width = rawW > 0 ? rawW : 640, height = width;

    const svg     = d3.select("#map-container").append("svg").attr("width", width).attr("height", height);
    const g       = svg.append("g");
    const tooltip = d3.select("#tooltip");

    let persistentlySelectedName = null;
    const pendingRegion = new URLSearchParams(window.location.search).get('region');

    const _fill = setFill
        ? (name, color) => setFill(g, name, color)
        : (name, color) => d3.select(`path[data-name='${name}']`).style("fill", color);
    function setRegionColor(name, color) { _fill(name, color); }

    function deactivateRegion(name) {
        setRegionColor(name, initialFill(name));
        persistentlySelectedName = null;
        updateInfoPanel(null);
    }

    window.activateRegion = function(name) {
        document.getElementById("search-input").value = "";
        if (persistentlySelectedName)
            setRegionColor(persistentlySelectedName, initialFill(persistentlySelectedName));
        persistentlySelectedName = name;
        setRegionColor(name, getRegionColor(name));
        updateInfoPanel(name);
    };

    window.executeSearch = function() {
        const rawTerm = document.getElementById("search-input").value.trim().toLowerCase();
        const iw = d3.select("#info-wrapper");

        if (!rawTerm) { updateInfoPanel(persistentlySelectedName); return; }

        const iwEl = document.getElementById('info-wrapper');
        if (window.innerWidth <= 768 && iwEl) {
            iwEl.scrollTop = 0;
            iwEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (persistentlySelectedName) {
            setRegionColor(persistentlySelectedName, initialFill(persistentlySelectedName));
            persistentlySelectedName = null;
        }

        const expanded = expandTerm(rawTerm);

        iw.selectAll(".info-divider,.candidate-list,.search-results,.no-candidate-msg").remove();
        d3.select("#info-title").text(`"${rawTerm}" 검색`).style("display", "").style("font-size", "20px");
        d3.select("#info-desc").text("후보자를 클릭하면 해당 선거구로 이동합니다.").style("color", "#666").style("font-size", "");
        iw.append("hr").attr("class", "info-divider");

        const rc = iw.append("div").attr("class", "search-results");
        const candSec = rc.append("div").attr("class", "candidate-list");

        const candidateResults = [];
        listRegions().forEach(rName => {
            (getCandidates(rName) || []).forEach(c => {
                const name = candidateName(c);
                if (name && name.toLowerCase().includes(rawTerm))
                    candidateResults.push({ regionName: rName, name, candidate: c });
            });
        });

        candidateResults.sort((a, b) =>
            a.name.localeCompare(b.name) || a.regionName.localeCompare(b.regionName));

        candidateResults.forEach(({ regionName, name, candidate: c }) => {
            buildCandidateCard(candSec, {
                ...cardOpts(c, name), name,
                yoon: c.yoon, election,
                isSearch: true, regionLabel: regionName,
                onClick: () => window.activateRegion(regionName),
            });
        });

        if (!candidateResults.length)
            rc.append("p").attr("class", "no-candidate-msg").text("검색 결과가 없습니다.");

        equalizeCardHeights(candSec.node());
    };

    function updateInfoPanel(regionName) {
        const iw = d3.select("#info-wrapper");
        iw.selectAll(".info-divider,.candidate-list,.search-results,.no-candidate-msg").remove();

        const iwEl = document.getElementById('info-wrapper');
        if (window.innerWidth <= 768 && iwEl) iwEl.scrollTop = 0;

        if (!regionName) {
            d3.select("#info-title").text("").style("display", "none");
            d3.select("#info-desc").text("YOON을 찾아봅시다!").style("color", "#000").style("font-size", "14px");
            iw.append("hr").attr("class", "info-divider");
            return;
        }

        d3.select("#info-title").text(regionName).style("display", "").style("font-size", "");

        if (isNoElection(regionName)) {
            d3.select("#info-desc").text(noElectionMsg).style("color", "#666").style("font-size", "");
            iw.append("hr").attr("class", "info-divider");
            return;
        }

        const candidates = getCandidates(regionName) || [];
        const hasYoon = candidates.some(c => c.yoon);

        d3.select("#info-desc")
            .text(hasYoon ? "YOON이 발견되었습니다!" : "YOON이 발견되지 않았습니다!")
            .style("color", hasYoon ? "#ae1932" : "#666")
            .style("font-size", "");
        iw.append("hr").attr("class", "info-divider");

        if (candidates.length) {
            const list = iw.append("div").attr("class", "candidate-list");
            candidates.forEach(c => {
                const name = candidateName(c);
                buildCandidateCard(list, { ...cardOpts(c, name), name, yoon: c.yoon, election });
            });
            equalizeCardHeights(list.node());
        } else {
            iw.append("p").attr("class", "no-candidate-msg").text("등록된 후보가 없습니다.");
        }
    }

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
                    d3.select("#info-title").text(name).style("display", "").style("font-size", "");
                    d3.select("#info-desc").text(noElectionMsg).style("color", "#666").style("font-size", "");
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