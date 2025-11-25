/* --------------------------------
   1) CODES D’ACTIVATION (50 codes, +3)
--------------------------------- */

function generateCodes(count){
  const codes = [];
  for(let i = 1; i <= count; i++){
    const n = i * 3;                         // suite +3
    const suffix = String(n).padStart(3,"0");// 003, 006, 009...
    codes.push(`PFM-2025-${suffix}`);
  }
  return codes;
}

// Official codes given by the organizer
const VALID_CODES = generateCodes(50);

const MAX_ATTEMPTS = 3;

// Local storage keys
const STORAGE_CODES = "pfm_codes_registry";   // { CODE: {name, usedAt} }
const STORAGE_LOCKED = "pfm_lock_blocked";    // bool
const STORAGE_LAST_GUEST = "pfm_last_guest";  // string (display name)

/* --------------------------------
   2) ELEMENTS DOM
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

/* Affiche l’invitation */
function showInvite(displayName){
  if(displayName && guestNameDiv){
    guestNameDiv.textContent = `Personal invitation for: ${displayName}`;
  }
  lockScreen.classList.add("hidden");
  inviteScreen.classList.remove("hidden");
  inviteScreen.setAttribute("aria-hidden","false");
}

/* Charge registre codes */
function getRegistry(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_CODES)) || {};
  }catch{
    return {};
  }
}

/* Sauvegarde registre */
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
   4) MAPS LINK
--------------------------------- */
const address = "Минск, проспект Победителей, 17, MONACO";
mapsBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/* --------------------------------
   5) INIT
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

  // Si un invité a déjà validé sur ce navigateur,
  // on peut lui afficher directement l’invitation
  // mais il peut toujours "Switch guest" pour revenir.
  const lastGuest = localStorage.getItem(STORAGE_LAST_GUEST);
  if(lastGuest){
    showInvite(lastGuest);
    return;
  }

  updateAttempts();
  setStatus("muted", "Waiting…");
})();

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

  // (A) le code doit exister dans la liste officielle
  if(!VALID_CODES.includes(code)){
    failAttempt("Invalid activation code.");
    return;
  }

  const registry = getRegistry();
  const existing = registry[code];

  // (B) si le code est déjà lié à un AUTRE nom → refus
  if(existing && existing.name !== name){
    failAttempt("This code is already linked to another guest.");
    return;
  }

  // (C) si le code est déjà lié AU MÊME nom → RECONNEXION OK
  if(existing && existing.name === name){
    const displayName = nameRaw.trim();
    localStorage.setItem(STORAGE_LAST_GUEST, displayName);

    setStatus("ok", `Welcome back ${displayName} ✨`);
    setTimeout(()=>showInvite(displayName), 450);
    return;
  }

  // (D) sinon : première utilisation → on lie code + nom
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
   7) SWITCH GUEST (RETURN TO LOCK)
--------------------------------- */
if(switchGuestBtn){
  switchGuestBtn.addEventListener("click", ()=>{
    // Retire seulement la session de l’invité courant
    localStorage.removeItem(STORAGE_LAST_GUEST);

    // Retour à l’écran de saisie
    inviteScreen.classList.add("hidden");
    inviteScreen.setAttribute("aria-hidden","true");
    lockScreen.classList.remove("hidden");

    // Reset UI
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
