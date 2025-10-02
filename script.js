/* Undercover Word Party – no backend, pure client JS */

const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const state = {
  gameName: "",
  civilianWord: "",
  undercoverWord: "",
  numUndercover: 1,
  numWhite: 1,
  players: [], // {id,name,role:'CIV'|'UND'|'WHT', alive:true}
  assigned: false,
  useRandomPair: false,
  wordPairs: [], // [{civ,und}]
  votes: {}, // name -> targetName
  timers: { handle:null, secs:0 },
};

// --- UI Elements
const els = {
  gameName: $("#gameName"),
  wordCivilian: $("#wordCivilian"),
  wordUndercover: $("#wordUndercover"),
  numUndercover: $("#numUndercover"),
  numWhite: $("#numWhite"),
  players: $("#players"),
  playerInput: $("#playerInput"),
  addPlayer: $("#addPlayer"),
  addQuick: $("#addQuick"),
  clearPlayers: $("#clearPlayers"),
  randomize: $("#randomize"),
  assignSummary: $("#assignSummary"),
  useRandomPair: $("#useRandomPair"),
  pairManager: $("#pairManager"),
  setup: $("#setup"),
  reveal: $("#reveal"),
  round: $("#round"),

  // Reveal
  revealName: $("#revealName"),
  revealContent: $("#revealContent"),
  btnReveal: $("#btnReveal"),
  btnPrev: $("#btnPrev"),
  btnNext: $("#btnNext"),
  revealStep: $("#revealStep"),
  toRound: $("#toRound"),

  // Round
  aliveList: $("#aliveList"),
  votePanel: $("#votePanel"),
  btnTally: $("#btnTally"),
  btnClearVotes: $("#btnClearVotes"),
  btnDescribe: $("#btnDescribe"),
  btnDiscuss: $("#btnDiscuss"),
  btnResetTimers: $("#btnResetTimers"),
  timer: $("#timer"),

  // Modals
  dlgWhite: $("#modalWhiteGuess"),
  whiteGuessInput: $("#whiteGuessInput"),
  whiteGuessConfirm: $("#whiteGuessConfirm"),
  dlgMsg: $("#modalMessage"),
  msgTitle: $("#msgTitle"),
  msgBody: $("#msgBody"),

  // Footer
  btnExport: $("#btnExport"),
  btnImport: $("#btnImport"),
  importFile: $("#importFile"),
};

let revealIndex = 0;

// ---------- Utility ----------
function uid() { return Math.random().toString(36).slice(2,9); }
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] } return arr; }
function speak(msg){ try{ new SpeechSynthesisUtterance && speechSynthesis.speak(new SpeechSynthesisUtterance(msg)); } catch(_){} }
function log(msg){ const el = $("#log"); const div = document.createElement("div"); div.textContent = msg; el.prepend(div); }
function showModal(title, body){ els.msgTitle.textContent=title; els.msgBody.textContent=body; els.dlgMsg.showModal(); }

// ---------- Players ----------
function renderPlayers(){
  els.players.innerHTML = "";
  state.players.forEach(p=>{
    const chip = document.createElement("div");
    chip.className = "playerChip";
    chip.innerHTML = `<span>${p.name}</span>`;
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = "×";
    b.onclick = ()=>{ state.players = state.players.filter(x=>x.id!==p.id); renderPlayers(); };
    chip.appendChild(b);
    els.players.appendChild(chip);
  });
}

els.addPlayer.onclick = ()=>{
  const name = els.playerInput.value.trim();
  if(!name) return;
  state.players.push({id:uid(), name, role:null, alive:true});
  els.playerInput.value="";
  renderPlayers();
};

els.addQuick.onclick = ()=>{
  const samples = ["Ali","Mei","Raj","Jess","Amir","Wei","Nur","Ken"];
  samples.forEach(n=> state.players.push({id:uid(), name:n, role:null, alive:true}));
  renderPlayers();
};

els.clearPlayers.onclick = ()=>{
  if(confirm("Clear all players?")){ state.players = []; renderPlayers(); }
};

