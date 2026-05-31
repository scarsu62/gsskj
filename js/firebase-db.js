// firebase-db.js
// Handles Firestore real-time cloud synchronization. LocalStorage fallback is disabled.

let roomUnsubscribe = null;
let activeRoomsUnsubscribe = null;

let isOfflineMode = true;
let currentRoomName = null;

// Callbacks
let onRoomUpdateCallback = null;
let onRoomsListUpdateCallback = null;
let onConnectionStateChangeCallback = null;

window.dbService = {
  /**
   * Initialize the database service
   */
  async init(unused, onRoomUpdate, onRoomsListUpdate, onConnectionStateChange) {
    onRoomUpdateCallback = onRoomUpdate;
    onRoomsListUpdateCallback = onRoomsListUpdate;
    onConnectionStateChangeCallback = onConnectionStateChange;

    // Retrieve Firebase Config from system static config
    const fbConfig = window.SYSTEM_CONFIG ? window.SYSTEM_CONFIG.FIREBASE_CONFIG : null;

    const isValidConfig = fbConfig && 
                          fbConfig.apiKey && 
                          !fbConfig.apiKey.startsWith("YOUR_") && 
                          fbConfig.projectId && 
                          !fbConfig.projectId.startsWith("YOUR_");

    if (isValidConfig && typeof firebase !== 'undefined') {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(fbConfig);
        }
        
        isOfflineMode = false;
        if (onConnectionStateChangeCallback) {
          onConnectionStateChangeCallback(false); // Cloud connection online
        }
        
        // Listen to active rooms list in Firebase
        this.subscribeToActiveRooms();
        
      } catch (error) {
        console.error("Firebase connection failed:", error);
        this.setConnectionStateUnconfigured();
      }
    } else {
      console.warn("Firebase configuration is missing or placeholder. Cloud sync is disabled.");
      this.setConnectionStateUnconfigured();
    }
  },

  setConnectionStateUnconfigured() {
    isOfflineMode = true;
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(true); // Flag as offline / unconfigured
    }
    this.unsubscribeFromFirebase();
  },

  isOffline() {
    return isOfflineMode;
  },

  /**
   * Subscribes to changes in a specific room
   */
  async subscribeToRoom(roomName) {
    currentRoomName = roomName;
    
    // Unsubscribe from previous subscriptions
    if (roomUnsubscribe) {
      if (typeof roomUnsubscribe === 'function') {
        roomUnsubscribe();
      }
      roomUnsubscribe = null;
    }

    if (!isOfflineMode && typeof firebase !== 'undefined' && firebase.apps.length) {
      try {
        const db = firebase.firestore();
        const docRef = db.collection("rooms").doc(roomName);
        
        roomUnsubscribe = docRef.onSnapshot((snapshot) => {
          if (snapshot.exists) {
            const data = snapshot.data();
            if (onRoomUpdateCallback) {
              onRoomUpdateCallback(data);
            }
          } else {
            // Room does not exist in Firestore yet, initialize it
            const defaultState = this.getDefaultRoomState(roomName);
            this.updateRoomState(roomName, defaultState);
          }
        }, (error) => {
          console.error("Firestore subscription error:", error);
          this.setConnectionStateUnconfigured();
        });
      } catch (e) {
        console.error("Failed to subscribe to room in Firestore:", e);
        this.setConnectionStateUnconfigured();
      }
    } else {
      console.error("Firestore is unconfigured. Cannot subscribe to room.");
    }
  },

  /**
   * Updates room state (writes directly to Firestore)
   */
  async updateRoomState(roomName, state) {
    state.lastActive = Date.now();

    if (!isOfflineMode && typeof firebase !== 'undefined' && firebase.apps.length) {
      try {
        const db = firebase.firestore();
        const docRef = db.collection("rooms").doc(roomName);
        await docRef.set(state, { merge: true });
      } catch (error) {
        console.error("Firestore write failed:", error);
        this.setConnectionStateUnconfigured();
      }
    } else {
      console.error("Firestore is unconfigured. Cannot write state.");
    }
  },

  /**
   * Clears all room state (Reset Room)
   */
  async resetRoom(roomName) {
    const defaultState = this.getDefaultRoomState(roomName);
    await this.updateRoomState(roomName, defaultState);
  },

  /**
   * Subscribes to all active rooms (Teacher View)
   */
  async subscribeToActiveRooms() {
    if (activeRoomsUnsubscribe) {
      activeRoomsUnsubscribe();
      activeRoomsUnsubscribe = null;
    }

    if (!isOfflineMode && typeof firebase !== 'undefined' && firebase.apps.length) {
      try {
        const db = firebase.firestore();
        const q = db.collection("rooms").orderBy("lastActive", "desc");
        
        activeRoomsUnsubscribe = q.onSnapshot((snapshot) => {
          const rooms = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.roomName) {
              rooms.push(data.roomName);
            }
          });
          if (onRoomsListUpdateCallback) {
            onRoomsListUpdateCallback(rooms);
          }
        }, (error) => {
          console.error("Active rooms subscription error:", error);
        });
      } catch (e) {
        console.error("Failed to subscribe to active rooms:", e);
      }
    }
  },

  unsubscribeFromFirebase() {
    if (roomUnsubscribe) {
      if (typeof roomUnsubscribe === 'function') {
        roomUnsubscribe();
      }
      roomUnsubscribe = null;
    }
    if (activeRoomsUnsubscribe) {
      if (typeof activeRoomsUnsubscribe === 'function') {
        activeRoomsUnsubscribe();
      }
      activeRoomsUnsubscribe = null;
    }
  },

  getDefaultRoomState(roomName) {
    return {
      roomName: roomName,
      round: 0,
      cards: [],
      groups: [],
      lastActive: Date.now()
    };
  }
};
