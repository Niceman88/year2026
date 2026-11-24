// ============================================================
//  설정 파일 — 행사 전에 이 파일만 확인/수정하면 됩니다.
// ============================================================

// 1) Firebase 설정 (상반기 빙고 때 쓴 프로젝트 그대로)
//    ※ databaseURL은 Firebase 콘솔 > Realtime Database 화면 상단 주소와 같은지 한 번 확인하세요.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBagSV-mmRykgR5dZ8oQJW-aMFCLS13Ojw",
  authDomain: "company-bingo-e8ea2.firebaseapp.com",
  databaseURL: "https://company-bingo-e8ea2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "company-bingo-e8ea2",
  storageBucket: "company-bingo-e8ea2.firebasestorage.app",
  messagingSenderId: "318440692637",
  appId: "1:318440692637:web:170c86c3bcbbbf33056d74"
};

// 2) 행사 ID — 데이터가 저장되는 칸 이름. 리허설은 "rehearsal", 본행사는 "2026" 처럼 나눠 쓰세요.
//    URL 뒤에 ?event=rehearsal 를 붙이면 이 값 대신 그 이름을 씁니다.
window.EVENT_ID = "2026";

// 3) 진행자 키 — 진행자 화면 주소: host.html?key=아래값
//    (참가자에게는 index.html 주소만 공유하세요)
window.HOST_KEY = "ADVPKG";