// ---------- Word Pairs ----------
els.pairManager.addEventListener("click",(e)=>{
  if(e.target.classList.contains("addPair")){
    const row = e.target.closest(".pairRow");
    const civ = row.querySelector(".pairCiv").value.trim();
    const und = row.querySelector(".pairUnd").value.trim();
    if(!civ || !und) { showModal("Add pair", "Please enter both words."); return; }
    state.wordPairs.push({civ,und});
    row.querySelector(".pairCiv").value="";
    row.querySelector(".pairUnd").value="";
    showModal("Added", `Saved pair: ${civ} / ${und}`);
  }
});

// ---------- Assign Roles ----------
els.randomize.onclick = ()=>{
  // Gather config
  state.gameName = els.gameName.value.trim() || "Undercover Night";
  state.useRandomPair = els.useRandomPair.checked;
  state.civilianWord = els.wordCivilian.value.trim();
  state.undercoverWord = els.wordUndercover.value.trim();
  state.numUndercover = Math.max(0, parseInt(els.numUndercover.value||"0",10));
  state.numWhite = Math.max(0, parseInt(els.numWhite.value||"0",10));

  if(state.players.length < 3) return showModal("Need more players","Add at least 3 players.");
  const totalImpostors = state.numUndercover + state.numWhite;
  if(totalImpostors >= state.players.length) return showModal("Too many impostors","Impostors must be fewer than total players.");

  // Pick pair randomly if enabled
  if(state.useRandomPair){
    if(state.wordPairs.length===0) return showModal("No pairs","Add pairs or disable random mode.");
    const pick = state.wordPairs[Math.floor(Math.random()*state.wordPairs.length)];
    state.civilianWord = pick.civ;
    state.undercoverWord = pick.und;
    els.wordCivilian.value = pick.civ;
    els.wordUndercover.value = pick.und;
  }

  if(!state.civilianWord || !state.undercoverWord) return showModal("Words required","Enter civilian & undercover words or use random pair.");

  // Reset roles
  state.players.forEach(p=>{ p.role=null; p.alive=true; });

  // Build roles
  const ids = shuffle([...state.players.map(p=>p.id)]);
  const undIDs = new Set(ids.slice(0, state.numUndercover));
  const whiteIDs = new Set(ids.slice(state.numUndercover, state.numUndercover + state.numWhite));

  state.players.forEach(p=>{
    if(undIDs.has(p.id)) p.role = "UND";
    else if(whiteIDs.has(p.id)) p.role = "WHT";
    else p.role = "CIV";
  });

  state.assigned = true;
  els.assignSummary.textContent = `Assigned: ${countAlive("CIV")} Civilian, ${countAlive("UND")} Undercover, ${countAlive("WHT")} Mr. White`;
  // Move to reveal
  gotoReveal();
};

// ---------- Reveal Flow ----------
function gotoReveal(){
  revealIndex = 0;
  els.setup.classList.add("hidden");
  els.reveal.classList.remove("hidden");
  els.round.classList.add("hidden");
  updateRevealCard();
}

function updateRevealCard(){
  const ordered = state.players.map(p=>p); // original order
  const p = ordered[revealIndex];
  els.revealName.textContent = p.name;
  els.revealStep.textContent = `${revealIndex+1} / ${ordered.length}`;
  els.revealContent.innerHTML = `<button id="btnReveal" class="btn xl">Reveal</button>`;
  $("#btnReveal").onclick = ()=>{
    const roleText = p.role==="CIV" ? "Civilian" : p.role==="UND" ? "Undercover" : "Mr. White";
    const word = p.role==="CIV" ? state.civilianWord : p.role==="UND" ? state.undercoverWord : "(no word)";
    els.revealContent.innerHTML = `
      <div class="revealInner">
        <p class="revealWord">${word}</p>
        <button id="btnHide" class="btn ghost" style="margin-top:10px">Hide</button>
      </div>`;
    $("#btnHide").onclick = ()=> updateRevealCard();
  };
}

els.btnPrev.onclick = ()=>{ if(revealIndex>0){ revealIndex--; updateRevealCard(); } };
els.btnNext.onclick = ()=>{ if(revealIndex < state.players.length-1){ revealIndex++; updateRevealCard(); } };

els.toRound.onclick = ()=>{
  els.reveal.classList.add("hidden");
  els.round.classList.remove("hidden");
  renderAlive();
  renderVotes();
  log(`Game started: ${state.gameName}. Words set.`);
};

