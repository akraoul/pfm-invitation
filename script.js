/* --------------------------------
   1) CODES D’ACTIVATION (50 codes, +3)
--------------------------------- */

function generateCodes(count){
  const codes = [];
  for(let i = 1; i <= count; i++){
    const n = i * 3;                          // suite +3
    const suffix = String(n).padStart(3,"0");// 003, 006, 009...
    codes.push(`PFM-2025-${suffix}`);
  }
  return codes;
}

const VALID_CODES = generateCodes(50);
const MAX_ATTEMPTS = 3;

// Local storage keys
const STORAGE_CODES = "pfm_codes_registry";   // { CODE: {name, usedAt} }
const STORAGE_LOCKED = "pfm_lock_blocked";    // bool
const STORAGE_LAST_GUEST = "pfm_last_guest";  // string (display name)

/* --------------------------------
   2) DOM ELEMENTS
--------------------------------- */
const lockScreen     = document.getElementById("lockScreen");
const inviteScreen   = document.getElementById("inviteScreen");
const unlockForm     = document.getElementById("unlockForm");
const codeInput      = document.getElementById("codeInput");
const fullNameInput  = document.getElementById("fullNameInput");
const attemptsInfo   = document.getElementById("attemptsInfo");
const statusInfo     = document.getElementById("statusInfo");
const guestNameDiv   = document.getElementById("guestName");
const mapsBtn        = document.getElementById("mapsBtn");
const switchGuestBtn = document.getElementById("switchGuestBtn");

let attemptsLeft = MAX_ATTEMPTS;

/* --------------------------------
   3) HELPERS
--------------------------------- */
function normalizeName(name){
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
function normalizeCode(code){
  return code.trim().toUpperCase();
}
function setStatus(type, text){
  statusInfo.className = `status ${type}`;
  statusInfo.textContent = text;
}
function updateAttempts(){
  attemptsInfo.textContent = `Attempts left: ${attemptsLeft}`;
}

/* Show invitation */
function showInvite(displayName){
  if(displayName && guestNameDiv){
    guestNameDiv.textContent = `Personal invitation for: ${displayName}`;
  }
  lockScreen.classList.add("hidden");
  inviteScreen.classList.remove("hidden");
  inviteScreen.setAttribute("aria-hidden","false");
}

/* Registry */
function getRegistry(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_CODES)) || {};
  }catch{
    return {};
  }
}
function saveRegistry(reg){
  localStorage.setItem(STORAGE_CODES, JSON.stringify(reg));
}

/* Attempts */
function failAttempt(message){
  attemptsLeft--;
  updateAttempts();
  setStatus("err", message);

  if(attemptsLeft <= 0){
    localStorage.setItem(STORAGE_LOCKED, "true");
    fullNameInput.disabled = true;
    codeInput.disabled = true;
    unlockForm.querySelector("button").disabled = true;
    setStatus("err", "Access blocked. Too many attempts.");
  }
}

/* --------------------------------
   4) MAPS LINK
--------------------------------- */
const address = "Минск, проспект Победителей, 17, MONACO";
mapsBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/* --------------------------------
   5) INIT (✅ always start on lock screen)
--------------------------------- */
(function init(){
  // ✅ IMPORTANT:
  // We ALWAYS reset last guest session on load so refresh returns to lock page.
  localStorage.removeItem(STORAGE_LAST_GUEST);

  const blocked = localStorage.getItem(STORAGE_LOCKED) === "true";
  if(blocked){
    attemptsLeft = 0;
    updateAttempts();
    fullNameInput.disabled = true;
    codeInput.disabled = true;
    unlockForm.querySelector("button").disabled = true;
    setStatus("err", "Access blocked (too many attempts).");
    return;
  }

  attemptsLeft = MAX_ATTEMPTS;
  updateAttempts();
  setStatus("muted", "Waiting…");
})();

/* ✅ Also clear last guest when leaving the page */
window.addEventListener("beforeunload", ()=>{
  localStorage.removeItem(STORAGE_LAST_GUEST);
});

/* --------------------------------
   6) UNLOCK / RECONNECT LOGIC
--------------------------------- */
unlockForm.addEventListener("submit", (e)=>{
  e.preventDefault();

  const nameRaw = fullNameInput.value;
  const codeRaw = codeInput.value;

  const name = normalizeName(nameRaw);
  const code = normalizeCode(codeRaw);

  if(!name || name.length < 3){
    setStatus("err", "Please enter a valid full name.");
    return;
  }

  // (A) code must exist
  if(!VALID_CODES.includes(code)){
    failAttempt("Invalid activation code.");
    return;
  }

  const registry = getRegistry();
  const existing = registry[code];

  // (B) if code linked to another guest → refuse
  if(existing && existing.name !== name){
    failAttempt("This code is already linked to another guest.");
    return;
  }

  // (C) if same guest → reconnection OK
  if(existing && existing.name === name){
    const displayName = nameRaw.trim();
    localStorage.setItem(STORAGE_LAST_GUEST, displayName);

    setStatus("ok", `Welcome back ${displayName} ✨`);
    setTimeout(()=>showInvite(displayName), 450);
    return;
  }

  // (D) first use → bind code + name
  registry[code] = {
    name,
    usedAt: new Date().toISOString()
  };
  saveRegistry(registry);

  const displayName = nameRaw.trim();
  localStorage.setItem(STORAGE_LAST_GUEST, displayName);

  setStatus("ok", `Welcome ${displayName} ✨`);
  setTimeout(()=>showInvite(displayName), 650);
});

/* --------------------------------
   7) SWITCH GUEST (manual return)
--------------------------------- */
if(switchGuestBtn){
  switchGuestBtn.addEventListener("click", ()=>{
    localStorage.removeItem(STORAGE_LAST_GUEST);

    inviteScreen.classList.add("hidden");
    inviteScreen.setAttribute("aria-hidden","true");
    lockScreen.classList.remove("hidden");

    attemptsLeft = MAX_ATTEMPTS;
    updateAttempts();
    setStatus("muted", "Waiting…");

    fullNameInput.value = "";
    codeInput.value = "";
    fullNameInput.disabled = false;
    codeInput.disabled = false;
    unlockForm.querySelector("button").disabled = false;
  });
}
