# 개발 사례 실행 예제

모미 개발 사례의 핵심을 가상 데이터로 재현한 독립 JavaScript 예제입니다. Node.js 22 이상에서 패키지 설치 없이 실행합니다.

저장소 루트에서 다음 명령을 실행합니다.

```sh
node --test examples/matching.test.mjs examples/offer-confirmation.test.mjs
```

| 예제 | 내용 | 설명 |
| --- | --- | --- |
| [matching.mjs](matching.mjs) | 최대 12명 중 한 경기의 참가자와 팀 선택 | [참여 기회와 실력 고려](../docs/case-studies/badminton-matching.md) |
| [offer-confirmation.mjs](offer-confirmation.mjs) | 요청 공유와 불명확한 결과 조회 | [중복과 응답 유실 처리](../docs/case-studies/offer-confirmation.md) |

2026년 10월 30일 Node.js 24.16.0에서 16개 테스트가 통과했습니다. 매칭은 6개, 참석 확정 처리는 10개입니다.

매칭 예제의 `history`는 `[[['A', 'B'], ['C', 'D']], ...]` 형태의 지난 경기 목록입니다. `games`에는 비교할 배정 횟수를 넣고, `ready: false` 또는 `reserved: true`인 참가자는 다음 편성에서 제외합니다.

참석 확정 예제는 저장소와 원격 처리를 주입합니다. 테스트의 저장소는 메모리이므로 디스크 영속성을 제공하지 않습니다. 실제 서비스에 적용하려면 저장소의 영속성, 원격 호출의 시간 제한과 명확한 오류 분류, 서버의 권한 및 중복 처리 검증이 필요합니다.
