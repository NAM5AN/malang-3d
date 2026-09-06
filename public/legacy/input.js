function handleStart(id, x, y) {
        initAudio();
        initMotion();
        if (!platformApplied) { platformApplied = true; applyPlatformUI(); }
        touchGestures[id] = ++gestureSeq;
        touchStarts[id] = { x: x, y: y, t: performance.now() };
        lastTouchPt = { x: x, y: y, t: performance.now() };
        const spec = getSpec();

        const n = getNearestNode(x, y);
        if (n) {
            // 바람 빠지는 소리는 말랑이를 실제로 눌렀을 때만 (배경 터치 시 무음)
            if (spec.type === "squishy") playSquishSound('squishy_breath');
            n.touchId = id;
            n.x = x; n.y = y;
        } else {
            activePushes.push({ id: id, x: x, y: y });
        }
        // 왁뿌볼: 누른 좌표에 데미지 1회 — 빈 자리면 금, 금 간 조각이면 낙하
        if (waxIntact) damageWax(x, y, touchGestures[id]);
    }

    function handleMove(id, x, y) {
        if (touchStarts[id]) { touchStarts[id].lx = x; touchStarts[id].ly = y; }
        lastTouchPt = { x: x, y: y, t: performance.now() };
        const spec = getSpec();
        const n = nodes.find(pt => pt.touchId === id) || (core.touchId === id ? core : null);
        
        if (n) {
            const vel = Math.hypot(x - n.x, y - n.y);
            if (vel > 1) {
                if (spec.dust && Math.random() < 0.5) {
                    // 밀가루: 옅고 큰 먼지가 풀풀 피어오름
                    if (Math.random() < 0.15) playSquishSound('squish');
                    crunchParticles.push({
                        x: x + (Math.random()-0.5)*20, y: y + (Math.random()-0.5)*20,
                        vx: (Math.random()-0.5)*1.4, vy: -0.3 - Math.random()*0.9,
                        size: 9 + Math.random()*9, alpha: 0.22 + Math.random()*0.1,
                        dust: true, grow: 0.18 + Math.random()*0.12,
                        rgb: spec.popColor || "246,241,232"
                    });
                } else if (spec.type === "crunch" && Math.random() < 0.4) {
                    playCrackSound(false);
                    for (let b = 0; b < 2; b++) {
                        crunchParticles.push({
                            x: x, y: y,
                            vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6,
                            size: 3 + Math.random()*4, alpha: 1,
                            rgb: Math.random() < 0.5 ? "255,255,255" : (spec.popColor || "255,182,193")
                        });
                    }
                } else if (spec.type !== "squishy" && !spec.type.includes("wax")) {
                    if(Math.random() < 0.15) playSquishSound('squish');
                }
            }
            // 아이스볼: 문지른 자리에서 기포가 보글 / 오브: 문지른 자리에 글리터가 박힘
            if (spec.fizz && vel > 1 && Math.random() < 0.85) spawnFizz(x, y, Math.random() < 0.4 ? 2 : 1);
            if (spec.sparkle && vel > 1 && Math.random() < 0.55) spawnSparkle(x, y, 1);

            // 오로라: 만지는 동안에만 색이 흘러가고, 놓으면 그 색에서 멈춤
            if (spec.aurora && vel > 1) {
                auroraHue = (auroraHue + Math.min(vel, 20) * 0.25) % 360;
                auroraSat = Math.min(80, auroraSat + Math.min(vel, 20) * 0.1);
            }

            // 해파리 젤리: 주물거릴수록 서서히 탁해짐 + 발/눈/입이 손끝에 밀림
            if (spec.jelly && vel > 1) {
                jellyCloud = Math.min(1, jellyCloud + 0.0009 * Math.min(vel, 18));

                const rj = getRadius();
                // 발: 손끝이 스치면 몸통선을 따라 밀림
                jellyFeet.forEach(F => {
                    if (F.px === undefined) return;
                    if (Math.hypot(F.px - x, F.py - y) < rj * 0.42) {
                        const fingerAng = Math.atan2(y - core.y, x - core.x);
                        const footAng = Math.atan2(F.py - core.y, F.px - core.x);
                        let da = fingerAng - footAng;
                        while (da > Math.PI) da -= Math.PI * 2;
                        while (da < -Math.PI) da += Math.PI * 2;
                        F.slide = Math.max(-2.5, Math.min(2.5, F.slide + da * 0.5));
                    }
                });

                // 눈/입: 손끝에 닿으면 따라 밀림
                const fy = core.y - rj * 0.1;
                const parts = [
                    ['lx', 'ly', core.x - rj * 0.2 + jellyFace.lx, fy + jellyFace.ly],
                    ['rx', 'ry', core.x + rj * 0.2 + jellyFace.rx, fy + jellyFace.ry],
                    ['mx', 'my', core.x + jellyFace.mx, fy + rj * 0.08 + jellyFace.my]
                ];
                parts.forEach(p => {
                    if (Math.hypot(p[2] - x, p[3] - y) < rj * 0.22) {
                        const lim = rj * 0.3;
                        jellyFace[p[0]] = Math.max(-lim, Math.min(lim, jellyFace[p[0]] + (x - p[2]) * 0.3));
                        jellyFace[p[1]] = Math.max(-lim, Math.min(lim, jellyFace[p[1]] + (y - p[3]) * 0.3));
                    }
                });
            }
            // 왁뿌볼: 문지르는 손끝이 지나가는 좌표마다 데미지 (금 → 다른 제스처에 낙하)
            if (waxIntact && spec.type === "crack_wax" && vel > 2) {
                damageWax(x, y, touchGestures[id]);
            }
            // 슈퍼 탱탱볼: 던지는 속도 기억 → 놓으면 그 방향으로 슝
            if (n === core && spec.bouncy) {
                core.vx = (x - core.x) * 1.3;
                core.vy = (y - core.y) * 1.3;
            }
            n.x = x; n.y = y;
            if(n !== core && !waxIntact) {
                const fw = spec.bouncy ? 0.12 : 0.05; // 탱탱볼은 노드로 던져도 잘 날아감
                core.vx += (x - core.x) * fw;
                core.vy += (y - core.y) * fw;
            }
        } else {
            let p = activePushes.find(pt => pt.id === id);
            if (p) { p.x = x; p.y = y; }
        }
    }

    function handleEnd(id) {
        delete touchGestures[id];

        // 짧은 탭(220ms 미만, 거의 안 움직임) → 챱! 출렁
        const ts = touchStarts[id];
        delete touchStarts[id];
        let wasTap = false;
        if (ts) {
            const moved = ts.lx !== undefined ? Math.hypot(ts.lx - ts.x, ts.ly - ts.y) : 0;
            if (performance.now() - ts.t < 220 && moved < 12
                && Math.hypot(ts.x - core.x, ts.y - core.y) < getRadius() * 1.8) {
                wasTap = jiggleSlime(ts.x, ts.y);
            }
        }

        if(core.touchId === id) { core.touchId = null; if (!wasTap) playSquishSound('release'); }
        const n = nodes.find(pt => pt.touchId === id);
        if (n) { n.touchId = null; if (!wasTap) playSquishSound('release'); }
        
        activePushes = activePushes.filter(pt => pt.id !== id);
    }

    canvas.addEventListener('touchstart', e => { e.preventDefault(); Array.from(e.changedTouches).forEach(t => handleStart(t.identifier, t.clientX, t.clientY)); });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); Array.from(e.changedTouches).forEach(t => handleMove(t.identifier, t.clientX, t.clientY)); });
    canvas.addEventListener('touchend', e => { e.preventDefault(); Array.from(e.changedTouches).forEach(t => handleEnd(t.identifier)); });
    canvas.addEventListener('touchcancel', e => { Array.from(e.changedTouches).forEach(t => handleEnd(t.identifier)); });

    let isMouseDown = false;
    canvas.addEventListener('mousedown', e => { isMouseDown = true; handleStart('mouse', e.clientX, e.clientY); });
    canvas.addEventListener('mousemove', e => { if (isMouseDown) handleMove('mouse', e.clientX, e.clientY); });
    canvas.addEventListener('mouseup', e => { isMouseDown = false; handleEnd('mouse'); });
    canvas.addEventListener('mouseleave', e => { isMouseDown = false; handleEnd('mouse'); });

    applyBgColor();
    applyPlatformUI();

    updateInventoryUI();
    resize();
    animate();
