import * as THREE from 'three';

export function materialProfile(spec, alpha = spec.baseAlpha ?? 1) {
  const foam = spec.type === 'cotton' || spec.type === 'squishy' || spec.gloss < 0.2;
  return {
    color: spec.color,
    roughness: foam ? 0.85 : Math.max(0.075, 0.46 - (spec.gloss ?? 0.5) * 0.36),
    metalness: spec.magnet ? 0.82 : spec.sparkleHolo ? 0.68 : 0,
    transmission: foam || spec.magnet || spec.sparkleHolo ? 0 : Math.min(0.96, (1 - alpha) * 1.3 + 0.52),
    thickness: foam ? 0 : 1.3,
    ior: 1.38,
    clearcoat: foam ? 0.08 : spec.gloss ?? 0.5,
    clearcoatRoughness: 0.12,
    sheen: foam ? 0.75 : 0.1,
    sheenColor: new THREE.Color('#fff0fa'),
    iridescence: spec.aurora || spec.sparkleHolo ? 0.65 : spec.bubbleBig ? 0.28 : 0,
    attenuationDistance: 1.6,
    attenuationColor: new THREE.Color(spec.color),
    envMapIntensity: foam ? 0.65 : 1.2,
  };
}

export function traits(spec) {
  const a = [];
  if (spec.type.includes('wax')) a.push('바삭한 왁스 코팅');
  if (spec.type === 'cotton') a.push('포슬포슬한 솜');
  if (spec.type === 'squishy') a.push('천천히 복원');
  if (spec.type === 'crunch' || spec.beads || spec.customBeads) a.push('오도독 알갱이');
  if (spec.plastic) a.push('모양을 기억해요');
  if (spec.magnet) a.push('손끝을 따라와요');
  if (spec.bouncy) a.push('탱탱한 바운스');
  if (spec.fizz) a.push(spec.bubbleBig ? '커다란 비눗방울' : '톡톡 탄산 기포');
  if (spec.sparkle) a.push('반짝이는 글리터');
  if (spec.galaxy) a.push('작은 은하를 품었어요');
  if (spec.aurora) a.push('만질 때 바뀌는 색');
  if (spec.jelly) a.push('만질수록 뽀얘져요');
  if (spec.mysteryCore) a.push('비밀스러운 속살');
  if (spec.shapePts) a.push('나만의 실루엣');
  if (spec.dust) a.push('보송한 가루');
  return a.length ? a : [spec.gloss < 0.2 ? '부드러운 크림 질감' : '촉촉하고 쫀득한 젤리'];
}
