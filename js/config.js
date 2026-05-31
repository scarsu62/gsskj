// js/config.js
// 系統核心服務配置檔 - 請在此處填入您的 API 金鑰與連線設定
// 提示：修改此檔案後，專案經由 GitHub Pages 發布時，所有使用者的白板將自動套用此設定，無須再手動設定。

window.SYSTEM_CONFIG = {
  // 1. Gemini 2.5 Flash AI 服務設定 (一鍵 AI 親和歸類用)
  // 請至 Google AI Studio (https://aistudio.google.com/) 申請 API 金鑰
  GEMINI_API_KEY: "AIzaSyCECiQA9sKH_8ZctwB-tp2myUdIwdGeyq8",

  // 2. Google OAuth 2.0 用戶端識別碼 (儲存至 Google Drive 雲端硬碟用)
  // 請至 Google Cloud Console 申請 OAuth Client ID
  GOOGLE_CLIENT_ID: "991094578430-pfcsup6vqit9qbvc5t751q93avro9eet.apps.googleusercontent.com",

  // 3. Firebase Firestore 雲端同步連線設定 (多人連線即時同步用)
  // 請至 Firebase Console 建立 Firestore 並複製網頁應用程式配置 JSON 欄位
  FIREBASE_CONFIG: {
  apiKey: "AIzaSyDWJDs-LGydNCjp0VwRrEOOdpVgHQF4AdU",
  authDomain: "kjonline-71305.firebaseapp.com",
  projectId: "kjonline-71305",
  storageBucket: "kjonline-71305.firebasestorage.app",
  messagingSenderId: "157905614405",
  appId: "1:157905614405:web:ec43fa76fdb209029ad52c"
  }
};
