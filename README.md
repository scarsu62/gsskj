# KJ 親和法多人 AI 協作平台 (KJ Affinity Collaborative Platform)

這是一個基於純前端技術 (HTML5 / Vanilla CSS / ES Modules) 開發的 **多人即時連線與 AI 親和歸類數位白板**，專為腦力激盪、問題收斂與共識凝聚設計，支援多輪迭代高階收斂與樹狀結構溯源。

## 🌟 核心特色
1. **雙重角色權限**：
   - **學員 (Student)**：可新增卡片、拖曳分類、自訂群組、呼叫 AI 歸類、晉級下一輪。
   - **講師 (Teacher)**：需輸入安全密語 `KJOnLine`。具備「全知巡房視角」，可在上方導覽列快速下拉切換不同小組聊天室，並具備「重置房間」清空所有資料的權限。
2. **雙引擎資料同步**：
   - **雲端同步**：使用 Firebase Firestore 進行即時同步，多個瀏覽器分頁、多台裝置開起同一個房間即可多人協作。
   - **本地離線備援**：若未設定 Firebase 或連線失敗，系統將自動降級為 **LocalStorage 離線模式**。在離線模式下，同一個瀏覽器開多個分頁協作也能透過 Storage API 即時同步，確保單機教學或離線展示順暢。
3. **AI 自動化歸類**：
   - 整合 Gemini 2.5 Flash。當收集的卡片數量大於等於 3 張時，一鍵呼叫 AI 自動進行語意分析歸類，自動命名精準的中文群組標籤（8 字以內），並將無強烈關聯的想法放入「獨立卡片區」。
4. **多輪次迭代與樹狀溯源 (Tree View)**：
   - 當初步歸類完成後，可點擊「晉級下一輪」，將當前輪次的群組標籤升格為下一輪的「高階卡片」，獨立卡片一併帶入。
   - 支援「親和分組畫板 (Board)」與「階層樹狀關聯圖 (Tree)」無縫切換。
   - 在 **Tree View** 中，可以點擊折疊資料夾，一路展開高階標籤，追溯到第 0 輪最原始是由哪位成員提出的想法與暱稱。
5. **分享與匯出**：
   - **分享邀請**：一鍵複製邀請連結（帶有 `?room=房間名` 參數），他人開啟即可自動填入房間。
   - **階層 Markdown 匯出**：完美生成包含輪次、群組、獨立卡片、發想者的縮排 Markdown。支援一鍵複製到剪貼簿或下載 `.md` 檔案，方便貼上至 Notion 或 Obsidian 知識庫。

---

## 🚀 快速開始使用

由於本專案採用**免安裝、免編譯的 Web App 架構**，您可以直接用瀏覽器打開網頁：

1. **直接開啟網頁**：
   - 用滑鼠雙擊或在瀏覽器中直接開啟 `index.html` 檔案。
2. **使用本地輕量伺服器 (推薦)**：
   - 若您電腦裝有 Python，可在該目錄下執行：
     ```bash
     python -m http.server 8000
     ```
   - 接著在瀏覽器打開：`http://localhost:8000`

---

## ⚙️ 系統設定指引

點擊白板右上角的 **「設定」** 按鈕（齒輪圖示），可進行以下配置：

### 1. Gemini AI 服務金鑰設定
- 輸入您的 **Gemini API 金鑰 (Key)** 以啟用「一鍵 AI 親和歸類」功能。
- *安全聲明：金鑰僅儲存在您的瀏覽器 LocalStorage 中，直接發送至 Google 官方 API，本平台絕不收集或儲存任何金鑰資訊。*

### 2. Firebase 雲端同步設定 (Firestore)
若要讓不同的電腦、不同的使用者共同即時連線，請照以下步驟建立免費的 Firebase Firestore：
1. 前往 [Firebase Console](https://console.firebase.google.com/) 建立新專案。
2. 在專案中新增 **網頁應用程式 (Web App)**。
3. 複製應用程式的 SDK 配置 JSON，格式類似：
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-project.firebaseapp.com",
     "projectId": "your-project",
     "storageBucket": "your-project.appspot.com",
     "messagingSenderId": "...",
     "appId": "..."
   }
   ```
4. 開啟 Firestore Database，建立資料庫，並將規則 (Rules) 修改為允許讀寫：
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
5. 將 Firebase Config JSON 貼入平台設定對話框中，點擊「儲存並重新載入」。
6. 頂部狀態燈將變為 🟢 **雲端即時連線 (Firebase)**，即可進行跨裝置多人連線！

---

## 📂 專案檔案結構
- [index.html](file:///c:/Users/scar_su/OneDrive%20-%20Galaxy%20Software%20Services/06_Project/AI%20Project/KJ%E8%A6%AA%E5%92%8C%E5%9C%96/index.html) - 主體 HTML 入口。
- [css/app.css](file:///c:/Users/scar_su/OneDrive%20-%20Galaxy%20Software%20Services/06_Project/AI%20Project/KJ%E8%A6%AA%E5%92%8C%E5%9C%96/css/app.css) - 高級淺色系視覺變數與排版樣式。
- [js/app.js](file:///c:/Users/scar_su/OneDrive%20-%20Galaxy%20Software%20Services/06_Project/AI%20Project/KJ%E8%A6%AA%E5%92%8C%E5%9C%96/js/app.js) - 核心控制、拖曳事件與樹狀歷史溯源渲染邏輯。
- [js/firebase-db.js](file:///c:/Users/scar_su/OneDrive%20-%20Galaxy%20Software%20Services/06_Project/AI%20Project/KJ%E8%A6%AA%E5%92%8C%E5%9C%96/js/firebase-db.js) - Firebase Firestore 連線與 LocalStorage 離線同步引擎。
- [js/gemini-api.js](file:///c:/Users/scar_su/OneDrive%20-%20Galaxy%20Software%20Services/06_Project/AI%20Project/KJ%E8%A6%AA%E5%92%8C%E5%9C%96/js/gemini-api.js) - 串接 Gemini 2.5 Flash 進行 JSON Mode 親和分類。
