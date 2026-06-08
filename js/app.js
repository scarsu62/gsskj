// app.js
// Main Application Controller for KJ Affinity Collaborative Platform (Cloud-Only Config Version)

// Helper: Secure UUID Generator
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper: SHA-256 Hasher (for secure password check)
async function computeSHA256(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Web-Safe Cipher for Room Name encoding to prevent easy F12 guessing
const CIPHER_KEY = 42;

function encodeRoomName(roomName) {
  const utf8Encoder = new TextEncoder();
  const bytes = utf8Encoder.encode(roomName);
  const xorBytes = Array.from(bytes).map(b => b ^ CIPHER_KEY);
  const binStr = String.fromCharCode(...xorBytes);
  const base64 = btoa(binStr);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeRoomName(encodedStr) {
  try {
    let base64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binStr = atob(base64);
    const xorBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      xorBytes[i] = binStr.charCodeAt(i) ^ CIPHER_KEY;
    }
    const utf8Decoder = new TextDecoder();
    return utf8Decoder.decode(xorBytes);
  } catch (e) {
    console.error("Failed to decode room name:", e);
    return "";
  }
}

// App State
let state = {
  userRole: null, // "student" or "teacher"
  userNickname: "",
  roomName: "",
  currentRound: 0,
  cards: [],
  groups: [],
  activeView: "board", // "board" or "tree"
  activeRooms: [],
  offline: true,
  rootCauses: [],
  countermeasures: [],
  presenceIntervalId: null
};

// Tracking active root cause analysis group
let activeRootCauseGroupId = null;
let activeCountermeasuresGroupId = null;

// DOM Element Cache
const dom = {
  // Screens
  lobbyScreen: document.getElementById("lobby-screen"),
  appScreen: document.getElementById("app-screen"),

  // Lobby Elements
  tabStudent: document.getElementById("tab-student"),
  tabTeacher: document.getElementById("tab-teacher"),
  formStudent: document.getElementById("form-student"),
  formTeacher: document.getElementById("form-teacher"),
  studentName: document.getElementById("student-name"),
  studentRoom: document.getElementById("student-room"),
  btnJoinStudent: document.getElementById("btn-join-student"),
  teacherPassword: document.getElementById("teacher-password"),
  teacherRoomSelect: document.getElementById("teacher-room-select"),
  teacherRoomInput: document.getElementById("teacher-room-input"),
  btnJoinTeacher: document.getElementById("btn-join-teacher"),

  // Header Elements
  connectionIndicator: document.getElementById("connection-indicator"),
  connectionStatusText: document.getElementById("connection-status-text"),
  teacherNav: document.getElementById("teacher-nav"),
  headerRoomSelect: document.getElementById("header-room-select"),
  userDisplayName: document.getElementById("user-display-name"),
  btnShare: document.getElementById("btn-share"),
  btnSettings: document.getElementById("btn-settings"),
  btnLogout: document.getElementById("btn-logout"),
  btnToggleSidebar: document.getElementById("btn-toggle-sidebar"),
  sidebar: document.querySelector(".sidebar"),

  // Sidebar Elements
  cardCreatorSection: document.getElementById("card-creator-section"),
  cardInput: document.getElementById("card-input"),
  btnAddCard: document.getElementById("btn-add-card"),
  displayRoundNum: document.getElementById("display-round-num"),
  roundDesc: document.getElementById("round-desc"),
  studentActions: document.getElementById("student-actions"),
  btnAiGroup: document.getElementById("btn-ai-group"),
  btnNewGroup: document.getElementById("btn-new-group"),
  btnAdvanceRound: document.getElementById("btn-advance-round"),
  btnRevertRound: document.getElementById("btn-revert-round"),
  teacherActions: document.getElementById("teacher-actions"),
  btnResetRoom: document.getElementById("btn-reset-room"),
  btnExportMd: document.getElementById("btn-export-md"),

  // Workspace View Canvas Elements
  displayRoomName: document.getElementById("display-room-name"),
  memberPresenceContainer: document.getElementById("member-presence-container"),
  btnMemberList: document.getElementById("btn-member-list"),
  memberCount: document.getElementById("member-count"),
  memberDropdown: document.getElementById("member-dropdown"),
  memberUl: document.getElementById("member-ul"),
  viewTabBoard: document.getElementById("view-tab-board"),
  viewTabTree: document.getElementById("view-tab-tree"),
  panelBoard: document.getElementById("panel-board"),
  panelTree: document.getElementById("panel-tree"),
  boardCanvas: document.getElementById("board-canvas"),
  treeCanvas: document.getElementById("tree-canvas"),

  // Toast Container
  toastContainer: document.getElementById("toast-container"),

  // Export Modal Elements
  modalExport: document.getElementById("modal-export"),
  modalExportClose: document.getElementById("modal-export-close"),
  exportTextarea: document.getElementById("export-textarea"),
  btnCopyMd: document.getElementById("btn-copy-md"),
  btnDownloadMd: document.getElementById("btn-download-md"),

  // Settings Modal Elements
  modalSettings: document.getElementById("modal-settings"),
  modalSettingsClose: document.getElementById("modal-settings-close"),
  settingGeminiKey: document.getElementById("setting-gemini-key"),
  btnSaveSettings: document.getElementById("btn-save-settings"),

  // Batch Export Elements
  modalBatchExport: document.getElementById("modal-batch-export"),
  modalBatchExportClose: document.getElementById("modal-batch-export-close"),
  btnBatchSelectAll: document.getElementById("btn-batch-select-all"),
  btnBatchDeselectAll: document.getElementById("btn-batch-deselect-all"),
  batchRoomsList: document.getElementById("batch-rooms-list"),
  btnExecuteBatchExport: document.getElementById("btn-execute-batch-export"),
  btnLobbyBatchExport: document.getElementById("btn-lobby-batch-export"),
  btnLobbyBatchImport: document.getElementById("btn-lobby-batch-import"),
  lobbyBatchImportInput: document.getElementById("lobby-batch-import-input"),
  btnImportMd: document.getElementById("btn-import-md"),
  importMdInput: document.getElementById("import-md-input"),
  btnHeaderBatchExport: document.getElementById("btn-header-batch-export"),

  // Root Cause Elements
  modalRootCause: document.getElementById("modal-root-cause"),
  modalRootCauseClose: document.getElementById("modal-root-cause-close"),
  modalRootCauseOk: document.getElementById("modal-root-cause-ok"),
  rootCauseGroupName: document.getElementById("root-cause-group-name"),
  rootCauseTreeContainer: document.getElementById("root-cause-tree-container"),

  // Countermeasures Elements
  modalCountermeasures: document.getElementById("modal-countermeasures"),
  modalCountermeasuresClose: document.getElementById("modal-countermeasures-close"),
  modalCountermeasuresOk: document.getElementById("modal-countermeasures-ok"),
  countermeasuresGroupName: document.getElementById("countermeasures-group-name"),
  countermeasuresTreeContainer: document.getElementById("countermeasures-tree-container")
};

// UI Notification Toast
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === "error") {
    icon = '<i class="fa-solid fa-circle-xmark"></i>';
  } else if (type === "warning") {
    icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  }
  
  toast.innerHTML = `${icon} <span>${message}</span>`;
  dom.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
