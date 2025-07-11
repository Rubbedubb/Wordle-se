// Huvudscript för svensk Wordle-se

// Ladda in alla ord från ord.txt till dictionary[] (tillåtna ord)
let dictionary = [];
let dictionaryLoaded = false;
const input = document.getElementById("guess");
const guessButton = document.querySelector("button[onclick='checkGuess()']");
const loadingMsg = document.createElement("div");
loadingMsg.id = "loading-msg";
loadingMsg.textContent = "Laddar ordbank...";
document.body.insertBefore(loadingMsg, document.body.firstChild);
input.disabled = true;
if (guessButton) guessButton.disabled = true;

fetch('ord.txt')
  .then(response => {
    if (!response.ok) throw new Error('Kunde inte ladda ordlistan.');
    return response.text();
  })
  .then(text => {
    dictionary = text.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length === 5);
    dictionaryLoaded = true;
    input.disabled = false;
    if (guessButton) guessButton.disabled = false;
    loadingMsg.remove();
  })
  .catch(err => {
    loadingMsg.textContent = "Fel vid laddning av ordbank!";
    input.disabled = true;
    if (guessButton) guessButton.disabled = true;
    alert("Kunde inte ladda ordlistan. Kontrollera din anslutning eller försök igen senare.");
  });

let wordList = [];
let shuffledWords = [];
let solution = "";
let wordListLoaded = false;
let tries = 0; // Lägg till denna rad bland globala variabler

// Ljudfiler (lägg till dina egna ljudfiler i projektmappen)
const soundCorrect = new Audio("sounds/correct.mp3");
const soundWrong = new Audio("sounds/wrong.mp3");
const soundYellow = new Audio("sounds/yellow.mp3");
const soundWin = new Audio("sounds/win.mp3");
const soundLose = new Audio("sounds/lose.mp3");

fetch('wordList.txt')
  .then(response => {
    if (!response.ok) throw new Error('Kunde inte ladda wordList.txt');
    return response.text();
  })
  .then(text => {
    wordList = text
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length === 5);
    shuffledWords = shuffle([...wordList]);
    solution = shuffledWords[0].toLowerCase();
    wordListLoaded = true;
  })
  .catch(err => {
    alert("Kunde inte ladda wordList.txt. Kontrollera din anslutning eller försök igen senare.");
  });

// Blanda orden slumpmässigt (Fisher-Yates shuffle)
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

  let lastWasGreen = false;

  for (let i = 0; i < 5; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = guess[i];

    row.appendChild(tile);

    // Om föregående ljud var correct.mp3, vänta lite längre innan nästa ljud
    let delay = i * 300;
    if (i > 0 && feedback[i - 1] === "green") {
      delay += 0; // Vänta 0 ms extra om förra var grön
    }

    setTimeout(() => {
      tile.classList.add("flip");
      if (feedback) tile.classList.add(feedback[i]);

      // Spela olika ljud beroende på feedback
      // Spela olika ljud beroende på feedback
      if (feedback[i] === "green") {
        soundCorrect.currentTime = 0;
        soundCorrect.play();
      } else if (feedback[i] === "yellow") {
        soundYellow.currentTime = 0;
        soundYellow.play();
      } else {
        soundWrong.currentTime = 0;
        soundWrong.play();
      }
    }, delay);
  }
  board.appendChild(row);
}

function checkGuess() {
  // Stoppa om spelet är slut
  if (input.disabled) return;

  const guess = input.value.toLowerCase();
  if (guess.length !== 5) {
    alert("Ordet måste vara 5 bokstäver!");
    return;
  }
  if (!dictionaryLoaded) {
    alert("Ordbanken laddas, vänta ett ögonblick och försök igen.");
    return;
  }
  if (!wordListLoaded) {
    alert("WordList laddas, vänta ett ögonblick och försök igen.");
    return;
  }
  if (!dictionary.includes(guess)) {
    alert("Ordet finns inte i ordbanken.");
    return;
  }

  let feedback = Array(5).fill("gray");
  let used = Array(5).fill(false);

  // Kolla rätt position (grön)
  for (let i = 0; i < 5; i++) {
    if (guess[i] === solution[i]) {
      feedback[i] = "green";
      used[i] = true;
    }
  }

  // Kolla fel position (gul)
  for (let i = 0; i < 5; i++) {
    if (feedback[i] === "green") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === solution[j]) {
        feedback[i] = "yellow";
        used[j] = true;
        break;
      }
    }
  }

  createRow(guess, feedback);
  updateKeyboard(guess, feedback);
  input.value = "";
  tries++; // <--- Denna rad är viktig!
  lastGuess = guess;

  // Avsluta spelet när det är klart
  if (guess === solution) {
    soundWin.play();
    message.textContent = `🎉 Du klarade det på ${tries}/6 försök!`;
    input.disabled = true;
    if (guessButton) guessButton.disabled = true;
    if (playingDaily) saveResult(true, tries);
  }
  else if (tries >= 6) {
    soundLose.play();
    message.textContent = `❌ Du förlorade! Ordet var: ${solution.toUpperCase()}`;
    input.disabled = true;
    if (guessButton) guessButton.disabled = true;
    if (playingDaily) saveResult(false, tries);
  }
}

