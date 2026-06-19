# 이터널 리턴 내전 계산기

이터널 리턴 내전 운영을 위한 웹 앱입니다. Supabase를 연결하면 여러 내전을 동시에 보관하고 참가 신청을 실시간으로 받을 수 있습니다. 참가자 랭크와 승률 조회, 역할군 신청, 팀 편성, 팀장 지정, 리플레이 및 밴 기록, 대회 점수 계산, JSON 백업과 CSV 내보내기를 지원합니다.

## 주요 기능

- 공식 Open API를 사용한 닉네임, 시즌 랭크, 전체 및 모스트별 승률 조회
- 참가자는 로그인과 API 키 없이 내전별 링크에서 신청
- 소유자가 승인한 운영자 이메일 로그인, 복수 내전 생성 및 실시간 신청 명단 동기화
- 신청 탭과 관리자 탭 분리
- 팀장 후보를 제외하고 남은 인원을 체크하는 팀원 뽑기 보조
- 고정 금지 대상 방식의 꼬리잡기 룰 표시
- 꼬리잡기와 무기군 내전 하우스룰 개별 활성화
- 23개 무기를 선택 폭과 사거리 성향으로 분산한 A~E 무기군 및 팀별 배정

무기군 프리셋은 2026-06-19 공식 Open API의 `WeaponTypeInfo`와 `CharacterMastery`를 기준으로 구성했습니다. 공식 API가 무기별 실시간 승률을 제공하지 않으므로 사용 가능 실험체 수, 기본 사거리, 근접·원거리 및 전투 성향을 기준으로 분산합니다.
- 공식 시즌 목록 자동 조회 및 정규 시즌 선택
- 역할군 1·2·3순위 신청
- MMR 기반 스네이크 팀 편성
- 가변 경기 수, 팀 수, 팀당 인원
- 리플레이 코드와 밴 페이즈 기록
- 편집 가능한 대회 점수룰
- Supabase 실시간 저장과 브라우저 로컬 비상 저장, JSON 백업/복원, CSV 내보내기

## API

공식 API 기본 주소는 `https://open-api.bser.io`입니다.

현재 앱은 다음 흐름을 사용합니다.

1. `GET /v1/user/nickname?query={nickname}`
2. `GET /v1/rank/uid/{userId}/{seasonId}/{matchingTeamMode}`
3. `GET /v2/user/stats/uid/{userId}/{seasonId}/{matchingMode}`
4. `GET /v2/data/Season`
5. `GET /v2/data/Character`

API 키는 공개 저장소에 넣지 않습니다. Supabase 연결 시 키는 Edge Function의 `ER_API_KEY` 비밀값으로만 보관되므로 참가자에게 노출되지 않습니다. 연결하지 않은 로컬 모드에서는 설정 창에 직접 입력한 키가 해당 브라우저의 `localStorage`에만 저장됩니다.

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

## Supabase 연결

1. Supabase 프로젝트를 만들고 프로젝트 설정에서 URL과 Publishable key(또는 기존 anon key)를 확인합니다.
2. `config.js`에 두 공개 연결값을 입력합니다. 이 키는 RLS가 적용된 공개용 키이며 서버 비밀키가 아닙니다.

```js
window.ER_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLISHABLE_KEY"
};
```

3. Supabase CLI로 데이터베이스와 랭크 조회 함수를 배포합니다.

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set ER_API_KEY=YOUR_NEW_ER_API_KEY ALLOWED_ORIGIN=https://xxoxx1309-byte.github.io
npx supabase functions deploy rank-lookup --no-verify-jwt
```

4. Supabase Authentication의 URL 설정에서 Site URL과 Redirect URL에 실제 GitHub Pages 주소를 등록합니다.

이터널 리턴 API 키는 대화나 공개 파일에 노출된 적이 있다면 새로 발급한 뒤 비밀값에 등록합니다.

## 실시간 운영

1. 사이트 소유자가 관리자 탭에서 운영자 이메일을 등록합니다.
2. 등록된 운영자는 API 키 없이 이메일 로그인 링크로 접속합니다.
3. 내전 이름을 입력해 내전을 생성하고 참가 신청 링크를 공유합니다.
4. 참가자는 링크에서 닉네임과 역할군 우선순위를 제출합니다. 랭크 조회는 선택입니다.
5. 운영자는 자신이 만든 내전의 명단과 진행 데이터를 관리하며, 사이트 소유자는 모든 내전을 관리합니다.

## 배포

`index.html`, `style.css`, `app.js`, `config.js`, `cloud.js`를 GitHub Pages에 배포합니다. `supabase` 폴더는 데이터베이스와 Edge Function 배포 소스입니다.

## 디자인

본문과 데이터는 Pretendard, 작업 제목과 버튼은 Paperlogy, 메인 내전명은 느림보고딕을 사용합니다. 아이보리, 로즈, 딥그린, 차콜을 중심으로 반복 작업에 적합한 운영 도구 형태로 구성했습니다.
