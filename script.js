// script.js

// ---------- Socket.IO Setup ----------
const socket = io("https://wordle-backend-63w9.onrender.com");

socket.on("start", ({ word }) => {
  console.log("Spelet har börjat – ordet är:", word);
  solution = word;
  restartGame();
});

socket.on("restart", ({ word }) => {
  console.log("Spelet har startats om – nytt ord:", word);
  solution = word;
  restartGame();
});

// Lyssna på topplista från server och uppdatera
socket.on("leaderboard", ({ players }) => updateLeaderboard(players));

// ---------- Globala variabler ----------
let isMultiplayer   = false;
let isHost          = false;
let currentParty    = "";
let playerName      = "";
let tries           = 0;

const board         = document.getElementById("board");
const message       = document.getElementById("message");
const leaderboardEl = document.getElementById("leaderboard"); // NYTT element
let lastGuess       = "";
let hintUsed        = false;
let playingDaily    = false;

// Ordbanker
let dictionary       = [];
let dictionaryLoaded = false;
let wordList         = [];
let shuffledWords    = [];
let solution         = "";
let wordListLoaded   = false;

// DOM-element
const input       = document.getElementById("guess");
const guessButton = document.querySelector("button[onclick='checkGuess()']");
const loadingMsg  = document.createElement("div");
loadingMsg.id     = "loading-msg";
loadingMsg.textContent = "Laddar ordbank...";
document.body.insertBefore(loadingMsg, document.body.firstChild);
input.disabled = true;
if (guessButton) guessButton.disabled = true;

// Ljudfiler
const soundCorrect = new Audio("sounds/correct.mp3");
const soundYellow  = new Audio("sounds/yellow.mp3");
const soundWrong   = new Audio("sounds/wrong.mp3");
const soundWin     = new Audio("sounds/win.mp3");
const soundLose    = new Audio("sounds/lose.mp3");

// ---------- Hämta ordlistor ----------
fetch("ord.txt")
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    dictionary = text.split(",").map(w => w.trim().toLowerCase()).filter(w => w.length === 5);
    dictionaryLoaded = true;
    input.disabled = false;
    if (guessButton) guessButton.disabled = false;
    loadingMsg.remove();
  })
  .catch(() => {
    loadingMsg.textContent = "Fel vid laddning av ordbank!";
    alert("Kunde inte ladda ordlistan.");
  });

fetch("wordList.txt")
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    wordList = text.split(",").map(w => w.trim().toLowerCase()).filter(w => w.length === 5);
    shuffledWords = shuffle([...wordList]);
    wordListLoaded = true;
    if (!isMultiplayer) {
      solution = shuffledWords[0];
      input.disabled = false;
      if (guessButton) guessButton.disabled = false;
    }
  })
  .catch(() => alert("Kunde inte ladda wordList.txt."));

// ---------- Hjälpfunktioner ----------
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createRow(guess, feedback) {
  const row = document.createElement("div");
  row.className = "row";
  for (let i = 0; i < 5; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = guess[i];
    row.appendChild(tile);
    setTimeout(() => {
      tile.classList.add("flip", feedback[i]);
      if (feedback[i] === "green") soundCorrect.play();
      else if (feedback[i] === "yellow") soundYellow.play();
      else soundWrong.play();
    }, i * 300);
  }
  board.appendChild(row);
}

function updateKeyboard(guess, feedback) {
  document.querySelectorAll(".key").forEach(key => {
    const letter = key.textContent;
    for (let i = 0; i < 5; i++) {
      if (letter === guess[i].toUpperCase()) {
        key.classList.add(feedback[i]);
      }
    }
  });
}

function updateLeaderboard(players) {
  // players = [ { name, score }, ... ]
  leaderboardEl.innerHTML = "<h3>🏆 Topplista</h3>";
  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.padding = "0";
  players.forEach((p, i) => {
    const li = document.createElement("li");
    li.textContent = `${i+1}. ${p.name} – ${p.score} poäng`;
    ul.appendChild(li);
  });
  leaderboardEl.appendChild(ul);
}

function checkGuess() {
  if (input.disabled) return;
  const guess = input.value.toLowerCase().trim();
  if (guess.length !== 5) return alert("Ordet måste vara 5 bokstäver!");
  if (!dictionaryLoaded || !wordListLoaded) return alert("Ordlistor laddas – vänta.");
  if (!dictionary.includes(guess)) return alert("Ordet finns inte.");

  let feedback = Array(5).fill("gray"), used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === solution[i]) { feedback[i] = "green"; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (feedback[i] !== "green") {
      for (let j = 0; j < 5; j++) {
        if (!used[j] && guess[i] === solution[j]) {
          feedback[i] = "yellow";
          used[j] = true;
          break;
        }
      }
    }
  }

  createRow(guess, feedback);
  updateKeyboard(guess, feedback);
  input.value = "";
  tries++;
  lastGuess = guess;

  if (isMultiplayer) {
    socket.emit("guess", { party: currentParty, guess });
  }

  if (guess === solution) {
    soundWin.play();
    message.textContent = `🎉 Klarade på ${tries}/6!`;
    input.disabled = true;
    if (guessButton) guessButton.disabled = true;
    if (playingDaily) saveResult(true, tries);

    // Multiplayer finish
    if (isMultiplayer) {
      socket.emit("finish", {
        party: currentParty,
        tries,
        finishTime: Date.now()
      });
    }
  } else if (tries >= 6) {
    soundLose.play();
    message.textContent = `❌ Förlust! Ordet var ${solution.toUpperCase()}`;
    input.disabled = true;
    if (guessButton) guessButton.disabled = true;
    if (playingDaily) saveResult(false, tries);
  }
}

function generatePartyCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
}

function showHint() {
  if (hintUsed || lastGuess.length !== 5) return alert("Inget tips!");
  for (let i = 0; i < 5; i++) {
    if (lastGuess[i] !== solution[i]) {
      hintUsed = true;
      return alert(`Tips: Bokstav ${i+1} = ${solution[i].toUpperCase()}`);
    }
  }
  alert("Alla bokstäver redan rätt!");
}

function resetKeyboardColors() {
  document.querySelectorAll(".key").forEach(key => key.classList.remove("green","yellow","gray"));
}

function restartGame() {
  if (!wordListLoaded) return alert("Laddar ordlistan…");
  hintUsed = false;
  lastGuess = "";
  tries = 0;
  board.innerHTML = "";
  message.textContent = "";
  resetKeyboardColors();
  if (!isMultiplayer) {
    shuffledWords = shuffle([...wordList]);
    solution      = shuffledWords[0];
  }
  input.disabled = false;
  if (guessButton) guessButton.disabled = false;
}

function getWordOfTheDay() {
  const startDate = new Date("2025-01-01");
  const diff = Math.floor((Date.now() - startDate) / 86400000);
  return { word: wordList[diff % wordList.length], dayNumber: diff };
}

function startDailyGame() {
  if (!wordListLoaded) return alert("Laddar…");
  playingDaily = true;
  hintUsed = false;
  lastGuess = "";
  const { word, dayNumber } = getWordOfTheDay();
  solution = word;
  board.innerHTML = "";
  message.textContent = `🔁 Dagens ord – Dag ${dayNumber}`;
  tries = 0;
  input.disabled = false;
  input.value = "";
  resetKeyboardColors();
}

function saveResult(success, attempts) {
  const { word, dayNumber } = getWordOfTheDay();
  const date = new Date().toLocaleDateString("sv-SE");
  const history = JSON.parse(localStorage.getItem("wordleHistory") || "[]");
  if (!history.some(e => e.dayNumber === dayNumber)) {
    history.push({ date, dayNumber, word, success, attempts: success ? attempts : null });
    localStorage.setItem("wordleHistory", JSON.stringify(history));
  }
}

// ---------- Setup Events ----------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("host-controls").style.display = "none";
  document.getElementById("restart").addEventListener("click", restartGame);
  document.getElementById("hint-button").addEventListener("click", showHint);
  document.getElementById("play-daily").addEventListener("click", startDailyGame);

  input.addEventListener("keydown", e => { if (e.key === "Enter") checkGuess(); });
  document.querySelectorAll(".key").forEach(key => {
    if (key.id === "backspace") return;
    key.addEventListener("click", () => {
      if (input.value.length < 5 && !input.disabled) input.value += key.textContent.toLowerCase();
    });
  });
  document.getElementById("backspace").addEventListener("click", () => {
    if (!input.disabled) input.value = input.value.slice(0, -1);
  });

  document.getElementById("create-party").addEventListener("click", () => {
    playerName    = prompt("Ditt namn:");
    currentParty  = generatePartyCode();
    isMultiplayer = true;
    isHost        = true;
    socket.emit("join", { name: playerName, party: currentParty });
    document.getElementById("party-info").innerHTML = `
      <p>Du har skapat party: <strong>${currentParty}</strong></p>
      <p>Dela koden!</p>`;
    document.getElementById("host-controls").style.display = "block";
  });

  document.getElementById("join-party").addEventListener("click", () => {
    playerName    = prompt("Ditt namn:");
    currentParty  = document.getElementById("join-code").value.toUpperCase().trim();
    if (currentParty.length < 3) return alert("Ogiltig partykod");
    isMultiplayer = true;
    isHost        = false;
    socket.emit("join", { name: playerName, party: currentParty });
    document.getElementById("party-info").innerHTML = `
      <p>Du gick med i party: <strong>${currentParty}</strong></p>`;
    document.getElementById("host-controls").style.display = "none";
  });

  document.getElementById("start-game").addEventListener("click", () => {
    if (isHost) socket.emit("startGame", { party: currentParty });
  });
  document.getElementById("restart-game").addEventListener("click", () => {
    if (isHost) socket.emit("restartGame", { party: currentParty });
  });

  document.getElementById("show-history").addEventListener("click", () => {
    const history = JSON.parse(localStorage.getItem("wordleHistory") || "[]");
    const container = document.getElementById("history");
    if (!history.length) return container.innerHTML = "<p>Inga resultat ännu.</p>";
    let html = "<h3>📈 Historik</h3><ul style='list-style:none;padding:0'>";
    history.forEach(e => {
      html += `<li>${e.date} – Dag ${e.dayNumber} – ${e.success ? `✅ ${e.attempts}/6` : '❌ Förlorade'} – (${e.word.toUpperCase()})</li>`;
    });
    container.innerHTML = html + "</ul>";
  });

  if (!isMultiplayer) restartGame();
});
