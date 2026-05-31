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
  offline: true
};

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
  btnJoinTeacher: document.getElementById("btn-join-teacher"),

  // Header Elements
  connectionIndicator: document.getElementById("connection-indicator"),
  connectionStatusText: document.getElementById("connection-status-text"),
  teacherNav: document.getElementById("teacher-nav"),
  headerRoomSelect: document.getElementById("header-room-select"),
  userDisplayName: document.getElementById("user-display-name"),
  btnShare: document.getElementById("btn-share"),
  btnLogout: document.getElementById("btn-logout"),

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
  teacherActions: document.getElementById("teacher-actions"),
  btnResetRoom: document.getElementById("btn-reset-room"),
  btnExportMd: document.getElementById("btn-export-md"),

  // Workspace View Canvas Elements
  displayRoomName: document.getElementById("display-room-name"),
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
  btnGoogleDrive: document.getElementById("btn-google-drive"),
  btnCopyMd: document.getElementById("btn-copy-md"),
  btnDownloadMd: document.getElementById("btn-download-md")
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
    dom.studentRoom.value = urlRoom;
    showToast(`偵測到邀請連結，已為您填入房間：${urlRoom}`, "success");
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

  // Password Listener for Teacher Room Fetching
  dom.teacherPassword.addEventListener("input", handleTeacherPasswordInput);

  // Room Switching Listener (Teacher only)
  dom.headerRoomSelect.addEventListener("change", (e) => {
    if (e.target.value) {
      switchRoom(e.target.value);
    }
  });

  // Export & Export Modal
  dom.btnExportMd.addEventListener("click", handleExportMarkdown);
  dom.modalExportClose.addEventListener("click", () => toggleModal(dom.modalExport, false));
  dom.btnGoogleDrive.addEventListener("click", handleGoogleDriveUpload);
  dom.btnCopyMd.addEventListener("click", handleCopyExport);
  dom.btnDownloadMd.addEventListener("click", handleDownloadExport);

  // Share invite
  dom.btnShare.addEventListener("click", handleShareLink);

  // Logout
  dom.btnLogout.addEventListener("click", handleLogout);

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
  dom.btnResetRoom.addEventListener("click", handleResetRoom);

  // View Panel Tabs
  dom.viewTabBoard.addEventListener("click", () => switchView("board"));
  dom.viewTabTree.addEventListener("click", () => switchView("tree"));
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

