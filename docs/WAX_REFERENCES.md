# 실제 왁뿌볼 작업물 참고

사용자 요청에 따라 다른 개발자가 만든 왁뿌볼 코드를 읽고, 껍질 파괴 구조를 연구했습니다. v2의 `src/render/coating.js`는 새 체적 물리에 맞춰 처음부터 작성했습니다.

## seongwoochikin-dev/wakppuball

- [저장소](https://github.com/seongwoochikin-dev/wakppuball)
- 확인한 커밋: `d1fcf298f06b50adcccb7aff20919ac9f3fc95f2`
- [읽은 코드](https://github.com/seongwoochikin-dev/wakppuball/blob/d1fcf298f06b50adcccb7aff20919ac9f3fc95f2/index.html)
- 함수: `initBase`, `fractureAt`, `rebuildShellIndex`, `rebuildRim`, `buildChunkObject`, `paintP`, `grindChunk`.

접촉점 주변의 표면 영역을 분리하고, 최근접 시드로 불규칙한 조각을 나누며, 표면 삼각형을 실제로 삭제하는 구조를 참고했습니다. 조각은 바깥면·안쪽면·옆면을 가져 두께가 보입니다. 구멍 가장자리에는 밝은 파단면을 만듭니다.

v2에서는 둥근 큐브의 삼각형 표면을 자체 생성하여 공간 시드에 배정합니다. 코팅은 새 3D 물리의 변위를 따르고, 선택된 영역에 필요한 횟수만큼 타격하면 그 영역을 제거합니다. 얇은 설탕은 1회, 두꺼운 초코와 황금 오브는 3회이며 코팅 두께와 조각 크기도 다릅니다.

참고 작업물의 조각은 점토에 붙거나 파묻힙니다. 여기서는 원작 말랑의 기획대로 조각이 바닥으로 떨어지며, 속살은 젤리 또는 해당 캐릭터의 고유 반죽 성질을 유지합니다. 껍질이 남아 있을 때는 단단하고, 깨질수록 속살의 유연함으로 바뀝니다.

## jibeommm/wakppu-ball

- [저장소](https://github.com/jibeommm/wakppu-ball)
- 확인한 커밋: `dc5ba137e1923d5cd6a09b7fcc49156c941ce46d`
- [읽은 코드](https://github.com/jibeommm/wakppu-ball/blob/dc5ba137e1923d5cd6a09b7fcc49156c941ce46d/index.html)
- 함수: `intensityCurve`, `onPress`, `update`, `spawnCracks`, `spawnCrumbs`.

누르는 시간에 따른 압력 진행과 껍질/속재질의 반응 구분을 참고했습니다. 여기서는 클릭 1회에 1타격, 길게 누르면 420 ms마다 추가 타격을 적용합니다.

## 라이선스 구분

확인한 두 저장소에는 별도의 LICENSE 파일이 없었습니다. 소스·이미지·오디오를 복사하거나 재배포하지 않습니다. 공개 코드에서 구조를 공부한 뒤 독립적으로 작성했고, 위 링크로 참고 출처를 남깁니다. Three.js의 MIT 고지는 배포물에 포함합니다.
