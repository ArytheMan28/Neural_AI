// --- keep your imports ---
import { contentFilterText, stopAtLastPeriod, removeBlankLines } from "./content-filter.js";
// ⛔️ STOP exposing keys in the browser. We’ll call our own backend.
// import { hugging_face_key } from "./keys.js";

const submitButton = document.querySelector(".submit-btn");
const entry = document.querySelector(".image-gen-entry");
const textFrame = document.querySelector(".text-frame");
const downloadButton = document.querySelector(".download-btn");
const downloadableLink = document.querySelector(".download-link");

// If records is used elsewhere, make sure it's defined
window.records = window.records || [];

/**
 * Minimal change: keep the same signature and the same return shape your code expects:
 * returns [{ generated_text: "<assistant text>" }]
 * Internally we call YOUR backend (/api/chat) so no CORS and no leaked tokens.
 */
async function query(data) {
  const userText = data?.inputs ?? "";
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: userText })
  });

  // Surface server error as a friendly message, but keep structure
  let content = "(Sorry, there was an error.)";
  try {
    const json = await res.json();
    if (res.ok && json?.ok) {
      content = json.text || "";
    } else {
      content = json?.error || content;
    }
  } catch {
    // fall through with default content
  }
  return [{ generated_text: content }];
}

downloadButton.addEventListener('click', () => {
  const filename = "records.txt";
  let conversation = "";
  if (records.length > 0) {
    records.forEach(record => {
      conversation += record + '\n\n';
    });
    const blob = new Blob([conversation], { type: 'text/plain;charset=utf-8' });
    downloadableLink.download = filename;
    downloadableLink.href = window.URL.createObjectURL(blob);
  }
});

submitButton.addEventListener('click', () => {
  submit();
});

async function submit() {
  const input = entry.value;
  if (input !== "") {
    let contentValue = await contentFilterText(input);
    if (contentValue == 1) {
      // show user bubble
      const userInput = document.createElement('p');
      userInput.classList.add("user-bubble");
      userInput.innerHTML = input;
      textFrame.appendChild(userInput);
      textFrame.scrollTop = textFrame.scrollHeight;

      // clear and show thinking
      entry.value = "";
      entry.placeholder = "Thinking...";

      // query model via backend proxy (same shape as before)
      try {
        const response = await query({ inputs: input, parameters: { return_full_text: false } });
        const raw = response[0].generated_text || "";
        const aiContentValue = await contentFilterText(raw);
        if (aiContentValue == 1) {
          const cutoff = stopAtLastPeriod(raw);
          const aiOutput = document.createElement('p');
          aiOutput.classList.add("ai-bubble");
          aiOutput.innerHTML = cutoff;
          textFrame.appendChild(aiOutput);
          textFrame.scrollTop = textFrame.scrollHeight;

          entry.placeholder = "Ask me a question...";

          const noBlank = removeBlankLines(cutoff);
          records.push("User: " + input);
          records.push("AI: " + noBlank);
        } else {
          setPlaceholder(aiContentValue);
        }
      } catch (e) {
        console.error(e);
        setPlaceholder(2);
      }
    } else {
      setPlaceholder(contentValue);
    }
  }
}

function setPlaceholder(cv) {
  if (cv == 0) {
    entry.value = "";
    entry.placeholder = "Please be appropriate!";
  } else {
    entry.value = "";
    entry.placeholder = "There has been an error.";
  }
}
