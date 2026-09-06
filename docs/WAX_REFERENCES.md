# 왁스 구현 참고 기록

사용자 요청에 따라 **실제 다른 개발자의 왁뿌볼 작업물 코드**를 먼저 읽고, 표면 파괴 구조를 연구했습니다. 범용 파괴 라이브러리만 참고한 구현이 아닙니다.

## 1. seongwoochikin-dev/wakppuball

- 저장소: https://github.com/seongwoochikin-dev/wakppuball
- 확인한 커밋: `d1fcf298f06b50adcccb7aff20919ac9f3fc95f2`
- [확인한 코드](https://github.com/seongwoochikin-dev/wakppuball/blob/d1fcf298f06b50adcccb7aff20919ac9f3fc95f2/index.html)
- 코드에서 읽은 부분: `initBase`, `fractureAt`, `rebuildShellIndex`, `rebuildRim`, `buildChunkObject`, `paintP`, `grindChunk`.
- 작동 예시: https://seongwoochikin-dev.github.io/wakppuball/

참고한 구조는 균일한 삼각형 표면, 접촉점 주변의 국소 파괴 영역, 최근접 시드를 이용한 조각 분할, 실제 표면 삭제, 외피와 내피를 연결하는 두께 있는 파단면입니다. 평면에 균열 그림만 얹는 방법을 사용하지 않습니다.

Malang 3D에서는 `IcosahedronGeometry`를 기존 말랑이 몸체에 맞춰 샘플링하고, 접촉한 패치를 여러 그룹으로 나눕니다. 각 그룹은 바깥면·안쪽면·옆 단면을 가진 메시로 떨어집니다. 원본 말랑이 DB의 `waxHits`, `chipScale`, `breakScore`, `waxTough`, `waxLayers`가 그대로 구동됩니다.

이 참고 작업물은 점토에 조각이 붙거나 파묻히는 방식입니다. 본 프로젝트는 원본 `NAM5AN/malang`의 **조각이 떨어지는** 성질을 유지합니다. 원본의 젤리 속살을 점토로 일괄 변경하지 않았으며, `plastic`이 있는 말랑이만 만든 모양을 기억합니다.

## 2. jibeommm/wakppu-ball

- 저장소: https://github.com/jibeommm/wakppu-ball
- 확인한 커밋: `dc5ba137e1923d5cd6a09b7fcc49156c941ce46d`
- [확인한 코드](https://github.com/jibeommm/wakppu-ball/blob/dc5ba137e1923d5cd6a09b7fcc49156c941ce46d/index.html)
- 코드에서 읽은 부분: `intensityCurve`, `onPress`, `update`, `spawnCracks`, `spawnCrumbs`.

누르는 시간을 압력 진행으로 해석하는 방식과, 껍질/속재질의 반응을 나누는 구조를 참고했습니다. 여기서는 반복 클릭을 유지하면서, 길게 누를 때도 480 ms마다 한 번의 추가 타격을 적용합니다. 한 번의 클릭이 같은 순간 여러 타격으로 중복 계산되지 않습니다.

## 코드와 라이선스의 구분

확인한 두 왁뿌볼 저장소에는 별도 LICENSE 파일이 없었습니다. 그 소스·오디오·이미지를 복사하거나 번들에 포함하지 않았습니다. 동작과 알고리즘 구조를 연구한 뒤, 이 프로젝트의 원본 물성·좌표계에 맞춰 별도 구현했습니다. 출처는 위 커밋 링크로 고정합니다.

실제 의존성인 Three.js는 MIT 라이선스를 따르며, 배포물에 라이선스 고지를 포함합니다. 참고 작업물의 코드를 그대로 재배포한다고 표시하지 않습니다.
