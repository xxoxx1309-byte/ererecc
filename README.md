# 이터널 리턴 내전 계산기

이터널 리턴 내전을 운영하기 위한 웹 앱입니다. Firebase Auth와 Firestore를 사용하면 여러 운영자가 내전을 만들고, 참가자는 로그인 없이 내전별 링크에서 신청할 수 있습니다.

## 주요 기능

- Google 로그인 기반 관리자/운영자 관리
- 내전별 참가 신청 링크 생성
- 참가자 랭크, 승률, 모스트 실험체 조회
- 역할군 우선순위, 피어리스 가능 실험체, 코발트 신청 양식
- 랭크/코발트 기준 팀 편성
- 24팀, 최대 3조 운영
- TS/TK 직접 합산 점수 입력
- 3경기 대회 점수 합산, 피어리스 중복 실험체 경고
- JSON 백업/복원, 서버 백업, CSV 내보내기

## Firebase 설정

1. Firebase Console에서 프로젝트를 만듭니다.
2. Authentication에서 Google 로그인을 활성화합니다.
3. Authentication의 Authorized domains에 `xxoxx1309-byte.github.io`를 추가합니다.
4. Firestore Database를 생성합니다.
5. Firebase Web App을 추가하고 SDK 설정값을 복사합니다.
6. `config.js`의 `firebaseConfig`에 복사한 값을 넣습니다.

```js
window.ER_CONFIG = {
  firebaseConfig: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  },
  ownerEmails: ["xxoxx1309@gmail.com"],
  rankLookupUrl: "https://asia-northeast3-YOUR_PROJECT.cloudfunctions.net/rankLookup"
};
```

## 배포

GitHub Pages만 사용할 경우 `index.html`, `style.css`, `app.js`, `config.js`, `cloud.js`를 배포하면 됩니다. 이 경우 `rankLookupUrl`에는 Firebase Functions의 전체 URL을 넣어야 합니다.

Firebase Hosting까지 사용할 경우:

```powershell
npm install -g firebase-tools
firebase login
firebase init hosting firestore functions
firebase functions:secrets:set ER_API_KEY
firebase deploy
```

랭크 조회 함수는 Blaze 요금제에서 Firebase Functions를 배포한 뒤 `rankLookupUrl`에 함수 URL을 넣어 사용합니다.

## Firestore 규칙

`firestore.rules`를 Firebase에 배포해야 합니다.

- 참가자: 공개된 내전의 신청만 가능
- 운영자: 내전 생성, 수정, 삭제, 백업 가능
- 소유자: `xxoxx1309@gmail.com`

운영자를 추가하려면 소유자로 로그인한 뒤 관리자 화면의 운영자 이메일 관리에서 등록합니다.
