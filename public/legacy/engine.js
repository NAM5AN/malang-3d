/* =================================================================
       5. 물리 엔진 및 특수 이펙트
    ================================================================= */
    const canvas = document.getElementById("slimeCanvas");
    const ctx = canvas.getContext("2d");

    // 왁스 코팅 껍질 전용 오프스크린 레이어 (깨진 자리를 구멍으로 뚫기 위함)
    const waxCanvas = document.createElement("canvas");
    const waxCtx = waxCanvas.getContext("2d");
    // 본체 전용 오프스크린 (gooey 필터는 반투명을 못 그리므로, 여기 그린 뒤 알파를 입혀 합성)
    const bodyCanvas = document.createElement("canvas");
    const bodyCtx = bodyCanvas.getContext("2d");
    let stretchSmooth = 0; // 늘어남 정도(부드럽게 따라오는 값) → 투명도 연출용

    // 배경색 커스터마이즈 — 투명도를 체감할 수 있도록 사용자가 자유롭게 변경
    let bgColor = localStorage.getItem("malang3d_bg_color") || "#f4eaef";
    let bgFill = "rgba(244, 234, 239, 0.5)";
    function applyBgColor() {
        document.body.style.backgroundColor = bgColor;
        const r = parseInt(bgColor.substr(1, 2), 16);
        const g = parseInt(bgColor.substr(3, 2), 16);
        const b = parseInt(bgColor.substr(5, 2), 16);
        bgFill = `rgba(${r}, ${g}, ${b}, 0.5)`;
    }

    const BG_PRESETS = [
        "#f4eaef", "#ffffff", "#fdf6e3", "#efe6d8",
        "#dbeafe", "#d1f5e0", "#e3ddf7", "#ffe4d6",
        "#ffe783", "#ff9e9e", "#7fc8f8", "#b8e986",
        "#3a3a44", "#1e2a4a", "#3b2a55", "#15151a"
    ];
    // iOS(아이폰/아이패드) 감지 — 전체화면 버튼 숨김 + 흔들림 권한 처리에 사용
    function detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }
    const IS_IOS = detectIOS();

    // iOS면 전체화면 버튼 숨기고, 위쪽 FAB 액션들을 한 칸씩 내려 빈자리 제거
    function applyPlatformUI() {
        if (!detectIOS()) return;
        const fsBtn = document.getElementById("fab-fs");
        if (fsBtn) fsBtn.style.display = "none";
        // 전체화면(맨 위 -402) 제거 → 배경색이 맨 위(-336)면 충분하므로 재배치 불필요
        // (fab-fs만 숨기면 나머지는 그대로 -72~-336에 위치)
    }

    let fabOpen = false;
    function toggleFab() {
        fabOpen = !fabOpen;
        document.getElementById("fab-wrap").classList.toggle("open", fabOpen);
    }
    // FAB 액션: 기능 실행 + 자동 접기
    function fabAct(fn) {
        // 메뉴는 닫지 않고 액션만 실행 (+버튼 다시 눌러야 닫힘)
        fn();
    }

    function openBgModal() {
        document.getElementById("bgModal").style.display = "flex";
        renderBgSwatches();
    }
    function closeBgModal() { document.getElementById("bgModal").style.display = "none"; }

    // 현재 슬라임 새로 꺼내기 (왁스/소성/이펙트 초기화)
    function respawnSlime() {
        initSlime();
        playSquishSound('squish');
    }

    // 전체화면 토글 (전체화면 상태에선 복귀 버튼으로 변신)
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }
    document.addEventListener("fullscreenchange", () => {
        const btn = document.getElementById("fab-fs");
        if (!btn) return;
        btn.title = document.fullscreenElement ? "전체화면 해제" : "전체화면";
    });
    function renderBgSwatches() {
        const grid = document.getElementById("bgSwatches");
        grid.innerHTML = "";
        BG_PRESETS.forEach(c => {
            const sw = document.createElement("div");
            const sel = c.toLowerCase() === bgColor.toLowerCase();
            sw.style.cssText = `width:46px;height:46px;border-radius:14px;background:${c};cursor:pointer;`
                + `border:3px solid ${sel ? '#ffeb3b' : 'rgba(255,255,255,0.4)'};box-sizing:border-box;`;
            sw.onclick = () => {
                bgColor = c;
                localStorage.setItem("malang3d_bg_color", bgColor);
                applyBgColor();
                renderBgSwatches();
            };
            grid.appendChild(sw);
        });
    }
    
    let width, height;
    let core = { x: 0, y: 0, vx: 0, vy: 0 };
    let nodes = [];
    let numNodes = 16; // 현재 슬라임의 노드 수 (initSlime에서 spec.nodeCount로 설정)
    
    let waxIntact = true;
    let waxLayers = null;        // 커스텀 왁스 겹 배열 (null이면 단일 껍질)
    let currentWaxLayer = 0;     // 현재 벗기는 중인 층 인덱스
    let waxLayerBrokenAt = 0;    // 마지막 층 전환 시각 (연속 벗김 쿨다운용)
    let waxShards = [];
    let crunchParticles = [];
    let activePushes = []; 
    let gestureSeq = 0;          // 터치/클릭 1회 = 제스처 1회
    const touchGestures = {};    // touchId → 제스처 번호
    const touchStarts = {};      // touchId → 탭(짧은 터치) 판정용 시작 정보
    let waxChips = [];           // 금/구멍 조각 (코어 기준 상대좌표, 서로 겹치지 않게 배치)
    let decorShards = [];        // 껍질 장식(사과 꼭지+잎)이 떨어질 때의 파편
    let cottonPuffs = [];        // 목화솜 표면 봉우리들 (노드에 앵커, 변형을 따라감)
    let foamBeads = [];          // 폼볼 몸속 폼 알갱이들 (노드에 앵커, 변형을 따라감)
    let fizzBubbles = [];        // 탄산 기포 (몸속에서 보글보글 상승)
    let sparkles = [];           // 글리터 반짝임 (수시로 생겼다 사라짐)
    let jellyFeet = [];          // 해파리 발 (몸통 노드에 앵커된 원 4개)
    let jellyCloud = 0;          // 해파리 탁해짐 (0=투명 → 1=뽀얗게)
    let jellyFace = { lx: 0, ly: 0, rx: 0, ry: 0, mx: 0, my: 0 }; // 눈/입 밀림 (시간 지나면 복귀)
    let auroraHue = 0, auroraSat = 0; // 오로라: 만질 때만 색이 흐름 (초기 흰색)
    let mysteryColor = "#ffffff";     // 미지의 오브: 깨기 전엔 모르는 속살 색
    let galaxyStars = [];             // 우주 덩어리: 내부 은하 별빛
    let lastTouchPt = null;           // 자석 퍼티가 기어갈 마지막 터치 지점
    let jellyHue = 200, jellySat = 50, jellyLit = 80; // 세션 고정 랜덤 색

    // 커스텀 슬라임: 베이스 스펙 위에 재료 효과를 머지 (uid+재료 조합으로 캐싱)
    const customSpecCache = {};
    function buildCustomSpec(cs) {
        const key = cs.uid + ":" + cs.mats.join(",");
        if (customSpecCache[key]) return customSpecCache[key];
        const base = slimeDB.find(x => x.id === cs.baseId) || slimeDB[0];
        const s = Object.assign({}, base);
        s.custom = true;
        s.customBeads = [];
        cs.mats.forEach(mid => {
            const m = matDB.find(x => x.id === mid);
            if (!m) return;
            if (m.cat === "bead") s.customBeads.push({ col: m.color, shape: m.beadShape, rMul: m.beadR, pearl: m.pearl });
            else if (m.cat === "effect") {
                if (m.fx === "fizz") { s.fizz = true; if (m.bubbleBig) s.bubbleBig = true; }
                if (m.fx === "dust") { s.dust = true; s.popColor = m.pop; }
            } else if (m.cat === "glitter") {
                s.sparkle = true;
                if (m.rainbow) s.sparkleRainbow = true;
                else if (m.holo) s.sparkleHolo = true;
                else s.sparkleColor = m.color;
            } else if (m.cat === "wax") {
                s.type = "crack_wax";
                s.waxColor = m.color;
                // 왁스를 여러 개 넣으면 겹겹이 쌓임 → 각 층을 배열로 저장 (한 겹씩 벗겨짐)
                s.waxLayers = s.waxLayers || [];
                s.waxLayers.push({ color: m.color, hits: m.waxHits, score: m.waxScore || 4, chipScale: m.chipScale, sparkle: m.waxSparkle });
                // 첫 번째(가장 바깥) 층 기준으로 대표 속성 설정
                s.waxHits = s.waxLayers[0].hits;
                s.breakScore = s.waxLayers[0].score;
                if (s.waxLayers[0].chipScale) s.chipScale = s.waxLayers[0].chipScale;
                if (s.waxLayers[0].sparkle) s.waxSparkle = true;
                s.waxColor = s.waxLayers[0].color;
            } else if (m.cat === "topping") {
                s.toppings = s.toppings || [];
                s.toppings.push(m.top);
                if (m.top === "face") s.faceTopping = true;
                if (m.top === "apple") s.decor = "apple";
            }
        });
        if (!s.customBeads.length) delete s.customBeads;
        customSpecCache[key] = s;
        return s;
    }
    function getSpec() {
        if (currentSlime.id === "custom") return buildCustomSpec(currentSlime);
        return slimeDB.find(x => x.id === currentSlime.id);
    }
    function getRadius() { return Math.min(100 + ((currentSlime.level || 1) - 1) * 10, 220); }

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        waxCanvas.width = width;
        waxCanvas.height = height;
        bodyCanvas.width = width;
        bodyCanvas.height = height;
        initSlime();
    }
    window.addEventListener("resize", resize);

    /* =================================================================
       SVG 커스텀 모양: spec.svgPath("d" 문자열)를 노드 좌표로 샘플링
       - 단일 닫힌 패스만 지원 (M...Z 하나). 곡선/호 명령 전부 OK.
       - 브라우저 네이티브 getPointAtLength로 둘레를 16등분 → 정규화(중심/최대반지름)
       - spec.svgScale로 크기 배율, strokeF로 몸통 두께 조절
    ================================================================= */
    const svgPtsCache = {};
    function getSvgPoints(spec) {
        if (svgPtsCache[spec.id]) return svgPtsCache[spec.id];
        const nn = spec.nodeCount || 16;
        const svgEl = document.querySelector("svg");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", spec.svgPath);
        svgEl.appendChild(p);
        const len = p.getTotalLength();
        const raw = [];
        let cx2 = 0, cy2 = 0;
        for (let i = 0; i < nn; i++) {
            const pt = p.getPointAtLength((i / nn) * len);
            raw.push({ x: pt.x, y: pt.y });
            cx2 += pt.x; cy2 += pt.y;
        }
        svgEl.removeChild(p);
        cx2 /= nn; cy2 /= nn;
        let maxR = 0;
        raw.forEach(q => { maxR = Math.max(maxR, Math.hypot(q.x - cx2, q.y - cy2)); });
        const pts = raw.map(q => ({ x: (q.x - cx2) / (maxR || 1), y: (q.y - cy2) / (maxR || 1) }));
        svgPtsCache[spec.id] = pts;
        return pts;
    }

    function initSlime() {
        window.malang3D?.cancelInteraction();
        {
            const sp = getSpec();
            numNodes = sp.shapePts ? sp.shapePts.length : (sp.nodeCount || 16); // 종별 노드 수 확정
        }
        nodes = [];
        waxShards = [];
        waxChips = [];
        decorShards = [];
        cottonPuffs = [];
        foamBeads = [];
        fizzBubbles = [];
        sparkles = [];
        jellyFeet = [];
        activePushes = [];
        const spec = getSpec();
        waxIntact = (spec.type === "wax" || spec.type === "crack_wax"); 
        // 왁스 레이어: 커스텀 왁스 여러 겹이면 한 겹씩 벗겨짐. currentWaxLayer는 지금 벗기는 중인 층(0=가장 바깥)
        waxLayers = spec.waxLayers ? spec.waxLayers.slice() : null;
        currentWaxLayer = 0;
        waxLayerBrokenAt = 0;
        // 캐시된 spec이 이전 플레이에서 안쪽 층 값으로 바뀌어 있을 수 있으니, 항상 첫 층으로 리셋
        if (waxLayers && waxLayers.length) {
            const L0 = waxLayers[0];
            spec.waxColor = L0.color;
            spec.waxHits = L0.hits;
            spec.breakScore = L0.score;
            if (L0.chipScale) spec.chipScale = L0.chipScale;
            spec.waxSparkle = !!L0.sparkle;
        }
        
// (하단 설명 제거됨)

        core = { x: width / 2, y: height / 2, vx: 0, vy: 0, touchId: null };
        stretchSmooth = 0;
        jellyCloud = 0;
        jellyFace = { lx: 0, ly: 0, rx: 0, ry: 0, mx: 0, my: 0 };
        auroraHue = 0; auroraSat = 0;
        lastTouchPt = null;
        if (spec.mysteryCore) mysteryColor = `hsl(${Math.floor(Math.random() * 360)}, ${55 + Math.floor(Math.random() * 30)}%, ${58 + Math.floor(Math.random() * 14)}%)`;
        // 우주 덩어리: 내부 은하 별빛 (몸 안 고정 위치, 명멸 위상 랜덤)
        if (spec.galaxy) {
            galaxyStars = [];
            for (let s = 0; s < 60; s++) {
                galaxyStars.push({
                    ang: Math.random() * Math.PI * 2,
                    f: Math.sqrt(Math.random()) * 0.92,
                    sz: 0.007 + Math.random() * 0.017,
                    ph: Math.random() * Math.PI * 2,
                    spd: 0.5 + Math.random() * 1.1,
                    hue: Math.random() < 0.3 ? 45 : (Math.random() < 0.5 ? 260 : 200)
                });
            }
        }
        // 해파리: 뽑을 때마다 색이 랜덤 (고정, 변하지 않음). 30%는 완전 클리어 톤
        if (spec.jelly) {
            if (Math.random() < 0.3) { jellyHue = 200; jellySat = 6 + Math.random() * 6; jellyLit = 86; }
            else { jellyHue = Math.floor(Math.random() * 360); jellySat = 40 + Math.random() * 28; jellyLit = 76 + Math.random() * 9; }
        }
        const radius = getRadius();
        
        for (let i = 0; i < numNodes; i++) {
            const t = (i / numNodes) * Math.PI * 2;
            let bx = Math.cos(t), by = Math.sin(t), bd = radius * 0.7;

            // 하트형: 파라메트릭 하트 곡선 위에 노드 배치
            if (spec.shape === "heart") {
                const hx = 16 * Math.pow(Math.sin(t), 3);
                const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                const hl = Math.hypot(hx, hy) || 1;
                bd = (hl / 17) * radius * 0.85;
                bx = hx / hl; by = hy / hl;
            }

            // 울퉁불퉁형(목화솜): 노드마다 기본 반지름이 제각각 → 뭉게뭉게 큰 요철이 고정됨
            if (spec.lumpy) {
                bd = radius * (0.55 + Math.random() * 0.38);
            }

            // 해파리형: 위는 넓은 돔, 아래는 납작 (발은 별도 원으로 융합)
            if (spec.shape === "jellyfish") {
                const jx = Math.cos(t);
                const jy = Math.sin(t) < 0 ? Math.sin(t) * 0.82 : Math.sin(t) * 0.42;
                const jl = Math.hypot(jx, jy) || 1;
                bd = jl * radius * 0.92;
                bx = jx / jl; by = jy / jl;
            }

            // 정밀 좌표형: 오프라인 곡률 적응 샘플링(코너 스냅)된 좌표를 그대로 사용
            if (spec.shapePts) {
                const p = spec.shapePts[i % spec.shapePts.length];
                const hl = Math.hypot(p[0], p[1]) || 1;
                bd = hl * radius * (spec.svgScale || 0.95);
                bx = p[0] / hl; by = p[1] / hl;
            }

            // SVG 패스형: 제공된 SVG 외곽선을 그대로 노드로 사용 (정확한 커스텀 모양)
            if (spec.svgPath) {
                const p = getSvgPoints(spec)[i];
                const hl = Math.hypot(p.x, p.y) || 1;
                bd = hl * radius * (spec.svgScale || 0.9);
                bx = p.x / hl; by = p.y / hl;
            }

            // 미세 요철: 폼 알갱이가 표면을 살짝 오돌토돌하게
            if (spec.bumpy) {
                bd = bd * (1 + (Math.random() - 0.5) * spec.bumpy);
            }

            nodes.push({
                x: core.x + bx * bd,
                y: core.y + by * bd,
                baseDist: bd,
                baseAngle: Math.atan2(by, bx),
                // 솜슬라임: 노드마다 복원 탄성이 제각각 → 울퉁불퉁하게 늘어나고 뭉게뭉게 복귀
                kMul: spec.type === "cotton" ? (0.35 + Math.random() * 0.95) : 1,
                vx: 0, vy: 0, touchId: null
            });
        }

        // 목화솜 봉우리: 바깥 링(실루엣을 울퉁불퉁하게) + 안쪽 채움 (모두 노드에 앵커)
        if (spec.puffs) {
            for (let j = 0; j < numNodes; j++) {
                cottonPuffs.push({
                    ni: j,
                    f: 0.9 + Math.random() * 0.18,
                    r: 0.20 + Math.random() * 0.12,
                    ox: (Math.random() - 0.5) * 0.07,
                    oy: (Math.random() - 0.5) * 0.07
                });
            }
            const inner = 8 + Math.floor(Math.random() * 3);
            for (let j = 0; j < inner; j++) {
                cottonPuffs.push({
                    ni: Math.floor(Math.random() * numNodes),
                    f: 0.2 + Math.random() * 0.6,
                    r: 0.18 + Math.random() * 0.12,
                    ox: 0, oy: 0
                });
            }
        }

        // 해파리 발: 아랫면 노드선 위 고정 지점 4곳 — 스트로크 두께만큼 더 바깥으로 돌출시켜 항상 보임
        if (spec.jelly) {
            [2.7, 3.55, 4.45, 5.3].forEach(bn => {
                jellyFeet.push({ baseNi: bn, slide: 0, out: 0.26, r: 0.18 });
            });
        }

        // 폼볼: 몸속에 박힌 폼 알갱이들 (노드에 앵커 → 변형을 따라감)
        if (spec.beads) {
            for (let j = 0; j < 44; j++) {
                foamBeads.push({
                    ni: Math.floor(Math.random() * numNodes),
                    f: 0.12 + Math.random() * 0.82,
                    aoff: (Math.random() - 0.5) * 0.38,
                    r: 0.034 + Math.random() * 0.032,
                    tint: Math.random()
                });
            }
        }

        // 커스텀 비즈: 세트당 단색 구슬 5개 (initSlime에서 1회만 생성)
        if (spec.customBeads) {
            spec.customBeads.forEach(cb => {
                for (let j = 0; j < 5; j++) {
                    foamBeads.push({
                        ni: Math.floor(Math.random() * numNodes),
                        f: 0.15 + Math.random() * 0.72,
                        aoff: (Math.random() - 0.5) * 0.38,
                        r: 0.05 + Math.random() * 0.045,
                        tint: 0.5,
                        col: cb.col
                    });
                }
            });
        }
    }

    // 왁스 플레이크(얇은 칩 조각) 파편 생성
    function spawnWaxFlakes(x, y, count, baseSize, burst = false) {
        for (let f = 0; f < count; f++) {
            const size = baseSize * (0.6 + Math.random() * 0.8);
            const vCount = 4 + Math.floor(Math.random() * 2); // 4~5각형 불규칙 칩
            const verts = [];
            for (let v = 0; v < vCount; v++) {
                const a = (v / vCount) * Math.PI * 2;
                const rr = size * (0.55 + Math.random() * 0.45);
                verts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.55 }); // 납작한 조각
            }
            waxShards.push({
                x: x + (Math.random() - 0.5) * 14,
                y: y + (Math.random() - 0.5) * 14,
                vx: (Math.random() - 0.5) * (burst ? 13 : 6),
                vy: burst ? (Math.random() - 0.5) * 12 : (-2 - Math.random() * 2.5),
                rot: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 0.35,
                verts: verts
            });
        }
    }

    // 데미지 1회 (좌표 기반): 빈 자리면 겹치지 않는 랜덤 크기 금,
    // 금 간 조각을 건드리면 금 모양대로 낙하. 같은 제스처로는 한 조각에 한 번만.
    function damageWax(x, y, gseq) {
        if (window.malang3D) return; // 3D surface picking and fracture live in WaxShell.
        const spec = getSpec();
        if (!waxIntact || spec.type !== "crack_wax") return;
        const radius = getRadius();
        const now = performance.now();
        if (Math.hypot(x - core.x, y - core.y) > radius * 1.05) return; // 공 밖

        // 1) 금 간 조각을 건드렸으면 → 금이 더 깊어지거나(두꺼운 왁스) 조각 낙하
        const needHits = spec.waxHits || 2;
        for (const c of waxChips) {
            if (c.state !== 1) continue;
            const d = Math.hypot(core.x + c.ox - x, core.y + c.oy - y);
            if (d < c.size * radius * 0.55 + radius * 0.06) {
                if (c.lastHitGesture === gseq) return;
                c.lastHitGesture = gseq;
                if (now - c.crackAt > 120) {
                    c.hits = (c.hits || 1) + 1;
                    c.crackAt = now;
                    if (c.hits >= needHits) breakWaxChip(c);
                    else playCrackSound(false); // 금이 한층 더 깊어짐
                }
                return;
            }
        }

        // 2) 빈 자리 → 기존 금/구멍과 겹치지 않는 크기로만 새 금 (스트로크 겹침 방지)
        let maxAllowed = (0.45 + Math.random() * 0.55) * (spec.chipScale || 1);
        for (const c of waxChips) {
            const d = Math.hypot(core.x + c.ox - x, core.y + c.oy - y);
            const room = (d - c.size * radius * 0.55 * 0.8) / (radius * 0.55);
            if (room < maxAllowed) maxAllowed = room;
        }
        if (maxAllowed < 0.28 * (spec.chipScale || 1)) return; // 금을 낼 공간이 없는 자리

        waxChips.push({
            ox: x - core.x, oy: y - core.y,
            size: maxAllowed,
            seed: Math.random() * 100,
            state: 1,               // 1=금 감, 2=구멍
            hits: 1,
            crackAt: now,
            lastHitGesture: gseq
        });
        playCrackSound(false);
        // 살얼음 왁스: 금 단계 없이 치는 즉시 조각이 빠사삭
        if (needHits <= 1) breakWaxChip(waxChips[waxChips.length - 1]);
    }

    // 금 간 조각이 파편으로 떨어져 나가며 구멍이 생김
    function breakWaxChip(chip) {
        if (chip.state !== 1) return;
        chip.state = 2;
        playCrackSound(false);
        const radius = getRadius();
        const cx = core.x + chip.ox, cy = core.y + chip.oy;
        const holeR = chip.size * radius * 0.55;
        const count = 3 + Math.floor(Math.random() * 3);
        for (let f = 0; f < count; f++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * holeR * 0.6;
            spawnWaxFlakes(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1, holeR * (0.35 + Math.random() * 0.3));
        }
    }

    function breakWaxAll() {
        if (!waxIntact) return;
        const radius = getRadius();

        // 왁스 여러 겹: 아직 다음 층이 남아있으면 이 층만 벗기고 다음 층 노출
        if (waxLayers && currentWaxLayer < waxLayers.length - 1) {
            playCrackSound(true);
            // 벗겨진 층 파편 흩뿌리기
            for (let i = 0; i < 22; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius;
                spawnWaxFlakes(core.x + Math.cos(angle) * dist, core.y + Math.sin(angle) * dist, 1, radius * (0.10 + Math.random() * 0.14), true);
            }
            // 다음(안쪽) 층으로 전환 — 껍질은 유지, 색/속성만 교체
            currentWaxLayer++;
            waxLayerBrokenAt = performance.now();   // 쿨다운 시작
            const L = waxLayers[currentWaxLayer];
            const spec = getSpec();
            spec.waxColor = L.color;
            spec.waxHits = L.hits;
            spec.breakScore = L.score;
            if (L.chipScale) spec.chipScale = L.chipScale;
            spec.waxSparkle = !!L.sparkle;
            waxChips = [];        // 새 껍질이므로 금 초기화
            return;               // waxIntact 유지 (아직 껍질 있음)
        }

        // 마지막 층(또는 단일 껍질) → 완전히 벗겨져 슬라임 노출
        waxIntact = false;
        waxChips = [];
        playCrackSound(true);
        // 사과 장식(꼭지+잎)도 껍질과 함께 떨어져 나감
        if (getSpec().decor === "apple") {
            decorShards.push({ x: core.x, y: core.y - radius * 1.02, vx: (Math.random() - 0.5) * 4, vy: -4 - Math.random() * 3, rot: 0, vRot: (Math.random() - 0.5) * 0.25 });
        }
        for(let i = 0; i < 26; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius;
            spawnWaxFlakes(core.x + Math.cos(angle) * dist, core.y + Math.sin(angle) * dist, 1, radius * (0.10 + Math.random() * 0.14), true);
        }
    }

    // 말랑이 본체(blob) 그리기 — 속살/왁스 껍질 공용
    function traceAndFillBlob(c, color, radius, strokeF, noStroke) {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(nodes[0].x, nodes[0].y);
        for(let i = 1; i < numNodes; i++) c.lineTo(nodes[i].x, nodes[i].y);
        c.closePath();
        if (!noStroke) {
            c.strokeStyle = color;
            c.lineWidth = radius * (strokeF || 0.8);
            c.lineCap = 'round'; c.lineJoin = 'round';
            c.stroke();
        }
        c.fill();
    }

    // 금/구멍 경계 모양 — 들쭉날쭉 다각형, 조각별 랜덤 시드라 매번 다르게 생김
    function traceChipHole(c, chip, radius) {
        const seed = chip.seed;
        const r = chip.size * radius * 0.55;
        const cx = core.x + chip.ox, cy = core.y + chip.oy;
        const spikes = 9;
        c.beginPath();
        for (let s = 0; s < spikes; s++) {
            const a = (s / spikes) * Math.PI * 2 + seed;
            const jag = 0.55 + Math.abs(Math.sin(seed * 7.7 + s * 3.1)) * 0.45;
            const wob = Math.sin(seed * 2.3 + s * 1.7) * 0.18;
            const px = cx + Math.cos(a + wob) * r * jag;
            const py = cy + Math.sin(a + wob) * r * jag;
            if (s === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath();
    }

    // 금 패턴 그리기 (isHole=false: 금 간 상태 / true: 조각 떨어진 뒤 단면+잔여 실금)
    function drawCrackPattern(c, chip, radius, isHole) {
        const seed = chip.seed;
        const r = chip.size * radius * 0.55;
        const nx = core.x + chip.ox, ny = core.y + chip.oy;

        // 조각 경계선 (금의 메인 라인 / 깨진 뒤엔 하얀 왁스 단면)
        traceChipHole(c, chip, radius);
        c.lineJoin = 'miter';
        c.lineWidth = isHole ? 5 : (2 + (chip.hits || 1) * 0.7);
        c.strokeStyle = 'rgba(255,255,255,0.92)';
        c.stroke();

        if (!isHole) {
            // 아직 안 떨어진 조각 내부를 가로지르는 균열
            c.lineWidth = 1.8;
            c.strokeStyle = 'rgba(255,255,255,0.8)';
            c.beginPath();
            for (let k = 0; k < 3; k++) {
                const a = ((k * 3) / 9) * Math.PI * 2 + seed;
                const jag = 0.55 + Math.abs(Math.sin(seed * 7.7 + (k * 3) * 3.1)) * 0.45;
                const midA = a + Math.sin(seed * 3.1 + k) * 0.3;
                c.moveTo(nx, ny);
                c.lineTo(nx + Math.cos(midA) * r * 0.5, ny + Math.sin(midA) * r * 0.5);
                c.lineTo(nx + Math.cos(a) * r * jag, ny + Math.sin(a) * r * jag);
            }
            c.stroke();
        }

        // 바깥으로 뻗는 실금 — 크고 두껍게 (조각이 떨어진 뒤에도 남음)
        c.lineWidth = 2;
        c.strokeStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        // h별 각도가 고정(황금각 수열)이라 두드릴수록 기존 실금 위에 새 실금이 "추가"됨
        const hairs = 1 + (chip.hits || 1) * 2;
        for (let h = 0; h < hairs; h++) {
            const a = seed * 1.3 + h * 2.399 + Math.sin(seed * 4.1 + h) * 0.35;
            let px = nx + Math.cos(a) * r * 0.9;
            let py = ny + Math.sin(a) * r * 0.9;
            c.moveTo(px, py);
            for (let s = 1; s <= 3; s++) {
                const jit = Math.sin(seed * 9.1 + h * 3.7 + s * 2.3) * 0.55;
                px += Math.cos(a + jit) * radius * 0.14;
                py += Math.sin(a + jit) * radius * 0.14;
                c.lineTo(px, py);
            }
        }
        c.stroke();
    }

    // 왁스 코팅 껍질 렌더링: 광택 재질 + 깨진 구멍 + 하얀 단면/실금
    function renderWaxShell(spec, radius) {
        waxCtx.clearRect(0, 0, width, height);

        // 1) 왁스 코팅 본체 (속살과 동일한 실루엣)
        waxCtx.save();
        waxCtx.filter = 'url(#gooey)';
        traceAndFillBlob(waxCtx, spec.waxColor, radius);
        waxCtx.restore();

        // 2) 왁스 재질감: 가장자리 두께감 + 좌상단 글로시 하이라이트 (코팅 위에만)
        waxCtx.save();
        waxCtx.globalCompositeOperation = 'source-atop';
        const edge = waxCtx.createRadialGradient(core.x, core.y, radius * 0.2, core.x, core.y, radius * 1.4);
        edge.addColorStop(0, 'rgba(255,255,255,0.10)');
        edge.addColorStop(0.7, 'rgba(0,0,0,0)');
        edge.addColorStop(1, 'rgba(80,50,20,0.20)');
        waxCtx.fillStyle = edge;
        waxCtx.fillRect(0, 0, width, height);

        const hl = waxCtx.createRadialGradient(
            core.x - radius * 0.42, core.y - radius * 0.48, radius * 0.05,
            core.x - radius * 0.42, core.y - radius * 0.48, radius * 0.95
        );
        hl.addColorStop(0, 'rgba(255,255,255,0.50)');
        hl.addColorStop(0.4, 'rgba(255,255,255,0.14)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        waxCtx.fillStyle = hl;
        waxCtx.fillRect(0, 0, width, height);
        waxCtx.restore();

        if (spec.type === "crack_wax") {
            // 3) 금 간 상태(조각 아직 안 떨어짐): 금 패턴만 그림 — source-atop이라 코팅 밖으로 절대 안 나감
            waxCtx.save();
            waxCtx.globalCompositeOperation = 'source-atop';
            waxChips.forEach(c => {
                if (c.state === 1) drawCrackPattern(waxCtx, c, radius, false);
            });
            waxCtx.restore();

            // 4) 조각 떨어진 자리 뚫기 → 밑의 층이 드러남
            //    다음 왁스 층이 남아있으면 그 자리에 "다음 층 왁스 색"이 보이고,
            //    마지막 층이면 뚫어서 속 말랑이가 드러남
            const hasNextLayer = waxLayers && currentWaxLayer < waxLayers.length - 1;
            if (hasNextLayer) {
                // 구멍 자리에 다음 층 왁스 색을 채움 (속살 대신 다음 껍질이 보이게)
                const nextColor = waxLayers[currentWaxLayer + 1].color;
                waxCtx.save();
                waxCtx.globalCompositeOperation = 'source-atop';
                waxCtx.fillStyle = nextColor;
                waxChips.forEach(c => {
                    if (c.state === 2) { traceChipHole(waxCtx, c, radius); waxCtx.fill(); }
                });
                waxCtx.restore();
            } else {
                // 마지막 층: 구멍을 뚫어 아래 속살이 보이게
                waxCtx.save();
                waxCtx.globalCompositeOperation = 'destination-out';
                waxChips.forEach(c => {
                    if (c.state === 2) { traceChipHole(waxCtx, c, radius); waxCtx.fill(); }
                });
                waxCtx.restore();
            }

            // 5) 구멍 단면 + 잔여 실금 — source-atop이라 남은 코팅 위에만 그려짐
            waxCtx.save();
            waxCtx.globalCompositeOperation = 'source-atop';
            waxChips.forEach(c => {
                if (c.state === 2) drawCrackPattern(waxCtx, c, radius, true);
            });
            waxCtx.restore();
        }

        ctx.drawImage(waxCanvas, 0, 0);
    }

    // 노드 폴리곤 내부 판정 (레이캐스팅)
    function pointInNodes(px, py) {
        let inside = false;
        for (let a = 0, b = numNodes - 1; a < numNodes; b = a++) {
            const xi = nodes[a].x, yi = nodes[a].y, xj = nodes[b].x, yj = nodes[b].y;
            if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
        }
        return inside;
    }

    // 해파리 얼굴: 점 눈 2개 + 미소 — 구겨져도 항상 몸 안쪽에 머무름
    let jellyFaceDrawn = [];
    function drawJellyFace(radius) {
        ['lx', 'ly', 'rx', 'ry', 'mx', 'my'].forEach(k => jellyFace[k] *= 0.97);
        // 얼굴 기준점: 코어가 아니라 현재 몸(노드) 무게중심 → 구김을 따라감
        let cxm = 0, cym = 0;
        nodes.forEach(nd => { cxm += nd.x; cym += nd.y; });
        cxm /= numNodes; cym /= numNodes;
        const clampIn = (px, py) => {
            for (let it = 0; it < 10 && !pointInNodes(px, py); it++) {
                px += (cxm - px) * 0.18;
                py += (cym - py) * 0.18;
            }
            return [px, py];
        };
        // 몸이 구겨져 작아지면 얼굴도 비례 축소 (뭉개짐 방지 1단계)
        let curD = 0, baseD = 0;
        nodes.forEach(nd => {
            curD += Math.hypot(nd.x - cxm, nd.y - cym);
            baseD += nd.baseDist;
        });
        const bodyScale = Math.min(1, Math.max(0.55, curD / (baseD || 1)));
        const ex = radius * 0.2 * bodyScale;
        const eyeDY = radius * 0.1 * bodyScale;

        let pL = clampIn(cxm - ex + jellyFace.lx, cym - eyeDY + jellyFace.ly);
        let pR = clampIn(cxm + ex + jellyFace.rx, cym - eyeDY + jellyFace.ry);
        let pM = clampIn(cxm + jellyFace.mx, cym - radius * 0.02 * bodyScale + jellyFace.my);

        // 최소 간격 유지 (뭉개짐 방지 2단계): 서로 겹치면 축 방향으로 밀어냄
        const sep = (a, b, minD) => {
            let dx = b[0] - a[0], dy = b[1] - a[1];
            let d = Math.hypot(dx, dy);
            if (d < 0.001) { dx = 1; dy = 0; d = 1; } // 완전 겹침 → 수평으로 분리
            if (d < minD) {
                const push = (minD - d) / 2;
                a[0] -= (dx / d) * push; a[1] -= (dy / d) * push;
                b[0] += (dx / d) * push; b[1] += (dy / d) * push;
            }
        };
        const eyeMin = radius * 0.26 * bodyScale;
        const mouthMin = radius * 0.16 * bodyScale;
        for (let it = 0; it < 3; it++) {
            sep(pL, pR, eyeMin);
            sep(pL, pM, mouthMin);
            sep(pR, pM, mouthMin);
        }

        jellyFaceDrawn = [pL, pR, pM];
        const er = Math.max(2.5, radius * 0.05 * bodyScale);
        ctx.save();
        ctx.fillStyle = "#2e2e36";
        ctx.beginPath(); ctx.arc(pL[0], pL[1], er, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(pR[0], pR[1], er, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#2e2e36";
        ctx.lineWidth = Math.max(2, radius * 0.028 * bodyScale);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(pM[0], pM[1], radius * 0.09 * bodyScale, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.restore();
    }

    // 토핑 장식 모음 (머리 위 등에 배치, s=radius/100 배율)
    function drawTopping(c, kind, cx, topY, s) {
        c.save();
        c.lineCap = "round"; c.lineJoin = "round";
        if (kind === "crown") {
            c.fillStyle = "#ffd54a"; c.strokeStyle = "#e0a800"; c.lineWidth = 2*s;
            const w = 42*s, h = 26*s, y = topY - h;
            c.beginPath();
            c.moveTo(cx - w/2, topY); c.lineTo(cx - w/2, y + h*0.4);
            c.lineTo(cx - w/4, y + h*0.7); c.lineTo(cx, y); c.lineTo(cx + w/4, y + h*0.7);
            c.lineTo(cx + w/2, y + h*0.4); c.lineTo(cx + w/2, topY); c.closePath();
            c.fill(); c.stroke();
            c.fillStyle = "#ff5f7e";
            [[-w/2,0],[0,0],[w/2,0]].forEach(p => { c.beginPath(); c.arc(cx+p[0], topY, 3*s, 0, 7); c.fill(); });
        } else if (kind === "ribbon") {
            c.fillStyle = "#ff6b8a"; c.strokeStyle = "#e04f6f"; c.lineWidth = 1.5*s;
            const w = 20*s;
            [-1, 1].forEach(d => {
                c.beginPath();
                c.moveTo(cx, topY); c.quadraticCurveTo(cx + d*w*1.4, topY - w*0.8, cx + d*w*1.3, topY + w*0.3);
                c.quadraticCurveTo(cx + d*w*0.9, topY + w*0.1, cx, topY); c.closePath(); c.fill(); c.stroke();
            });
            c.beginPath(); c.arc(cx, topY, 5*s, 0, 7); c.fill(); c.stroke();
        } else if (kind === "star") {
            c.fillStyle = "#ffd54a"; c.strokeStyle = "#e0a800"; c.lineWidth = 1.5*s;
            c.beginPath();
            for (let v = 0; v < 10; v++) {
                const rr = v % 2 === 0 ? 16*s : 7*s;
                const a = (v/10)*Math.PI*2 - Math.PI/2;
                const px = cx + Math.cos(a)*rr, py = (topY - 12*s) + Math.sin(a)*rr;
                v === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
            }
            c.closePath(); c.fill(); c.stroke();
        } else if (kind === "cherry") {
            c.strokeStyle = "#7a5236"; c.lineWidth = 3*s; c.fillStyle = "#e53950";
            c.beginPath(); c.moveTo(cx - 8*s, topY); c.quadraticCurveTo(cx, topY - 22*s, cx + 8*s, topY - 4*s); c.stroke();
            c.beginPath(); c.moveTo(cx - 8*s, topY); c.quadraticCurveTo(cx - 4*s, topY - 20*s, cx - 12*s, topY - 6*s); c.stroke();
            c.beginPath(); c.arc(cx - 12*s, topY, 7*s, 0, 7); c.fill();
            c.beginPath(); c.arc(cx + 8*s, topY - 2*s, 7*s, 0, 7); c.fill();
        } else if (kind === "horn") {
            const g = c.createLinearGradient(cx, topY, cx, topY - 40*s);
            g.addColorStop(0, "#ffe08a"); g.addColorStop(1, "#ff9ec3");
            c.fillStyle = g; c.strokeStyle = "#e0a0c0"; c.lineWidth = 1.5*s;
            c.beginPath(); c.moveTo(cx - 8*s, topY); c.quadraticCurveTo(cx, topY - 44*s, cx + 8*s, topY); c.closePath(); c.fill();
            c.strokeStyle = "#e0a0c0"; c.lineWidth = 2*s;
            for (let r = 1; r <= 3; r++) { const ry = topY - r*11*s; c.beginPath(); c.moveTo(cx - 7*s*(1-r*0.22), ry); c.lineTo(cx + 7*s*(1-r*0.22), ry); c.stroke(); }
        } else if (kind === "leaf") {
            c.fillStyle = "#66bb6a"; c.strokeStyle = "#4a9d4e"; c.lineWidth = 1.5*s;
            c.beginPath(); c.moveTo(cx, topY); c.quadraticCurveTo(cx + 20*s, topY - 22*s, cx + 4*s, topY - 30*s);
            c.quadraticCurveTo(cx - 6*s, topY - 16*s, cx, topY); c.closePath(); c.fill(); c.stroke();
        }
        c.restore();
    }

    // 사과 꼭지 + 잎 장식 그리기 (s: 크기 배율)
    function drawAppleDecor(c, x, y, s, rot) {
        c.save(); c.translate(x, y); c.rotate(rot || 0);
        // 꼭지
        c.strokeStyle = "#7a5236"; c.lineWidth = 5 * s; c.lineCap = "round";
        c.beginPath(); c.moveTo(0, 4 * s); c.quadraticCurveTo(4 * s, -12 * s, 10 * s, -22 * s); c.stroke();
        // 잎
        c.fillStyle = "#66bb6a";
        c.beginPath();
        c.moveTo(8 * s, -16 * s);
        c.quadraticCurveTo(26 * s, -32 * s, 42 * s, -18 * s);
        c.quadraticCurveTo(24 * s, -8 * s, 8 * s, -16 * s);
        c.closePath(); c.fill();
        // 잎맥
        c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1.5 * s;
        c.beginPath(); c.moveTo(10 * s, -16 * s); c.quadraticCurveTo(25 * s, -21 * s, 38 * s, -18 * s); c.stroke();
        c.restore();
    }

    function simulateFrame() {
        const spec = getSpec();
        
        if (!window.malang3D) {
            ctx.fillStyle = bgFill;
            ctx.fillRect(0, 0, width, height);
        }
        
        const k = waxIntact ? 0.28 : spec.k;       
        const damp = waxIntact ? 0.65 : spec.damping; 
        const radius = getRadius();

        // 1. 코어 물리연산
        if (spec.bouncy) {
            // 슈퍼 탱탱볼: 관성을 유지하며 화면을 돌아다님
            core.vx *= 0.998; core.vy *= 0.998;
            if (core.touchId === null) {
                core.vx += (width/2 - core.x) * 0.00015;
                core.vy += (height/2 - core.y) * 0.00015;
            }
        } else {
            core.vx *= damp; core.vy *= damp;
            core.vx += (width/2 - core.x) * (spec.magnet ? 0.001 : 0.01);
            core.vy += (height/2 - core.y) * (spec.magnet ? 0.001 : 0.01);
        }
        core.x += core.vx; core.y += core.vy;

        // 슈퍼 탱탱볼: 화면 벽에 탱! 하고 반사 (잡는 중에도 밖으로는 못 나감)
        if (spec.bouncy) {
            const bR = getRadius();
            if (core.touchId === null) {
                let hit = 0;
                if (core.x < bR) { core.x = bR; if (core.vx < 0) { hit = -core.vx; core.vx *= -0.94; } }
                else if (core.x > width - bR) { core.x = width - bR; if (core.vx > 0) { hit = core.vx; core.vx *= -0.94; } }
                if (core.y < bR) { core.y = bR; if (core.vy < 0) { hit = Math.max(hit, -core.vy); core.vy *= -0.94; } }
                else if (core.y > height - bR) { core.y = height - bR; if (core.vy > 0) { hit = Math.max(hit, core.vy); core.vy *= -0.94; } }
                if (hit > 3) playSquishSound('boing');
            } else {
                core.x = Math.max(bR * 0.5, Math.min(width - bR * 0.5, core.x));
                core.y = Math.max(bR * 0.5, Math.min(height - bR * 0.5, core.y));
            }
        }

        // 자석 퍼티: 마지막으로 만진 자리로 스르륵 기어감
        if (spec.magnet && lastTouchPt && core.touchId === null && performance.now() - lastTouchPt.t < 5000) {
            core.vx += (lastTouchPt.x - core.x) * 0.0018;
            core.vy += (lastTouchPt.y - core.y) * 0.0018;
        }

        let maxDeformation = 0;
        let maxPullOvershoot = 0; // 단단한 껍질을 한계 밖으로 잡아끈 정도
        let avgX = 0, avgY = 0;
        let totalCracks = 0;

        nodes.forEach((n, i) => {
            if (n.touchId === null) {
                const targetX = core.x + Math.cos(n.baseAngle) * n.baseDist;
                const targetY = core.y + Math.sin(n.baseAngle) * n.baseDist;
                
                const kEff = k * (n.kMul || 1);
                const homeW = spec.homeW || 0.5; // 제자리 복원 가중치 (높을수록 원래 모양 고수)
                const nbrW = spec.nbrW || 2.5;   // 이웃 평활 가중치 (높을수록 요철/노치가 뭉개짐)
                n.vx += (targetX - n.x) * (kEff * homeW); 
                n.vy += (targetY - n.y) * (kEff * homeW);
                
                const prev = nodes[(i - 1 + numNodes) % numNodes];
                const next = nodes[(i + 1) % numNodes];
                
                // 편차 라플라시안 평활: 정지 상태(홈 모양)에선 힘이 0이라 코너/요철을
                // 완벽 보존하고, 홈에서 벗어난 "편차"만 이웃과 비슷해지도록 눌러
                // 바늘 스파이크를 제거함. 노드 밀도(간격²) 보정 포함.
                const nbrScale = Math.min(9, Math.pow(numNodes / 16, 2));
                const phx = core.x + Math.cos(prev.baseAngle) * prev.baseDist;
                const phy = core.y + Math.sin(prev.baseAngle) * prev.baseDist;
                const qhx = core.x + Math.cos(next.baseAngle) * next.baseDist;
                const qhy = core.y + Math.sin(next.baseAngle) * next.baseDist;
                const relTx = targetX + ((prev.x + next.x) / 2 - (phx + qhx) / 2);
                const relTy = targetY + ((prev.y + next.y) / 2 - (phy + qhy) / 2);
                n.vx += (relTx - n.x) * (k * nbrW * nbrScale);
                n.vy += (relTy - n.y) * (k * nbrW * nbrScale);
                
                n.vx *= damp; n.vy *= damp;
                n.x += n.vx; n.y += n.vy;
            } else {
                // 금 내기는 터치 핸들러(damageWax)에서 좌표 기반으로 처리
                // 잡기 분산(종 모양): 이웃들이 잡은 노드 "변위"를 cos² 감쇠로 나눠 받아
                // 끝이 평평하고 어깨가 매끈한, 슬라임다운 뭉툭한 당김이 됨
                {
                    const K = Math.max(2, Math.round(numNodes / 8));
                    const nhx = core.x + Math.cos(n.baseAngle) * n.baseDist;
                    const nhy = core.y + Math.sin(n.baseAngle) * n.baseDist;
                    const dxg = n.x - nhx, dyg = n.y - nhy; // 잡은 노드의 홈 대비 변위
                    for (let o = -K; o <= K; o++) {
                        if (o === 0) continue;
                        const m = nodes[(i + o + numNodes) % numNodes];
                        if (m.touchId !== null) continue;
                        const c = Math.cos((Math.abs(o) / (K + 1)) * Math.PI / 2);
                        const fall = c * c; // 종형: 중심부 평평(뭉툭한 끝) + 경계 기울기 0(주름 없음)
                        const tx2 = core.x + Math.cos(m.baseAngle) * m.baseDist + dxg * fall;
                        const ty2 = core.y + Math.sin(m.baseAngle) * m.baseDist + dyg * fall;
                        m.vx += (tx2 - m.x) * 0.3;
                        m.vy += (ty2 - m.y) * 0.3;
                    }
                }
            }

            activePushes.forEach(p => {
                let dx = n.x - p.x;
                let dy = n.y - p.y;
                let dist = Math.hypot(dx, dy);
                let pushRadius = 100;
                if (dist < pushRadius) {
                    let force = (pushRadius - dist) * 0.5;
                    let angle = Math.atan2(dy, dx);
                    n.vx += Math.cos(angle) * force;
                    n.vy += Math.sin(angle) * force;
                    
                    // (배경 밀기 데미지는 아래에서 damageWax로 좌표 기반 처리)
                }
            });

            if (spec.type === "cotton") {
                const lump = Math.sin(i * 3.7 + performance.now() * 0.0011 + n.x * 0.01) * 5;
                n.vx += Math.cos(n.baseAngle) * lump * 0.06;
                n.vy += Math.sin(n.baseAngle) * lump * 0.06;
            }

            if (spec.type === "squishy") {
                let waveNoise = Math.sin(i * 2.5 + n.x * 0.04) * 7;
                n.vx += Math.cos(n.baseAngle) * waveNoise * 0.08;

                let dx = n.x - core.x;
                let dy = n.y - core.y;
                let dist = Math.hypot(dx, dy);
                let maxStretchLimit = radius * 1.45; 
                if (dist > maxStretchLimit) {
                    n.x = core.x + (dx / dist) * maxStretchLimit;
                    n.y = core.y + (dy / dist) * maxStretchLimit;
                    n.vx *= 0.3; n.vy *= 0.3;
                }
            }
            
            // 저신축: 주물거리는 말랑이 — 살짝만 늘어나고 강하게 원형 복귀
            if (spec.maxStretch) {
                const dxs = n.x - core.x, dys = n.y - core.y;
                const ds = Math.hypot(dxs, dys);
                const lim = radius * spec.maxStretch;
                if (ds > lim) {
                    n.x = core.x + (dxs / ds) * lim;
                    n.y = core.y + (dys / ds) * lim;
                    n.vx *= 0.3; n.vy *= 0.3;
                }
                // 안쪽 한계: 뾰족하게 깊이 패이지 않고 뭉툭하게
                const minLim = radius * (spec.minStretch || 0);
                if (minLim && ds > 0 && ds < minLim) {
                    n.x = core.x + (dxs / ds) * minLim;
                    n.y = core.y + (dys / ds) * minLim;
                    n.vx *= 0.3; n.vy *= 0.3;
                }
            }

            // 소성 기억: 현재 모양을 서서히 새 제자리로 기억 → 늘리거나 구긴 모양이 오래 유지됨
            if (spec.plastic) {
                const relX = n.x - core.x, relY = n.y - core.y;
                const curD = Math.hypot(relX, relY) || 1;
                const minB = radius * 0.25, maxB = radius * 2.0;
                n.baseDist += (Math.min(maxB, Math.max(minB, curD)) - n.baseDist) * spec.plastic;
                const curA = Math.atan2(relY, relX);
                let dA = curA - n.baseAngle;
                while (dA > Math.PI) dA -= Math.PI * 2;
                while (dA < -Math.PI) dA += Math.PI * 2;
                n.baseAngle += dA * spec.plastic;
            }

            // 왁스 껍질이 있는 동안엔 단단한 상태: 제자리(홈)에서 어느 방향으로든 아주 약간만 밀림
            // (반지름만 제한하면 옆으로 끌려가 콩팥 모양으로 접히므로, 각도까지 홈 위치에 고정)
            if (waxIntact) {
                const hx = core.x + Math.cos(n.baseAngle) * n.baseDist;
                const hy = core.y + Math.sin(n.baseAngle) * n.baseDist;
                const dxw = n.x - hx, dyw = n.y - hy;
                const dw = Math.hypot(dxw, dyw);
                const give = n.baseDist * 0.1; // 허용 유격
                if (dw > give) {
                    if (dw - give > maxPullOvershoot) maxPullOvershoot = dw - give;
                    n.x = hx + (dxw / dw) * give;
                    n.y = hy + (dyw / dw) * give;
                    n.vx *= 0.2; n.vy *= 0.2;
                }
            }

            avgX += n.x; avgY += n.y;

            const distToCore = Math.hypot(n.x - core.x, n.y - core.y);
            if (Math.abs(distToCore - n.baseDist) > maxDeformation) {
                maxDeformation = Math.abs(distToCore - n.baseDist);
            }
        });

        if (!waxIntact) {
            core.vx += ((avgX / numNodes) - core.x) * 0.05;
            core.vy += ((avgY / numNodes) - core.y) * 0.05;
        }

        // 배경에서 밀고 들어오는 손끝도 껍질 데미지 (좌표 기반)
        if (waxIntact && spec.type === "crack_wax") {
            activePushes.forEach(p => damageWax(p.x, p.y, touchGestures[p.id]));
            waxChips.forEach(c => { totalCracks += c.state === 2 ? 1 : 0.5; });
        }

        // 껍질은 안 늘어나지만, 한계 이상 세게 잡아끌면 통째로 와장창
        // 단, 왁스 층 전환 직후엔 잠깐 무적(연속으로 여러 겹이 한 번에 깨지는 것 방지)
        const layerCooldown = waxLayerBrokenAt && (performance.now() - waxLayerBrokenAt < 450);
        if (!layerCooldown) {
            if (waxIntact && spec.type === "wax" && maxPullOvershoot > radius * 0.55) {
                breakWaxAll();
            }
            if (waxIntact && spec.type === "crack_wax" && (totalCracks >= (spec.breakScore || 4) || maxPullOvershoot > radius * 0.7 * (spec.waxTough || 1))) {
                breakWaxAll();
            }
        }

        // 3. 렌더링 파트
        const showWaxShell = waxIntact && spec.type.includes("wax");

        // 3-1. 늘어남 정도(0~1) — 늘어날수록 커지고 원형 복귀하면 서서히 0으로
        let stretchTarget = 0;
        if (!waxIntact) {
            stretchTarget = Math.min(1, Math.max(0, maxDeformation - radius * 0.12) / (radius * 0.6));
        }
        stretchSmooth += (stretchTarget - stretchSmooth) * 0.15;

        // 3-2. 개체별 투명도: 평소 baseAlpha ↔ 최대 스트레치 stretchAlpha 보간
        const baseA = spec.baseAlpha !== undefined ? spec.baseAlpha : 1;
        const stA = spec.stretchAlpha !== undefined ? spec.stretchAlpha : baseA;
        let bodyAlpha = showWaxShell ? 1 : (baseA + (stA - baseA) * stretchSmooth);
        if (spec.jelly && !showWaxShell) bodyAlpha = 0.42 + jellyCloud * 0.52; // 만질수록 탁해짐

        if (window.malang3D) {
            window.malang3D.onPhysicsStep({ spec, radius, bodyAlpha });
            return;
        }

        // 3-3. 본체를 오프스크린에 불투명하게 그린 뒤, 알파를 입혀 합성
        bodyCtx.clearRect(0, 0, width, height);
        // 오로라(L): 시간에 따라 색상이 무지개처럼 흐름 / 해파리: 세션 고정 랜덤 색 + 탁해질수록 뽀얗게
        let bodyColor = spec.color;
        if (spec.aurora) {
            bodyColor = `hsl(${Math.floor(auroraHue)}, ${Math.floor(auroraSat)}%, ${Math.floor(92 - auroraSat * 0.25)}%)`;
        } else if (spec.jelly) {
            bodyColor = `hsl(${jellyHue}, ${Math.min(85, jellySat * (1 + 0.45 * jellyCloud))}%, ${jellyLit + (88 - jellyLit) * 0.3 * jellyCloud}%)`;
        } else if (spec.mysteryCore) {
            bodyColor = mysteryColor;
        }
        bodyCtx.save();
        bodyCtx.filter = spec.fineGoo ? 'url(#gooeyFine)' : 'url(#gooey)'; // 정밀 모양은 미세 블러
        if (spec.rim) {
            // 림(테두리 음영)도 같은 노드로 그려서 몸통과 함께 늘어남
            traceAndFillBlob(bodyCtx, spec.rim, radius, spec.strokeF);
            traceAndFillBlob(bodyCtx, bodyColor, radius, (spec.strokeF || 0.8) - (spec.rimW || 0.18));
        } else {
            traceAndFillBlob(bodyCtx, bodyColor, radius, spec.strokeF);
        }
        // 해파리 발: 현재 몸통선(노드) 위에 붙어 절대 안 떨어짐. 문지르면 몸통선을 따라 밀렸다가 복귀
        if (spec.jelly && jellyFeet.length) {
            bodyCtx.fillStyle = bodyColor;
            bodyCtx.beginPath();
            jellyFeet.forEach(F => {
                F.slide *= 0.985; // 시간이 지나면 원래 자리로
                const pos = F.baseNi + F.slide;
                const i0 = ((Math.floor(pos) % numNodes) + numNodes) % numNodes;
                const i1 = (i0 + 1) % numNodes;
                const tf = pos - Math.floor(pos);
                const nx2 = nodes[i0].x + (nodes[i1].x - nodes[i0].x) * tf;
                const ny2 = nodes[i0].y + (nodes[i1].y - nodes[i0].y) * tf;
                const dl = Math.hypot(nx2 - core.x, ny2 - core.y) || 1;
                const fx2 = nx2 + ((nx2 - core.x) / dl) * F.out * radius;
                const fy2 = ny2 + ((ny2 - core.y) / dl) * F.out * radius;
                F.px = fx2; F.py = fy2; // 상호작용 판정용 캐시
                bodyCtx.moveTo(fx2 + F.r * radius, fy2);
                bodyCtx.arc(fx2, fy2, F.r * radius, 0, Math.PI * 2);
            });
            bodyCtx.fill();
        }
        bodyCtx.restore();

        // 목화솜: 회색 감싸기 → 흰 봉우리 순서로 그려서 흰 알갱이가 항상 회색 안에 들어감
        if (spec.puffs && cottonPuffs.length) {
            const puffPos = cottonPuffs.map(P => {
                const nd = nodes[P.ni];
                return {
                    x: core.x + (nd.x - core.x) * P.f + P.ox * radius,
                    y: core.y + (nd.y - core.y) * P.f + P.oy * radius,
                    r: P.r * radius
                };
            });
            bodyCtx.save();
            // 1) 회색 감싸기: 봉우리마다 한 치수 큰 회색 원 (몸통 회색과 합쳐져 완전한 테두리)
            bodyCtx.filter = 'blur(2px)';
            bodyCtx.fillStyle = "#c9c4d4";
            bodyCtx.beginPath();
            puffPos.forEach(p => {
                const rr = p.r * 1.25 + 4;
                bodyCtx.moveTo(p.x + rr, p.y);
                bodyCtx.arc(p.x, p.y, rr, 0, Math.PI * 2);
            });
            bodyCtx.fill();
            // 2) 흰 솜봉우리 (좌상단으로 살짝 치우쳐 아래쪽 회색 골이 두껍게 → 입체감)
            bodyCtx.filter = 'blur(1.5px)';
            bodyCtx.fillStyle = "#ffffff";
            bodyCtx.beginPath();
            puffPos.forEach(p => { bodyCtx.moveTo(p.x - 1 + p.r, p.y - 2); bodyCtx.arc(p.x - 1, p.y - 2, p.r, 0, Math.PI * 2); });
            bodyCtx.fill();
            bodyCtx.restore();
        }

        // 폼볼: 폼 알갱이 텍스처 (source-atop이라 몸통 안에만 그려짐)
        if ((spec.beads || spec.customBeads) && foamBeads.length) {
            bodyCtx.save();
            bodyCtx.globalCompositeOperation = 'source-atop';
            foamBeads.forEach(B => {
                const nd = nodes[B.ni];
                const dxn = nd.x - core.x, dyn = nd.y - core.y;
                const bx2 = core.x + dxn * B.f - dyn * B.aoff;
                const by2 = core.y + dyn * B.f + dxn * B.aoff;
                const br = B.r * radius;
                const bc = spec.beadColors || ["rgba(255,255,255,0.9)", "#ffd9e1", "#f79cae"];
                const brr = br * (B.rMul || 1);
                if (B.pearl) {
                    const pg = bodyCtx.createRadialGradient(bx2 - brr*0.3, by2 - brr*0.3, brr*0.1, bx2, by2, brr);
                    pg.addColorStop(0, "#ffffff"); pg.addColorStop(0.5, B.col || "#f4f0ff"); pg.addColorStop(1, "#d8cff0");
                    bodyCtx.fillStyle = pg;
                } else {
                    bodyCtx.fillStyle = B.col ? B.col : (B.tint < 0.4 ? bc[0] : (B.tint < 0.7 ? bc[1] : bc[2]));
                }
                bodyCtx.beginPath();
                if (B.shape === "star") {
                    for (let v = 0; v < 10; v++) {
                        const rr = v % 2 === 0 ? brr * 1.4 : brr * 0.6;
                        const a = (v / 10) * Math.PI * 2 - Math.PI / 2;
                        const px = bx2 + Math.cos(a) * rr, py = by2 + Math.sin(a) * rr;
                        v === 0 ? bodyCtx.moveTo(px, py) : bodyCtx.lineTo(px, py);
                    }
                    bodyCtx.closePath();
                } else if (B.shape === "heart") {
                    const hs = brr * 1.3;
                    bodyCtx.moveTo(bx2, by2 + hs * 0.35);
                    bodyCtx.bezierCurveTo(bx2 - hs, by2 - hs * 0.4, bx2 - hs * 0.5, by2 - hs, bx2, by2 - hs * 0.35);
                    bodyCtx.bezierCurveTo(bx2 + hs * 0.5, by2 - hs, bx2 + hs, by2 - hs * 0.4, bx2, by2 + hs * 0.35);
                    bodyCtx.closePath();
                } else {
                    bodyCtx.arc(bx2, by2, brr, 0, Math.PI * 2);
                }
                bodyCtx.fill();
                if (!B.pearl) {
                    bodyCtx.fillStyle = "rgba(255,255,255,0.75)";
                    bodyCtx.beginPath();
                    bodyCtx.arc(bx2 - brr * 0.3, by2 - brr * 0.32, brr * 0.28, 0, Math.PI * 2);
                    bodyCtx.fill();
                }
            });
            bodyCtx.restore();
        }

        // 탄산 기포: 만진 자리에서 생겨나 위로 보글보글 올라가다 사라짐 (source-atop이라 몸 안에서만)
        if (spec.fizz && fizzBubbles.length) {
            bodyCtx.save();
            bodyCtx.globalCompositeOperation = 'source-atop';
            bodyCtx.strokeStyle = 'rgba(255,255,255,0.55)';
            bodyCtx.lineWidth = 1.5;
            for (let i = fizzBubbles.length - 1; i >= 0; i--) {
                const B = fizzBubbles[i];
                B.oy -= B.sp; B.wp += 0.05;
                if (B.oy < -0.85) { fizzBubbles.splice(i, 1); continue; }
                const bx2 = core.x + (B.ox + Math.sin(B.wp) * 0.03) * radius;
                const by2 = core.y + B.oy * radius;
                bodyCtx.beginPath();
                bodyCtx.arc(bx2, by2, B.r * radius, 0, Math.PI * 2);
                bodyCtx.stroke();
                bodyCtx.fillStyle = 'rgba(255,255,255,0.35)';
                bodyCtx.beginPath();
                bodyCtx.arc(bx2 - B.r * radius * 0.3, by2 - B.r * radius * 0.3, B.r * radius * 0.28, 0, Math.PI * 2);
                bodyCtx.fill();
            }
            bodyCtx.restore();
        }

        // 글리터: 만진 자리에 박혀서 계속 반짝반짝 (십자 광채, 위상별 명멸)
        if (spec.sparkle && sparkles.length) {
            bodyCtx.save();
            bodyCtx.globalCompositeOperation = 'source-atop';
            bodyCtx.lineCap = 'round';
            sparkles.forEach(S => {
                S.ph += S.spd;
                S.ox += S.dx || 0; S.oy += S.dy || 0; // 점점 퍼짐
                const a = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(S.ph));
                const sx = core.x + S.ox * radius, sy = core.y + S.oy * radius;
                const L = S.sz * radius * (0.7 + 0.3 * a);
                bodyCtx.globalAlpha = a;
                bodyCtx.strokeStyle = S.col || "#ffffff";
                bodyCtx.lineWidth = 2;
                bodyCtx.save();
                bodyCtx.translate(sx, sy); bodyCtx.rotate(S.rot);
                bodyCtx.beginPath();
                bodyCtx.moveTo(-L, 0); bodyCtx.lineTo(L, 0);
                bodyCtx.moveTo(0, -L); bodyCtx.lineTo(0, L);
                bodyCtx.stroke();
                bodyCtx.restore();
            });
            bodyCtx.restore();
        }

        // 우주 덩어리(L): 내부 은하 별빛 — 몸 안에서 별들이 천천히 명멸 (커스텀 재현 불가)
        if (spec.galaxy && galaxyStars.length) {
            bodyCtx.save();
            bodyCtx.globalCompositeOperation = 'source-atop';
            // 은은한 성운 그라데이션 (중앙에서 부드럽게 퍼짐, 경계선 없이)
            const neb = bodyCtx.createRadialGradient(core.x, core.y, 0, core.x, core.y, radius * 1.15);
            neb.addColorStop(0, 'rgba(130,100,210,0.32)');
            neb.addColorStop(0.35, 'rgba(95,70,175,0.18)');
            neb.addColorStop(0.7, 'rgba(60,45,130,0.08)');
            neb.addColorStop(1, 'rgba(40,30,90,0)');
            bodyCtx.fillStyle = neb;
            bodyCtx.fillRect(0, 0, width, height);
            // 별들
            const t = performance.now() * 0.001;
            galaxyStars.forEach(st => {
                // 노드 방향 보간으로 몸 변형 추종
                let seg = st.ang / (Math.PI * 2) * numNodes;
                seg = ((seg % numNodes) + numNodes) % numNodes;
                const i0 = Math.floor(seg), i1 = (i0 + 1) % numNodes, tf = seg - i0;
                const ex = (nodes[i0].x - core.x) * (1 - tf) + (nodes[i1].x - core.x) * tf;
                const ey = (nodes[i0].y - core.y) * (1 - tf) + (nodes[i1].y - core.y) * tf;
                const sx = core.x + ex * st.f, sy = core.y + ey * st.f;
                const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.spd + st.ph)); // 반짝임
                const sr = st.sz * radius * (0.7 + tw * 0.6);
                // 별빛 글로우
                const g = bodyCtx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
                g.addColorStop(0, `hsla(${st.hue}, 90%, 92%, ${tw})`);
                g.addColorStop(0.4, `hsla(${st.hue}, 85%, 78%, ${tw * 0.5})`);
                g.addColorStop(1, `hsla(${st.hue}, 80%, 70%, 0)`);
                bodyCtx.fillStyle = g;
                bodyCtx.beginPath(); bodyCtx.arc(sx, sy, sr * 3, 0, 7); bodyCtx.fill();
                // 별 코어
                bodyCtx.fillStyle = `hsla(${st.hue}, 60%, 98%, ${tw})`;
                bodyCtx.beginPath(); bodyCtx.arc(sx, sy, sr * 0.6, 0, 7); bodyCtx.fill();
            });
            bodyCtx.restore();
        }

        // 미지의 황금 오브(L): 왁스 벗긴 뒤 코어가 맥동하며 발광 (커스텀 재현 불가)
        if (spec.mysteryCore && !showWaxShell) {
            const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.0011);
            // 내부 발광 (몸 안)
            bodyCtx.save();
            bodyCtx.globalCompositeOperation = 'source-atop';
            const cg = bodyCtx.createRadialGradient(core.x, core.y, radius * 0.05, core.x, core.y, radius * 0.95);
            cg.addColorStop(0, `rgba(255,250,230,${0.55 * pulse})`);
            cg.addColorStop(0.4, `rgba(255,225,150,${0.3 * pulse})`);
            cg.addColorStop(1, 'rgba(255,200,100,0)');
            bodyCtx.fillStyle = cg;
            bodyCtx.fillRect(0, 0, width, height);
            bodyCtx.restore();
            // 외곽 후광 (몸 밖으로 넓고 은은하게 번짐) — 본체 위 ctx에 직접
            ctx.save();
            const og = ctx.createRadialGradient(core.x, core.y, radius * 0.6, core.x, core.y, radius * 2.2);
            og.addColorStop(0, `rgba(255,222,140,${0.22 * pulse})`);
            og.addColorStop(0.5, `rgba(255,215,120,${0.1 * pulse})`);
            og.addColorStop(1, 'rgba(255,215,120,0)');
            ctx.fillStyle = og;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }

        // 3-4. 개체별 광택 (gloss 0=무광 ~ 1=유리광)
        const gloss = spec.gloss !== undefined ? spec.gloss : 0.3;
        if (gloss > 0.02 && !showWaxShell) {
            bodyCtx.save();
            bodyCtx.globalCompositeOperation = 'source-atop';
            const hl = bodyCtx.createRadialGradient(
                core.x - radius * 0.4, core.y - radius * 0.45, radius * 0.05,
                core.x - radius * 0.4, core.y - radius * 0.45, radius * 1.0);
            hl.addColorStop(0, `rgba(255,255,255,${0.65 * gloss})`);
            hl.addColorStop(0.4, `rgba(255,255,255,${0.2 * gloss})`);
            hl.addColorStop(1, 'rgba(255,255,255,0)');
            bodyCtx.fillStyle = hl;
            bodyCtx.fillRect(0, 0, width, height);
            bodyCtx.restore();
        }

        ctx.save();
        ctx.globalAlpha = bodyAlpha;
        ctx.drawImage(bodyCanvas, 0, 0);
        ctx.restore();

        // 해파리 얼굴 (인쇄된 얼굴이라 불투명)
        if (spec.jelly || spec.faceTopping) drawJellyFace(radius);

        // 커스텀 토핑 (머리 위 장식) — 여러 개면 살짝 벌려 배치
        if (spec.toppings) {
            const deco = spec.toppings.filter(t => t !== "face" && t !== "apple");
            deco.forEach((t, di) => {
                const off = (di - (deco.length - 1) / 2) * radius * 0.42;
                drawTopping(ctx, t, core.x + off, core.y - radius * 0.96, radius / 100);
            });
        }

        // 3-5. 왁스 코팅 껍질 (광택 재질 + 깨진 자리 구멍)
        if (showWaxShell) renderWaxShell(spec, radius);

        // 반짝이 왁스: 왁스 껍질 위에 작은 반짝임
        if (showWaxShell && spec.waxSparkle) {
            ctx.save();
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            const t = performance.now() * 0.004;
            for (let i = 0; i < 10; i++) {
                const a = i * 2.4 + t, rr = radius * (0.3 + (i % 3) * 0.22);
                const sx = core.x + Math.cos(a) * rr, sy = core.y + Math.sin(a) * rr;
                const sp = (0.5 + 0.5 * Math.sin(t * 3 + i)) * radius * 0.02;
                ctx.beginPath(); ctx.arc(sx, sy, sp, 0, 7); ctx.fill();
            }
            ctx.restore();
        }

        // 3-6. 껍질 장식 (청사과 꼭지+잎)
        if (spec.decor === "apple" && (showWaxShell || !spec.type.includes("wax"))) {
            drawAppleDecor(ctx, core.x, core.y - radius * 1.02, radius / 100, 0);
        }

        // 4. 크런치 알갱이 연산
        if (spec.type === "crunch" && crunchParticles.length > 0) {
            crunchParticles.forEach((p, index) => {
                p.x += p.vx; p.y += p.vy;
                if (p.dust) {
                    // 먼지: 천천히 커지고 흐릿하게 흩어짐
                    p.size += p.grow;
                    p.vx *= 0.985; p.vy *= 0.985;
                    p.alpha -= 0.0045;
                } else {
                    p.alpha -= 0.02;
                }
                ctx.fillStyle = `rgba(${p.rgb || "255,255,255"}, ${Math.max(0, p.alpha)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.fill();
                if(p.alpha <= 0) crunchParticles.splice(index, 1);
            });
        }

        // 5. 왁스 플레이크(얇은 칩) 낙하 연산
        if (spec.type.includes("wax") && waxShards.length > 0) {
            ctx.fillStyle = spec.waxColor;
            ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.5;
            for(let i = waxShards.length - 1; i >= 0; i--) {
                const s = waxShards[i];
                s.vy += 0.5; s.vx *= 0.985;
                s.x += s.vx; s.y += s.vy; s.rot += s.vRot;
                ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
                ctx.beginPath();
                s.verts.forEach((v, vi) => { vi === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y); });
                ctx.closePath();
                ctx.fill(); ctx.stroke(); ctx.restore();
                if(s.y > height + 100) waxShards.splice(i, 1);
            }
        }

        // 6. 떨어진 장식(사과 꼭지+잎) 낙하 연산
        if (decorShards.length > 0) {
            for (let i = decorShards.length - 1; i >= 0; i--) {
                const d = decorShards[i];
                d.vy += 0.5; d.x += d.vx; d.y += d.vy; d.rot += d.vRot;
                drawAppleDecor(ctx, d.x, d.y, radius / 100, d.rot);
                if (d.y > height + 120) decorShards.splice(i, 1);
            }
        }

    }

    // Keep the original spring constants at 60 Hz on high-refresh and slow displays.
    let previousFrame = 0, physicsRemainder = 0;
    function animate(now = performance.now()) {
        const dt = previousFrame ? Math.min((now - previousFrame) / 1000, 0.05) : 1 / 60;
        previousFrame = now;
        physicsRemainder += dt;
        while (physicsRemainder >= 1 / 60) {
            simulateFrame();
            physicsRemainder -= 1 / 60;
        }
        window.malang3D?.renderFrame(dt);
        requestAnimationFrame(animate);
    }

    /* =================================================================
       6. 인터랙션 처리
    ================================================================= */
    // 탄산 기포: 터치 지점(코어 상대좌표)에서 생성
    function spawnFizz(x, y, count) {
        const r = getRadius();
        const big = getSpec().bubbleBig; // 왕방울 기포: 크고 천천히 (비눗방울 계열)
        for (let i = 0; i < count; i++) {
            if (fizzBubbles.length > 40) fizzBubbles.shift();
            fizzBubbles.push({
                ox: (x - core.x) / r + (Math.random() - 0.5) * 0.12,
                oy: (y - core.y) / r + (Math.random() - 0.5) * 0.08,
                r: (0.025 + Math.random() * 0.035) * (big ? 2.4 : 1),
                sp: (0.005 + Math.random() * 0.007) * (big ? 0.6 : 1),
                wp: Math.random() * 6
            });
        }
    }

    // 글리터: 터치 지점에 박혀 계속 반짝임 (최대 16개, 오래된 것부터 교체)
    function spawnSparkle(x, y, count) {
        const r = getRadius();
        for (let i = 0; i < count; i++) {
            if (sparkles.length >= 28) sparkles.shift();
            const gspec = getSpec();
            let scol = gspec.sparkleColor || "#ffffff";
            if (gspec.sparkleRainbow) scol = `hsl(${Math.floor(Math.random() * 360)}, 90%, 70%)`;
            else if (gspec.sparkleHolo) scol = `hsl(${(Math.floor(performance.now() * 0.1) + Math.floor(Math.random() * 60)) % 360}, 75%, 78%)`;
            sparkles.push({
                col: scol,
                ox: (x - core.x) / r + (Math.random() - 0.5) * 0.18,
                oy: (y - core.y) / r + (Math.random() - 0.5) * 0.18,
                sz: 0.045 + Math.random() * 0.05,
                rot: Math.random() * Math.PI,
                ph: Math.random() * 6,
                spd: 0.06 + Math.random() * 0.05,
                dx: (Math.random() - 0.5) * 0.0018, // 시간이 지나며 서서히 퍼짐
                dy: (Math.random() - 0.5) * 0.0018
            });
        }
    }

    // 짧은 탭 → 챱! 하고 출렁 (잘 늘어나는 말랑이일수록 크게 출렁임)
    function jiggleSlime(x, y) {
        const spec = getSpec();
        // 기포/글리터는 왁스 상태와 무관하게 터치 지점에 생성 (구멍 사이로 보임)
        if (spec.fizz) spawnFizz(x, y, 7);
        if (spec.sparkle) spawnSparkle(x, y, 6);
        if (waxIntact) return false; // 왁스 껍질은 단단해서 안 출렁임
        const amp = Math.min(20, Math.max(4, 0.6 / spec.k)); // 부드러울수록(k 낮을수록) 큰 출렁
        const reach = getRadius() * 1.6;
        nodes.forEach(n => {
            const dx = n.x - x, dy = n.y - y;
            const d = Math.hypot(dx, dy) || 1;
            const fall = Math.max(0, 1 - d / reach);
            n.vx += (dx / d) * amp * fall;
            n.vy += (dy / d) * amp * fall;
        });
        core.vx += (core.x - x) * 0.02;
        core.vy += (core.y - y) * 0.02;
        if (spec.jelly) jellyCloud = Math.min(1, jellyCloud + 0.015);
        if (spec.aurora) { auroraHue = (auroraHue + 24) % 360; auroraSat = Math.min(80, auroraSat + 6); }
        if (spec.dust) {
            // 밀가루 도우: 퍽! 하고 먼지 구름이 크게 피어오름
            playSquishSound('chop');
            for (let b = 0; b < 5; b++) {
                crunchParticles.push({
                    x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 40,
                    vx: (Math.random() - 0.5) * 1.8, vy: -0.4 - Math.random() * 1.1,
                    size: 12 + Math.random() * 10, alpha: 0.26 + Math.random() * 0.1,
                    dust: true, grow: 0.22 + Math.random() * 0.14,
                    rgb: spec.popColor || "246,241,232"
                });
            }
        } else if (spec.type === "crunch") {
            // 폼볼: 탭하면 알갱이가 오도독 터지는 팝!
            playCrackSound(false);
            for (let b = 0; b < 8; b++) {
                crunchParticles.push({
                    x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60,
                    vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 3,
                    size: 2 + Math.random() * 3.5, alpha: 1,
                    rgb: Math.random() < 0.5 ? "255,255,255" : (spec.popColor || "255,182,193")
                });
            }
        } else if (spec.type !== "squishy") {
            playSquishSound('chop'); // 스퀴시는 누를 때 바람소리만
        }
        return true;
    }

    // 기기 흔들기 → 말랑이 출렁 (iOS는 첫 터치 때 권한 요청됨)
    let motionReady = false;
    let motionAttached = false;
    let lastAcc = null;
    function initMotion() {
        if (motionAttached) return;  // 이미 리스너 붙었으면 끝
        const attach = () => {
            if (motionAttached) return;
            motionAttached = true;
            window.addEventListener('devicemotion', onMotion);
        };
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            // iOS 13+: 반드시 사용자 제스처(터치) 안에서 호출되어야 권한 팝업이 뜸
            // 실패해도 motionReady를 잠그지 않아, 다음 터치에서 다시 시도 가능
            DeviceMotionEvent.requestPermission()
                .then(state => { if (state === 'granted') attach(); })
                .catch(() => {});
        } else if (typeof DeviceMotionEvent !== 'undefined') {
            // 안드로이드/기타: 권한 없이 바로 부착
            attach();
        }
        motionReady = true;
    }
    function onMotion(e) {
        const a = e.accelerationIncludingGravity;
        if (!a || a.x === null) return;
        if (lastAcc) {
            const dx = a.x - lastAcc.x, dy = a.y - lastAcc.y;
            const mag = Math.hypot(dx, dy);
            if (mag > 2.5) {
                const spec = getSpec();
                // 2단계 감도: 약하게 흔들면 제자리 잔출렁(soft), 세게 흔들 때만 이동(hard)
                const soft = Math.min(1.6, (mag - 2.5) / 5);
                const hard = Math.max(0, Math.min(2.2, (mag - 8) / 6));
                if (!waxIntact) {
                    const amp = Math.min(14, Math.max(3, 0.45 / spec.k));
                    nodes.forEach(n => { n.vx += -dx * amp * 0.1 * soft; n.vy += dy * amp * 0.1 * soft; });
                    core.vx += -dx * 0.55 * hard; core.vy += dy * 0.55 * hard;
                    if (soft > 0.5 && Math.random() < 0.4) playSquishSound('squish');
                } else {
                    // 왁스 상태: 단단해서 세게 흔들 때만 통째로 이동
                    core.vx += -dx * 0.7 * hard; core.vy += dy * 0.7 * hard;
                }
            }
        }
        lastAcc = { x: a.x, y: a.y };
    }

    function getNearestNode(x, y) {
        let minDist = Infinity; let nearest = null;
        const catchRadius = waxIntact ? getRadius() : getRadius() * 1.4;
        
        nodes.forEach(n => {
            if (n.touchId !== null) return;
            const dist = Math.hypot(n.x - x, n.y - y);
            if (dist < minDist) { minDist = dist; nearest = n; }
        });
        const coreDist = Math.hypot(core.x - x, core.y - y);
        if (coreDist < minDist && core.touchId == null) { minDist = coreDist; nearest = core; }
        return minDist < catchRadius ? nearest : null;
    }

    let platformApplied = false;
