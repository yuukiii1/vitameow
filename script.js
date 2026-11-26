const form = document.getElementById("name-form");
const nameInput = document.getElementById("visitor-name");
const emailInput = document.getElementById("visitor-email");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("form-status");
const downloadsSection = document.getElementById("downloads-section");
const lockNote = document.getElementById("downloads-lock-note");
const downloadLinks = document.querySelectorAll(".download-link");

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type ? `form-status ${type}` : "form-status";
}

function unlockDownloads() {
  downloadsSection.classList.remove("is-locked");
  if (lockNote) {
    lockNote.hidden = true;
  }
  for (const link of downloadLinks) {
    if (link.dataset.href) {
      link.href = link.dataset.href;
    }
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  }
}

for (const link of downloadLinks) {
  link.addEventListener("click", (event) => {
    if (downloadsSection.classList.contains("is-locked")) {
      event.preventDefault();
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name) {
    setStatus("Please enter your name.", "error");
    nameInput.focus();
    return;
  }

  if (!email || !emailInput.checkValidity()) {
    setStatus("Please enter a valid email address.", "error");
    emailInput.focus();
    return;
  }

  submitBtn.disabled = true;
  setStatus("Sending...", "");

  try {
    const response = await fetch("/api/submit-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Failed to send your details.");
    }

    unlockDownloads();
    setStatus(`Thanks, ${name}! Download is now unlocked.`, "success");
    form.reset();
  } catch (err) {
    setStatus(err.message || "Something went wrong.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
