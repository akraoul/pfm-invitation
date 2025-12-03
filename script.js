/* --------------------------------
   1) CODES D’ACTIVATION (50 codes, +3)
--------------------------------- */
function generateCodes(count){
  const codes = [];
  for(let i = 1; i <= count; i++){
    const n = i * 3;                          // suite +3
    const suffix = String(n).padStart(3,"0"); // 003, 006, 009...
    codes.push(`PFM-2025-${suffix}`);
  }
  return codes;
}

const VALID_CODES = generateCodes(50);
const MAX_ATTEMPTS = 3;

/* --------------------------------
   2) LOCAL STORAGE KEYS
--------------------------------- */
// { CODE: { name, usedAt } }
const STORAGE_CODES = "pfm_codes_registry";
// bool
const STORAGE_LOCKED = "pfm_lock_blocked";
// last guest session (display name only)
const STORAGE_LAST_GUEST = "pfm_last_guest";
// ✅ NEW: last credentials to help reconnect fast
const STORAGE_LAST_CREDENTIALS = "pfm_last_credentials"; 
// { nameRaw, codeRaw }

/* --------------------------------
   3) DOM ELEMENTS
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

// (optionnel) checkbox "remember me" si tu l’ajoutes
const rememberMeInput = document.getElementById("rememberMe");

let attemptsLeft = MAX_ATTEMPTS;

/* --------------------------------
   4) HELPERS
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

function showInvite(displayName){
  if(displayName && guestNameDiv){
    guestNameDiv.textContent = `Personal invitation for: ${displayName}`;
  }
  lockScreen.classList.add("hidden");
  inviteScreen.classList.remove("hidden");
  inviteScreen.setAttribute("aria-hidden","false");
}

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
   5) MAPS LINK (UPDATED)
   - Lieu affiché sur la carte: SAFARI
   - Adresse affichée sur la carte: ZYBITSKAYA, 23
   - Localisation réelle Maps: Кирила и Мефодия 8
--------------------------------- */
const mapsAddress = "Кирила и Мефодия 8";
if(mapsBtn){
  mapsBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsAddress)}`;
  mapsBtn.setAttribute("target", "_blank");
  mapsBtn.setAttribute("rel", "noopener noreferrer");
}

/* --------------------------------
   6) SAVE / LOAD LAST CREDENTIALS
--------------------------------- */
function saveLastCredentials(nameRaw, codeRaw){
  // si checkbox existe et n’est pas cochée => ne pas mémoriser
  if(rememberMeInput && !rememberMeInput.checked) return;

  const payload = { nameRaw, codeRaw };
  localStorage.setItem(STORAGE_LAST_CREDENTIALS, JSON.stringify(payload));
}

function loadLastCredentials(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_LAST_CREDENTIALS));
  }catch{
    return null;
  }
}

/* --------------------------------
   7) INIT
--------------------------------- */
(function init(){
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

  // ✅ Prefill last guest credentials if exist
  const lastCreds = loadLastCredentials();
  if(lastCreds?.nameRaw && lastCreds?.codeRaw){
    fullNameInput.value = lastCreds.nameRaw;
    codeInput.value = lastCreds.codeRaw;

    setStatus("ok", "Welcome back! Your details are ready.");
  }else{
    setStatus("muted", "Waiting…");
  }
})();

/* --------------------------------
   8) UNLOCK / RECONNECT LOGIC
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

  // (A) code must be official
  if(!VALID_CODES.includes(code)){
    failAttempt("Invalid activation code.");
    return;
  }

  const registry = getRegistry();
  const existing = registry[code];

  // (B) code linked to another guest => reject
  if(existing && existing.name !== name){
    failAttempt("This code is already linked to another guest.");
    return;
  }

  // (C) same guest => reconnect OK
  if(existing && existing.name === name){
    const displayName = nameRaw.trim();

    localStorage.setItem(STORAGE_LAST_GUEST, displayName);
    saveLastCredentials(nameRaw.trim(), code); // ✅ keep for next time

    setStatus("ok", `Welcome back ${displayName} ✨`);
    setTimeout(()=>showInvite(displayName), 450);
    return;
  }

  // (D) first use => bind code + name
  registry[code] = {
    name,
    usedAt: new Date().toISOString()
  };
  saveRegistry(registry);

  const displayName = nameRaw.trim();
  localStorage.setItem(STORAGE_LAST_GUEST, displayName);

  // ✅ save for quick reconnection
  saveLastCredentials(displayName, code);

  setStatus("ok", `Welcome ${displayName} ✨`);
  setTimeout(()=>showInvite(displayName), 650);
});

/* --------------------------------
   9) SWITCH GUEST (manual return)
--------------------------------- */
if(switchGuestBtn){
  switchGuestBtn.addEventListener("click", ()=>{
    // on retire la session visible
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
