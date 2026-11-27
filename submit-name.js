const DISCORD_API_TIMEOUT_MS = 8000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.in",
  "outlook.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "yahoo.ca",
  "yahoo.de",
  "yahoo.fr",
  "yahoo.com.au",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "aol.com",
  "zoho.com",
  "zohomail.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "fastmail.com",
  "tuta.com",
  "tuta.io",
  "tutamail.com",
  "yandex.com",
  "yandex.ru",
  "rediffmail.com",
]);

function isAllowedEmail(email) {
  if (!EMAIL_REGEX.test(email) || email.length > 254) return false;
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const [localPart, domain] = parts;
  if (!localPart || /^[.]|[.]$|\.\./.test(localPart)) return false;
  return ALLOWED_EMAIL_DOMAINS.has(domain);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 4096) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    }
    if (req.body && typeof req.body === "object") {
      return Promise.resolve(req.body);
    }
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  const botToken = process.env.DISCORD_BOT_TOKEN || "";
  const channelId = process.env.DISCORD_CHANNEL_ID || "";

  if (!botToken || !channelId) {
    sendJson(res, 500, {
      error: "Server is missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID.",
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
    return;
  }

  const rawName = typeof body.name === "string" ? body.name : "";
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const name = rawName.replace(/[\r\n]+/g, " ").trim();
  const email = rawEmail.replace(/[\r\n]+/g, "").trim();

  if (!name) {
    sendJson(res, 400, { error: "Name is required." });
    return;
  }
  if (name.length > 100) {
    sendJson(res, 400, { error: "Name must be 100 characters or fewer." });
    return;
  }
  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    sendJson(res, 400, { error: "A valid email is required." });
    return;
  }
  if (!isAllowedEmail(email)) {
    sendJson(res, 400, {
      error: "Please use a known email provider (e.g. Gmail, Outlook, Yahoo, iCloud, Proton).",
    });
    return;
  }

  try {
    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `New visitor:\n- **Name:** ${name}\n- **Email:** ${email}`,
          allowed_mentions: { parse: [] },
        }),
        signal: AbortSignal.timeout(DISCORD_API_TIMEOUT_MS),
      }
    );

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error("Discord API error:", discordRes.status, errorText);
      sendJson(res, 502, { error: "Discord bot failed to send the message." });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error("Failed to reach Discord API:", err);
    sendJson(res, 502, { error: "Could not reach Discord." });
  }
};