function initApp() {
  // Check Firebase config validity
  const fbConfig = window.SYSTEM_CONFIG ? window.SYSTEM_CONFIG.FIREBASE_CONFIG : null;
  const isValidConfig = fbConfig && fbConfig.apiKey && fbConfig.projectId && !fbConfig.apiKey.startsWith("YOUR_");

  if (!isValidConfig) {
    // Render full-screen warning overlay
    document.body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background-color:#f8fafc; color:#0f172a; text-align:center; padding:20px;">
        <h1 style="color:#ef4444; font-size:2rem; margin-bottom:16px;"><i class="fa-solid fa-triangle-exclamation"></i> 系統尚未配置雲端連線</h1>
        <p style="font-size:1.1rem; color:#475569; max-width:550px; line-height:1.6; margin-bottom:24px;">
          本平台已設定為「強制雲端連線模式」。請在專案目錄下的 <b>js/config.js</b> 檔案中填入您的 Firebase 設定，完成並發布後即可開始使用。
        </p>
        <div style="font-size:0.9rem; color:#94a3b8; background:white; padding:12px 20px; border-radius:8px; border:1px solid #e2e8f0; font-family:monospace; margin-bottom:16px;">
          c:/Users/scar_su/OneDrive - Galaxy Software Services/06_Project/AI Project/KJ親和圖/js/config.js
        </div>
        <p style="font-size:0.85rem; color:#64748b;">修改該檔案後重新載入頁面即可。</p>
      </div>
    `;
    return;
  }

  // Parse room name from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoom = urlParams.get("room");
  if (urlRoom) {
    const decodedRoom = decodeRoomName(urlRoom);
    if (decodedRoom) {
      dom.studentRoom.value = decodedRoom;
      showToast(`偵測到邀請連結，已為您填入房間：${decodedRoom}`, "success");
    } else {
      dom.studentRoom.value = urlRoom;
      showToast(`偵測到邀請連結，已為您填入房間：${urlRoom}`, "success");
    }
  }

  // Connect DB
  window.dbService.init(
    null,
    onRoomStateUpdate,
    onRoomsListUpdate,
    onConnectionStateChange
  );

  // Bind Events
  bindUIEvents();
}

// -------------------------------------------------------------
// EVENT BINDINGS
// -------------------------------------------------------------
function bindUIEvents() {
  // Lobby Tab Toggle
  dom.tabStudent.addEventListener("click", () => switchLobbyTab("student"));
  dom.tabTeacher.addEventListener("click", () => switchLobbyTab("teacher"));

  // Lobby Login Event
  dom.btnJoinStudent.addEventListener("click", handleStudentJoin);
  dom.btnJoinTeacher.addEventListener("click", handleTeacherJoin);
  
  dom.formStudent.addEventListener("submit", (e) => {
    e.preventDefault();
    handleStudentJoin();
  });
  dom.formTeacher.addEventListener("submit", (e) => {
    e.preventDefault();
    handleTeacherJoin();
  });

  // Password Listener for Teacher Room Fetching
  dom.teacherPassword.addEventListener("input", handleTeacherPasswordInput);
  dom.teacherPassword.addEventListener("change", handleTeacherPasswordInput);

  // Room Switching Listener (Teacher only)
  dom.headerRoomSelect.addEventListener("change", (e) => {
    if (e.target.value) {
      switchRoom(e.target.value);
    }
  });

  // Export & Export Modal
  dom.btnExportMd.addEventListener("click", handleExportMarkdown);
  dom.modalExportClose.addEventListener("click", () => toggleModal(dom.modalExport, false));
  dom.btnCopyMd.addEventListener("click", handleCopyExport);
  dom.btnDownloadMd.addEventListener("click", handleDownloadExport);

  // Share invite
  dom.btnShare.addEventListener("click", handleShareLink);

  // Logout
  dom.btnLogout.addEventListener("click", handleLogout);

  // Sidebar Toggle Collapse
  dom.btnToggleSidebar.addEventListener("click", () => {
    dom.sidebar.classList.toggle("collapsed");
    const isCollapsed = dom.sidebar.classList.contains("collapsed");
    
    // Update icon and title
    const icon = dom.btnToggleSidebar.querySelector("i");
    if (icon) {
      if (isCollapsed) {
        icon.className = "fa-solid fa-chevron-right";
        dom.btnToggleSidebar.title = "展開控制面板";
      } else {
        icon.className = "fa-solid fa-chevron-left";
        dom.btnToggleSidebar.title = "收起控制面板";
      }
    }
  });

  // Settings & Settings Modal
  dom.btnSettings.addEventListener("click", () => {
    const currentKey = localStorage.getItem("KJ_GEMINI_API_KEY") || "";
    dom.settingGeminiKey.value = currentKey;
    toggleModal(dom.modalSettings, true);
  });
  dom.modalSettingsClose.addEventListener("click", () => {
    toggleModal(dom.modalSettings, false);
  });
  dom.btnSaveSettings.addEventListener("click", () => {
    const newKey = dom.settingGeminiKey.value.trim();
    if (newKey) {
      localStorage.setItem("KJ_GEMINI_API_KEY", newKey);
      showToast("金鑰設定已儲存！", "success");
    } else {
      localStorage.removeItem("KJ_GEMINI_API_KEY");
      showToast("已清除自訂金鑰，將使用系統預設金鑰！", "warning");
    }
    toggleModal(dom.modalSettings, false);
  });

  // Batch Export Modal Triggers
  const openBatchModal = () => {
    populateBatchRoomsList();
    toggleModal(dom.modalBatchExport, true);
  };
  dom.btnLobbyBatchExport.addEventListener("click", openBatchModal);
  dom.btnHeaderBatchExport.addEventListener("click", openBatchModal);
  dom.modalBatchExportClose.addEventListener("click", () => {
    toggleModal(dom.modalBatchExport, false);
  });
  dom.btnBatchSelectAll.addEventListener("click", () => {
    const chks = dom.batchRoomsList.querySelectorAll(".batch-room-checkbox");
    chks.forEach(chk => chk.checked = true);
  });
  dom.btnBatchDeselectAll.addEventListener("click", () => {
    const chks = dom.batchRoomsList.querySelectorAll(".batch-room-checkbox");
    chks.forEach(chk => chk.checked = false);
  });
  dom.btnExecuteBatchExport.addEventListener("click", handleBatchExport);

  // Markdown Import Event Listeners (Teacher only)
  dom.btnLobbyBatchImport.addEventListener("click", () => {
    dom.lobbyBatchImportInput.click();
  });
  dom.lobbyBatchImportInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImportFile(e.target.files[0], true);
    }
  });
  dom.btnImportMd.addEventListener("click", () => {
    dom.importMdInput.click();
  });
  dom.importMdInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImportFile(e.target.files[0], false);
    }
  });

  // Root Cause Modal Listeners
  dom.modalRootCauseClose.addEventListener("click", () => {
    activeRootCauseGroupId = null;
    toggleModal(dom.modalRootCause, false);
  });
  dom.modalRootCauseOk.addEventListener("click", () => {
    activeRootCauseGroupId = null;
    toggleModal(dom.modalRootCause, false);
  });

  // Countermeasures Modal Listeners
  dom.modalCountermeasuresClose.addEventListener("click", () => {
    activeCountermeasuresGroupId = null;
    toggleModal(dom.modalCountermeasures, false);
  });
  dom.modalCountermeasuresOk.addEventListener("click", () => {
    activeCountermeasuresGroupId = null;
    toggleModal(dom.modalCountermeasures, false);
  });

  // Add Card (Student only)
  dom.btnAddCard.addEventListener("click", handleAddCard);
  dom.cardInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddCard();
    }
  });

  // Sidebar Operations (AI grouping, Custom Group, Next Round)
  dom.btnAiGroup.addEventListener("click", handleAIGrouping);
  dom.btnNewGroup.addEventListener("click", handleCreateCustomGroup);
  dom.btnAdvanceRound.addEventListener("click", handleAdvanceRound);
  dom.btnRevertRound.addEventListener("click", handleRevertRound);
  dom.btnResetRoom.addEventListener("click", handleResetRoom);

  // View Panel Tabs
  dom.viewTabBoard.addEventListener("click", () => switchView("board"));
  dom.viewTabTree.addEventListener("click", () => switchView("tree"));

  // Member Presence list dropdown toggle
  dom.btnMemberList.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.memberDropdown.classList.toggle("active");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (dom.memberPresenceContainer && !dom.memberPresenceContainer.contains(e.target)) {
      dom.memberDropdown.classList.remove("active");
    }
  });

  // Clean presence on browser close/unload
  window.addEventListener("beforeunload", () => {
    if (state.roomName && state.userNickname && !window.dbService.isOffline()) {
      window.dbService.removeMemberPresence(state.roomName, state.userNickname);
    }
  });
}

// -------------------------------------------------------------
// LOBBY CONTROLS
// -------------------------------------------------------------
function switchLobbyTab(role) {
  if (role === "student") {
    dom.tabStudent.classList.add("active");
    dom.tabTeacher.classList.remove("active");
    dom.formStudent.classList.add("active");
    dom.formTeacher.classList.remove("active");
  } else {
    dom.tabTeacher.classList.add("active");
    dom.tabStudent.classList.remove("active");
    dom.formTeacher.classList.add("active");
    dom.formStudent.classList.remove("active");
  }
}

async function handleTeacherPasswordInput() {
  const value = dom.teacherPassword.value.trim();
  if (!value) {
    dom.teacherRoomSelect.disabled = true;
    dom.teacherRoomInput.disabled = true;
    dom.btnJoinTeacher.disabled = true;
    dom.btnLobbyBatchExport.style.display = "none";
    dom.btnLobbyBatchExport.disabled = true;
    dom.btnLobbyBatchImport.style.display = "none";
    dom.btnLobbyBatchImport.disabled = true;
    return;
  }
  const hash = await computeSHA256(value.toLowerCase());
  if (hash === "1b6b228c27431948a07b78cc8e0adc0f0a22c100c826bbf2e76547dde1cff81a") {
    const wasDisabled = dom.teacherRoomSelect.disabled;
    dom.teacherRoomSelect.disabled = false;
    dom.teacherRoomInput.disabled = false;
    dom.btnJoinTeacher.disabled = false;
    dom.btnLobbyBatchExport.style.display = "block";
    dom.btnLobbyBatchExport.disabled = false;
    dom.btnLobbyBatchImport.style.display = "block";
    dom.btnLobbyBatchImport.disabled = false;
    if (wasDisabled) {
      showToast("密語驗證成功，正在讀取線上活躍房間...", "success");
      window.dbService.subscribeToActiveRooms();
    }
  } else {
    dom.teacherRoomSelect.disabled = true;
    dom.teacherRoomInput.disabled = true;
    dom.btnJoinTeacher.disabled = true;
    dom.btnLobbyBatchExport.style.display = "none";
    dom.btnLobbyBatchExport.disabled = true;
    dom.btnLobbyBatchImport.style.display = "none";
    dom.btnLobbyBatchImport.disabled = true;
  }
}

function handleStudentJoin() {
  const nickname = dom.studentName.value.trim();
  const room = dom.studentRoom.value.trim();

  if (!nickname || !room) {
    showToast("請輸入暱稱與房間名稱！", "error");
    return;
  }

  state.userRole = "student";
  state.userNickname = nickname;
  state.roomName = room;

  enterApp();
}

async function handleTeacherJoin() {
  const value = dom.teacherPassword.value.trim();
  const hash = await computeSHA256(value.toLowerCase());
  if (hash !== "1b6b228c27431948a07b78cc8e0adc0f0a22c100c826bbf2e76547dde1cff81a") {
    showToast("講師專屬安全密語不正確！", "error");
    dom.teacherPassword.focus();
    return;
  }

  const manualRoom = dom.teacherRoomInput.value.trim();
  const selectedRoom = dom.teacherRoomSelect.value;
  const roomToJoin = manualRoom || selectedRoom;

  if (!roomToJoin) {
    showToast("請選擇或手動輸入一個房間進行巡房！", "error");
    return;
  }

  state.userRole = "teacher";
  state.userNickname = "講師";
  state.roomName = roomToJoin;

  enterApp();
}

function enterApp() {
  dom.userDisplayName.textContent = `${state.userRole === "student" ? "學員" : "講師"}: ${state.userNickname}`;
  if (state.userRole === "teacher") {
    dom.userDisplayName.classList.add("teacher");
    dom.teacherNav.classList.add("active");
    dom.cardCreatorSection.style.display = "none";
    dom.studentActions.style.display = "none";
    dom.teacherActions.style.display = "flex";
    dom.btnHeaderBatchExport.style.display = "inline-flex";
  } else {
    dom.userDisplayName.classList.remove("teacher");
    dom.teacherNav.classList.remove("active");
    dom.cardCreatorSection.style.display = "block";
    dom.studentActions.style.display = "flex";
    dom.teacherActions.style.display = "none";
    dom.btnHeaderBatchExport.style.display = "none";
  }

  dom.displayRoomName.textContent = state.roomName;
  resetSidebarState();
  
  dom.lobbyScreen.style.display = "none";
  dom.appScreen.classList.add("active");

  // Show presence container
  dom.memberPresenceContainer.style.display = "inline-block";
  dom.memberDropdown.classList.remove("active");

  // Setup presence heartbeat
  if (state.presenceIntervalId) {
    clearInterval(state.presenceIntervalId);
    state.presenceIntervalId = null;
  }
  if (state.roomName && state.userNickname && !window.dbService.isOffline()) {
    window.dbService.updateMemberPresence(state.roomName, state.userNickname);
  }
  state.presenceIntervalId = setInterval(() => {
    if (state.roomName && state.userNickname && !window.dbService.isOffline()) {
      window.dbService.updateMemberPresence(state.roomName, state.userNickname);
    }
  }, 30000);

  const encodedRoom = encodeRoomName(state.roomName);
  const newUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(encodedRoom)}`;
  window.history.replaceState({ path: newUrl }, "", newUrl);

  window.dbService.subscribeToRoom(state.roomName);
  
  showToast(`已登入房間：${state.roomName}`, "success");
}

async function switchRoom(newRoomName) {
  // Clean up presence in old room
  if (state.roomName && state.userNickname && !window.dbService.isOffline()) {
    await window.dbService.removeMemberPresence(state.roomName, state.userNickname);
  }

  state.roomName = newRoomName;
  dom.displayRoomName.textContent = newRoomName;
  resetSidebarState();
  
  // Hide dropdown
  dom.memberDropdown.classList.remove("active");

  // Setup presence heartbeat for new room
  if (state.presenceIntervalId) {
    clearInterval(state.presenceIntervalId);
    state.presenceIntervalId = null;
  }
  if (state.roomName && state.userNickname && !window.dbService.isOffline()) {
    window.dbService.updateMemberPresence(state.roomName, state.userNickname);
  }
  state.presenceIntervalId = setInterval(() => {
    if (state.roomName && state.userNickname && !window.dbService.isOffline()) {
      window.dbService.updateMemberPresence(state.roomName, state.userNickname);
    }
  }, 30000);

  window.dbService.subscribeToRoom(newRoomName);
  
  const encodedRoom = encodeRoomName(newRoomName);
  const newUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(encodedRoom)}`;
  window.history.pushState({ path: newUrl }, "", newUrl);

  showToast(`已切換至房間：${newRoomName}`, "success");
}

async function handleLogout() {
  // Clean up presence in old room
  if (state.roomName && state.userNickname && !window.dbService.isOffline()) {
    try {
      await window.dbService.removeMemberPresence(state.roomName, state.userNickname);
    } catch (e) {
      console.error("Presence cleanup on logout failed:", e);
    }
  }

  // Clear presence heartbeat
  if (state.presenceIntervalId) {
    clearInterval(state.presenceIntervalId);
    state.presenceIntervalId = null;
  }

  // Hide presence UI
  dom.memberPresenceContainer.style.display = "none";
  dom.memberDropdown.classList.remove("active");

  window.dbService.unsubscribeFromFirebase();
  resetSidebarState();
  
  state.userRole = null;
  state.userNickname = "";
  state.roomName = "";
  state.cards = [];
  state.groups = [];

  dom.studentName.value = "";
  dom.teacherPassword.value = "";
  dom.teacherRoomSelect.disabled = true;
  dom.teacherRoomInput.value = "";
  dom.teacherRoomInput.disabled = true;
  dom.btnJoinTeacher.disabled = true;
  dom.btnLobbyBatchExport.style.display = "none";
  dom.btnLobbyBatchExport.disabled = true;
  dom.btnLobbyBatchImport.style.display = "none";
  dom.btnLobbyBatchImport.disabled = true;
  dom.btnHeaderBatchExport.style.display = "none";
  
  dom.appScreen.classList.remove("active");
  dom.lobbyScreen.style.display = "flex";

  showToast("已成功登出", "success");
}

// -------------------------------------------------------------
// CONNECTION STATUS
// -------------------------------------------------------------
function onConnectionStateChange(isOffline) {
  state.offline = isOffline;
  if (isOffline) {
    dom.connectionIndicator.className = "connection-badge offline";
    dom.connectionStatusText.textContent = "連線配置未完成";
    dom.connectionIndicator.title = "未正確連接至 Firebase Firestore 雲端資料庫！";
  } else {
    dom.connectionIndicator.className = "connection-badge online";
    dom.connectionStatusText.textContent = "雲端即時連線";
    dom.connectionIndicator.title = "已成功連線至 Firebase Firestore 雲端資料庫";
  }
}

function toggleModal(modalEl, show) {
  if (show) {
    modalEl.classList.add("active");
  } else {
    modalEl.classList.remove("active");
  }
}

// -------------------------------------------------------------
// REAL-TIME DATA UPDATE CALLBACKS
// -------------------------------------------------------------
function onRoomStateUpdate(roomState) {
  state.currentRound = roomState.round || 0;
  state.cards = roomState.cards || [];
  state.groups = roomState.groups || [];
  state.rootCauses = roomState.rootCauses || [];
  state.countermeasures = roomState.countermeasures || [];

  dom.displayRoundNum.textContent = `第 ${state.currentRound + 1} 輪`;
  
  if (state.currentRound === 0) {
    dom.roundDesc.textContent = "第一階段：收集卡片與基本親和分組。可以拖曳卡片或點擊 AI 一鍵歸類。";
  } else {
    dom.roundDesc.textContent = `第 ${state.currentRound + 1} 階段：將前一輪的分類標籤當作「高階卡片」，進行更高層次的抽象收斂归類。`;
  }

  if (state.userRole === "student" && state.currentRound > 0) {
    dom.btnRevertRound.style.display = "block";
  } else {
    dom.btnRevertRound.style.display = "none";
  }

  updateHeaderRoomDropdown();
  renderCurrentView();

  // Render online presence list
  renderMemberPresence(roomState.members);

  if (activeRootCauseGroupId) {
    renderRootCauseTree(activeRootCauseGroupId);
  }
  if (activeCountermeasuresGroupId) {
    renderCountermeasuresTree(activeCountermeasuresGroupId);
  }
}

function renderMemberPresence(members) {
  if (!members) members = {};
  const now = Date.now();
  const activeMembers = Object.keys(members).filter(name => {
    const timestamp = members[name];
    return (now - timestamp) < 90000;
  });

  // Sort names: "講師" first, then alphabetically
  activeMembers.sort((a, b) => {
    if (a === "講師") return -1;
    if (b === "講師") return 1;
    return a.localeCompare(b, "zh-TW");
  });

  dom.memberCount.textContent = activeMembers.length;
  dom.memberUl.innerHTML = "";

  if (activeMembers.length === 0) {
    const li = document.createElement("li");
    li.className = "member-item";
    li.style.color = "var(--text-muted)";
    li.style.justifyContent = "center";
    li.textContent = "目前無人在線";
    dom.memberUl.appendChild(li);
    return;
  }

  activeMembers.forEach(name => {
    const li = document.createElement("li");
    li.className = "member-item";
    if (name === "講師") {
      li.classList.add("teacher");
    }

    const dot = document.createElement("span");
    dot.className = "member-status-dot";

    const nameSpan = document.createElement("span");
    nameSpan.className = "member-item-name";
    nameSpan.textContent = name;

    const roleSpan = document.createElement("span");
    roleSpan.className = "member-item-role";
    roleSpan.textContent = name === "講師" ? "講師" : "學員";

    li.appendChild(dot);
    li.appendChild(nameSpan);
    li.appendChild(roleSpan);
    dom.memberUl.appendChild(li);
  });
}

function onRoomsListUpdate(roomsList) {
  state.activeRooms = roomsList;

  const lobbySelect = dom.teacherRoomSelect;
  lobbySelect.innerHTML = "";
  
  if (roomsList.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "目前無活躍房間";
    lobbySelect.appendChild(opt);
  } else {
    roomsList.forEach(room => {
      const opt = document.createElement("option");
      opt.value = room;
      opt.textContent = room;
      lobbySelect.appendChild(opt);
    });
  }

  updateHeaderRoomDropdown();
}

function updateHeaderRoomDropdown() {
  if (state.userRole !== "teacher") return;

  const headerSelect = dom.headerRoomSelect;
  headerSelect.innerHTML = "";

  state.activeRooms.forEach(room => {
    const opt = document.createElement("option");
    opt.value = room;
    opt.textContent = room;
    if (room === state.roomName) {
      opt.selected = true;
    }
    headerSelect.appendChild(opt);
  });

  if (state.roomName && !state.activeRooms.includes(state.roomName)) {
    const opt = document.createElement("option");
    opt.value = state.roomName;
    opt.textContent = state.roomName;
    opt.selected = true;
    headerSelect.appendChild(opt);
  }
}

// -------------------------------------------------------------
// RENDERERS (BOARD VIEW & TREE VIEW)
// -------------------------------------------------------------
function renderCurrentView() {
  if (state.activeView === "board") {
    renderBoardView();
  } else {
    renderTreeView();
  }
}

function switchView(viewName) {
  state.activeView = viewName;
  if (viewName === "board") {
    dom.viewTabBoard.classList.add("active");
    dom.viewTabTree.classList.remove("active");
    dom.panelBoard.classList.add("active");
    dom.panelTree.classList.remove("active");
  } else {
    dom.viewTabTree.classList.add("active");
    dom.viewTabBoard.classList.remove("active");
    dom.panelTree.classList.add("active");
    dom.panelBoard.classList.remove("active");
  }
  renderCurrentView();
}

// 1. BOARD VIEW RENDERER
function renderBoardView() {
  const canvas = dom.boardCanvas;
  canvas.innerHTML = "";

  const currentRoundCards = state.cards.filter(c => c.round === state.currentRound);
  const currentRoundGroups = state.groups.filter(g => g.round === state.currentRound);

  // Independent Cards Column
  const independentCards = currentRoundCards.filter(c => c.groupId === null);

  const indColumn = document.createElement("div");
  indColumn.className = "board-column independent";
  indColumn.setAttribute("data-group-id", "independent");
  
  indColumn.innerHTML = `
    <div class="column-header">
      <div class="column-title-container">
        <span class="column-title">📌 獨立卡片區</span>
        <span class="column-badge">${independentCards.length}</span>
      </div>
    </div>
    <div class="column-cards" id="cards-container-independent"></div>
  `;
  canvas.appendChild(indColumn);

  const indCardsContainer = indColumn.querySelector("#cards-container-independent");
  independentCards.forEach(card => {
    indCardsContainer.appendChild(createCardDOM(card));
  });

  // Render Group Columns
  currentRoundGroups.forEach(group => {
    const groupCards = currentRoundCards.filter(c => c.groupId === group.id);
    const grpColumn = document.createElement("div");
    grpColumn.className = "board-column";
    grpColumn.setAttribute("data-group-id", group.id);
    
    const actionsHtml = `
      <div class="column-actions">
        <button class="column-btn root-cause-btn" title="根因分析" style="color: var(--primary);"><i class="fa-solid fa-network-wired"></i></button>
        <button class="column-btn countermeasure-btn" title="對策規劃" style="color: var(--success);"><i class="fa-solid fa-lightbulb"></i></button>
        ${state.userRole === "student" ? `
          <button class="column-btn edit-group-btn" title="修改名稱"><i class="fa-solid fa-pen"></i></button>
          <button class="column-btn delete delete-group-btn" title="解散群組"><i class="fa-solid fa-trash-can"></i></button>
        ` : ''}
      </div>
    `;

    grpColumn.innerHTML = `
      <div class="column-header">
        <div class="column-title-container">
          <span class="column-title" id="title-text-${group.id}">${escapeHtml(group.name)}</span>
          <span class="column-badge">${groupCards.length}</span>
        </div>
        ${actionsHtml}
      </div>
      <div class="column-cards" id="cards-container-${group.id}"></div>
    `;
    canvas.appendChild(grpColumn);

    const rcBtn = grpColumn.querySelector(".root-cause-btn");
    if (rcBtn) {
      rcBtn.addEventListener("click", () => {
        activeRootCauseGroupId = group.id;
        dom.rootCauseGroupName.textContent = group.name;
        renderRootCauseTree(group.id);
        toggleModal(dom.modalRootCause, true);
      });
    }

    const cmBtn = grpColumn.querySelector(".countermeasure-btn");
    if (cmBtn) {
      cmBtn.addEventListener("click", () => {
        activeCountermeasuresGroupId = group.id;
        dom.countermeasuresGroupName.textContent = group.name;
        renderCountermeasuresTree(group.id);
        toggleModal(dom.modalCountermeasures, true);
      });
    }

    const grpCardsContainer = grpColumn.querySelector(`#cards-container-${group.id}`);
    groupCards.forEach(card => {
      grpCardsContainer.appendChild(createCardDOM(card));
    });

    if (state.userRole === "student") {
      const editBtn = grpColumn.querySelector(".edit-group-btn");
      const titleSpan = grpColumn.querySelector(`#title-text-${group.id}`);
      
      const triggerEdit = () => {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "inline-edit-input";
        input.value = group.name;
        
        titleSpan.replaceWith(input);
        input.focus();
        input.select();

        let finished = false;
        const saveEdit = () => {
          if (finished) return;
          finished = true;
          const newName = input.value.trim();
          if (newName && newName !== group.name) {
            group.name = newName;
            window.dbService.updateRoomState(state.roomName, { groups: state.groups });
            showToast(`已重新命名群組為：${newName}`, "success");
          } else {
            renderBoardView();
          }
        };

        input.addEventListener("blur", saveEdit);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") saveEdit();
          if (e.key === "Escape") {
            finished = true;
            renderBoardView();
          }
        });
      };

      editBtn.addEventListener("click", triggerEdit);
      titleSpan.addEventListener("dblclick", triggerEdit);

      const deleteBtn = grpColumn.querySelector(".delete-group-btn");
      deleteBtn.addEventListener("click", () => {
        if (confirm(`確定要解散群組「${group.name}」嗎？裡面的卡片將會退回獨立卡片區。`)) {
          state.cards.forEach(c => {
            if (c.groupId === group.id && c.round === state.currentRound) {
              c.groupId = null;
            }
          });
          state.groups = state.groups.filter(g => g.id !== group.id);
          state.rootCauses = (state.rootCauses || []).filter(rc => rc.groupId !== group.id);
          state.countermeasures = (state.countermeasures || []).filter(cm => cm.groupId !== group.id);
          window.dbService.updateRoomState(state.roomName, {
            cards: state.cards,
            groups: state.groups,
            rootCauses: state.rootCauses,
            countermeasures: state.countermeasures
          });
          showToast(`已解散群組「${group.name}」`, "success");
        }
      });
    }
  });

  setupDragAndDrop();
}

