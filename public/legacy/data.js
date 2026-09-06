/* =================================================================
       1. 다양해진 말랑이 라인업 DB 설정 
    ================================================================= */
    // gloss: 광택 세기(0~1), baseAlpha: 평소 투명도, stretchAlpha: 최대로 늘렸을 때 투명도
    // shape: "heart"면 하트형, strokeF: 몸통 두께 배율, kMul은 cotton 타입에서 노드별 랜덤 부여
    const slimeDB = [
        { id: 1, name: "물젤리 슬랑이", grade: "C", color: "#64c8ff", k: 0.05, damping: 0.8, type: "normal", rate: 5, gloss: 0.55, baseAlpha: 0.9, stretchAlpha: 0.35 },
        { id: 2, name: "우유 생크림 폼", grade: "C", color: "#ffffff", k: 0.08, damping: 0.85, type: "normal", rate: 5, gloss: 0.08, baseAlpha: 1, stretchAlpha: 0.95 },
        { id: 3, name: "폼볼 크런치 팝", grade: "R", color: "#ffb6c1", k: 0.11, damping: 0.75, type: "crunch", beads: true, bumpy: 0.09, rate: 3, gloss: 0.3, baseAlpha: 1, stretchAlpha: 0.85 },
        { id: 4, name: "바사삭 리얼 왁뿌볼", grade: "E", color: "#d81b60", waxColor: "#f8bbd0", k: 0.12, damping: 0.8, type: "wax", rate: 3, gloss: 0.5, baseAlpha: 1, stretchAlpha: 0.8 },
        { id: 5, name: "바삭 크랙볼", grade: "E", color: "#ff5722", waxColor: "#ffe082", k: 0.10, damping: 0.8, type: "crack_wax", rate: 3, gloss: 0.45, baseAlpha: 1, stretchAlpha: 0.8 }, 
        { id: 6, name: "쫀득 고무 찰떡", grade: "R", color: "#8bc34a", k: 0.18, damping: 0.65, type: "normal", rate: 3, gloss: 0.7, baseAlpha: 1, stretchAlpha: 0.9 },
        { id: 7, name: "구름 숨결 스퀴시", grade: "E", color: "#e040fb", k: 0.02, damping: 0.55, type: "squishy", rate: 2, gloss: 0.2, baseAlpha: 0.95, stretchAlpha: 0.75 }, 
        { id: 8, name: "✨우주 덩어리✨", grade: "L", color: "#3d2f6b", galaxy: true, k: 0.06, damping: 0.88, type: "normal", rate: 1, gloss: 0.7, baseAlpha: 0.9, stretchAlpha: 0.55 },
        // ── 신규 & 파생 라인업 ──
        { id: 9, name: "코랄 하트젤리", grade: "E", color: "#ff7f6e", k: 0.07, damping: 0.8, type: "normal", fineGoo: true, shapePts: [[-0.0,1.0],[0.036,0.946],[0.147,0.82],[0.331,0.662],[0.547,0.487],[0.727,0.338],[0.838,0.21],[0.907,0.084],[0.939,-0.041],[0.936,-0.166],[0.9,-0.281],[0.829,-0.392],[0.732,-0.483],[0.622,-0.541],[0.515,-0.562],[0.404,-0.55],[0.284,-0.502],[0.16,-0.412],[0.046,-0.288],[0.011,-0.239],[-0.0,-0.222],[-0.029,-0.265],[-0.139,-0.393],[-0.263,-0.489],[-0.388,-0.546],[-0.499,-0.562],[-0.606,-0.546],[-0.715,-0.494],[-0.816,-0.408],[-0.892,-0.299],[-0.933,-0.181],[-0.941,-0.061],[-0.916,0.061],[-0.851,0.19],[-0.747,0.318],[-0.582,0.459],[-0.362,0.637],[-0.168,0.8],[-0.052,0.923],[-0.009,0.986]], svgScale: 1.02, strokeF: 0.2, maxStretch: 1.5, homeW: 2.2, nbrW: 0.5, rate: 3, gloss: 0.6, baseAlpha: 0.95, stretchAlpha: 0.5 },
        { id: 10, name: "뭉게구름 솜슬라임", grade: "E", color: "#eceae6", k: 0.012, damping: 0.62, type: "cotton", rate: 2, gloss: 0.08, baseAlpha: 1, stretchAlpha: 0.96 },
        { id: 11, name: "청량 민트젤리", grade: "C", color: "#5fd7c5", k: 0.05, damping: 0.8, type: "normal", rate: 5, gloss: 0.5, baseAlpha: 0.85, stretchAlpha: 0.3 },
        { id: 12, name: "아그작 청사과 왁뿌볼", grade: "E", color: "#7cb342", waxColor: "#d7ec9a", k: 0.10, damping: 0.8, type: "crack_wax", decor: "apple", rate: 3, gloss: 0.5, baseAlpha: 1, stretchAlpha: 0.8 },
        { id: 13, name: "멜론 푸딩젤리", grade: "R", color: "#58d668", k: 0.06, damping: 0.82, type: "normal", rate: 3, gloss: 0.75, baseAlpha: 0.8, stretchAlpha: 0.45 },
        { id: 14, name: "유리알 리퀴드", grade: "R", color: "#4fc3f7", k: 0.03, damping: 0.86, type: "normal", rate: 3, gloss: 0.9, baseAlpha: 0.7, stretchAlpha: 0.22 },
        { id: 15, name: "포도알 톡톡", grade: "R", color: "#8e44ad", k: 0.15, damping: 0.7, type: "normal", rate: 3, gloss: 0.85, baseAlpha: 0.9, stretchAlpha: 0.55 },
        { id: 16, name: "황금 꿀 슬라임", grade: "E", color: "#e2b93b", k: 0.04, damping: 0.84, type: "normal", rate: 2, gloss: 0.95, baseAlpha: 0.78, stretchAlpha: 0.35 },
        { id: 17, name: "몽실몽실 목화솜", grade: "E", color: "#c9c4d4", k: 0.014, damping: 0.6, type: "cotton", lumpy: true, strokeF: 0.55, homeW: 2.0, nbrW: 0.25, rate: 2, gloss: 0.05, baseAlpha: 1, stretchAlpha: 1, puffs: true, plastic: 0.1 },
        { id: 18, name: "🌈오로라 젤리🌈", grade: "L", color: "#b388ff", aurora: true, k: 0.035, damping: 0.86, type: "normal", rate: 1, gloss: 0.9, baseAlpha: 0.85, stretchAlpha: 0.4 },
        { id: 19, name: "투명 해파리 말랑이", grade: "E", color: "#dfeef2", type: "normal", jelly: true, shape: "jellyfish", strokeF: 0.42, k: 0.14, damping: 0.7, homeW: 1.6, nbrW: 1.2, maxStretch: 1.18, minStretch: 0.55, rate: 3, gloss: 0.75, baseAlpha: 0.42, stretchAlpha: 0.42 },
        // ── C/R 라인업 확충 ──
        { id: 20, name: "딸기우유 폼", grade: "C", color: "#ffc7d4", type: "normal", k: 0.07, damping: 0.83, rate: 4, gloss: 0.15, baseAlpha: 1, stretchAlpha: 0.9 },
        { id: 21, name: "레몬 젤리", grade: "C", color: "#ffe36e", type: "normal", k: 0.05, damping: 0.8, rate: 3, gloss: 0.5, baseAlpha: 0.85, stretchAlpha: 0.4 },
        { id: 22, name: "초코 푸딩", grade: "C", color: "#8d5a3b", type: "normal", k: 0.04, damping: 0.82, rate: 3, gloss: 0.6, baseAlpha: 0.95, stretchAlpha: 0.8 },
        { id: 23, name: "소다 젤리", grade: "C", color: "#a5dcf5", type: "normal", k: 0.05, damping: 0.8, rate: 3, gloss: 0.45, baseAlpha: 0.8, stretchAlpha: 0.35 },
        { id: 24, name: "슈퍼 탱탱볼", grade: "R", color: "#ff6b6b", type: "normal", bouncy: true, k: 0.22, damping: 0.62, maxStretch: 1.3, rate: 3, gloss: 0.8, baseAlpha: 0.9, stretchAlpha: 0.7 },
        { id: 25, name: "꾸덕 카라멜", grade: "R", color: "#c98a3d", type: "normal", k: 0.02, damping: 0.7, plastic: 0.035, homeW: 1.3, nbrW: 0.8, rate: 3, gloss: 0.65, baseAlpha: 1, stretchAlpha: 0.85 },
        { id: 26, name: "사이다 버블 팝", grade: "R", color: "#bfe6f7", type: "crunch", beads: true, beadColors: ["rgba(255,255,255,0.95)", "#dff2fc", "#9ed3ef"], popColor: "158,211,239", bumpy: 0.07, k: 0.08, damping: 0.8, rate: 3, gloss: 0.7, baseAlpha: 0.8, stretchAlpha: 0.45 },
        { id: 27, name: "쭈욱 치즈 스트레치", grade: "R", color: "#f7c948", type: "normal", k: 0.025, damping: 0.85, rate: 3, gloss: 0.55, baseAlpha: 0.92, stretchAlpha: 0.55 },
        // ── 스퀴시 파생 ──
        { id: 28, name: "말랑 식빵 반죽", grade: "C", color: "#eddcbc", type: "squishy", k: 0.025, damping: 0.55, rate: 3, gloss: 0.1, baseAlpha: 1, stretchAlpha: 0.92 },
        { id: 29, name: "말차 모찌 반죽", grade: "R", color: "#9dbf7d", type: "squishy", k: 0.018, damping: 0.5, rate: 2, gloss: 0.3, baseAlpha: 0.97, stretchAlpha: 0.75 },
        { id: 30, name: "밤하늘 별 반죽", grade: "E", color: "#3a4680", type: "squishy", beads: true, beadColors: ["rgba(255,255,255,0.95)", "#ffe98a", "#ffd43b"], k: 0.02, damping: 0.52, rate: 1, gloss: 0.65, baseAlpha: 0.92, stretchAlpha: 0.6 },
        // ── 형태기억(소성) 계열: 유연하게 변형되고 만든 모양이 유지됨 ──
        { id: 31, name: "밀가루 반죽 도우", grade: "C", color: "#efe3cf", type: "crunch", plastic: 0.05, bumpy: 0.05, maxStretch: 1.7, homeW: 1.2, nbrW: 0.4, k: 0.03, damping: 0.6, dust: true, popColor: "246,241,232", rate: 3, gloss: 0.08, baseAlpha: 1, stretchAlpha: 0.95 },
        { id: 32, name: "네온 점토", grade: "R", color: "#8ef23c", type: "normal", plastic: 0.08, maxStretch: 1.5, minStretch: 0.45, homeW: 1.5, nbrW: 0.2, k: 0.04, damping: 0.62, rim: "#4bab24", rimW: 0.14, rate: 2, gloss: 0.85, baseAlpha: 0.85, stretchAlpha: 0.55 },
        { id: 33, name: "자석 리퀴드 퍼티", grade: "E", color: "#3d3d46", type: "normal", magnet: true, plastic: 0.12, maxStretch: 1.5, minStretch: 0.5, homeW: 1.6, nbrW: 0.3, k: 0.05, damping: 0.7, rate: 1, gloss: 0.9, baseAlpha: 1, stretchAlpha: 0.9 },
        // ── 왁뿌볼 계열 확장: 두께/강도/조각 크기/붕괴량이 전부 다름 ──
        { id: 34, name: "설탕 코팅 딸기볼", grade: "C", color: "#ff5f7e", waxColor: "#ffe3ec", type: "crack_wax", waxHits: 1, breakScore: 2, waxTough: 0.5, chipScale: 1.1, beads: true, beadColors: ["#ffe9a8", "#fff4d6", "#f7c948"], bumpy: 0.06, k: 0.1, damping: 0.72, rate: 3, gloss: 0.55, baseAlpha: 1, stretchAlpha: 0.6 },
        { id: 35, name: "두툼 초코 코팅볼", grade: "R", color: "#f6e7c8", waxColor: "#6b4a2f", type: "crack_wax", waxHits: 3, breakScore: 3, chipScale: 1.35, plastic: 0.04, homeW: 1.2, nbrW: 0.5, maxStretch: 1.6, beads: true, beadColors: ["#8a5a33", "#a8763f", "#fff3e0"], k: 0.03, damping: 0.62, rate: 2, gloss: 0.5, baseAlpha: 1, stretchAlpha: 0.85 },
        { id: 36, name: "쨍그랑 아이스볼", grade: "E", color: "#4fb6e8", waxColor: "#d9f1fc", type: "crack_wax", waxHits: 1, breakScore: 6, chipScale: 0.7, waxTough: 1.4, fizz: true, k: 0.045, damping: 0.84, rate: 1, gloss: 0.85, baseAlpha: 0.8, stretchAlpha: 0.35 },
        { id: 37, name: "✨미지의 황금 오브✨", grade: "L", color: "#ffffff", waxColor: "#e8c04a", type: "crack_wax", mysteryCore: true, waxHits: 3, breakScore: 6, chipScale: 0.85, waxTough: 1.6, sparkle: true, k: 0.04, damping: 0.85, rate: 1, gloss: 0.95, baseAlpha: 0.9, stretchAlpha: 0.35 },
        // ── SVG 커스텀 모양 데모: svgPath에 단일 닫힌 패스를 넣으면 그 모양이 됨 ──
                { id: 38, name: "행운의 클로버 젤리", grade: "E", color: "#54b45e", type: "normal", fineGoo: true, shapePts: [[-0.313,0.83],[-0.193,0.967],[0.002,0.993],[0.172,0.911],[0.236,0.795],[0.258,0.813],[0.376,0.862],[0.547,0.828],[0.66,0.685],[0.655,0.516],[0.479,0.34],[0.223,0.159],[0.249,0.17],[0.537,0.279],[0.775,0.318],[0.921,0.222],[0.973,0.054],[0.901,-0.113],[0.812,-0.173],[0.782,-0.185],[0.852,-0.316],[0.827,-0.489],[0.69,-0.609],[0.522,-0.614],[0.331,-0.455],[0.151,-0.223],[0.167,-0.251],[0.294,-0.508],[0.345,-0.735],[0.259,-0.888],[0.095,-0.951],[-0.076,-0.89],[-0.15,-0.786],[-0.153,-0.78],[-0.291,-0.866],[-0.465,-0.847],[-0.59,-0.715],[-0.6,-0.547],[-0.443,-0.345],[-0.253,-0.172],[-0.281,-0.188],[-0.587,-0.343],[-0.795,-0.38],[-0.942,-0.284],[-0.994,-0.11],[-0.918,0.056],[-0.835,0.111],[-0.832,0.115],[-0.924,0.264],[-0.895,0.444],[-0.762,0.558],[-0.574,0.556],[-0.335,0.414],[-0.192,0.284],[-0.173,0.263],[-0.207,0.332],[-0.317,0.626]], svgScale: 1.05, strokeF: 0.14, maxStretch: 1.45, homeW: 2.4, nbrW: 0.35, k: 0.07, damping: 0.8, rate: 1, gloss: 0.6, baseAlpha: 0.9, stretchAlpha: 0.5 },
        { id: 39, name: "뽀짝 생쥐젤리", grade: "E", color: "#c3c8d4", type: "normal", fineGoo: true, shapePts: [[0.603,-0.616],[0.469,-0.59],[0.368,-0.508],[0.313,-0.377],[0.277,-0.251],[0.259,-0.26],[0.134,-0.316],[-0.016,-0.333],[-0.168,-0.3],[-0.283,-0.241],[-0.296,-0.261],[-0.326,-0.391],[-0.388,-0.514],[-0.497,-0.59],[-0.63,-0.607],[-0.768,-0.565],[-0.879,-0.472],[-0.938,-0.347],[-0.935,-0.214],[-0.873,-0.095],[-0.767,-0.026],[-0.623,-0.017],[-0.471,-0.022],[-0.451,-0.016],[-0.481,0.109],[-0.482,0.243],[-0.524,0.258],[-0.611,0.328],[-0.628,0.431],[-0.574,0.524],[-0.449,0.588],[-0.283,0.62],[-0.111,0.628],[0.003,0.65],[0.128,0.63],[0.312,0.618],[0.476,0.581],[0.592,0.512],[0.638,0.413],[0.611,0.316],[0.515,0.251],[0.49,0.242],[0.486,0.087],[0.453,-0.027],[0.478,-0.032],[0.639,-0.023],[0.777,-0.04],[0.877,-0.117],[0.931,-0.242],[0.925,-0.375],[0.857,-0.496],[0.741,-0.582]], svgScale: 1.02, strokeF: 0.18, maxStretch: 1.45, homeW: 2.3, nbrW: 0.4, k: 0.07, damping: 0.8, rate: 2, gloss: 0.6, baseAlpha: 0.92, stretchAlpha: 0.5 },
        // ── 물성·이펙트 다양화 라인업: 질감/탄력/터치반응이 전부 다름 ──
        { id: 40, name: "탁! 크렘브륄레", grade: "R", color: "#f2e3ae", waxColor: "#a86a24", type: "crack_wax", waxHits: 1, breakScore: 6, chipScale: 1.45, waxTough: 1.2, k: 0.035, damping: 0.82, rate: 2, gloss: 0.75, baseAlpha: 1, stretchAlpha: 0.85 },
        { id: 41, name: "콜라 톡톡젤리", grade: "C", color: "#5a3722", type: "normal", fizz: true, k: 0.05, damping: 0.8, rate: 3, gloss: 0.8, baseAlpha: 0.72, stretchAlpha: 0.3 },
        { id: 42, name: "몽글 비눗방울 구슬", grade: "E", color: "#cfe6f4", type: "normal", fizz: true, bubbleBig: true, k: 0.02, damping: 0.88, maxStretch: 1.55, rate: 2, gloss: 0.95, baseAlpha: 0.5, stretchAlpha: 0.12 },
        { id: 43, name: "무지개 요정가루 젤리", grade: "E", color: "#e9dcff", type: "normal", sparkle: true, sparkleRainbow: true, k: 0.055, damping: 0.8, rate: 2, gloss: 0.7, baseAlpha: 0.9, stretchAlpha: 0.5 },
        { id: 44, name: "수은 홀로 메탈", grade: "E", color: "#c3cbd8", type: "normal", sparkle: true, sparkleHolo: true, rim: "#6f7a8a", rimW: 0.16, plastic: 0.03, k: 0.03, damping: 0.9, minStretch: 0.6, maxStretch: 1.35, rate: 1, gloss: 1, baseAlpha: 1, stretchAlpha: 0.9 },
        { id: 45, name: "별사탕 컨페티 팝", grade: "R", color: "#fff3f6", type: "crunch", customBeads: [{ col: "#ffd54a", shape: "star" }, { col: "#ff8fab", shape: "heart" }, { col: "#8ecff2" }], popColor: "255,213,74", bumpy: 0.08, k: 0.1, damping: 0.76, rate: 2, gloss: 0.4, baseAlpha: 1, stretchAlpha: 0.85 },
        { id: 46, name: "타피오카 밀크티", grade: "R", color: "#e8d3b8", type: "normal", customBeads: [{ col: "#3b2a20", rMul: 1.5 }, { col: "#4a362a", rMul: 1.25 }], k: 0.045, damping: 0.84, rate: 2, gloss: 0.5, baseAlpha: 0.88, stretchAlpha: 0.6 },
        { id: 47, name: "스마일 찹쌀떡", grade: "C", color: "#f5ede3", type: "squishy", faceTopping: true, k: 0.02, damping: 0.52, rate: 3, gloss: 0.12, baseAlpha: 1, stretchAlpha: 0.92 },
        { id: 48, name: "쭈-욱 끈끈이 몬스터", grade: "R", color: "#6fd44e", type: "normal", k: 0.012, damping: 0.72, homeW: 0.9, nbrW: 0.3, maxStretch: 1.95, rate: 2, gloss: 0.6, baseAlpha: 0.92, stretchAlpha: 0.25 },
        { id: 49, name: "프리즘 보석 젤리", grade: "E", color: "#7fd8e8", type: "normal", nodeCount: 7, fineGoo: true, strokeF: 0.22, k: 0.09, damping: 0.78, rate: 1, gloss: 1, baseAlpha: 0.68, stretchAlpha: 0.2 },
    ];

    const gradeOrder = { "L": 0, "E": 1, "R": 2, "C": 3 };

    /* =================================================================
       재료 DB — 슬라임 꾸미기(커스텀)용 소모재
       cat: bead(비즈 1세트=구슬5개) / effect(터치 이펙트) / glitter / wax / topping
       w: 뽑기 보너스 가중치
    ================================================================= */
    const matDB = [
        // 비즈 — 단색 구슬 5개/세트 (색 + 모양 다양화)
        { id: "b_pink",   cat: "bead", name: "핑크 비즈",    color: "#ff9ec3", price: 20, w: 4 },
        { id: "b_blue",   cat: "bead", name: "블루 비즈",    color: "#7ec3f7", price: 20, w: 4 },
        { id: "b_yellow", cat: "bead", name: "옐로 비즈",    color: "#ffd95e", price: 20, w: 4 },
        { id: "b_white",  cat: "bead", name: "화이트 비즈",  color: "#ffffff", price: 20, w: 4 },
        { id: "b_mint",   cat: "bead", name: "민트 비즈",    color: "#7be3c3", price: 20, w: 3 },
        { id: "b_purple", cat: "bead", name: "퍼플 비즈",    color: "#c39bf5", price: 20, w: 3 },
        { id: "b_black",  cat: "bead", name: "블랙 캐비어 비즈", color: "#2c2c34", beadR: 0.6, price: 25, w: 2 },
        { id: "b_star",   cat: "bead", name: "골드 별 비즈",  color: "#ffd54a", beadShape: "star", price: 35, w: 2 },
        { id: "b_heart",  cat: "bead", name: "하트 비즈",    color: "#ff6b8a", beadShape: "heart", price: 35, w: 2 },
        { id: "b_pearl",  cat: "bead", name: "진주 비즈",    color: "#f4f0ff", pearl: true, beadR: 1.15, price: 40, w: 1 },
        // 이펙트 — 터치 반응
        { id: "fx_fizz",  cat: "effect", name: "탄산 기포",  fx: "fizz", price: 40, w: 2 },
        { id: "fx_dust",  cat: "effect", name: "밀가루 먼지", fx: "dust", pop: "246,241,232", price: 40, w: 2 },
        { id: "fx_snow",  cat: "effect", name: "눈꽃 먼지",  fx: "dust", pop: "255,255,255", price: 45, w: 2 },
        { id: "fx_bubble",cat: "effect", name: "비눗방울",   fx: "fizz", bubbleBig: true, price: 50, w: 1 },
        // 글리터 — 지속 반짝임
        { id: "g_silver", cat: "glitter", name: "실버 글리터",  color: "#ffffff", price: 50, w: 2 },
        { id: "g_gold",   cat: "glitter", name: "골드 글리터",  color: "#ffd54a", price: 50, w: 2 },
        { id: "g_pink",   cat: "glitter", name: "핑크 글리터",  color: "#ff9ec3", price: 50, w: 2 },
        { id: "g_blue",   cat: "glitter", name: "사파이어 글리터", color: "#6db3ff", price: 50, w: 2 },
        { id: "g_rainbow",cat: "glitter", name: "무지개 글리터", rainbow: true, price: 65, w: 1 },
        { id: "g_holo",   cat: "glitter", name: "홀로그램 글리터", holo: true, price: 70, w: 1 },
        // 왁스 — 겉껍질
        { id: "w_thin",   cat: "wax", name: "얇은 왁스",     color: "#ffe3ec", waxHits: 1, price: 45, w: 2 },
        { id: "w_thick",  cat: "wax", name: "두꺼운 왁스",   color: "#e8c04a", waxHits: 3, price: 55, w: 2 },
        { id: "w_choco",  cat: "wax", name: "초코 왁스",     color: "#6b4a2f", waxHits: 3, price: 55, w: 2 },
        { id: "w_ice",    cat: "wax", name: "얼음 왁스",     color: "#d9f1fc", waxHits: 1, waxScore: 6, chipScale: 0.7, price: 60, w: 1 },
        { id: "w_candy",  cat: "wax", name: "딸기 사탕 왁스", color: "#ff9ec3", waxHits: 2, price: 50, w: 2 },
        { id: "w_glitwax",cat: "wax", name: "반짝이 왁스",   color: "#ffd54a", waxHits: 2, waxSparkle: true, price: 70, w: 1 },
        // 토핑 — 장식
        { id: "t_face",   cat: "topping", name: "얼굴 스티커",  top: "face", price: 35, w: 2 },
        { id: "t_apple",  cat: "topping", name: "사과 꼭지",    top: "apple", price: 35, w: 2 },
        { id: "t_horn_removed", cat: "topping", name: "(삭제됨)", top: "none", price: 999999, w: 0, hidden: true }
    ];
    const CAT_LABEL = { bead: "비즈", effect: "이펙트", glitter: "글리터", wax: "왁스", topping: "토핑" };
    // 재료별 미리보기 아이콘 (SVG 대신 이모지)
    function matIcon(m) {
        if (m.cat === "bead") {
            if (m.beadShape === "star") return "⭐";
            if (m.beadShape === "heart") return "🩷";
            if (m.pearl) return "🤍";
            if (m.id === "b_black") return "⚫";
            return "🔵";
        }
        if (m.cat === "effect") {
            if (m.fx === "fizz") return m.bubbleBig ? "🫧" : "💨";
            return "❄️";
        }
        if (m.cat === "glitter") {
            if (m.rainbow) return "🌈";
            if (m.holo) return "✨";
            return "💫";
        }
        if (m.cat === "wax") {
            if (m.id === "w_choco") return "🍫";
            if (m.id === "w_ice") return "🧊";
            if (m.id === "w_candy") return "🍬";
            if (m.waxSparkle) return "🌟";
            return "🕯️";
        }
        if (m.cat === "topping") {
            if (m.top === "face") return "😊";
            if (m.top === "apple") return "🍎";
        }
        return "🎁";
    }