// ---------- Round / Voting ----------
function alivePlayers(){ return state.players.filter(p=>p.alive); }
function countAlive(role){ return state.players.filter(p=>p.alive && p.role===role).length; }
function renderAlive(){
  els.aliveList.innerHTML = "";
  state.players.forEach(p=>{
    const d = document.createElement("div");
    d.className = "chip"+(p.alive?"":" dead");
    d.textContent = p.name;
    els.aliveList.appendChild(d);
  });
}

function renderVotes(){
  els.votePanel.innerHTML = "";
  // For each alive player, create a dropdown to pick a target (cannot pick self)
  alivePlayers().forEach(p=>{
    const row = document.createElement("div");
    row.className = "voteRow";
    const label = document.createElement("div");
    label.textContent = p.name;
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value=""; empty.textContent="(no vote)";
    select.appendChild(empty);
    alivePlayers().forEach(t=>{
      if(t.id===p.id) return;
      const opt = document.createElement("option");
      opt.value = t.id; opt.textContent = t.name;
      select.appendChild(opt);
    });
    select.value = state.votes[p.id] || "";
    select.onchange = ()=>{ state.votes[p.id] = select.value; };
    row.appendChild(label);
    row.appendChild(select);
    els.votePanel.appendChild(row);
  });
}

els.btnClearVotes.onclick = ()=>{ state.votes = {}; renderVotes(); };

els.btnTally.onclick = ()=>{
  const votes = {};
  Object.entries(state.votes).forEach(([voter, targetId])=>{
    if(!targetId) return;
    votes[targetId] = (votes[targetId]||0)+1;
  });

  const pairs = Object.entries(votes).sort((a,b)=>b[1]-a[1]);
  if(pairs.length===0){ showModal("No votes","Cast some votes first."); return; }

  const topCount = pairs[0][1];
  const tied = pairs.filter(([_,c])=>c===topCount).map(([id])=>id);

  if(tied.length>1){
    const names = tied.map(id=>state.players.find(p=>p.id===id).name).join(", ");
    showModal("Tie","Tied between: "+names+". Clear non-tied votes and re-vote among them.");
    // Filter vote options to tied players only
    alivePlayers().forEach(p=>{
      if(state.votes[p.id] && !tied.includes(state.votes[p.id])) delete state.votes[p.id];
    });
    // Re-render with only tied in dropdowns
    $$("#votePanel select").forEach(sel=>{
      const keep = new Set(tied.concat([""]));
      [...sel.options].forEach(o=>{
        if(o.value && !keep.has(o.value)) o.remove();
      });
    });
    return;
  }

  const eliminatedId = pairs[0][0];
  const eliminated = state.players.find(p=>p.id===eliminatedId);
  eliminated.alive = false;
  renderAlive();

  log(`Eliminated: ${eliminated.name} (${roleLabel(eliminated.role)})`);
  speak(`${eliminated.name} eliminated`);

  // If Mr. White, allow instant guess
  if(eliminated.role === "WHT"){
    els.whiteGuessInput.value = "";
    els.dlgWhite.showModal();
    els.whiteGuessConfirm.onclick = ()=>{
      const guess = els.whiteGuessInput.value.trim();
      els.dlgWhite.close();
      if(guess && normalize(guess) === normalize(state.civilianWord)){
        endGame("Mr. White guessed correctly! Mr. White wins instantly.");
        return;
      } else {
        log(`Mr. White guessed "${guess || '(blank)'}" — incorrect.`);
      }
      checkWinOrContinue();
    };
  } else {
    checkWinOrContinue();
  }

  // Reset votes for next round
  state.votes = {};
  renderVotes();
};

function roleLabel(r){ return r==="CIV"?"Civilian":r==="UND"?"Undercover":"Mr. White"; }
function normalize(s){ return s.toLowerCase().replace(/\s+/g,"").trim(); }

function checkWinOrContinue(){
  const civ = countAlive("CIV");
  const und = countAlive("UND");
  const wht = countAlive("WHT");

  if(und===0 && wht===0){
    endGame("Civilians win! All impostors eliminated.");
    return;
  }
  if(civ <= 1 && (und>0 || wht>0)){
    // Impostors survive till only 1 civilian left
    endGame("Impostors win! Only one Civilian remains.");
    return;
  }
  log(`Next round. Civilians: ${civ}, Undercover: ${und}, Mr. White: ${wht}.`);
}