function createCardDOM(card) {
  const cardDiv = document.createElement("div");
  cardDiv.className = `kj-card${card.sourceGroupId ? " high-level" : ""}`;
  cardDiv.id = `card-${card.id}`;
  
  if (state.userRole === "student") {
    cardDiv.setAttribute("draggable", "true");
  }

  let badgeHtml = "";
  if (card.sourceGroupId) {
    badgeHtml = `<span class="kj-card-badge">第 ${card.round} 輪群組</span>`;
  } else if (card.round > 0) {
    badgeHtml = `<span class="kj-card-badge" style="background:#f1f5f9; color:var(--text-secondary);">繼承</span>`;
  }

  let actionsHtml = "";
  if (state.userRole === "student") {
    actionsHtml = `
      <div class="kj-card-actions">
        <button class="card-action-btn edit-card-btn" title="修改"><i class="fa-solid fa-pen"></i></button>
        <button class="card-action-btn delete-card-btn" title="刪除"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
  }

  cardDiv.innerHTML = `
    ${actionsHtml}
    <div class="kj-card-text">${escapeHtml(card.text)}</div>
    <div class="kj-card-footer">
      <span class="kj-card-author"><i class="fa-regular fa-user"></i> ${escapeHtml(card.author)}</span>
      ${badgeHtml}
    </div>
  `;

  if (state.userRole === "student") {
    const editBtn = cardDiv.querySelector(".edit-card-btn");
    const deleteBtn = cardDiv.querySelector(".delete-card-btn");
    const textDiv = cardDiv.querySelector(".kj-card-text");

    const triggerEdit = () => {
      cardDiv.setAttribute("draggable", "false");
      
      const textarea = document.createElement("textarea");
      textarea.className = "inline-edit-textarea";
      textarea.value = card.text;
      
      textDiv.replaceWith(textarea);
      textarea.focus();
      textarea.select();

      let finished = false;
      const saveEdit = () => {
        if (finished) return;
        finished = true;
        const newText = textarea.value.trim();
        if (newText && newText !== card.text) {
          card.text = newText;
          window.dbService.updateRoomState(state.roomName, { cards: state.cards });
          showToast("已更新卡片內容", "success");
        } else {
          renderBoardView();
        }
      };

      const cancelEdit = () => {
        if (finished) return;
        finished = true;
        renderBoardView();
      };

      textarea.addEventListener("blur", saveEdit);
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          saveEdit();
        }
        if (e.key === "Escape") {
          cancelEdit();
        }
      });
    };

    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerEdit();
      });
    }

    if (textDiv) {
      textDiv.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        triggerEdit();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("確定要刪除這張卡片嗎？此操作無法復原。")) {
          state.cards = state.cards.filter(c => c.id !== card.id);
          window.dbService.updateRoomState(state.roomName, { cards: state.cards });
          showToast("已刪除卡片", "success");
        }
      });
    }
  }

  return cardDiv;
}

function setupDragAndDrop() {
  if (state.userRole !== "student") return;

  const dragCards = document.querySelectorAll(".kj-card");
  const columns = document.querySelectorAll(".board-column");

  dragCards.forEach(card => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.id.replace("card-", ""));
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
  });

  columns.forEach(col => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });

    col.addEventListener("dragleave", () => {
      col.classList.remove("drag-over");
    });

    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      
      const cardId = e.dataTransfer.getData("text/plain");
      const targetGroupId = col.getAttribute("data-group-id");
      const groupId = targetGroupId === "independent" ? null : targetGroupId;

      const targetCard = state.cards.find(c => c.id === cardId);
      
      if (targetCard && targetCard.groupId !== groupId) {
        targetCard.groupId = groupId;
        window.dbService.updateRoomState(state.roomName, { cards: state.cards });
      }
    });
  });
}

// 2. TREE VIEW RENDERER
function renderTreeView() {
  const canvas = dom.treeCanvas;
  canvas.innerHTML = "";

  if (state.cards.length === 0) {
    canvas.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-sitemap"></i></div>
        <h4>目前無任何卡片與分組資料</h4>
        <p>請先切換至 Board 檢視並新增卡片，或是進行分組歸類。</p>
      </div>
    `;
    return;
  }

  const headerInfo = document.createElement("div");
  headerInfo.className = "tree-header-info";
  headerInfo.innerHTML = `
    <h3><i class="fa-solid fa-timeline"></i> 階層歸類溯源樹狀圖</h3>
    <p>顯示最高層次的概念分類。您可以展開每個資料夾，追溯至當初提出該點子的原始團隊成員。</p>
  `;
  canvas.appendChild(headerInfo);

  const treeRoot = document.createElement("div");
  treeRoot.className = "tree-root";
  canvas.appendChild(treeRoot);

  let maxRound = 0;
  state.cards.forEach(c => {
    if (c.round > maxRound) maxRound = c.round;
  });

  const rootRoundCards = state.cards.filter(c => c.round === maxRound);
  const rootRoundGroups = state.groups.filter(g => g.round === maxRound);

  const rootIndependent = rootRoundCards.filter(c => c.groupId === null);
  rootIndependent.forEach(card => {
    treeRoot.appendChild(buildTreeCardNode(card, maxRound));
  });

  rootRoundGroups.forEach(group => {
    const groupCards = rootRoundCards.filter(c => c.groupId === group.id);
    treeRoot.appendChild(buildTreeGroupNode(group, groupCards, maxRound));
  });
}

