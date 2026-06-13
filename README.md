# 이터널 리턴 내전 계산기

이터널 리턴 내전 운영을 위한 정적 웹 앱입니다. 참가자 랭크 조회, 역할군 신청, 블라인드 팀 편성, 팀장 지정, 리플레이 및 밴 기록, 대회 점수 계산, JSON 백업과 CSV 내보내기를 지원합니다.

## 주요 기능

- 공식 Open API를 사용한 닉네임 및 시즌 랭크 조회
- 공식 시즌 목록 자동 조회 및 정규 시즌 선택
- 역할군 3순위 신청과 블라인드 공개
- MMR 기반 스네이크 팀 편성
- 가변 경기 수, 팀 수, 팀당 인원
- 리플레이 코드와 밴 페이즈 기록
- 편집 가능한 대회 점수룰
- 브라우저 로컬 저장, JSON 백업/복원, CSV 내보내기

## API

공식 API 기본 주소는 `https://open-api.bser.io`입니다.

현재 앱은 다음 흐름을 사용합니다.

1. `GET /v1/user/nickname?query={nickname}`
2. `GET /v1/rank/uid/{userId}/{seasonId}/{matchingTeamMode}`
3. `GET /v2/user/stats/uid/{userId}/{seasonId}/{matchingMode}`
4. `GET /v2/data/Season`
5. `GET /v2/data/Character`

API 키는 공개 저장소에 넣지 않습니다. 설정 창에서 입력한 키는 해당 브라우저의 `localStorage`에만 저장됩니다.

기본 조회 시즌은 게임 표기 `Season10`이며, 공식 API 내부 시즌 ID는 `19`입니다. 설정에서 다른 정규 시즌으로 변경할 수 있습니다.

로컬 개발 환경에서는 아래 형식의 `config.local.json`을 만들면 자동으로 키를 읽습니다. 이 파일은 `.gitignore`에 포함되어 있습니다.

```json
{
  "apiKey": "YOUR_API_KEY"
}
```

## 실행

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:5173`으로 접속합니다.

## 배포

`index.html`, `style.css`, `app.js`를 GitHub Pages에 배포하면 됩니다. 공개 Pages에서는 설정 버튼을 눌러 API 키를 한 번 입력해야 합니다.

## 디자인

본문과 데이터는 Pretendard, 작업 제목과 버튼은 Paperlogy, 메인 내전명은 느림보고딕을 사용합니다. 아이보리, 로즈, 딥그린, 차콜을 중심으로 반복 작업에 적합한 운영 도구 형태로 구성했습니다.