function endGame(message){
  showModal("Game Over", message + scoreBlurb());
  log(message);
  // Optionally lock out round controls
}

function scoreBlurb(){
  // Civilians 2 pts each, Mr White 6, Undercover 10 (from prompt)
  return `\nScoring tips — Civilians: +2 each if they won; Mr. White: +6 if win; Undercover: +10 if win.`;
}

// ---------- Timers ----------
function setTimer(secs){
  clearInterval(state.timers.handle);
  state.timers.secs = secs;
  renderTimer();
  state.timers.handle = setInterval(()=>{
    state.timers.secs--;
    renderTimer();
    if(state.timers.secs<=0){
      clearInterval(state.timers.handle);
      speak("Time up");
    }
  },1000);
}
function renderTimer(){
  const s = Math.max(0, state.timers.secs);
  const m = Math.floor(s/60).toString().padStart(2,"0");
  const ss = (s%60).toString().padStart(2,"0");
  els.timer.textContent = `${m}:${ss}`;
}

els.btnDescribe.onclick = ()=> setTimer(30);
els.btnDiscuss.onclick = ()=> setTimer(90);
els.btnResetTimers.onclick = ()=> { clearInterval(state.timers.handle); setTimer(0); };

// ---------- Export / Import ----------
els.btnExport.onclick = (e)=>{
  e.preventDefault();
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "undercover_state.json"; a.click();
  URL.revokeObjectURL(url);
};
els.btnImport.onclick = (e)=>{ e.preventDefault(); els.importFile.click(); };
els.importFile.onchange = (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ try{
    const obj = JSON.parse(r.result);
    Object.assign(state, obj);
    // basic re-render
    renderPlayers();
    showModal("Imported","State loaded. If roles were assigned, you can go straight to Reveal or Round.");
  }catch(err){ showModal("Import failed", String(err)); }};
  r.readAsText(f);
};

// ---------- Reset Game ----------
els.btnResetGame = $("#btnResetGame");
els.btnResetGame.onclick = ()=>{
  if(!confirm("Reset and start a new game?")) return;

  // Clear state
  state.gameName = "";
  state.civilianWord = "";
  state.undercoverWord = "";
  state.numUndercover = 1;
  state.numWhite = 1;
  state.players = [];
  state.assigned = false;
  state.useRandomPair = false;
  state.wordPairs = [];
  state.votes = {};
  clearInterval(state.timers.handle);

  // Reset UI
  els.gameName.value = "";
  els.wordCivilian.value = "";
  els.wordUndercover.value = "";
  els.numUndercover.value = 1;
  els.numWhite.value = 1;
  els.assignSummary.textContent = "";
  els.aliveList.innerHTML = "";
  els.votePanel.innerHTML = "";
  $("#log").innerHTML = "";

  renderPlayers();

  // Go back to setup
  els.setup.classList.remove("hidden");
  els.reveal.classList.add("hidden");
  els.round.classList.add("hidden");

  showModal("Game Reset","You can now set up a new game!");
};

els.btnNewGameKeep = $("#btnNewGameKeep");
// ---------- New Game while keeping players ----------
els.btnNewGameKeep.onclick = ()=>{
  if(!confirm("Start a new game with the same players?")) return;

  // Keep: players list & impostor counts & word pairs (optional)
  // Reset: alive flags, roles, votes, timers, words, assigned flag, logs
  state.players.forEach(p=>{ p.alive = true; p.role = null; });

  state.assigned = false;
  state.votes = {};
  clearInterval(state.timers.handle);

  // Clear current words so host will enter new ones (you can comment these two lines if you want to keep last words)
  state.civilianWord = "";
  state.undercoverWord = "";

  // UI resets
  els.wordCivilian.value = "";
  els.wordUndercover.value = "";
  els.assignSummary.textContent = "";
  els.aliveList.innerHTML = "";
  els.votePanel.innerHTML = "";
  $("#log").innerHTML = "";
  els.timer.textContent = "00:00";

  // Go back to Step 1 but keep players & impostor counts on screen
  renderPlayers();
  els.setup.classList.remove("hidden");
  els.reveal.classList.add("hidden");
  els.round.classList.add("hidden");

  showModal("New Game","Players kept. Enter new words and click ‘Assign Roles’.");  
};

// ---------- Helpers on load ----------
renderPlayers();