function buildTreeGroupNode(group, childrenCards, round) {
  const groupNode = document.createElement("div");
  groupNode.className = "tree-node";

  const groupItem = document.createElement("div");
  groupItem.className = "tree-item group-node";
  groupItem.innerHTML = `
    <div class="tree-item-left">
      <span class="tree-toggle-icon"><i class="fa-solid fa-chevron-right"></i></span>
      <span class="tree-item-label"><i class="fa-regular fa-folder-open" style="color:var(--primary); margin-right:4px;"></i> ${escapeHtml(group.name)}</span>
    </div>
    <div class="tree-item-meta">
      <span class="tree-item-author"><i class="fa-solid fa-layer-group"></i> 第 ${round + 1} 輪群組</span>
      <span style="font-weight:600;">(${childrenCards.length} 卡)</span>
    </div>
  `;
  groupNode.appendChild(groupItem);

  const childrenContainer = document.createElement("div");
  childrenContainer.className = "tree-children";
  groupNode.appendChild(childrenContainer);

  childrenCards.forEach(card => {
    childrenContainer.appendChild(buildTreeCardNode(card, round));
  });

  groupItem.addEventListener("click", (e) => {
    e.stopPropagation();
    const arrow = groupItem.querySelector(".tree-toggle-icon");
    arrow.classList.toggle("open");
    childrenContainer.classList.toggle("open");
  });

  return groupNode;
}

