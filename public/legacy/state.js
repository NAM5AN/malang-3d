let saveData = {
        mySlimes: [{ id: 1, customName: "물젤리 슬랑이", level: 1 }],
        currentSlimeId: 1,
        mileage: 0,
        unlockedIds: [1]
    };

    if(localStorage.getItem("malang3d_save")) {
        try {
            saveData = JSON.parse(localStorage.getItem("malang3d_save"));
        } catch(e) { console.error(e); }
    }

    let mySlimes = saveData.mySlimes;
    let materials = saveData.materials || {}; // 재료 보유량 { matId: 개수 }
    let seenMats = saveData.seenMats || Object.keys(materials); // 획득 이력 있는 재료 id
    let currentSlime = (typeof saveData.currentSlimeId === "string" && saveData.currentSlimeId.indexOf("c:") === 0)
        ? (mySlimes.find(s => s.uid === saveData.currentSlimeId.slice(2)) || mySlimes[0])
        : (mySlimes.find(s => s.id === saveData.currentSlimeId) || mySlimes[0]);
    let mileage = saveData.mileage;
    let unlockedIds = saveData.unlockedIds || [1];

    function saveGame() {
        saveData.mySlimes = mySlimes;
        saveData.materials = materials;
        saveData.seenMats = seenMats;
        if (mySlimes.includes(currentSlime)) {
            saveData.currentSlimeId = currentSlime.id === "custom" ? "c:" + currentSlime.uid : currentSlime.id;
        }
        saveData.mileage = mileage;
        saveData.unlockedIds = unlockedIds;
        localStorage.setItem("malang3d_save", JSON.stringify(saveData));
    }

    let invTab = "slime";
    function setInvTab(t) { invTab = t; updateInventoryUI(); }

    function updateInventoryUI() {
        mySlimes.sort((a, b) => {
            const ga = a.id === "custom" ? -1 : gradeOrder[slimeDB.find(x => x.id === a.id).grade];
            const gb = b.id === "custom" ? -1 : gradeOrder[slimeDB.find(x => x.id === b.id).grade];
            return ga - gb;
        });

        document.getElementById("tabSlime").style.background = invTab === "slime" ? "#4caf50" : "#777";
        document.getElementById("tabMat").style.background = invTab === "mat" ? "#4caf50" : "#777";
        const list = document.getElementById("slimeList");
        const matList = document.getElementById("matList");
        list.style.display = invTab === "slime" ? "block" : "none";
        matList.style.display = invTab === "mat" ? "block" : "none";

        list.innerHTML = "";
        mySlimes.forEach(s => {
            const isCust = s.id === "custom";
            const spec = isCust ? null : slimeDB.find(x => x.id === s.id);
            const div = document.createElement("div");
            const active = (s === currentSlime);
            div.className = `slime-item ${active ? "active" : ""}`;
            const label = isCust
                ? `<span class="item-name" style="color:#0097a7; font-weight:bold;">★ ${s.customName || "나만의 슬라임"}</span>`
                : `<span class="item-name grade-${spec.grade}">[${spec.grade}] ${s.customName || spec.name}</span>`;
            const renameCall = isCust ? `renameCustomSlime('${s.uid}', event)` : `renameSlime(${s.id}, event)`;
            const delBtn = isCust ? `<button class="rename-btn" onclick="dismantleCustomSlime('${s.uid}', event)" title="분해">♻️</button>` : "";
            div.innerHTML = `
                ${label}
                <div class="item-right">
                    <span class="lv-badge">Lv.${s.level}</span>
                    <button class="rename-btn" onclick="${renameCall}">📝</button>
                    ${delBtn}
                </div>
            `;
            div.onclick = () => {
                currentSlime = s;
                initSlime();
                updateInventoryUI();
                saveGame();
            };
            list.appendChild(div);
        });

        // 재료 탭
        matList.innerHTML = "";
        let any = false;
        matDB.forEach(m => {
            if (m.hidden) return;
            const cnt = materials[m.id] || 0;
            if (cnt <= 0) return;
            any = true;
            const div = document.createElement("div");
            div.className = "slime-item";
            div.innerHTML = `<span class="item-name"><span style="font-size:16px;">${matIcon(m)}</span> <b style="color:#0097a7;">[${CAT_LABEL[m.cat]}]</b> ${m.name}</span><span class="lv-badge">×${cnt}</span>`;
            div.style.cursor = "default";
            matList.appendChild(div);
        });
        if (!any) matList.innerHTML = `<div style="color:#999; font-size:12px; text-align:center; padding:10px;">재료가 없어요.<br>뽑기 보너스나 상점에서 얻을 수 있어요!</div>`;

        document.getElementById("mileageText").innerText = mileage;
    }

    /* =================================================================
       슬라임 꾸미기 — 베이스(보유 슬라임에서 레벨 차출) + 재료(소모)
    ================================================================= */
    let custSel = { base: null, useLv: 1, mats: {} };

    function openCustomize() {
        custSel = { base: null, useLv: 1, mats: {} };
        document.getElementById("customModal").style.display = "flex";
        renderCustomize();
    }
    function closeCustomize() { document.getElementById("customModal").style.display = "none"; }

    function renderCustomize() {
        const baseList = document.getElementById("custBaseList");
        baseList.innerHTML = "";
        const bases = mySlimes.filter(s => s.id !== "custom")
            .sort((a, b) => gradeOrder[slimeDB.find(x => x.id === a.id).grade] - gradeOrder[slimeDB.find(x => x.id === b.id).grade]);
        if (!bases.length) baseList.innerHTML = `<span style="font-size:12px; color:#999;">베이스로 쓸 슬라임이 없어요</span>`;
        bases.forEach(s => {
            const spec = slimeDB.find(x => x.id === s.id);
            const row = document.createElement("div");
            const sel = custSel.base === s;
            row.className = `slime-item ${sel ? "sel-cust" : ""}`;
            row.innerHTML = `<span class="item-name grade-${spec.grade}">[${spec.grade}] ${s.customName || spec.name}</span><span class="lv-badge">Lv.${s.level}</span>`;
            row.onclick = () => { custSel.base = s; custSel.useLv = 1; renderCustomize(); };
            baseList.appendChild(row);
        });

        const lvRow = document.getElementById("custLvRow");
        if (custSel.base) {
            lvRow.style.display = "block";
            document.getElementById("custLvText").innerText = custSel.useLv;
            document.getElementById("custLvMax").innerText = `/ ${custSel.base.level}`;
        } else lvRow.style.display = "none";

        const matWrap = document.getElementById("custMatList");
        matWrap.innerHTML = "";
        let any = false;
        matDB.forEach(m => {
            if (m.hidden) return;
            const own = materials[m.id] || 0;
            if (own <= 0) return;
            any = true;
            const sel = custSel.mats[m.id] || 0;
            const row = document.createElement("div");
            row.className = "slime-item";
            row.style.cursor = "default";
            row.innerHTML = `<span class="item-name"><span style="font-size:16px;">${matIcon(m)}</span> <b style="color:#0097a7;">[${CAT_LABEL[m.cat]}]</b> ${m.name} <span style="color:#aaa;">×${own}</span></span>
                <span class="item-right">
                    <button class="rename-btn" style="width:26px; font-weight:bold;" onclick="custMat('${m.id}', -1)">−</button>
                    <b style="min-width:16px; text-align:center; color:${sel > 0 ? "#e91e63" : "#ccc"};">${sel}</b>
                    <button class="rename-btn" style="width:26px; font-weight:bold; background:#ffd9e6;" onclick="custMat('${m.id}', 1)">＋</button>
                </span>`;
            matWrap.appendChild(row);
        });
        if (!any) matWrap.innerHTML = `<div style="color:#999; font-size:12px; padding:8px;">보유 재료가 없어요</div>`;
    }

    function custLv(d) {
        if (!custSel.base) return;
        custSel.useLv = Math.max(1, Math.min(custSel.base.level, custSel.useLv + d));
        renderCustomize();
    }
    function custMat(id, d) {
        const own = materials[id] || 0;
        custSel.mats[id] = Math.max(0, Math.min(own, (custSel.mats[id] || 0) + d));
        if (custSel.mats[id] === 0) delete custSel.mats[id];
        renderCustomize();
    }

    let previewSlime = null;      // 미리보기용 임시 커스텀 슬라임
    let previewReturn = null;      // 미리보기 전에 보던 슬라임 (취소 시 복귀)

    function createCustomSlime() {
        const b = custSel.base;
        if (!b) { showToast("베이스 슬라임을 먼저 선택하세요!"); return; }
        const matArr = [];
        Object.entries(custSel.mats).forEach(([id, n]) => { for (let q = 0; q < n; q++) matArr.push(id); });
        if (!matArr.length) { showToast("재료를 1개 이상 넣어주세요!"); return; }

        // 아직 차감하지 않고 미리보기만 렌더 (임시 uid)
        previewSlime = {
            id: "custom",
            uid: "preview" + Date.now().toString(36),
            baseId: b.id,
            mats: matArr,
            level: custSel.useLv,
            customName: "나만의 " + slimeDB.find(x => x.id === b.id).name
        };
        previewReturn = currentSlime;
        currentSlime = previewSlime;
        initSlime();
        document.getElementById("customModal").style.display = "none";
        // 미리보기 중엔 플로팅 메뉴 강제로 닫기
        fabOpen = false;
        document.getElementById("fab-wrap").classList.remove("open");
        document.getElementById("previewModal").style.display = "flex";
    }

    // 미리보기 취소 → 재료 그대로, 꾸미기 창으로 복귀
    function cancelPreview() {
        currentSlime = previewReturn;
        initSlime();
        previewSlime = null;
        document.getElementById("previewModal").style.display = "none";
        document.getElementById("customModal").style.display = "flex";
        renderCustomize();
    }

    // 미리보기 확정 → 이제 실제 차감 + 인벤토리 등록
    function confirmCustomSlime() {
        const b = custSel.base;
        const use = custSel.useLv;
        b.level -= use;
        Object.entries(custSel.mats).forEach(([id, n]) => {
            materials[id] -= n;
            if (materials[id] <= 0) delete materials[id];
        });
        const cs = Object.assign({}, previewSlime, { uid: "u" + Date.now().toString(36) + Math.floor(Math.random() * 999) });
        if (b.level <= 0) mySlimes.splice(mySlimes.indexOf(b), 1);
        mySlimes.push(cs);
        currentSlime = cs;
        initSlime();
        previewSlime = null;
        document.getElementById("previewModal").style.display = "none";
        showToast("✨ 커스텀 슬라임 완성!");
        updateInventoryUI();
        saveGame();
    }

    function renameCustomSlime(uid, e) {
        e.stopPropagation();
        const s = mySlimes.find(x => x.uid === uid);
        if (!s) return;
        openRenameModal(s.customName || "나만의 슬라임", { kind: "custom", ref: s });
    }

    // 커스텀 슬라임 가치 = 베이스 SHOP가 + 넣은 재료 가격 합
    function customSlimeValue(s) {
        const base = slimeDB.find(x => x.id === s.baseId);
        let val = base ? (SHOP_PRICES[base.grade] || 0) : 0;
        (s.mats || []).forEach(mid => {
            const m = matDB.find(x => x.id === mid);
            if (m && m.price) val += m.price;
        });
        return val;
    }

    function dismantleCustomSlime(uid, e) {
        e.stopPropagation();
        const s = mySlimes.find(x => x.uid === uid);
        if (!s) return;
        const value = customSlimeValue(s);
        const rate = 0.3 + Math.random() * 0.5; // 30~80% 랜덤
        const refund = Math.round(value * rate);
        openConfirmModal(
            "♻️ 슬라임 분해",
            `'${s.customName || "나만의 슬라임"}'을(를) 분해할까요?\n마일리지 약 ${Math.round(value*0.3)}~${Math.round(value*0.8)}를 돌려받아요.\n(넣은 재료와 레벨은 사라져요)`,
            "분해",
            () => {
                const wasCurrent = (currentSlime === s);
                mySlimes.splice(mySlimes.indexOf(s), 1);
                if (!mySlimes.length) mySlimes.push({ id: 1, customName: null, level: 1 });
                if (wasCurrent) { currentSlime = mySlimes[0]; initSlime(); }
                mileage += refund;
                updateInventoryUI();
                saveGame();
                showToast(`♻️ 분해 완료! 마일리지 +${refund} 획득`);
            }
        );
    }

    function renameSlime(id, e) {
        e.stopPropagation();
        const s = mySlimes.find(x => x.id === id);
        if (!s) return;
        const spec = slimeDB.find(x => x.id === id);
        openRenameModal(s.customName || spec.name, { kind: "slime", ref: s });
    }

    let isInvCollapsed = true;
    function toggleInventory() {
        isInvCollapsed = !isInvCollapsed;
        const container = document.getElementById("inventory-container");
        const btn = document.getElementById("toggleInvBtn");
        if(isInvCollapsed) {
            container.classList.add("collapsed");
            btn.innerText = "🎒"; 
        } else {
            container.classList.remove("collapsed");
            btn.innerText = "🎒 가방 접기";
        }
    }

    /* =================================================================
       2. 도감 시스템 구현
    ================================================================= */
    // 슬라임 미리보기 실루엣 SVG (fill=색 또는 실루엣). 노드 좌표 없이 근사 외곽 사용
    function slimeThumb(spec, fill) {
        let d;
        if (spec.shapePts) {
            d = "M" + spec.shapePts.map(p => `${(50 + p[0] * 34).toFixed(1)},${(50 + p[1] * 34).toFixed(1)}`).join(" L") + " Z";
        } else if (spec.shape === "heart") {
            d = "M50,30 A14,14 0 0 1 78,44 Q78,62 50,80 Q22,62 22,44 A14,14 0 0 1 50,30 Z";
        } else if (spec.jelly) {
            d = "M20,45 Q20,20 50,20 Q80,20 80,45 Q80,62 70,68 L68,74 L62,68 L56,74 L50,68 L44,74 L38,68 L32,74 L30,68 Q20,62 20,45 Z";
        } else {
            d = "M50,18 C74,18 84,34 84,52 C84,72 68,84 50,84 C32,84 16,72 16,52 C16,34 26,18 50,18 Z";
        }
        return `<svg viewBox="0 0 100 100" width="46" height="46"><path d="${d}" fill="${fill}"/></svg>`;
    }
    const typeLabel = spec => spec.type === 'squishy' ? '스퀴시형' : spec.type === 'cotton' ? '솜뭉치형' : spec.type === 'crunch' ? '크런치형' : spec.type.includes('wax') ? '왁뿌형' : spec.jelly ? '해파리형' : (spec.svgPath || spec.shapePts) ? '커스텀형' : spec.shape === 'heart' ? '하트형' : '일반형';

    let bookTab = "slime";
    function setBookTab(t) { bookTab = t; openBook(); }

    function openBook() {
        document.getElementById("bookModal").style.display = "flex";
        document.getElementById("bookTabSlime").style.background = bookTab === "slime" ? "#9c27b0" : "#777";
        document.getElementById("bookTabMat").style.background = bookTab === "mat" ? "#9c27b0" : "#777";
        const grid = document.getElementById("bookGrid");
        grid.innerHTML = "";

        if (bookTab === "mat") {
            const mats = matDB.filter(m => !m.hidden);
            let seen = 0;
            mats.forEach(m => {
                const owned = (materials[m.id] || 0) > 0;
                const everSeen = seenMats.includes(m.id) || owned;
                if (everSeen) seen++;
                const item = document.createElement("div");
                item.className = `book-item ${everSeen ? "unlocked" : "locked"}`;
                if (everSeen) {
                    item.innerHTML = `<div style="font-size:26px; line-height:1.1;">${matIcon(m)}</div>`
                        + `<span style="font-size:9px;color:#7ce7ff;">[${CAT_LABEL[m.cat]}]</span><br><b style="font-size:11px;">${m.name}</b>`
                        + `<br><span style="font-size:9px;color:${owned ? "#8f8" : "#999"};">${owned ? "×" + materials[m.id] : "미보유"}</span>`;
                } else {
                    item.innerHTML = `<div style="font-size:26px; line-height:1.1; filter:grayscale(1) brightness(0.4);">${matIcon(m)}</div><span style="color:#777;font-size:10px;">???</span>`;
                }
                grid.appendChild(item);
            });
            document.getElementById("bookProgress").innerText = `재료 수집률: ${Math.round(seen / mats.length * 100)}% (${seen}/${mats.length})`;
            return;
        }

        let unlockCount = 0;
        const sortedDB = [...slimeDB].sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade] || a.id - b.id);
        sortedDB.forEach(spec => {
            const isUnlocked = unlockedIds.includes(spec.id);       // 획득 이력
            const ownNow = mySlimes.some(s => s.id === spec.id);   // 현재 보유
            const item = document.createElement("div");
            item.className = `book-item ${isUnlocked ? "unlocked" : "locked"}`;
            if (isUnlocked) {
                unlockCount++;
                item.innerHTML = `<span class="grade-${spec.grade}">[${spec.grade}]</span><br><b>${spec.name}</b>`
                    + `<br><span style="font-size:10px; color:#eee;">${typeLabel(spec)}</span>`
                    + (ownNow ? "" : `<br><span style="font-size:9px; color:#e6a;">보유 없음</span>`);
                if (!ownNow) item.style.opacity = "0.72";
            } else {
                item.innerHTML = `❓<br><span style="color:#777;">미획득</span>`;
            }
            grid.appendChild(item);
        });
        const progress = Math.round((unlockCount / slimeDB.length) * 100);
        document.getElementById("bookProgress").innerText = `수집률: ${progress}% (${unlockCount}/${slimeDB.length})`;
    }
    function closeBook() { document.getElementById("bookModal").style.display = "none"; }

    /* =================================================================
       2.5 상점 시스템 — 마일리지로 원하는 말랑이 구매
    ================================================================= */
    const SHOP_PRICES = { C: 40, R: 120, E: 280, L: 600 };

    // 커스텀 이름변경 모달
    let renameTarget = null; // { kind: 'slime'|'custom', ref }
    function openRenameModal(current, target) {
        renameTarget = target;
        document.getElementById("renameInput").value = current || "";
        document.getElementById("renameModal").style.display = "flex";
        setTimeout(() => document.getElementById("renameInput").focus(), 50);
    }
    function closeRenameModal() { document.getElementById("renameModal").style.display = "none"; renameTarget = null; }
    function applyRename() {
        const v = document.getElementById("renameInput").value.trim();
        if (v.length > 0 && renameTarget) {
            renameTarget.ref.customName = v;
            updateInventoryUI();
            saveGame();
        }
        closeRenameModal();
    }

    // 커스텀 확인 모달 (콜백 방식)
    let confirmCb = null;
    function openConfirmModal(title, msg, okLabel, cb) {
        document.getElementById("confirmTitle").innerText = title;
        document.getElementById("confirmMsg").innerText = msg;
        document.getElementById("confirmOkBtn").innerText = okLabel || "확인";
        confirmCb = cb;
        document.getElementById("confirmModal").style.display = "flex";
    }
    function closeConfirmModal(ok) {
        document.getElementById("confirmModal").style.display = "none";
        const cb = confirmCb; confirmCb = null;
        if (ok && cb) cb();
    }

    let toastTimer = null;
    function showToast(msg) {
        const t = document.getElementById("toast");
        t.innerText = msg;
        t.style.display = "block";
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.style.display = "none"; }, 1800);
    }

    function openShop() {
        document.getElementById("shopModal").style.display = "flex";
        renderShop();
    }
    function closeShop() { document.getElementById("shopModal").style.display = "none"; }

    let shopTab = "slime";
    function setShopTab(t) { shopTab = t; renderShop(); }

    function renderShop() {
        document.getElementById("shopMileage").innerText = `✨ 보유 마일리지: ${mileage}`;
        document.getElementById("shopTabSlime").style.background = shopTab === "slime" ? "#ff9800" : "#777";
        document.getElementById("shopTabMat").style.background = shopTab === "mat" ? "#ff9800" : "#777";
        const grid = document.getElementById("shopGrid");
        grid.innerHTML = "";

        if (shopTab === "mat") {
            matDB.forEach(m => {
                if (m.hidden) return;
                const own = materials[m.id] || 0;
                const afford = mileage >= m.price;
                const item = document.createElement("div");
                item.className = "book-item unlocked";
                item.style.border = own > 0 ? "2px solid #ffeb3b" : "2px solid transparent";
                item.innerHTML = `<div style="font-size:24px;">${matIcon(m)}</div><span style="color:#7ce7ff;">[${CAT_LABEL[m.cat]}]</span><br><b>${m.name}</b><br>`
                    + `<span style="font-size:10px; color:#eee;">${own > 0 ? "×" + own + " 보유중" : "미보유"}</span><br>`
                    + `<button class="btn" style="padding:4px 12px; font-size:12px; margin-top:6px;${afford ? "" : " background:#777;"}" onclick="buyMaterial('${m.id}')">✨ ${m.price}</button>`;
                grid.appendChild(item);
            });
            return;
        }
        const sorted = [...slimeDB].sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade] || a.id - b.id);
        sorted.forEach(spec => {
            const price = SHOP_PRICES[spec.grade];
            const owned = mySlimes.find(s => s.id === spec.id);
            const afford = mileage >= price;
            const item = document.createElement("div");
            item.className = "book-item unlocked";
            item.style.border = owned ? "2px solid #ffeb3b" : "2px solid transparent";
            item.innerHTML = `<span class="grade-${spec.grade}">[${spec.grade}]</span><br><b>${spec.name}</b><br>`
                + `<span style="font-size:10px; color:#eee;">${owned ? 'Lv.' + owned.level + ' 보유중' : '미보유'}</span><br>`
                + `<button class="btn" style="padding:4px 12px; font-size:12px; margin-top:6px;${afford ? '' : ' background:#777;'}" onclick="buySlime(${spec.id})">✨ ${price}</button>`;
            grid.appendChild(item);
        });
    }

    function buyMaterial(id) {
        const m = matDB.find(x => x.id === id);
        if (mileage < m.price) { showToast(`마일리지가 부족해요! (필요: ✨${m.price})`); return; }
        mileage -= m.price;
        materials[id] = (materials[id] || 0) + 1;
        if (!seenMats.includes(id)) seenMats.push(id);
        showToast(`${m.name} 획득!`);
        updateInventoryUI();
        renderShop();
        saveGame();
    }

    function buySlime(id) {
        const spec = slimeDB.find(s => s.id === id);
        const price = SHOP_PRICES[spec.grade];
        if (mileage < price) { showToast(`마일리지가 부족해요! (필요: ✨${price})`); return; }
        mileage -= price;
        if (!unlockedIds.includes(id)) unlockedIds.push(id);
        const existing = mySlimes.find(s => s.id === id);
        if (existing) {
            existing.level++;
            showToast(`${existing.customName || spec.name} 레벨업! (Lv.${existing.level})`);
        } else {
            mySlimes.push({ id: id, customName: spec.name, level: 1 });
            showToast(`${spec.name} 획득!`);
        }
        updateInventoryUI();
        renderShop();
        saveGame();
    }

    /* =================================================================
       3. 가챠 스크립트
    ================================================================= */
    // 중복 획득 시 등급별 마일리지
    const MILEAGE_DUP = { C: 15, R: 25, E: 45, L: 120 };
    let gachaTimers = [];

    /* =================================================================
       광고 연동 (WebView + AdMob 보상형 광고)
       ----------------------------------------------------------------
       앱(WebView)에서는 안드로이드가 window.AndroidAd 인터페이스를 주입.
       - AndroidAd.showRewardedAd() 호출 → 광고 재생
       - 광고 시청 완료 시 안드로이드가 window.onAdReward() 콜백 호출
       - 광고 실패/닫힘 시 window.onAdFailed() 콜백 호출
       웹(브라우저)에서는 AndroidAd가 없으므로 광고 없이 바로 뽑기.
    ================================================================= */
    let pendingGachaReward = false;    // 광고 시청 대기 중 플래그

    // 안드로이드 → JS 콜백 (WebView에서 호출됨)
    window.onAdReward = function () {
        if (!pendingGachaReward) return;
        pendingGachaReward = false;
        doGacha();                     // 광고 다 봤으니 실제 뽑기 실행
    };
    window.onAdFailed = function () {
        pendingGachaReward = false;
        showToast("광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    };

    // 뽑기 진입점: 광고 게이트
    function startGacha() {
        // 앱(WebView)이면 광고를 먼저 재생, 완료 콜백에서 doGacha() 실행
        if (window.AndroidAd && typeof window.AndroidAd.showRewardedAd === "function") {
            pendingGachaReward = true;
            try {
                window.AndroidAd.showRewardedAd();
            } catch (err) {
                pendingGachaReward = false;
                showToast("광고 재생에 실패했어요.");
            }
            return;
        }
        // 웹 브라우저: 광고 없이 바로 뽑기 (개발/테스트용)
        doGacha();
    }

    // 실제 뽑기 로직 (광고 시청 완료 후 실행)
    function doGacha() {
        const card = document.getElementById("gachaCard");
        const box = document.getElementById("ad-box");
        document.getElementById("gachaModal").style.display = "flex";
        box.style.display = "block";
        const result = document.getElementById("gachaResult");
        result.innerText = ""; result.className = "";
        document.getElementById("gachaSubResult").innerText = "";
        document.getElementById("closeGachaBtn").style.display = "none";
        card.style.boxShadow = "none";
        gachaTimers.forEach(clearTimeout); gachaTimers = [];

        // 결과를 먼저 뽑고, 등급에 따라 연출 길이/강도를 달리함
        const rand = Math.random() * 100;
        let pulled = slimeDB[0], sum = 0;
        for (let s of slimeDB) { sum += s.rate; if (rand <= sum) { pulled = s; break; } }
        const high = pulled.grade === "E" || pulled.grade === "L";

        box.innerHTML = '<span class="gacha-box shake-slow">🎁</span><div class="gacha-caption">두근두근...</div>';
        gachaTimers.push(setTimeout(() => {
            box.innerHTML = '<span class="gacha-box shake-fast" style="font-size:68px;">🎁</span><div class="gacha-caption">두근두근...!</div>';
            playCrackSound(false);
        }, 700));
        if (high) {
            gachaTimers.push(setTimeout(() => {
                box.innerHTML = '<span class="gacha-box shake-fast" style="font-size:80px;">🎁</span><div class="gacha-caption" style="color:#ffeb3b; font-weight:bold;">✨ 심상치 않은 기운이...!! ✨</div>';
                card.style.boxShadow = pulled.grade === "L" ? "0 0 45px 10px rgba(255,215,64,0.8)" : "0 0 32px 6px rgba(255,64,129,0.6)";
                playCrackSound(true);
            }, 1500));
        }
        gachaTimers.push(setTimeout(() => {
            box.style.display = "none";
            revealGacha(pulled);
        }, high ? 2400 : 1400));
    }

    function revealGacha(pulled) {
        const result = document.getElementById("gachaResult");
        const subResult = document.getElementById("gachaSubResult");
        result.className = "result-pop";

        if (!unlockedIds.includes(pulled.id)) unlockedIds.push(pulled.id);

        const existing = mySlimes.find(s => s.id === pulled.id);
        if (existing) {
            existing.level++;
            const gain = MILEAGE_DUP[pulled.grade] || 15;
            mileage += gain;
            result.innerHTML = `<span class="grade-${pulled.grade}">[${pulled.grade}] ${existing.customName || pulled.name}</span><br>중복 획득!`;
            subResult.innerText = `레벨업! (Lv.${existing.level}) (마일리지 +${gain})`;
        } else {
            mySlimes.push({ id: pulled.id, customName: pulled.name, level: 1 });
            mileage += 20;
            result.innerHTML = `<span class="grade-${pulled.grade}">[${pulled.grade}] ${pulled.name}</span><br>신규 획득!`;
            subResult.innerText = `마일리지 +20 적립!`;
        }
        // 등급별 재료 지급: C=35% 확률 1개 / R=1개 / E=2개 / L=3개 확정
        const MAT_COUNT = { C: 0, R: 1, E: 2, L: 3 };
        let matGain = MAT_COUNT[pulled.grade] || 0;
        if (pulled.grade === "C" && Math.random() < 0.35) matGain = 1;
        if (matGain > 0) {
            const pool = [];
            matDB.forEach(m => { for (let q = 0; q < (m.w || 0); q++) pool.push(m); });
            const gained = [];
            for (let g = 0; g < matGain; g++) {
                const bm = pool[Math.floor(Math.random() * pool.length)];
                materials[bm.id] = (materials[bm.id] || 0) + 1;
                if (!seenMats.includes(bm.id)) seenMats.push(bm.id);
                gained.push(bm.name);
            }
            subResult.innerHTML += `<br>🎁 재료: ${gained.join(", ")}`;
        }

        document.getElementById("closeGachaBtn").style.display = "block";
        updateInventoryUI();
        saveGame();
    }
    function closeGacha() {
        gachaTimers.forEach(clearTimeout); gachaTimers = [];
        document.getElementById("gachaCard").style.boxShadow = "none";
        document.getElementById("gachaModal").style.display = "none";
    }

    /* =================================================================
       4. Audio Engine (청량하고 바삭한 타격감 극대화)
    ================================================================= */
    let audioCtx;
    function initAudio() {
        if (window.malangMuted) return;
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        loadCustomSounds();
    }

    // ====================================================================
    //  커스텀 효과음 시스템
    //  - SOUND_FILES에 파일 경로를 넣으면 그 음원을 재생, 비워두면 기존 합성음 사용.
    //  - 원하는 소리만 골라서 교체 가능 (예: crack_heavy만 mp3로).
    //  - 파일은 앱(WebView)의 assets 폴더 또는 웹 서버 경로에 두면 됨.
    //  예) squish: "sounds/squish.mp3"
    // ====================================================================
    const SOUND_FILES = {
        squish: "",           // 주무르기
        release: "",          // 손 뗄 때
        chop: "",             // 누를 때
        boing: "",            // 세게 튕길 때
        squishy_breath: "",   // 말랑이 숨소리
        crack_light: "",      // 왁스 금 가기
        crack_heavy: ""       // 왁스 깨지기
    };
    const soundBuffers = {};   // 디코딩된 오디오 캐시
    let soundsLoading = false;

    function loadCustomSounds() {
        if (soundsLoading || !audioCtx) return;
        soundsLoading = true;
        Object.entries(SOUND_FILES).forEach(([key, url]) => {
            if (!url || soundBuffers[key]) return;
            fetch(url)
                .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
                .then(buf => audioCtx.decodeAudioData(buf))
                .then(decoded => { soundBuffers[key] = decoded; })
                .catch(() => { /* 파일 없거나 실패 → 합성음 폴백 */ });
        });
    }

    // 커스텀 음원이 있으면 재생하고 true, 없으면 false(→합성음으로)
    function playCustomSound(key, volume = 1) {
        if (!audioCtx || !soundBuffers[key]) return false;
        const src = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        src.buffer = soundBuffers[key];
        gain.gain.value = volume;
        src.connect(gain); gain.connect(audioCtx.destination);
        src.start();
        return true;
    }

    function playSquishSound(type = 'squish') {
        if (window.malangMuted) return;
        if (!audioCtx) return;
        // 커스텀 음원이 등록돼 있으면 그걸 재생하고 종료
        if (playCustomSound(type)) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);

        if (type === 'squish') {
            osc.type = "sine";
            osc.frequency.setValueAtTime(200 + Math.random()*150, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'release') {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'chop') {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(650 + Math.random() * 250, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'boing') {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(170, now);
            osc.frequency.exponentialRampToValueAtTime(520, now + 0.05);
            osc.frequency.exponentialRampToValueAtTime(130, now + 0.16);
            gain.gain.setValueAtTime(0.32, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
            osc.start(now); osc.stop(now + 0.2);
        } else if (type === 'squishy_breath') {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(2500 + Math.random()*800, now);
            osc.frequency.linearRampToValueAtTime(300, now + 0.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        }
    }

    function playCrackSound(isHeavy = false) {
        if (window.malangMuted) return;
        if (!audioCtx) return;
        // 커스텀 음원 우선 (crack_heavy / crack_light)
        if (playCustomSound(isHeavy ? 'crack_heavy' : 'crack_light')) return;
        const count = isHeavy ? 8 : 4;
        for(let i=0; i<count; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            const now = audioCtx.currentTime + (i * 0.015);
            
            osc.type = "triangle";
            osc.frequency.setValueAtTime(3500 + Math.random()*2500, now);
            osc.frequency.exponentialRampToValueAtTime(500 + Math.random()*300, now + 0.03);
            
            gain.gain.setValueAtTime(isHeavy ? 0.45 : 0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            
            osc.start(now); osc.stop(now + 0.04);
        }
    }
