const content = document.getElementById("content");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function settingsPrompt(text) {
  content.innerHTML = `<p class="muted">${text}</p>`;
  const btn = el('<button class="secondary">Open settings</button>');
  btn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  content.appendChild(btn);
}

/**
 * Injected into the job page. Best-effort: matches each visible field by its
 * label/name/placeholder and fills it. File inputs (resume upload) can't be
 * set by an extension, so those are left for the user.
 */
function fillForm(data) {
  const { profile, coverLetter } = data;
  const parts = (profile.name || "").trim().split(/\s+/);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ") || "";

  const map = [
    { keys: ["first name", "firstname", "given name", "fname"], value: first },
    { keys: ["last name", "lastname", "surname", "family name", "lname"], value: last },
    { keys: ["full name", "your name", "candidate name", "applicant name"], value: profile.name, generic: "name" },
    { keys: ["e-mail", "email"], value: profile.email },
    { keys: ["mobile", "telephone", "phone", "tel"], value: profile.phone },
    { keys: ["city", "town"], value: profile.location },
    { keys: ["location", "address"], value: profile.location },
    { keys: ["headline", "current title", "job title", "current role"], value: profile.headline },
  ];

  function labelText(node) {
    let t = "";
    if (node.id) {
      const l = document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
      if (l) t += " " + l.textContent;
    }
    const wrap = node.closest("label");
    if (wrap) t += " " + wrap.textContent;
    t +=
      " " + (node.name || "") +
      " " + (node.id || "") +
      " " + (node.placeholder || "") +
      " " + (node.getAttribute("aria-label") || "") +
      " " + (node.getAttribute("autocomplete") || "");
    return t.toLowerCase();
  }

  function setValue(node, value) {
    if (value == null || value === "") return false;
    const proto =
      node.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const blockGenericName = ["user", "company", "file", "screen", "display", "event", "middle", "nick"];
  let filled = 0;
  const nodes = Array.from(document.querySelectorAll("input, textarea, select"));

  for (const node of nodes) {
    const type = (node.type || "").toLowerCase();
    if (["hidden", "file", "password", "submit", "button", "checkbox", "radio"].includes(type)) continue;
    if (node.disabled || node.readOnly) continue;
    if (node.value && node.value.trim() !== "") continue;

    const hay = labelText(node);

    if (
      node.tagName === "TEXTAREA" &&
      coverLetter &&
      /(cover|letter|message|motivat|why .*(you|us|role|company)|tell us|additional)/.test(hay)
    ) {
      if (setValue(node, coverLetter)) filled++;
      continue;
    }

    for (const m of map) {
      if (!m.value) continue;
      const hit = m.keys.some((k) => hay.includes(k));
      if (!hit) continue;
      if (m.generic === "name" && blockGenericName.some((b) => hay.includes(b))) break;

      if (node.tagName === "SELECT") {
        const opt = Array.from(node.options).find((o) =>
          o.text.toLowerCase().includes(String(m.value).toLowerCase())
        );
        if (opt) {
          node.value = opt.value;
          node.dispatchEvent(new Event("change", { bubbles: true }));
          filled++;
        }
      } else if (setValue(node, m.value)) {
        filled++;
      }
      break;
    }
  }
  return filled;
}

async function render() {
  const cfg = await chrome.storage.sync.get(["portalUrl", "token"]);
  if (!cfg.portalUrl || !cfg.token) {
    return settingsPrompt(
      "Add your portal address and access token to get started."
    );
  }

  let data;
  try {
    const res = await fetch(`${cfg.portalUrl}/api/extension/me`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
  } catch (err) {
    return settingsPrompt(
      `Couldn't reach the portal (${err.message}). Check the address and token in settings.`
    );
  }

  const apps = data.applications || [];
  const ready = apps.filter((a) => a.status === "ready" || a.status === "submitted");
  const list = ready.length ? ready : apps;

  content.innerHTML = "";
  content.appendChild(
    el(
      `<p class="muted">Signed in as <strong>${data.profile.name || data.profile.email}</strong>${data.demo ? " · demo data" : ""}</p>`
    )
  );

  if (!list.length) {
    content.appendChild(
      el(
        '<p class="muted">No prepared applications yet. Curate a resume &amp; cover letter in the portal, then come back.</p>'
      )
    );
    return;
  }

  const label = el('<p class="muted" style="margin-top:8px">Applying for</p>');
  content.appendChild(label);

  const select = el("<select></select>");
  list.forEach((a, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `${a.job_title} — ${a.company}${a.status === "ready" ? " (ready)" : ""}`;
    select.appendChild(o);
  });
  content.appendChild(select);

  const fillBtn = el('<button class="primary">Autofill this page</button>');
  content.appendChild(fillBtn);

  const copyBtn = el('<button class="ghost">Copy cover letter</button>');
  content.appendChild(copyBtn);

  content.appendChild(el("<hr/>"));
  const docs = el('<div class="row"></div>');
  content.appendChild(docs);

  const msg = el('<div id="msg"></div>');
  content.appendChild(msg);

  const note = el(
    '<p class="muted" style="margin-top:8px">Tip: the resume file must be attached by hand — browsers don\'t let extensions do that. Open it below, then review everything before you submit.</p>'
  );
  content.appendChild(note);

  function selected() {
    return list[Number(select.value)] || list[0];
  }

  function refreshDocs() {
    docs.innerHTML = "";
    const a = selected();
    if (a.resume_link) {
      docs.appendChild(
        el(`<a class="link" target="_blank" href="${a.resume_link}">📄 Open resume</a>`)
      );
    }
    if (a.cover_letter_link) {
      docs.appendChild(
        el(`<a class="link" target="_blank" href="${a.cover_letter_link}">💌 Open cover letter</a>`)
      );
    }
    if (!a.resume_link && !a.cover_letter_link) {
      docs.appendChild(el('<span class="muted">Documents are shown via Copy.</span>'));
    }
  }
  refreshDocs();
  select.addEventListener("change", refreshDocs);

  fillBtn.addEventListener("click", async () => {
    const a = selected();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillForm,
        args: [{ profile: data.profile, coverLetter: a.cover_letter_text || "" }],
      });
      msg.className = "good";
      msg.textContent =
        result > 0
          ? `Filled ${result} field${result === 1 ? "" : "s"}. Review, attach your resume, and submit.`
          : "No matching fields found on this page — try Copy and paste manually.";
    } catch (e) {
      msg.className = "bad";
      msg.textContent = "Couldn't fill this page (it may block extensions).";
    }
  });

  copyBtn.addEventListener("click", async () => {
    const a = selected();
    await navigator.clipboard.writeText(a.cover_letter_text || "");
    msg.className = "good";
    msg.textContent = "Cover letter copied to clipboard.";
  });
}

render();
