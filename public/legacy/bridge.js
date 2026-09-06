// A small boundary around the original game. The catalog and economy stay shared.
let studioPreview = false;
let ownedSelection = currentSlime;
window.Malang = {
    catalog: slimeDB,
    getState: () => ({ spec: getSpec(), slime: currentSlime, nodes, core, width, height,
        radius: getRadius(), waxIntact, waxChips, waxShards, currentWaxLayer,
        cottonPuffs, foamBeads, fizzBubbles, sparkles, jellyFeet, jellyCloud, jellyFace,
        auroraHue, auroraSat, mysteryColor, galaxyStars, jellyHue, jellySat, jellyLit,
        crunchParticles, decorShards, bgColor, stretchSmooth, preview: studioPreview }),
    select(id) {
        this.cancelPointers();
        const owned = mySlimes.find(s => s.id === id);
        if (!studioPreview) ownedSelection = currentSlime;
        studioPreview = !owned;
        currentSlime = owned || { id, customName: slimeDB.find(s => s.id === id).name, level: 1 };
        if (owned) ownedSelection = owned;
        initSlime(); updateInventoryUI();
        if (owned) saveGame();
    },
    leavePreview() {
        if (!studioPreview) return;
        studioPreview = false;
        currentSlime = mySlimes.includes(ownedSelection) ? ownedSelection : mySlimes[0];
        initSlime(); updateInventoryUI();
    },
    cancelPointers() {
        Object.keys(touchStarts).forEach(id => {
            nodes.forEach(n => { if (String(n.touchId) === id) n.touchId = null; });
            if (String(core.touchId) === id) core.touchId = null;
            delete touchStarts[id]; delete touchGestures[id];
        });
        activePushes = [];
    },
    start(id, x, y) {
        const n = getNearestNode(x, y);
        const offset = n ? { x: n.x - x, y: n.y - y } : { x: 0, y: 0 };
        handleStart(id, x, y);
        if (n) { n.x += offset.x; n.y += offset.y; }
        return offset;
    },
    move: handleMove, end: handleEnd,
    jiggle: jiggleSlime, reset: respawnSlime,
    audio: initAudio, crack: playCrackSound,
    background(x, y) { lastTouchPt = { x, y, t: performance.now() }; },
    setBackground(color) { bgColor = color; localStorage.setItem('malang3d_bg_color', color); applyBgColor(); },
    breakWax: breakWaxAll,
    showToast,
    toggleSound(muted) {
        window.malangMuted = muted;
        if (audioCtx) { if (muted) audioCtx.suspend(); else audioCtx.resume(); }
    },
    exportSave: () => JSON.stringify(saveData, null, 2)
};
