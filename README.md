# 이터널 리턴 내전 계산기

이터널 리턴 내전 운영을 위한 정적 웹 앱입니다. 참가자 랭크와 승률 조회, 역할군 신청, 팀 편성, 팀장 지정, 리플레이 및 밴 기록, 대회 점수 계산, JSON 백업과 CSV 내보내기를 지원합니다.

## 주요 기능

- 공식 Open API를 사용한 닉네임, 시즌 랭크, 전체 및 모스트별 승률 조회
- API 키 없이 닉네임과 역할군만으로 수동 참가 등록
- 신청 탭과 관리자 탭 분리
- 공식 시즌 목록 자동 조회 및 정규 시즌 선택
- 역할군 1·2·3순위 신청
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

기본 조회 시즌은 현재 게임 표기 `정출 시즌 11`이며, 공식 API 내부 시즌명은 `Season20`, 시즌 ID는 `39`입니다. 화면에서는 정출 시즌 기준으로 변환해 표시합니다.

내전별 일정, 진행자, 시간, 티어 제한, 팀 방식, 인원과 자유 형식 규칙 공지를 설정하고 메인 화면에 표시할 수 있습니다.

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

`index.html`, `style.css`, `app.js`를 GitHub Pages에 배포하면 됩니다. 공개 Pages에서는 API 키 없이도 참가 등록을 사용할 수 있고, 랭크 조회가 필요할 때만 설정에서 API 키를 입력하면 됩니다.

## 디자인

본문과 데이터는 Pretendard, 작업 제목과 버튼은 Paperlogy, 메인 내전명은 느림보고딕을 사용합니다. 아이보리, 로즈, 딥그린, 차콜을 중심으로 반복 작업에 적합한 운영 도구 형태로 구성했습니다.
