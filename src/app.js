import "./ui.css";
import { catalog, textures, supplies } from "./catalog.js";
import { Collection } from "./collection.js";
import { Studio } from "./render/studio.js";

const $ = (id) => document.getElementById(id),
  escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let storage;
try {
  storage = localStorage;
} catch {}
const collection = new Collection(storage);
let studio,
  mode = "owned",
  filter = "all",
  lastEarn = 0,
  touches = 0,
  toastTimer;
const grades = { C: "COMMON", R: "RARE", E: "EPIC", L: "LEGENDARY" };
const toast = (message) => {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3200);
};
const name = (item) => collection.state.names[item.id] || item.name;
const mini = (item) =>
  `<span aria-hidden="true" class="mini ${item.shell ? "wax" : item.shape}" style="--body:${escape(item.shell || item.color)}"></span>`;
function wallet() {
  $("coins").textContent = collection.state.coins;
  const count = Object.keys(collection.state.owned).length;
  $("owned-count").textContent = count + " 친구";
  $("mobile-count").textContent = count + " 친구";
}
function list() {
  const search = $("search").value.trim().toLowerCase();
  const items = collection
    .items()
    .filter(
      (i) =>
        (mode === "book" || collection.state.owned[i.id]) &&
        (filter === "all" ||
          (filter === "wax" && i.shell) ||
          (filter === "jelly" &&
            [
              "jelly",
              "liquid",
              "rubber",
              "stretch",
              "bounce",
              "crunch",
            ].includes(i.texture)) ||
          (filter === "slow" &&
            ["clay", "cotton", "squishy", "foam"].includes(i.texture))) &&
        [name(i), i.description, textures[i.texture].label]
          .join(" ")
          .toLowerCase()
          .includes(search),
    );
  $("slime-list").innerHTML = items.length
    ? items
        .map(
          (i) =>
            `<button role="listitem" class="slime-card ${String(i.id) === String(collection.state.selected) ? "active" : ""}" data-id="${escape(i.id)}" aria-label="${escape(name(i))} 선택" aria-current="${String(i.id) === String(collection.state.selected)}">${mini(i)}<span class="card-copy"><strong>${escape(name(i))}</strong><small><i>${i.grade}</i>${collection.state.owned[i.id] ? "Lv. " + collection.level(i.id) : "미리 만져보기"} · ${textures[i.texture].label.split(" · ")[0]}</small></span></button>`,
        )
        .join("")
    : '<p class="empty">찾는 말랑이가 없어요.<br>다른 이름이나 촉감을 찾아보세요.</p>';
  $("book-note").hidden = mode !== "book";
  wallet();
}
function select(id) {
  const item = collection.select(id);
  studio.select(item);
  $("slime-name").textContent = name(item);
  $("slime-description").textContent = item.description;
  $("grade").textContent = grades[item.grade];
  $("level").textContent = collection.state.owned[id]
    ? "Lv. " + collection.level(id)
    : "";
  $("preview-badge").hidden = !!collection.state.owned[id];
  const tags = [
    textures[item.texture].label,
    item.shape === "heart"
      ? "하트 모양"
      : item.shape === "clover"
        ? "네 잎 클로버"
        : item.shell
          ? `${item.shellHits || 2}번 톡톡`
          : item.beads
            ? "작은 비즈"
            : item.iridescent
              ? "빛나는 색 변화"
              : item.magnet
                ? "손끝을 따라오는"
                : item.glitter
                  ? "반짝이는 속살"
                  : "부드러운 볼륨",
  ];
  $("traits").innerHTML = tags.map((t) => `<span>${escape(t)}</span>`).join("");
  list();
  closeDrawer();
}
function closeDrawer() {
  $("collection-panel").classList.remove("expanded");
  $("drawer-toggle").setAttribute("aria-expanded", "false");
}
function modal(html, kicker = "MALANG STUDIO") {
  studio?.clearInput();
  $("modal-kicker").textContent = kicker;
  $("modal-content").innerHTML = html;
  if (!$("modal").open) $("modal").showModal();
}
function closeModal() {
  $("modal").close();
}
$("close-modal").onclick = closeModal;
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) {
    const r = $("modal").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeModal();
  }
});
$("drawer-toggle").onclick = () => {
  const expanded = $("collection-panel").classList.toggle("expanded");
  $("drawer-toggle").setAttribute("aria-expanded", String(expanded));
};
$("slime-list").onclick = (e) => {
  const button = e.target.closest("[data-id]");
  if (button) select(button.dataset.id);
};
$("search").oninput = list;
for (const tab of ["owned", "book"])
  $("tab-" + tab).onclick = () => {
    mode = tab;
    for (const t of ["owned", "book"]) {
      $("tab-" + t).classList.toggle("active", t === mode);
      $("tab-" + t).setAttribute("aria-selected", String(t === mode));
    }
    list();
  };