function buildTreeCardNode(card, round) {
  const cardNode = document.createElement("div");
  cardNode.className = "tree-node";

  if (card.sourceGroupId) {
    const prevGroup = state.groups.find(g => g.id === card.sourceGroupId);
    if (prevGroup) {
      const prevRoundCards = state.cards.filter(c => c.round === (round - 1) && c.groupId === prevGroup.id);
      return buildTreeGroupNode(prevGroup, prevRoundCards, round - 1);
    }
  }

  if (card.sourceCardId) {
    const prevCard = state.cards.find(c => c.id === card.sourceCardId);
    if (prevCard) {
      return buildTreeCardNode(prevCard, round - 1);
    }
  }

  const cardItem = document.createElement("div");
  cardItem.className = "tree-item";
  cardItem.style.cursor = "default";
  cardItem.innerHTML = `
    <div class="tree-item-left" style="font-weight:400; color:var(--text-secondary);">
      <span class="tree-item-label"><i class="fa-regular fa-note-sticky" style="color:var(--text-muted); margin-right:4px;"></i> ${escapeHtml(card.text)}</span>
    </div>
    <div class="tree-item-meta">
      <span class="tree-item-author"><i class="fa-regular fa-user"></i> ${escapeHtml(card.author)}</span>
    </div>
  `;
  cardNode.appendChild(cardItem);

  return cardNode;
}

// -------------------------------------------------------------
// CORE BRAINSTORMING ACTIONS (STUDENTS)
// -------------------------------------------------------------
function handleAddCard() {
  if (state.userRole !== "student") return;

  const text = dom.cardInput.value.trim();
  if (!text) return;

  const newCard = {
    id: generateUUID(),
    text: text,
    author: state.userNickname,
    round: state.currentRound,
    groupId: null,
    sourceGroupId: null,
    sourceCardId: null
  };

  state.cards.push(newCard);
  window.dbService.updateRoomState(state.roomName, { cards: state.cards });
  
  dom.cardInput.value = "";
  dom.cardInput.focus();
  showToast("成功建立點子卡片！", "success");
}

function handleCreateCustomGroup() {
  if (state.userRole !== "student") return;

  const name = prompt("請輸入自訂群組名稱：");
  if (!name || !name.trim()) return;

  const newGroup = {
    id: generateUUID(),
    name: name.trim(),
    round: state.currentRound
  };

  state.groups.push(newGroup);
  window.dbService.updateRoomState(state.roomName, { groups: state.groups });
  showToast(`已建立群組「${newGroup.name}」`, "success");
}

async function handleAIGrouping() {
  if (state.userRole !== "student") return;

  const currentRoundCards = state.cards.filter(c => c.round === state.currentRound);
  if (currentRoundCards.length < 3) {
    showToast("目前輪次的卡片數量不足 3 張，無法觸發 AI 歸類！", "error");
    return;
  }

  dom.btnAiGroup.disabled = true;
  dom.btnAiGroup.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 正在親和歸類中...';

  try {
    const result = await window.geminiService.classifyCards(currentRoundCards);
    
    state.groups = state.groups.filter(g => g.round !== state.currentRound);
    state.cards.forEach(c => {
      if (c.round === state.currentRound) {
        c.groupId = null;
      }
    });

    result.groups.forEach(aiGrp => {
      const newGroupId = generateUUID();
      state.groups.push({
        id: newGroupId,
        name: aiGrp.name,
        round: state.currentRound
      });

      aiGrp.cardIds.forEach(cardId => {
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
          card.groupId = newGroupId;
        }
      });
    });

    result.independentCardIds.forEach(cardId => {
      const card = state.cards.find(c => c.id === cardId);
      if (card) {
        card.groupId = null;
      }
    });

    await window.dbService.updateRoomState(state.roomName, {
      cards: state.cards,
      groups: state.groups
    });

    showToast("AI 歸類完成！", "success");

  } catch (error) {
    console.error("AI Grouping Error:", error);
    
    if (error.message === "API_KEY_MISSING") {
      showToast("系統未配置 Gemini API 金鑰，請點擊右上角「設定」按鈕進行配置！", "error");
    } else if (error.message === "API_KEY_INVALID") {
      showToast("Gemini API 金鑰驗證無效，請點擊設定重新檢查金鑰！", "error");
    } else if (error.message === "API_KEY_LEAKED") {
      showToast("您的 Gemini API 金鑰已被 Google 系統判定洩漏並禁用，請點擊設定更換金鑰！", "error");
    } else {
      showToast("呼叫 Gemini AI 進行親和歸類失敗，請稍候重試！", "error");
    }
  } finally {
    dom.btnAiGroup.disabled = false;
    dom.btnAiGroup.innerHTML = '<i class="fa-solid fa-brain"></i> 一鍵 AI 親和歸類';
  }
}

function handleAdvanceRound() {
  if (state.userRole !== "student") return;

  const currentRoundGroups = state.groups.filter(g => g.round === state.currentRound);
  if (currentRoundGroups.length === 0) {
    showToast("目前輪次未進行任何群組分類，無法晉級下一輪！", "error");
    return;
  }

  if (confirm("晉級後，當前的「群組標籤」會升格為新一輪的「高階卡片」，獨立卡片也會一同帶入。確定要晉級下一輪嗎？")) {
    const nextRound = state.currentRound + 1;
    const currentRoundCards = state.cards.filter(c => c.round === state.currentRound);

    currentRoundGroups.forEach(g => {
      state.cards.push({
        id: generateUUID(),
        text: g.name,
        author: "上一輪群組",
        round: nextRound,
        groupId: null,
        sourceGroupId: g.id,
        sourceCardId: null
      });
    });

    const independentCards = currentRoundCards.filter(c => c.groupId === null);
    independentCards.forEach(c => {
      state.cards.push({
        id: generateUUID(),
        text: c.text,
        author: c.author,
        round: nextRound,
        groupId: null,
        sourceGroupId: null,
        sourceCardId: c.id
      });
    });

    state.currentRound = nextRound;
    window.dbService.updateRoomState(state.roomName, {
      round: nextRound,
      cards: state.cards
    });

    showToast(`成功晉級至第 ${nextRound + 1} 輪！`, "success");
  }
}

function handleRevertRound() {
  if (state.userRole !== "student") return;
  if (state.currentRound <= 0) return;

  const confirmMsg = "⚠️ 確定要退回到上一輪嗎？\n這將會：\n1. 刪除目前輪次（第 " + (state.currentRound + 1) + " 輪）的所有卡片與分組資料。\n2. 退回至上一輪（第 " + state.currentRound + " 輪），且將上一輪的所有群組解散（恢復為未分群狀態），以便您重新進行分組。\n\n確定要執行此操作嗎？";
  
  if (confirm(confirmMsg)) {
    const prevRound = state.currentRound - 1;

    // 1. Remove all cards and groups of currentRound
    state.cards = state.cards.filter(c => c.round <= prevRound);
    state.groups = state.groups.filter(g => g.round <= prevRound);

    // 2. For the prevRound cards, dissolve all groups
    state.cards.forEach(c => {
      if (c.round === prevRound) {
        c.groupId = null;
      }
    });

    // 3. Remove all groups in prevRound
    state.groups = state.groups.filter(g => g.round !== prevRound);

    state.currentRound = prevRound;

    window.dbService.updateRoomState(state.roomName, {
      round: prevRound,
      cards: state.cards,
      groups: state.groups
    });

    showToast(`已退回到第 ${prevRound + 1} 輪，並解散了該輪的分群，您可以重新分組！`, "success");
  }
}