function showHint() {
  if (hintUsed || !lastGuess || lastGuess.length !== 5) {
    alert("💡 Inget tips tillgängligt just nu!");
    return;
  }

  // Hitta första fel bokstav
  for (let i = 0; i < 5; i++) {
    if (lastGuess[i] !== solution[i]) {
      alert(`💡 Tips: Bokstav ${i + 1} ska vara "${solution[i].toUpperCase()}"`);
      hintUsed = true;
      return;
    }
  }

  alert("✅ Alla bokstäver var redan rätt!");
}

function resetKeyboardColors() {
  const keys = document.querySelectorAll(".key");
  keys.forEach(key => {
    key.classList.remove("green", "yellow", "gray");
  });
}

function restartGame() {
  if (!wordListLoaded) {
    alert("WordList laddas, vänta ett ögonblick och försök igen.");
    return;
  }
  hintUsed = false;
  lastGuess = "";
  playingDaily = false;
  shuffledWords = shuffle([...wordList]);
  solution = shuffledWords[0].toLowerCase();
  board.innerHTML = "";
  message.textContent = "";
  tries = 0;
  input.disabled = !dictionaryLoaded;
  if (guessButton) guessButton.disabled = !dictionaryLoaded;
  input.value = "";
  input.focus();
  resetKeyboardColors();
}

function getWordOfTheDay() {
  if (!wordListLoaded) {
    alert("WordList laddas, vänta ett ögonblick och försök igen.");
    return { word: "", dayNumber: 0 };
  }
  const startDate = new Date("2025-01-01"); // Valfritt startdatum
  const today = new Date();

  const diffTime = today - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return {
    word: wordList[diffDays % wordList.length].toLowerCase(),
    dayNumber: diffDays
  };
}

function startDailyGame() {
  if (!wordListLoaded) {
    alert("WordList laddas, vänta ett ögonblick och försök igen.");
    return;
  }
  const daily = getWordOfTheDay();
  playingDaily = true;
  hintUsed = false;
  lastGuess = "";
  
  solution = daily.word;
  board.innerHTML = "";
  message.textContent = `🔁 Dagens ord – Dag ${daily.dayNumber}`;
  tries = 0;

  const input = document.getElementById("guess");
  input.disabled = false;
  input.value = "";
  input.focus();

  resetKeyboardColors();
}

function saveResult(success, attempts) {
  const daily = getWordOfTheDay();
  const result = {
    date: new Date().toLocaleDateString("sv-SE"),
    dayNumber: daily.dayNumber,
    word: daily.word,
    success: success,
    attempts: success ? attempts : null
  };

  // Hämta nuvarande historik från localStorage
  const history = JSON.parse(localStorage.getItem("wordleHistory") || "[]");

  // Undvik dubbletter för samma dag
  const alreadyExists = history.some(entry => entry.dayNumber === result.dayNumber);
  if (!alreadyExists) {
    history.push(result);
    localStorage.setItem("wordleHistory", JSON.stringify(history));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("restart").addEventListener("click", restartGame);
  
  document.getElementById("hint-button").addEventListener("click", showHint);

  // Enter på tangentbordet
  document.getElementById("guess").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      checkGuess();
    }
  });

  // Klick på alla tangenter (utom specialknappar)
  document.querySelectorAll(".key").forEach(key => {
    if (key.id === "backspace") return; // hoppa över backspace

    key.addEventListener("click", () => {
      const input = document.getElementById("guess");
      if (input.value.length < 5 && !input.disabled) {
        input.value += key.textContent.toLowerCase();
      }
    });
  });

  // Backspace-knappen
  document.getElementById("backspace").addEventListener("click", () => {
    const input = document.getElementById("guess");
    if (!input.disabled && input.value.length > 0) {
      input.value = input.value.slice(0, -1);
    }
  });
  document.getElementById("play-daily").addEventListener("click", startDailyGame);
  
  document.getElementById("show-history").addEventListener("click", () => {
  const history = JSON.parse(localStorage.getItem("wordleHistory") || "[]");
  const container = document.getElementById("history");

  if (history.length === 0) {
    container.innerHTML = "<p>Inga resultat ännu.</p>";
    return;
  }

  let html = "<h3>📈 Historik</h3><ul style='list-style:none;padding:0'>";
  history.forEach(entry => {
    html += `<li>
      ${entry.date} – Dag ${entry.dayNumber} – ${
        entry.success ? `✅ ${entry.attempts}/6` : "❌ Förlorade"
      } – (${entry.word.toUpperCase()})
    </li>`;
  });
  html += "</ul>";
  container.innerHTML = html;
});
});

// Funktion för att uppdatera färgerna på tangenterna
function updateKeyboard(guess, feedback) {
  const keys = document.querySelectorAll(".key");

  for (let i = 0; i < guess.length; i++) {
    const letter = guess[i].toUpperCase();
    const key = [...keys].find(k => k.textContent === letter);
    if (!key) continue;

    if (feedback[i] === "green") {
      key.classList.remove("yellow", "gray");
      key.classList.add("green");
    } else if (feedback[i] === "yellow" && !key.classList.contains("green")) {
      key.classList.remove("gray");
      key.classList.add("yellow");
    } else if (
      feedback[i] === "gray" &&
      !key.classList.contains("green") &&
      !key.classList.contains("yellow")
    ) {
      key.classList.add("gray");
    }
  }
}