document.querySelectorAll("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((i) => i.classList.toggle("active", i === b));
      list();
    }),
);
$("draw").onclick = () => {
  const result = collection.draw();
  if (!result)
    return toast("솜이 조금 부족해요. 말랑이를 주무르며 모아 보세요.");
  list();
  const { item, duplicate, material } = result;
  modal(
    `<div class="result">${mini(item)}<span class="grade">${grades[item.grade]} · ${duplicate ? "또 만났어요!" : "새로운 친구!"}</span><h2>${escape(item.name)}</h2><p>${duplicate ? `같은 친구를 만나 Lv. ${collection.level(item.id)}이 되었어요.` : escape(item.description)}<br>${escape(material.name)}도 함께 받았어요.</p><button class="primary" id="meet">지금 만져보기 →</button></div>`,
    "A LITTLE SURPRISE",
  );
  $("meet").onclick = () => {
    closeModal();
    select(item.id);
  };
};
function shop() {
  modal(
    `<h2>작은 재료 상점</h2><p>새로운 색과 반짝임을 더해 보세요. 현재 ✳ ${collection.state.coins} 솜</p>${supplies.map((m) => `<div class="shop-row"><i style="--c:${m.color}"></i><span>${m.name}<small>보유 ${collection.state.materials[m.id] || 0}개</small></span><button data-buy="${m.id}">✳ ${m.price}</button></div>`).join("")}`,
    "LITTLE EXTRAS",
  );
  $("modal-content")
    .querySelectorAll("[data-buy]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (collection.buy(b.dataset.buy)) {
            wallet();
            shop();
            toast("재료를 담았어요.");
          } else toast("솜이 부족해요.");
        }),
    );
}
$("shop").onclick = shop;
$("craft").onclick = () => {
  const owned = collection
    .items()
    .filter((i) => collection.state.owned[i.id] && !i.custom);
  modal(
    `<h2>나만의 말랑이</h2><p>레벨 2 이상인 친구를 골라 꾸며요.<br>처음 받은 물젤리는 바로 꾸밀 수 있어요.</p><form id="craft-form"><label class="form-row">바탕 말랑이<select id="craft-base">${owned.map((i) => `<option value="${i.id}" ${i.id === 1 ? "selected" : ""}>${i.name} · Lv. ${collection.level(i.id)}</option>`).join("")}</select></label><label class="form-row">내가 지어줄 이름<input id="craft-name" maxlength="24" placeholder="예: 반짝이는 오후" required></label><label class="form-row">젤리 색<input id="craft-color" type="color" value="#91cbb6"></label><p>좋아하는 재료를 골라요</p><div class="material-grid">${supplies.map((m) => `<label class="material-option"><input type="checkbox" name="material" value="${m.id}" ${collection.state.materials[m.id] ? "" : "disabled"}><i style="--c:${m.color}"></i>${m.name}<small>×${collection.state.materials[m.id] || 0}</small></label>`).join("")}</div><p class="error-note" id="craft-error" role="alert"></p><button class="primary" type="submit">내 말랑이 완성하기 <span>✧</span></button></form>`,
    "MADE BY YOU",
  );
  $("craft-form").onsubmit = (e) => {
    e.preventDefault();
    const result = collection.craft(
      $("craft-base").value,
      $("craft-name").value,
      $("craft-color").value,
      [...document.querySelectorAll("[name=material]:checked")].map(
        (i) => i.value,
      ),
    );
    if (result.error) {
      $("craft-error").textContent = result.error;
      return;
    }
    closeModal();
    select(result.item.id);
    toast("세상에 하나뿐인 말랑이가 태어났어요.");
  };
};
$("manage").onclick = () => {
  const item = collection.item(collection.state.selected);
  if (!collection.state.owned[item.id])
    return toast(
      "도감에서 미리 만져보는 친구예요. 뽑기로 만나면 이름을 지을 수 있어요.",
    );
  modal(
    `<h2>친구의 이름</h2><form id="rename-form"><label class="form-row">이름<input id="rename" value="${escape(name(item))}" maxlength="24" required></label><button class="primary">이름 저장하기 <span>✓</span></button></form><button id="dismantle" class="danger" ${Number(item.id) === 1 ? "disabled" : ""}>${(collection.state.owned[item.id] || 0) > 1 ? "중복 한 개" : "이 친구"} 보내고 12 솜 받기</button><p>마지막 친구를 보내도 도감의 만난 기록은 남아요.</p>`,
  );
  $("rename-form").onsubmit = (e) => {
    e.preventDefault();
    collection.state.names[item.id] = $("rename").value.trim() || item.name;
    collection.save();
    closeModal();
    select(item.id);
  };
  $("dismantle").onclick = () => {
    modal(
      `<h2>이 친구를 보내줄까요?</h2><p>${escape(name(item))} 한 개를 보내고 12 솜을 받아요.</p><button class="primary" id="confirm-dismantle">보내주기 · 12 솜</button>`,
    );
    $("confirm-dismantle").onclick = () => {
      collection.dismantle(item.id);
      closeModal();
      select(collection.state.selected);
      toast("12 솜을 받았어요.");
    };
  };
};
$("help").onclick = () =>
  modal(
    '<h2>잠깐, 말랑한 시간</h2><ul class="help-list"><li><b>꾹 누르고 쭉 당겨요.</b><br>손가락 주변이 함께 움직이고, 놓으면 출렁여요. 두 손가락으로 양쪽을 잡을 수도 있어요.</li><li><b>각자 다른 촉감을 찾아요.</b><br>고무는 빠르게, 스퀴시는 천천히. 점토는 만든 모양을 기억하고, 왁스는 여러 번 누르면 깨져요.</li><li><b>친구와 재료를 모아요.</b><br>다섯 번 주무를 때마다 2 솜. 뽑기에는 꾸미기 재료가 함께 와요. 같은 친구는 레벨이 올라요.</li><li><b>시점도 바꿀 수 있어요.</b><br>컴퓨터에서는 오른쪽 버튼으로 회전해요. 휴대폰에서는 빈 공간을 쓸어 돌려보세요.</li></ul><p>도감에서는 49가지 친구를 모두 미리 만져볼 수 있어요. 보관함은 이 브라우저에 저장돼요.</p><a class="help-link" href="https://github.com/NAM5AN/malang-3d" target="_blank" rel="noreferrer">만들어진 이야기 ↗</a>',
    "A MOMENT FOR YOURSELF",
  );