function handleTeacherPasswordInput() {
  const value = dom.teacherPassword.value;
  if (value === "KJOnLine") {
    dom.teacherRoomSelect.disabled = false;
    dom.btnJoinTeacher.disabled = false;
    showToast("密語驗證成功，正在讀取線上活躍房間...", "success");
    window.dbService.subscribeToActiveRooms();
  } else {
    dom.teacherRoomSelect.disabled = true;
    dom.btnJoinTeacher.disabled = true;
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

function handleTeacherJoin() {
  const selectedRoom = dom.teacherRoomSelect.value;
  if (!selectedRoom) {
    showToast("請選擇一個房間進行巡房！", "error");
    return;
  }

  state.userRole = "teacher";
  state.userNickname = "講師";
  state.roomName = selectedRoom;

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
  } else {
    dom.userDisplayName.classList.remove("teacher");
    dom.teacherNav.classList.remove("active");
    dom.cardCreatorSection.style.display = "block";
    dom.studentActions.style.display = "flex";
    dom.teacherActions.style.display = "none";
  }

  dom.displayRoomName.textContent = state.roomName;
  
  dom.lobbyScreen.style.display = "none";
  dom.appScreen.classList.add("active");

  window.dbService.subscribeToRoom(state.roomName);
  
  showToast(`已登入房間：${state.roomName}`, "success");
}

function switchRoom(newRoomName) {
  state.roomName = newRoomName;
  dom.displayRoomName.textContent = newRoomName;
  window.dbService.subscribeToRoom(newRoomName);
  
  const newUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(newRoomName)}`;
  window.history.pushState({ path: newUrl }, "", newUrl);

  showToast(`已切換至房間：${newRoomName}`, "success");
}

function handleLogout() {
  window.dbService.unsubscribeFromFirebase();
  
  state.userRole = null;
  state.userNickname = "";
  state.roomName = "";
  state.cards = [];
  state.groups = [];

  dom.studentName.value = "";
  dom.teacherPassword.value = "";
  dom.teacherRoomSelect.disabled = true;
  dom.btnJoinTeacher.disabled = true;
  
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

  dom.displayRoundNum.textContent = `第 ${state.currentRound + 1} 輪`;
  
  if (state.currentRound === 0) {
    dom.roundDesc.textContent = "第一階段：收集卡片與基本親和分組。可以拖曳卡片或點擊 AI 一鍵歸類。";
  } else {
    dom.roundDesc.textContent = `第 ${state.currentRound + 1} 階段：將前一輪的分類標籤當作「高階卡片」，進行更高層次的抽象收斂歸類。`;
  }

  updateHeaderRoomDropdown();
  renderCurrentView();
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
    
    const actionsHtml = state.userRole === "student" ? `
      <div class="column-actions">
        <button class="column-btn edit-group-btn" title="修改名稱"><i class="fa-solid fa-pen"></i></button>
        <button class="column-btn delete delete-group-btn" title="解散群組"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    ` : '';

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
          window.dbService.updateRoomState(state.roomName, {
            cards: state.cards,
            groups: state.groups
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

  cardDiv.innerHTML = `
    <div class="kj-card-text">${escapeHtml(card.text)}</div>
    <div class="kj-card-footer">
      <span class="kj-card-author"><i class="fa-regular fa-user"></i> ${escapeHtml(card.author)}</span>
      ${badgeHtml}
    </div>
  `;
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
      showToast("系統未配置 Gemini API 金鑰，請請管理員配置 js/config.js 設定檔！", "error");
    } else if (error.message === "API_KEY_INVALID") {
      showToast("Gemini API 金鑰驗證無效，請檢查 API 金鑰！", "error");
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
// SHARE LINK
// -------------------------------------------------------------
function handleShareLink() {
  if (!state.roomName) return;

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(state.roomName)}`;
  
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
  link.setAttribute("download", `KJ_Affinity_${state.roomName}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast("Markdown 報告下載完成！", "success");
}

// -------------------------------------------------------------
// GOOGLE DRIVE BACKUP INTEGRATION
// -------------------------------------------------------------
let tokenClient = null;

async function handleGoogleDriveUpload() {
  const clientId = window.SYSTEM_CONFIG ? window.SYSTEM_CONFIG.GOOGLE_CLIENT_ID : null;
  const isValidClient = clientId && clientId !== "" && !clientId.startsWith("YOUR_");

  if (!isValidClient) {
    showToast("系統尚未配置 Google Client ID，請聯繫管理員填寫 config.js 設定檔！", "error");
    return;
  }

  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    showToast("Google SDK 尚未載入完成，請確認已連上網並稍候重試！", "error");
    return;
  }

  dom.btnGoogleDrive.disabled = true;
  dom.btnGoogleDrive.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 授權中...';

  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: async (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          dom.btnGoogleDrive.disabled = false;
          dom.btnGoogleDrive.innerHTML = '<i class="fa-brands fa-google-drive"></i> 儲存至 Google Drive';
          showToast(`授權失敗: ${tokenResponse.error}`, "error");
          return;
        }
        
        dom.btnGoogleDrive.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 上傳中...';
        try {
          await uploadFileToGoogleDrive(tokenResponse.access_token);
          showToast("備份成功！已將收斂成果存入您的 Google Drive！", "success");
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          showToast("上傳檔案失敗，請檢查網路或用戶端權限！", "error");
        } finally {
          dom.btnGoogleDrive.disabled = false;
          dom.btnGoogleDrive.innerHTML = '<i class="fa-brands fa-google-drive"></i> 儲存至 Google Drive';
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (e) {
    console.error("GIS client init failed:", e);
    dom.btnGoogleDrive.disabled = false;
    dom.btnGoogleDrive.innerHTML = '<i class="fa-brands fa-google-drive"></i> 儲存至 Google Drive';
    showToast("授權視窗開啟失敗，請檢查 Client ID 是否正確！", "error");
  }
}

async function uploadFileToGoogleDrive(accessToken) {
  const metadata = {
    name: `KJ_Affinity_${state.roomName}.md`,
    mimeType: 'text/markdown'
  };
  
  const fileContent = dom.exportTextarea.value;
  const boundary = '314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  
  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Drive upload API error details:", errText);
    throw new Error(`Upload failed: ${response.status}`);
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
