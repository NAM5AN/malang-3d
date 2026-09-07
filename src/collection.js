import { catalog, supplies } from "./catalog.js";
const KEY = "malang-volume-studio-v2";
const starter = () => ({
  version: 2,
  coins: 180,
  selected: 1,
  owned: { 1: 2, 4: 1, 6: 1, 7: 1, 24: 1, 31: 1, 33: 1, 48: 1 },
  seen: [1, 4, 6, 7, 24, 31, 33, 48],
  custom: [],
  materials: { pearl: 1, glitter: 1 },
  names: {},
  background: "cream",
  muted: false,
});
export class Collection {
  constructor(storage) {
    this.storage = storage;
    this.state = starter();
    this.storageAvailable = true;
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || "null");
      if (
        saved?.version === 2 &&
        Number.isFinite(saved.coins) &&
        saved.owned &&
        Array.isArray(saved.custom)
      )
        this.state = { ...this.state, ...saved };
    } catch {
      this.storageAvailable = false;
    }
  }
  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
    } catch {
      this.storageAvailable = false;
    }
  }
  items() {
    return [...catalog, ...this.state.custom];
  }
  item(id) {
    return this.items().find((i) => String(i.id) === String(id)) || catalog[0];
  }
  level(id) {
    return Math.min(
      5,
      1 + Math.floor(Math.log2(Math.max(1, this.state.owned[id] || 0))),
    );
  }
  select(id) {
    this.state.selected = id;
    this.save();
    return this.item(id);
  }
  draw(random = Math.random) {
    if (this.state.coins < 40) return null;
    const weights = { C: 5, R: 3, E: 1.7, L: 0.45 };
    let ticket = random() * catalog.reduce((n, i) => n + weights[i.grade], 0);
    let item = catalog.at(-1);
    for (const i of catalog) {
      ticket -= weights[i.grade];
      if (ticket < 0) {
        item = i;
        break;
      }
    }
    const duplicate = !!this.state.owned[item.id];
    this.state.coins -= 40;
    this.state.owned[item.id] = (this.state.owned[item.id] || 0) + 1;
    if (!this.state.seen.includes(item.id)) this.state.seen.push(item.id);
    const material =
      supplies[Math.floor(random() * supplies.length) % supplies.length];
    this.state.materials[material.id] =
      (this.state.materials[material.id] || 0) + 1;
    this.save();
    return { item, duplicate, material };
  }
  buy(id) {
    const m = supplies.find((m) => m.id === id);
    if (!m || this.state.coins < m.price) return false;
    this.state.coins -= m.price;
    this.state.materials[id] = (this.state.materials[id] || 0) + 1;
    this.save();
    return true;
  }
  craft(baseId, name, color, materials) {
    if (!this.state.owned[baseId] || this.level(baseId) < 2)
      return {
        error:
          "레벨 2인 말랑이부터 꾸밀 수 있어요. 같은 친구를 뽑으면 레벨이 올라가요.",
      };
    const unique = [...new Set(materials)];
    if (
      unique.some(
        (id) => !supplies.find((m) => m.id === id) || !this.state.materials[id],
      )
    )
      return { error: "선택한 재료가 부족해요." };
    for (const category of ["beads", "shell"]) {
      if (
        unique.filter((id) => supplies.find((m) => m.id === id).apply[category])
          .length > 1
      )
        return { error: "비즈와 왁스는 종류별로 하나씩 골라주세요." };
    }
    const base = this.item(baseId),
      id =
        "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const item = {
      ...base,
      id,
      name: (name.trim() || "나의 " + base.name).slice(0, 24),
      color,
      custom: true,
      baseId,
      description:
        "내 손으로 꾸민 특별한 말랑이. 원래 친구의 촉감은 그대로예요.",
    };
    for (const mat of unique) {
      Object.assign(item, supplies.find((m) => m.id === mat).apply);
      this.state.materials[mat]--;
    }
    this.state.custom.push(item);
    this.state.owned[id] = 1;
    this.state.selected = id;
    this.save();
    return { item };
  }
  dismantle(id) {
    if (!this.state.owned[id] || Number(id) === 1) return false;
    this.state.owned[id]--;
    this.state.coins += 12;
    if (!this.state.owned[id]) {
      delete this.state.owned[id];
      if (String(this.state.selected) === String(id)) this.state.selected = 1;
    }
    this.save();
    return true;
  }
  earn() {
    this.state.coins += 2;
    this.save();
  }
}