document.querySelectorAll("[data-bg]").forEach(
  (b) =>
    (b.onclick = () => {
      collection.state.background = b.dataset.bg;
      collection.save();
      background();
    }),
);
function background() {
  studio.setBackground(collection.state.background);
  document.body.classList.toggle(
    "night",
    collection.state.background === "night",
  );
  document
    .querySelectorAll("[data-bg]")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        b.dataset.bg === collection.state.background,
      ),
    );
}
function sound() {
  studio.muted = collection.state.muted;
  $("sound").textContent = studio.muted ? "♪" : "♫";
  $("sound").style.opacity = studio.muted ? ".45" : "1";
  $("sound").setAttribute(
    "aria-label",
    studio.muted ? "소리 켜기" : "소리 끄기",
  );
  $("sound").title = studio.muted ? "소리 켜기" : "소리 끄기";
}
$("sound").onclick = () => {
  collection.state.muted = !collection.state.muted;
  collection.save();
  sound();
};
$("reset").onclick = () => {
  studio.reset();
  toast("다시 말랑말랑, 처음 모양으로.");
};
$("camera").onclick = () => studio.view();
$("poke").onclick = () => studio.poke();
try {
  studio = new Studio($("stage"), {
    onTouch() {
      const now = Date.now();
      touches++;
      if (touches >= 5 && now - lastEarn > 2500) {
        collection.earn();
        wallet();
        touches = 0;
        lastEarn = now;
        toast("손끝에 쌓인 작은 쉼 · +2 솜");
      }
    },
    onCoating(message) {
      $("feel-note").textContent = message;
    },
  });
  select(collection.state.selected);
  background();
  sound();
  $("loading").remove();
  if (!collection.storageAvailable)
    toast("이 브라우저에서는 보관함 저장을 사용할 수 없어요.");
  if (import.meta.env.DEV)
    window.__malang = { studio, collection, select, catalog };
} catch (error) {
  $("loading").textContent =
    "3D 화면을 열지 못했어요. 브라우저의 그래픽 가속을 켠 뒤 새로고침해 주세요.";
  console.error(error);
}