// -------------------------------------------------------------
// TEACHER ACTIONS
// -------------------------------------------------------------
function handleResetRoom() {
  if (state.userRole !== "teacher") return;

  if (confirm("⚠️ 【危險操作警告】\n確定要重置此房間嗎？這將會清空該房間所有輪次的卡片、群組標籤與所有歷史數據且無法復原！")) {
    window.dbService.resetRoom(state.roomName).then(() => {
      showToast("此房間的數據已完全重置", "success");
    });
  }
}

// -------------------------------------------------------------
// BATCH / SINGLE MARKDOWN IMPORT
// -------------------------------------------------------------
function parseSingleRoomMarkdown(roomName, mdText) {
  const lines = mdText.split("\n");
  const rootNodes = [];
  const stack = [];
  let maxRound = 0;
  
  let activeCard = null;
  
  function closeActiveCard() {
    if (!activeCard) return;
    const fullText = activeCard.lines.join("\n").trim();
    const authorMatch = fullText.match(/\(由\s*\[(.*?)\]\s*提出\)\s*$/);
    let author = "未知";
    let text = fullText;
    if (authorMatch) {
      author = authorMatch[1].trim();
      text = fullText.replace(/\(由\s*\[(.*?)\]\s*提出\)\s*$/, "").trim();
    }
    
    const node = {
      type: "card",
      text: text,
      author: author,
      indent: activeCard.indent
    };
    
    while (stack.length > 0 && stack[stack.length - 1].indent >= activeCard.indent) {
      stack.pop();
    }
    
    if (stack.length > 0) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      rootNodes.push(node);
    }
    
    stack.push({ indent: activeCard.indent, node: node });
    activeCard = null;
  }
  
  for (let line of lines) {
    line = line.replace(/\r/g, "");
    
    // Parse round number from header if present
    const roundMatch = line.match(/(?:總收斂輪次|當前輪次)：共\s*(\d+)\s*輪/);
    if (roundMatch) {
      const parsedRound = parseInt(roundMatch[1], 10) - 1;
      if (parsedRound > maxRound) {
        maxRound = parsedRound;
      }
    }
    
    // Pattern for groups
    const groupMatch = line.match(/^(\s*)-\s*###\s*🗂\ufe0f?\s+(.*?)\s*\(第\s*(\d+)\s*輪群組分類\)/);
    // Pattern for card start line
    const cardStartMatch = line.match(/^(\s*)-\s*📝\ufe0f?\s+(.*)/);
    
    if (groupMatch) {
      closeActiveCard();
      const indent = groupMatch[1].length;
      const name = groupMatch[2].trim();
      const roundNum = parseInt(groupMatch[3], 10);
      const node = {
        type: "group",
        name: name,
        roundNum: roundNum,
        indent: indent,
        children: []
      };
      
      if (roundNum - 1 > maxRound) {
        maxRound = roundNum - 1;
      }
      
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(node);
      } else {
        rootNodes.push(node);
      }
      
      stack.push({ indent: indent, node: node });
    } else if (cardStartMatch) {
      closeActiveCard();
      activeCard = {
        indent: cardStartMatch[1].length,
        lines: [cardStartMatch[2]]
      };
    } else {
      if (activeCard) {
        activeCard.lines.push(line);
      }
    }
  }
  
  closeActiveCard();
  
  const cardsList = [];
  const groupsList = [];
  
  function reconstructNode(node, targetRound, parentGroupId = null) {
    if (node.type === "card") {
      let prevCardId = null;
      for (let r = 0; r <= targetRound; r++) {
        const cardId = generateUUID();
        cardsList.push({
          id: cardId,
          text: node.text,
          author: node.author,
          round: r,
          groupId: (r === targetRound) ? parentGroupId : null,
          sourceGroupId: null,
          sourceCardId: prevCardId
        });
        prevCardId = cardId;
      }
    } else if (node.type === "group") {
      const G = node.roundNum - 1;
      const groupId = generateUUID();
      groupsList.push({
        id: groupId,
        name: node.name,
        round: G
      });
      
      node.children.forEach(child => {
        reconstructNode(child, G, groupId);
      });
      
      let prevCardId = null;
      for (let r = G + 1; r <= targetRound; r++) {
        const cardId = generateUUID();
        cardsList.push({
          id: cardId,
          text: node.name,
          author: "上一輪群組",
          round: r,
          groupId: (r === targetRound) ? parentGroupId : null,
          sourceGroupId: (r === G + 1) ? groupId : null,
          sourceCardId: (r > G + 1) ? prevCardId : null
        });
        prevCardId = cardId;
      }
    }
  }
  
  rootNodes.forEach(node => {
    reconstructNode(node, maxRound, null);
  });
  
  return {
    round: maxRound,
    cards: cardsList,
    groups: groupsList
  };
}

async function handleImportFile(file, isLobbyImport) {
  if (state.userRole !== "teacher" && !isLobbyImport) {
    if (state.userRole !== "teacher") return;
  }
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    
    // Check if it's a batch report or single report
    const isBatchReport = text.includes("========================================================================");
    
    if (isBatchReport) {
      const sections = text.split("========================================================================");
      const roomsToImport = [];
      
      for (let section of sections) {
        const lines = section.split("\n");
        let roomName = null;
        for (let line of lines) {
          const roomMatch = line.match(/^#\s*(?:小組)?房間：(.*?)$/);
          if (roomMatch) {
            roomName = roomMatch[1].trim();
            break;
          }
        }
        
        if (roomName) {
          const isEmpty = section.includes("（該房間目前無卡片資料或未初始化）");
          roomsToImport.push({
            name: roomName,
            content: section,
            isEmpty: isEmpty
          });
        }
      }
      
      if (roomsToImport.length === 0) {
        showToast("未能在此檔案中識別出任何小組房間！", "error");
        return;
      }
      
      const confirmMsg = `偵測到共 ${roomsToImport.length} 個小組房間：\n` + 
        roomsToImport.map(r => ` - ${r.name}`).join("\n") + 
        `\n\n確定要將這些小組的成果匯入嗎？這將會覆蓋這些小組原有的所有資料！`;
        
      if (confirm(confirmMsg)) {
        showToast("正在批次寫入資料庫...", "info");
        try {
          for (let room of roomsToImport) {
            if (room.isEmpty) {
              await window.dbService.resetRoom(room.name);
            } else {
              const stateData = parseSingleRoomMarkdown(room.name, room.content);
              await window.dbService.updateRoomState(room.name, {
                roomName: room.name,
                round: stateData.round,
                cards: stateData.cards,
                groups: stateData.groups,
                rootCauses: [],
                countermeasures: []
              });
            }
          }
          showToast(`已成功批次匯入 ${roomsToImport.length} 個房間的成果！`, "success");
          
          // Clear file inputs
          dom.lobbyBatchImportInput.value = "";
          dom.importMdInput.value = "";
        } catch (err) {
          console.error("Batch import failed:", err);
          showToast("批次匯入過程中發生錯誤，請重試！", "error");
        }
      } else {
        dom.lobbyBatchImportInput.value = "";
        dom.importMdInput.value = "";
      }
    } else {
      // Single room report
      let roomName = null;
      const lines = text.split("\n");
      for (let line of lines) {
        const roomMatch = line.match(/^#\s*KJ\s+親和圖收斂報告\s+—\s+房間：(.*?)$/);
        if (roomMatch) {
          roomName = roomMatch[1].trim();
          break;
        }
      }
      
      // If we are importing inside a room, use that room name
      if (!isLobbyImport && state.roomName) {
        roomName = state.roomName;
      }
      
      if (!roomName) {
        const inputName = prompt("此檔案未包含房間名稱資訊，請輸入要匯入的房間名稱：");
        if (inputName && inputName.trim()) {
          roomName = inputName.trim();
        } else {
          showToast("取消匯入", "warning");
          dom.lobbyBatchImportInput.value = "";
          dom.importMdInput.value = "";
          return;
        }
      }
      
      if (confirm(`確定要將此成果匯入房間「${roomName}」嗎？這將會覆蓋該房間現有的所有資料！`)) {
        try {
          const stateData = parseSingleRoomMarkdown(roomName, text);
          await window.dbService.updateRoomState(roomName, {
            roomName: roomName,
            round: stateData.round,
            cards: stateData.cards,
            groups: stateData.groups,
            rootCauses: [],
            countermeasures: []
          });
          showToast(`已成功匯入房間「${roomName}」的成果！`, "success");
          
          // Clear file inputs
          dom.lobbyBatchImportInput.value = "";
          dom.importMdInput.value = "";
        } catch (err) {
          console.error("Single import failed:", err);
          showToast("匯入失敗，請檢查檔案格式！", "error");
        }
      } else {
        dom.lobbyBatchImportInput.value = "";
        dom.importMdInput.value = "";
      }
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// SHARE LINK
// -------------------------------------------------------------
function handleShareLink() {
  if (!state.roomName) return;

  const encodedRoom = encodeRoomName(state.roomName);
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(encodedRoom)}`;
  
  navigator.clipboard.writeText(inviteUrl)
    .then(() => {
      showToast("已成功將邀請網址複製到剪貼簿，可直接傳送給小組成員！", "success");
    })
    .catch(() => {
      showToast("複製失敗，請手動複製瀏覽器網址列分享", "error");
    });
}

// -------------------------------------------------------------
// EXPORTS (MARKDOWN EXPORT)
// -------------------------------------------------------------
function handleExportMarkdown() {
  if (state.cards.length === 0) {
    showToast("目前畫板內無任何卡片，無法匯出成果！", "error");
    return;
  }

  let md = `# KJ 親和圖收斂報告 — 房間：${state.roomName}\n`;
  md += `產出時間：${new Date().toLocaleString()}\n`;
  md += `總收斂輪次：共 ${state.currentRound + 1} 輪\n\n`;
  md += `---\n\n`;

  let maxRound = 0;
  state.cards.forEach(c => {
    if (c.round > maxRound) maxRound = c.round;
  });

  const rootRoundCards = state.cards.filter(c => c.round === maxRound);
  const rootRoundGroups = state.groups.filter(g => g.round === maxRound);

  const rootIndependent = rootRoundCards.filter(c => c.groupId === null);
  if (rootIndependent.length > 0) {
    md += `## 📌 最終獨立概念\n`;
    rootIndependent.forEach(card => {
      md += buildCardMarkdown(card, 0, maxRound);
    });
    md += `\n`;
  }

  if (rootRoundGroups.length > 0) {
    md += `## 🗂️ 核心概念分類結構\n`;
    rootRoundGroups.forEach(group => {
      const groupCards = rootRoundCards.filter(c => c.groupId === group.id);
      md += buildGroupMarkdown(group, groupCards, 0, maxRound);
    });
  }

  dom.exportTextarea.value = md;
  toggleModal(dom.modalExport, true);
  showToast("成功生成 Markdown 階層結構！", "success");
}

function buildGroupMarkdown(group, childrenCards, depth, round) {
  const indent = "  ".repeat(depth);
  let md = `${indent}- ### 🗂️ ${group.name} (第 ${round + 1} 輪群組分類)\n`;
  
  childrenCards.forEach(card => {
    md += buildCardMarkdown(card, depth + 1, round);
  });
  return md;
}

function buildCardMarkdown(card, depth, round) {
  const indent = "  ".repeat(depth);
  
  if (card.sourceGroupId) {
    const prevGroup = state.groups.find(g => g.id === card.sourceGroupId);
    if (prevGroup) {
      const prevRoundCards = state.cards.filter(c => c.round === (round - 1) && c.groupId === prevGroup.id);
      return buildGroupMarkdown(prevGroup, prevRoundCards, depth, round - 1);
    }
  }

  if (card.sourceCardId) {
    const prevCard = state.cards.find(c => c.id === card.sourceCardId);
    if (prevCard) {
      return buildCardMarkdown(prevCard, depth, round - 1);
    }
  }

  return `${indent}- 📝 ${card.text} (由 [${card.author}] 提出)\n`;
}

function handleCopyExport() {
  const text = dom.exportTextarea.value;
  navigator.clipboard.writeText(text)
    .then(() => {
      showToast("已成功將 Markdown 複製到剪貼簿！", "success");
    })
    .catch(() => {
      showToast("複製失敗，請手動全選複製", "error");
    });
}

function handleDownloadExport() {
  const text = dom.exportTextarea.value;
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  const filename = state.roomName ? `KJ_Affinity_${state.roomName}.md` : "KJ_Affinity_Batch_Export.md";
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast("Markdown 報告下載完成！", "success");
}

// -------------------------------------------------------------
// BATCH EXPORTS FOR INSTRUCTOR
// -------------------------------------------------------------
function populateBatchRoomsList() {
  const container = dom.batchRoomsList;
  if (!container) return;
  
  container.innerHTML = "";
  if (!state.activeRooms || state.activeRooms.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px 0;">目前無線上活躍的房間</div>`;
    dom.btnExecuteBatchExport.disabled = true;
    return;
  }
  
  dom.btnExecuteBatchExport.disabled = false;
  
  state.activeRooms.forEach(roomName => {
    const div = document.createElement("div");
    div.className = "batch-room-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = roomName;
    checkbox.id = `batch-room-chk-${roomName}`;
    checkbox.className = "batch-room-checkbox";
    checkbox.style.cursor = "pointer";
    
    const label = document.createElement("label");
    label.htmlFor = `batch-room-chk-${roomName}`;
    label.textContent = roomName;
    label.style.cursor = "pointer";
    label.style.fontSize = "0.9rem";
    label.style.color = "var(--text-primary)";
    label.style.flex = "1";
    
    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  });
}

async function fetchRoomState(roomName) {
  if (!state.offline && typeof firebase !== 'undefined' && firebase.apps.length) {
    try {
      const db = firebase.firestore();
      const docRef = db.collection("rooms").doc(roomName);
      const doc = await docRef.get();
      if (doc.exists) {
        return doc.data();
      }
    } catch (err) {
      console.error(`Failed to fetch room state for ${roomName}:`, err);
    }
  }
  return null;
}

function generateRoomMarkdown(roomName, roomData) {
  const originalCards = state.cards;
  const originalGroups = state.groups;
  
  state.cards = roomData.cards || [];
  state.groups = roomData.groups || [];
  const roomRound = roomData.round || 0;
  
  let md = `\n========================================================================\n`;
  md += `# 小組房間：${roomName}\n`;
  md += `當前輪次：共 ${roomRound + 1} 輪\n\n`;
  
  let maxRound = 0;
  state.cards.forEach(c => {
    if (c.round > maxRound) maxRound = c.round;
  });

  const rootRoundCards = state.cards.filter(c => c.round === maxRound);
  const rootRoundGroups = state.groups.filter(g => g.round === maxRound);

  const rootIndependent = rootRoundCards.filter(c => c.groupId === null);
  if (rootIndependent.length > 0) {
    md += `## 📌 最終獨立概念\n`;
    rootIndependent.forEach(card => {
      md += buildCardMarkdown(card, 0, maxRound);
    });
    md += `\n`;
  }

  if (rootRoundGroups.length > 0) {
    md += `## 🗂️ 核心概念分類結構\n`;
    rootRoundGroups.forEach(group => {
      const groupCards = rootRoundCards.filter(c => c.groupId === group.id);
      md += buildGroupMarkdown(group, groupCards, 0, maxRound);
    });
  }
  
  state.cards = originalCards;
  state.groups = originalGroups;
  
  return md;
}

async function handleBatchExport() {
  const checkboxes = dom.batchRoomsList.querySelectorAll(".batch-room-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("請至少選擇一個房間進行匯出！", "error");
    return;
  }
  
  const roomNames = Array.from(checkboxes).map(chk => chk.value);
  dom.btnExecuteBatchExport.disabled = true;
  showToast(`正在讀取 ${roomNames.length} 個房間的成果...`, "info");
  
  try {
    const fetchPromises = roomNames.map(name => fetchRoomState(name));
    const roomsData = await Promise.all(fetchPromises);
    
    let combinedMd = `# KJ 親和圖多小組成果彙整報告\n\n`;
    combinedMd += `匯出時間：${new Date().toLocaleString()}\n`;
    combinedMd += `匯出小組數量：共 ${roomNames.length} 組\n`;
    combinedMd += `彙整小組清單：\n`;
    roomNames.forEach(name => {
      combinedMd += `- ${name}\n`;
    });
    combinedMd += `\n`;
    
    for (let i = 0; i < roomNames.length; i++) {
      const roomName = roomNames[i];
      const roomData = roomsData[i];
      if (roomData && roomData.cards && roomData.cards.length > 0) {
        combinedMd += generateRoomMarkdown(roomName, roomData);
      } else {
        combinedMd += `\n========================================================================\n`;
        combinedMd += `# 小組房間：${roomName}\n`;
        combinedMd += `（該房間目前無卡片資料或未初始化）\n`;
      }
    }
    
    toggleModal(dom.modalBatchExport, false);
    dom.exportTextarea.value = combinedMd;
    toggleModal(dom.modalExport, true);
    showToast("批次成果匯出成功！", "success");
  } catch (err) {
    console.error("Batch export error:", err);
    showToast("批次匯出過程中發生錯誤，請稍後再試！", "error");
  } finally {
    dom.btnExecuteBatchExport.disabled = false;
  }
}

// -------------------------------------------------------------
// ROOT CAUSE ANALYSIS (5 WHYS TREE)
// -------------------------------------------------------------
function renderRootCauseTree(groupId) {
  const container = dom.rootCauseTreeContainer;
  if (!container) return;
  
  container.innerHTML = "";
  
  const groupNodes = (state.rootCauses || []).filter(n => n.groupId === groupId);
  const group = state.groups.find(g => g.id === groupId);
  const groupName = group ? group.name : "未知群組";
  
  const treeDiv = document.createElement("div");
  treeDiv.className = "rc-tree-container";
  
  const rootBox = document.createElement("div");
  rootBox.className = "rc-root-box";
  rootBox.innerHTML = `
    <i class="fa-solid fa-circle-question" style="color: var(--primary);"></i>
    <span>核心課題：${escapeHtml(groupName)}</span>
  `;
  
  if (state.userRole === "student") {
    const addBtn = document.createElement("button");
    addBtn.className = "rc-node-btn";
    addBtn.style.marginLeft = "10px";
    addBtn.style.padding = "4px 8px";
    addBtn.style.background = "var(--primary)";
    addBtn.style.color = "white";
    addBtn.style.borderRadius = "4px";
    addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> 新增主因`;
    addBtn.addEventListener("click", () => {
      const text = prompt("請輸入此群組的主要原因（第一層原因）：");
      if (text && text.trim()) {
        const newNode = {
          id: generateUUID(),
          groupId: groupId,
          parentId: null,
          text: text.trim()
        };
        state.rootCauses.push(newNode);
        window.dbService.updateRoomState(state.roomName, { rootCauses: state.rootCauses });
        renderRootCauseTree(groupId);
      }
    });
    rootBox.appendChild(addBtn);
  }
  
  treeDiv.appendChild(rootBox);
  
  function buildSubtree(parentId) {
    const children = groupNodes.filter(n => n.parentId === parentId);
    if (children.length === 0) return null;
    
    const ul = document.createElement("ul");
    ul.className = "rc-node-list";
    
    children.forEach(node => {
      const li = document.createElement("li");
      li.className = "rc-node-item";
      
      const content = document.createElement("div");
      content.className = "rc-node-content";
      
      const textSpan = document.createElement("span");
      textSpan.className = "rc-node-text";
      textSpan.textContent = node.text;
      
      content.appendChild(textSpan);
      
      if (state.userRole === "student") {
        const actions = document.createElement("div");
        actions.className = "rc-node-actions";
        
        const addBtn = document.createElement("button");
        addBtn.className = "rc-node-btn";
        addBtn.title = "新增下一層原因";
        addBtn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
        addBtn.addEventListener("click", () => {
          const text = prompt(`請輸入「${node.text}」的下一層原因：`);
          if (text && text.trim()) {
            const newNode = {
              id: generateUUID(),
              groupId: groupId,
              parentId: node.id,
              text: text.trim()
            };
            state.rootCauses.push(newNode);
            window.dbService.updateRoomState(state.roomName, { rootCauses: state.rootCauses });
            renderRootCauseTree(groupId);
          }
        });
        
        const editBtn = document.createElement("button");
        editBtn.className = "rc-node-btn";
        editBtn.title = "修改文字";
        editBtn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
        editBtn.addEventListener("click", () => {
          const newText = prompt("請修改原因內容：", node.text);
          if (newText && newText.trim() && newText.trim() !== node.text) {
            node.text = newText.trim();
            window.dbService.updateRoomState(state.roomName, { rootCauses: state.rootCauses });
            renderRootCauseTree(groupId);
          }
        });

        textSpan.style.cursor = "pointer";
        textSpan.title = "雙擊可快速修改原因";
        textSpan.addEventListener("dblclick", () => {
          const newText = prompt("請修改原因內容：", node.text);
          if (newText && newText.trim() && newText.trim() !== node.text) {
            node.text = newText.trim();
            window.dbService.updateRoomState(state.roomName, { rootCauses: state.rootCauses });
            renderRootCauseTree(groupId);
          }
        });
        
        const delBtn = document.createElement("button");
        delBtn.className = "rc-node-btn delete";
        delBtn.title = "刪除此原因及所有子原因";
        delBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
        delBtn.addEventListener("click", () => {
          if (confirm(`確定要刪除此原因「${node.text}」及其底下的所有子原因嗎？`)) {
            const idsToDelete = new Set([node.id]);
            let added;
            do {
              added = false;
              state.rootCauses.forEach(n => {
                if (n.parentId && idsToDelete.has(n.parentId) && !idsToDelete.has(n.id)) {
                  idsToDelete.add(n.id);
                  added = true;
                }
              });
            } while (added);
            
            state.rootCauses = state.rootCauses.filter(n => !idsToDelete.has(n.id));
            state.countermeasures = (state.countermeasures || []).filter(c => !idsToDelete.has(c.causeId));
            window.dbService.updateRoomState(state.roomName, {
              rootCauses: state.rootCauses,
              countermeasures: state.countermeasures
            });
            renderRootCauseTree(groupId);
          }
        });
        
        actions.appendChild(addBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        content.appendChild(actions);
      }
      
      li.appendChild(content);
      
      const childSubtree = buildSubtree(node.id);
      if (childSubtree) {
        li.appendChild(childSubtree);
      }
      
      ul.appendChild(li);
    });
    
    return ul;
  }
  
  const level1Tree = buildSubtree(null);
  if (level1Tree) {
    treeDiv.appendChild(level1Tree);
  } else {
    const emptyDiv = document.createElement("div");
    emptyDiv.style.textAlign = "center";
    emptyDiv.style.padding = "40px 20px";
    emptyDiv.style.color = "var(--text-muted)";
    emptyDiv.style.fontSize = "0.9rem";
    emptyDiv.innerHTML = `
      <i class="fa-solid fa-network-wired" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
      尚未新增任何根因分析節點。<br>${state.userRole === "student" ? "請點擊上方的「新增主因」按鈕開始分析主要原因！" : "此小組尚未進行根因分析。"}
    `;
    treeDiv.appendChild(emptyDiv);
  }
  
  container.appendChild(treeDiv);
}

// -------------------------------------------------------------
// COUNTERMEASURES PLANNING TREE
// -------------------------------------------------------------
function renderCountermeasuresTree(groupId) {
  const container = dom.countermeasuresTreeContainer;
  if (!container) return;
  
  container.innerHTML = "";
  
  const groupNodes = (state.rootCauses || []).filter(n => n.groupId === groupId);
  const group = state.groups.find(g => g.id === groupId);
  const groupName = group ? group.name : "未知群組";
  
  const treeDiv = document.createElement("div");
  treeDiv.className = "cm-tree-container";
  
  const rootBox = document.createElement("div");
  rootBox.className = "rc-root-box";
  rootBox.innerHTML = `
    <i class="fa-solid fa-circle-question" style="color: var(--primary);"></i>
    <span>核心課題：${escapeHtml(groupName)}</span>
  `;
  treeDiv.appendChild(rootBox);
  
  if (groupNodes.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.style.textAlign = "center";
    emptyDiv.style.padding = "40px 20px";
    emptyDiv.style.color = "var(--text-muted)";
    emptyDiv.style.fontSize = "0.9rem";
    emptyDiv.innerHTML = `
      <i class="fa-solid fa-lightbulb" style="font-size: 2.5rem; margin-bottom: 10px; display: block; opacity: 0.5; color: var(--success);"></i>
      尚未建立任何根因分析節點，請先至「根因分析」新增原因後，再來規劃對策！
    `;
    treeDiv.appendChild(emptyDiv);
    container.appendChild(treeDiv);
    return;
  }
  
  function buildSubtree(parentId) {
    const children = groupNodes.filter(n => n.parentId === parentId);
    if (children.length === 0) return null;
    
    const ul = document.createElement("ul");
    ul.className = "rc-node-list";
    
    children.forEach(node => {
      const li = document.createElement("li");
      li.className = "rc-node-item";
      
      const content = document.createElement("div");
      content.className = "rc-node-content";
      
      const textSpan = document.createElement("span");
      textSpan.className = "rc-node-text";
      textSpan.textContent = node.text;
      content.appendChild(textSpan);
      
      const cms = (state.countermeasures || []).filter(c => c.causeId === node.id);
      
      if (state.userRole === "student") {
        const addCmBtn = document.createElement("button");
        addCmBtn.className = "cm-node-btn";
        addCmBtn.title = "規劃對策";
        addCmBtn.innerHTML = `<i class="fa-solid fa-lightbulb"></i> + 對策`;
        addCmBtn.addEventListener("click", () => {
          const text = prompt(`針對原因「${node.text}」，請輸入您的對策方案：`);
          if (text && text.trim()) {
            const newCm = {
              id: generateUUID(),
              groupId: groupId,
              causeId: node.id,
              text: text.trim(),
              author: state.userNickname || "成員"
            };
            state.countermeasures.push(newCm);
            window.dbService.updateRoomState(state.roomName, { countermeasures: state.countermeasures });
            renderCountermeasuresTree(groupId);
          }
        });
        content.appendChild(addCmBtn);
      }
      
      li.appendChild(content);
      
      if (cms.length > 0) {
        const cmListDiv = document.createElement("div");
        cmListDiv.className = "cm-list";
        
        cms.forEach(cm => {
          const cmBox = document.createElement("div");
          cmBox.className = "cm-box";
          
          const cmTextSpan = document.createElement("span");
          cmTextSpan.className = "cm-text";
          cmTextSpan.textContent = `💡 ${cm.text}`;
          cmBox.appendChild(cmTextSpan);
          
          if (cm.author) {
            const authorSpan = document.createElement("span");
            authorSpan.className = "kj-card-author";
            authorSpan.style.marginLeft = "8px";
            authorSpan.style.fontSize = "0.7rem";
            authorSpan.textContent = `(${cm.author})`;
            cmBox.appendChild(authorSpan);
          }
          
          if (state.userRole === "student") {
            const cmActions = document.createElement("div");
            cmActions.className = "cm-actions";
            
            const editCmBtn = document.createElement("button");
            editCmBtn.className = "cm-btn";
            editCmBtn.title = "修改對策";
            editCmBtn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
            editCmBtn.addEventListener("click", () => {
              const newText = prompt("請修改對策內容：", cm.text);
              if (newText && newText.trim() && newText.trim() !== cm.text) {
                cm.text = newText.trim();
                window.dbService.updateRoomState(state.roomName, { countermeasures: state.countermeasures });
                renderCountermeasuresTree(groupId);
              }
            });
            
            const delCmBtn = document.createElement("button");
            delCmBtn.className = "cm-btn delete";
            delCmBtn.title = "刪除對策";
            delCmBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
            delCmBtn.addEventListener("click", () => {
              if (confirm(`確定要刪除此對策「${cm.text}」嗎？`)) {
                state.countermeasures = state.countermeasures.filter(c => c.id !== cm.id);
                window.dbService.updateRoomState(state.roomName, { countermeasures: state.countermeasures });
                renderCountermeasuresTree(groupId);
              }
            });
            
            cmActions.appendChild(editCmBtn);
            cmActions.appendChild(delCmBtn);
            cmBox.appendChild(cmActions);
          }
          
          cmListDiv.appendChild(cmBox);
        });
        
        li.appendChild(cmListDiv);
      }
      
      const childSubtree = buildSubtree(node.id);
      if (childSubtree) {
        li.appendChild(childSubtree);
      }
      
      ul.appendChild(li);
    });
    
    return ul;
  }
  
  const level1Tree = buildSubtree(null);
  if (level1Tree) {
    treeDiv.appendChild(level1Tree);
  }
  
  container.appendChild(treeDiv);
}

function resetSidebarState() {
  activeRootCauseGroupId = null;
  activeCountermeasuresGroupId = null;
  if (dom.modalRootCause) {
    toggleModal(dom.modalRootCause, false);
  }
  if (dom.modalCountermeasures) {
    toggleModal(dom.modalCountermeasures, false);
  }
  if (dom.sidebar) {
    dom.sidebar.classList.remove("collapsed");
  }
  if (dom.btnToggleSidebar) {
    dom.btnToggleSidebar.title = "收起控制面板";
    const icon = dom.btnToggleSidebar.querySelector("i");
    if (icon) {
      icon.className = "fa-solid fa-chevron-left";
    }
  }
}

// -------------------------------------------------------------
// UTILITIES
// -------------------------------------------------------------
function escapeHtml(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(string).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Initialize on script load
window.addEventListener("DOMContentLoaded", initApp);
