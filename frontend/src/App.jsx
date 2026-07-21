import React, { useState, useRef } from "react";
import {
  Mail, Phone, MapPin, Linkedin, Globe, Sparkles, Plus, Trash2,
  Download, ChevronRight, ChevronLeft, Loader2, User, Briefcase,
  GraduationCap, Languages as LangIcon, Award, Target, Check, AlertCircle, ImagePlus
} from "lucide-react";

// ---------- design tokens ----------
const INK = "#1B2A4A";      // deep ink navy — headings, primary text
const STEEL = "#3B5BA5";    // steel blue — accent / links / active state
const GOLD = "#B8862E";     // muted brass/gold — the AI "seal" accent
const PAPER = "#FAF8F3";    // warm paper background
const LINE = "#E1DCCF";     // hairline border on paper
const SLATE = "#5B6472";    // secondary text

const FONT_SERIF = "'Source Serif 4', Georgia, serif";
const FONT_SANS = "'Inter', system-ui, sans-serif";

const uid = () => Math.random().toString(36).slice(2, 10);

// Capitalizes the first letter of each word, leaves existing casing (e.g. acronyms) alone.
// Used on blur for short fields like names, companies, schools — instant, no API call.
const capitalizeWords = (s) =>
  typeof s === "string" ? s.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s;

// Fixes spelling mistakes and capitalization (sentence starts, proper nouns, "I") in longer
// free-text fields via Claude, without changing wording, tone, or meaning.
async function autoCorrectSpelling(text) {
  if (!text || !text.trim()) return text;
  const corrected = await askClaude(
    "You are a careful proofreader. Fix ONLY spelling mistakes and capitalization (start of sentences, proper nouns, the word 'I'). Do not change word choice, tone, structure, punctuation style, or line breaks otherwise, and do not add or remove content. Return ONLY the corrected text, with the same line breaks as the input, no preamble, no explanation.",
    text
  );
  return corrected;
}

const emptyExperience = () => ({
  id: uid(), company: "", role: "", location: "", start: "", end: "",
  current: false, bullets: ""
});
const emptyEducation = () => ({
  id: uid(), school: "", degree: "", field: "", start: "", end: "", grade: ""
});
const emptyLanguage = () => ({ id: uid(), name: "", level: "Conversational" });
const emptyCert = () => ({ id: uid(), name: "", issuer: "", year: "" });

const initialData = {
  personal: { fullName: "", email: "", phone: "", location: "", linkedin: "", website: "", photo: null },
  target: { jobTitle: "", summary: "" },
  education: [emptyEducation()],
  experience: [emptyExperience()],
  skills: [],
  languages: [emptyLanguage()],
  certifications: []
};

const STEPS = [
  { key: "personal", label: "Personal", icon: User },
  { key: "target", label: "Objective", icon: Target },
  { key: "experience", label: "Experience", icon: Briefcase },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "skills", label: "Skills", icon: Award },
  { key: "languages", label: "Languages", icon: LangIcon },
];

// ---------- Claude API helper (via our backend, so the API key stays server-side) ----------
async function askClaude(systemPrompt, userPrompt) {
  const response = await fetch("/api/ai/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: systemPrompt, user: userPrompt })
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `AI request failed (${response.status})`);
  }
  const data = await response.json();
  if (!data.text) throw new Error("Empty AI response");
  return data.text;
}

// ---------- small UI atoms ----------
function Field({ label, children, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold tracking-wide uppercase mb-1.5" style={{ color: SLATE }}>
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: SLATE }}>{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:ring-2";
const inputStyle = { borderColor: LINE, color: INK };

const TextInput = React.forwardRef(({ onFocus, onBlur, ...props }, ref) => (
  <input
    {...props}
    ref={ref}
    className={inputCls + " " + (props.className || "")}
    style={{ ...inputStyle, ...(props.style || {}) }}
    onFocus={(e) => { e.target.style.boxShadow = `0 0 0 3px ${STEEL}22`; onFocus && onFocus(e); }}
    onBlur={(e) => { e.target.style.boxShadow = "none"; onBlur && onBlur(e); }}
  />
));
function TextArea({ onFocus, onBlur, ...props }) {
  return (
    <textarea
      {...props}
      className={inputCls + " resize-y " + (props.className || "")}
      style={{ ...inputStyle, ...(props.style || {}) }}
      onFocus={(e) => { e.target.style.boxShadow = `0 0 0 3px ${STEEL}22`; onFocus && onFocus(e); }}
      onBlur={(e) => { e.target.style.boxShadow = "none"; onBlur && onBlur(e); }}
    />
  );
}

function AiButton({ onClick, loading, label = "Polish with AI" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition disabled:opacity-60"
      style={{ borderColor: GOLD, color: GOLD, background: `${GOLD}0F` }}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      {loading ? "Thinking…" : label}
    </button>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold mb-5" style={{ color: INK, fontFamily: FONT_SERIF }}>
      <Icon size={18} style={{ color: STEEL }} />
      {children}
    </h2>
  );
}

// ---------- Main App ----------
export default function RBuildora() {
  const [data, setData] = useState(initialData);
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState("modern"); // modern | ats
  const [aiLoading, setAiLoading] = useState({});
  const [error, setError] = useState("");
  const [mobileView, setMobileView] = useState("edit"); // edit | preview
  const printRef = useRef(null);
  const lastCorrectedRef = useRef({}); // avoids re-correcting unchanged text on repeat blurs

  const setLoading = (key, val) => setAiLoading((s) => ({ ...s, [key]: val }));
  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  };

  // Silently fixes spelling + capitalization in a free-text field when the user leaves it.
  // getValue/setValue read and write the current field; key scopes the loading + dedupe state.
  const correctOnBlur = async (key, getValue, setValue) => {
    const value = getValue();
    if (!value || !value.trim() || lastCorrectedRef.current[key] === value) return;
    setLoading("correct-" + key, true);
    try {
      const fixed = await autoCorrectSpelling(value);
      lastCorrectedRef.current[key] = fixed;
      setValue(fixed);
    } catch (e) {
      // Fail silently for background correction — don't interrupt the user's flow.
    } finally {
      setLoading("correct-" + key, false);
    }
  };

  const update = (section, patch) =>
    setData((d) => ({ ...d, [section]: { ...d[section], ...patch } }));

  const updateList = (section, id, patch) =>
    setData((d) => ({
      ...d,
      [section]: d[section].map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));

  const addToList = (section, factory) =>
    setData((d) => ({ ...d, [section]: [...d[section], factory()] }));

  const removeFromList = (section, id) =>
    setData((d) => ({ ...d, [section]: d[section].filter((item) => item.id !== id) }));

  // ---- AI actions ----
  const polishSummary = async () => {
    if (!data.target.jobTitle.trim()) return showError("Add the job title you're targeting first.");
    setLoading("summary", true);
    try {
      const yrs = data.experience.filter((e) => e.role || e.company).length;
      const skillsList = data.skills.join(", ");
      const text = await askClaude(
        "You write concise, confident resume professional summaries. Return ONLY the summary text: 2-3 sentences, no preamble, no markdown, no quotation marks, no headers. Never invent employers, numbers, or credentials that are not implied by the input.",
        `Write a professional summary for a resume.
Target role: ${data.target.jobTitle}
Candidate's rough notes (may be empty or messy): ${data.target.summary || "none provided"}
Number of listed work experience entries: ${yrs}
Known skills: ${skillsList || "none listed"}`
      );
      update("target", { summary: text });
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading("summary", false);
    }
  };

  const polishBullets = async (exp) => {
    if (!exp.role.trim() && !exp.bullets.trim()) return showError("Add a role and a rough description first.");
    setLoading("exp-" + exp.id, true);
    try {
      const text = await askClaude(
        "You turn rough job-duty notes into polished resume bullet points. Return ONLY plain bullet lines, each starting with '- ', each beginning with a strong past/present-tense action verb. 3 to 5 bullets. No markdown headers, no preamble, no closing remarks. Do NOT invent metrics, numbers, tools, or achievements that are not present or clearly implied in the notes — you may sharpen phrasing but never fabricate facts.",
        `Role: ${exp.role}
Company: ${exp.company}
Rough notes from the candidate: ${exp.bullets || "none — write generic strong duties for this role title only if reasonable, otherwise keep it minimal"}`
      );
      const cleaned = text
        .split("\n")
        .map((l) => l.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
        .join("\n");
      updateList("experience", exp.id, { bullets: cleaned });
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading("exp-" + exp.id, false);
    }
  };

  const suggestSkills = async () => {
    if (!data.target.jobTitle.trim()) return showError("Add the job title you're targeting first.");
    setLoading("skills", true);
    try {
      const text = await askClaude(
        "You suggest resume skill keywords. Return ONLY a comma-separated list of 8-12 relevant skills, no numbering, no explanation, no markdown.",
        `Suggest resume skills for someone targeting this role: ${data.target.jobTitle}. Existing skills already listed (don't repeat these): ${data.skills.join(", ") || "none"}`
      );
      const newSkills = text.split(",").map((s) => s.trim()).filter((s) => s && !data.skills.includes(s));
      setData((d) => ({ ...d, skills: [...d.skills, ...newSkills] }));
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading("skills", false);
    }
  };

  const handlePrint = () => window.print();

  const skillInputRef = useRef(null);
  const addSkillFromInput = () => {
    const val = capitalizeWords(skillInputRef.current.value.trim());
    if (val && !data.skills.includes(val)) {
      setData((d) => ({ ...d, skills: [...d.skills, val] }));
    }
    skillInputRef.current.value = "";
  };

  const currentKey = STEPS[step].key;

  return (
    <div className="min-h-screen" style={{ background: "#F1EEE6", fontFamily: FONT_SANS }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        @media print {
          .no-print { display: none !important; }
          .preview-pane { display: block !important; position: static !important; }
          .print-area { box-shadow: none !important; margin: 0 !important; width: 100% !important; border: none !important; }
          html, body { background: white !important; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print border-b" style={{ borderColor: LINE, background: PAPER }}>
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm" style={{ background: INK, fontFamily: FONT_SERIF }}>R</div>
            <div>
              <div className="font-bold text-base leading-tight" style={{ color: INK, fontFamily: FONT_SERIF }}>RBuildora</div>
              <div className="text-[11px] leading-tight" style={{ color: SLATE }}>AI-assisted resume builder</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center rounded-full border p-0.5" style={{ borderColor: LINE }}>
              {["modern", "ats"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition"
                  style={template === t ? { background: INK, color: "white" } : { color: SLATE }}
                >
                  {t === "modern" ? "Modern" : "ATS-Clean"}
                </button>
              ))}
            </div>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-md text-white"
              style={{ background: STEEL }}
            >
              <Download size={15} /> Download PDF
            </button>
          </div>
        </div>
        {/* mobile template switch */}
        <div className="sm:hidden flex justify-center pb-3">
          <div className="flex items-center rounded-full border p-0.5" style={{ borderColor: LINE }}>
            {["modern", "ats"].map((t) => (
              <button
                key={t}
                onClick={() => setTemplate(t)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition"
                style={template === t ? { background: INK, color: "white" } : { color: SLATE }}
              >
                {t === "modern" ? "Modern" : "ATS-Clean"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div className="no-print max-w-7xl mx-auto px-5 pt-3">
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-md" style={{ background: "#FDEDEC", color: "#B3261E" }}>
            <AlertCircle size={15} /> {error}
          </div>
        </div>
      )}

      {/* mobile edit/preview toggle */}
      <div className="no-print lg:hidden max-w-7xl mx-auto px-5 pt-3">
        <div className="flex rounded-md border overflow-hidden" style={{ borderColor: LINE }}>
          {["edit", "preview"].map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className="flex-1 py-2 text-sm font-semibold capitalize"
              style={mobileView === v ? { background: INK, color: "white" } : { background: PAPER, color: SLATE }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 py-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* ---------- FORM PANE ---------- */}
        <div className={"no-print " + (mobileView === "edit" ? "block" : "hidden lg:block")}>
          {/* stepper */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              return (
                <button
                  key={s.key}
                  onClick={() => setStep(i)}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition"
                  style={active ? { background: INK, color: "white", borderColor: INK } : { color: SLATE, borderColor: LINE, background: PAPER }}
                >
                  <Icon size={12} /> {s.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border p-5" style={{ borderColor: LINE, background: PAPER }}>
            {currentKey === "personal" && (
              <div>
                <SectionTitle icon={User}>Personal information</SectionTitle>
                <Field label="Full name">
                  <TextInput
                    value={data.personal.fullName}
                    onChange={(e) => update("personal", { fullName: e.target.value })}
                    onBlur={(e) => update("personal", { fullName: capitalizeWords(e.target.value) })}
                    placeholder="Aarav Sharma"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <TextInput type="email" value={data.personal.email} onChange={(e) => update("personal", { email: e.target.value })} placeholder="you@email.com" />
                  </Field>
                  <Field label="Phone">
                    <TextInput value={data.personal.phone} onChange={(e) => update("personal", { phone: e.target.value })} placeholder="+91 98765 43210" />
                  </Field>
                </div>
                <Field label="Location">
                  <TextInput
                    value={data.personal.location}
                    onChange={(e) => update("personal", { location: e.target.value })}
                    onBlur={(e) => update("personal", { location: capitalizeWords(e.target.value) })}
                    placeholder="Ludhiana, Punjab"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="LinkedIn">
                    <TextInput value={data.personal.linkedin} onChange={(e) => update("personal", { linkedin: e.target.value })} placeholder="linkedin.com/in/you" />
                  </Field>
                  <Field label="Website / Portfolio">
                    <TextInput value={data.personal.website} onChange={(e) => update("personal", { website: e.target.value })} placeholder="yourportfolio.com" />
                  </Field>
                </div>

                <Field label="Professional photograph" hint={template === "ats" ? "Hidden on the ATS-Clean template — parsing systems ignore images and some flag them." : "Optional. A plain, front-facing headshot works best."}>
                  <div className="flex items-center gap-3">
                    {data.personal.photo ? (
                      <img src={data.personal.photo} alt="Preview" className="w-16 h-16 rounded-full object-cover border" style={{ borderColor: LINE }} />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center border" style={{ borderColor: LINE, background: "#F1EEE6" }}>
                        <User size={22} style={{ color: SLATE }} />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer" style={{ borderColor: STEEL, color: STEEL }}>
                        <ImagePlus size={13} /> {data.personal.photo ? "Change photo" : "Upload photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) return;
                            if (file.size > 3 * 1024 * 1024) return showError("Photo is too large — please use an image under 3MB.");
                            const reader = new FileReader();
                            reader.onload = () => update("personal", { photo: reader.result });
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {data.personal.photo && (
                        <button type="button" onClick={() => update("personal", { photo: null })} className="text-xs font-semibold text-left" style={{ color: "#B3261E" }}>
                          Remove photo
                        </button>
                      )}
                    </div>
                  </div>
                </Field>
              </div>
            )}

            {currentKey === "target" && (
              <div>
                <SectionTitle icon={Target}>Objective</SectionTitle>
                <Field label="Job you're applying for">
                  <TextInput value={data.target.jobTitle} onChange={(e) => update("target", { jobTitle: e.target.value })} placeholder="Frontend Developer" />
                </Field>
                <Field
                  label="Summary / objective"
                  hint={
                    aiLoading["correct-summary"]
                      ? "Checking spelling…"
                      : "Jot rough notes — spelling is fixed automatically, and AI can turn this into a polished summary."
                  }
                >
                  <TextArea
                    rows={5}
                    value={data.target.summary}
                    onChange={(e) => update("target", { summary: e.target.value })}
                    onBlur={(e) => correctOnBlur("summary", () => e.target.value, (v) => update("target", { summary: v }))}
                    placeholder="e.g. 3 years building React apps, like solving UI problems, looking to grow into a senior role..."
                  />
                </Field>
                <AiButton onClick={polishSummary} loading={!!aiLoading.summary} label="Polish summary with AI" />
              </div>
            )}

            {currentKey === "experience" && (
              <div>
                <SectionTitle icon={Briefcase}>Work experience</SectionTitle>
                {data.experience.map((exp, idx) => (
                  <div key={exp.id} className="mb-5 pb-5 border-b last:border-b-0" style={{ borderColor: LINE }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: STEEL }}>Entry {idx + 1}</span>
                      {data.experience.length > 1 && (
                        <button onClick={() => removeFromList("experience", exp.id)} className="text-xs flex items-center gap-1" style={{ color: "#B3261E" }}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Role / title">
                        <TextInput
                          value={exp.role}
                          onChange={(e) => updateList("experience", exp.id, { role: e.target.value })}
                          onBlur={(e) => updateList("experience", exp.id, { role: capitalizeWords(e.target.value) })}
                          placeholder="Software Engineer"
                        />
                      </Field>
                      <Field label="Company">
                        <TextInput
                          value={exp.company}
                          onChange={(e) => updateList("experience", exp.id, { company: e.target.value })}
                          onBlur={(e) => updateList("experience", exp.id, { company: capitalizeWords(e.target.value) })}
                          placeholder="Acme Corp"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Start">
                        <TextInput value={exp.start} onChange={(e) => updateList("experience", exp.id, { start: e.target.value })} placeholder="Jun 2022" />
                      </Field>
                      <Field label="End">
                        <TextInput value={exp.end} onChange={(e) => updateList("experience", exp.id, { end: e.target.value })} placeholder="Present" disabled={exp.current} />
                      </Field>
                      <Field label="Location">
                        <TextInput value={exp.location} onChange={(e) => updateList("experience", exp.id, { location: e.target.value })} placeholder="Remote" />
                      </Field>
                    </div>
                    <Field
                      label="What did you do?"
                      hint={aiLoading["correct-exp-" + exp.id] ? "Checking spelling…" : "Rough notes are fine — one idea per line. Spelling is fixed automatically."}
                    >
                      <TextArea
                        rows={4}
                        value={exp.bullets}
                        onChange={(e) => updateList("experience", exp.id, { bullets: e.target.value })}
                        onBlur={(e) => correctOnBlur("exp-" + exp.id, () => e.target.value, (v) => updateList("experience", exp.id, { bullets: v }))}
                        placeholder="built dashboards in react, worked with backend team on api, fixed bugs, mentored 2 interns"
                      />
                    </Field>
                    <AiButton onClick={() => polishBullets(exp)} loading={!!aiLoading["exp-" + exp.id]} label="Turn into bullet points" />
                  </div>
                ))}
                <button onClick={() => addToList("experience", emptyExperience)} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: STEEL }}>
                  <Plus size={15} /> Add another role
                </button>
              </div>
            )}

            {currentKey === "education" && (
              <div>
                <SectionTitle icon={GraduationCap}>Education & qualifications</SectionTitle>
                {data.education.map((ed, idx) => (
                  <div key={ed.id} className="mb-5 pb-5 border-b last:border-b-0" style={{ borderColor: LINE }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: STEEL }}>Entry {idx + 1}</span>
                      {data.education.length > 1 && (
                        <button onClick={() => removeFromList("education", ed.id)} className="text-xs flex items-center gap-1" style={{ color: "#B3261E" }}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                    <Field label="School / university">
                      <TextInput
                        value={ed.school}
                        onChange={(e) => updateList("education", ed.id, { school: e.target.value })}
                        onBlur={(e) => updateList("education", ed.id, { school: capitalizeWords(e.target.value) })}
                        placeholder="Panjab University"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Degree">
                        <TextInput
                          value={ed.degree}
                          onChange={(e) => updateList("education", ed.id, { degree: e.target.value })}
                          onBlur={(e) => updateList("education", ed.id, { degree: capitalizeWords(e.target.value) })}
                          placeholder="B.Tech"
                        />
                      </Field>
                      <Field label="Field of study">
                        <TextInput
                          value={ed.field}
                          onChange={(e) => updateList("education", ed.id, { field: e.target.value })}
                          onBlur={(e) => updateList("education", ed.id, { field: capitalizeWords(e.target.value) })}
                          placeholder="Computer Science"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Start">
                        <TextInput value={ed.start} onChange={(e) => updateList("education", ed.id, { start: e.target.value })} placeholder="2019" />
                      </Field>
                      <Field label="End">
                        <TextInput value={ed.end} onChange={(e) => updateList("education", ed.id, { end: e.target.value })} placeholder="2023" />
                      </Field>
                      <Field label="Grade / CGPA">
                        <TextInput value={ed.grade} onChange={(e) => updateList("education", ed.id, { grade: e.target.value })} placeholder="8.4 CGPA" />
                      </Field>
                    </div>
                  </div>
                ))}
                <button onClick={() => addToList("education", emptyEducation)} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: STEEL }}>
                  <Plus size={15} /> Add another qualification
                </button>

                <div className="mt-6 pt-5 border-t" style={{ borderColor: LINE }}>
                  <SectionTitle icon={Award}>Certifications (optional)</SectionTitle>
                  {data.certifications.map((c, idx) => (
                    <div key={c.id} className="grid grid-cols-[1fr_1fr_80px_28px] gap-2 mb-2 items-center">
                      <TextInput
                        value={c.name}
                        onChange={(e) => updateList("certifications", c.id, { name: e.target.value })}
                        onBlur={(e) => updateList("certifications", c.id, { name: capitalizeWords(e.target.value) })}
                        placeholder="AWS Certified..."
                      />
                      <TextInput
                        value={c.issuer}
                        onChange={(e) => updateList("certifications", c.id, { issuer: e.target.value })}
                        onBlur={(e) => updateList("certifications", c.id, { issuer: capitalizeWords(e.target.value) })}
                        placeholder="Issuer"
                      />
                      <TextInput value={c.year} onChange={(e) => updateList("certifications", c.id, { year: e.target.value })} placeholder="2024" />
                      <button onClick={() => removeFromList("certifications", c.id)}><Trash2 size={15} style={{ color: "#B3261E" }} /></button>
                    </div>
                  ))}
                  <button onClick={() => addToList("certifications", emptyCert)} className="flex items-center gap-1.5 text-sm font-semibold mt-1" style={{ color: STEEL }}>
                    <Plus size={15} /> Add certification
                  </button>
                </div>
              </div>
            )}

            {currentKey === "skills" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <SectionTitle icon={Award}>Skills</SectionTitle>
                  <div className="-mt-5"><AiButton onClick={suggestSkills} loading={!!aiLoading.skills} label="Suggest skills" /></div>
                </div>
                <Field label="Add a skill">
                  <div className="flex gap-2">
                    <TextInput ref={skillInputRef} placeholder="React.js" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkillFromInput(); } }} />
                    <button onClick={addSkillFromInput} className="px-3 rounded-md text-white text-sm font-semibold" style={{ background: INK }}>Add</button>
                  </div>
                </Field>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.skills.map((sk) => (
                    <span key={sk} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${STEEL}15`, color: STEEL }}>
                      {sk}
                      <button onClick={() => setData((d) => ({ ...d, skills: d.skills.filter((s) => s !== sk) }))}>×</button>
                    </span>
                  ))}
                  {data.skills.length === 0 && <span className="text-sm" style={{ color: SLATE }}>No skills added yet.</span>}
                </div>
              </div>
            )}

            {currentKey === "languages" && (
              <div>
                <SectionTitle icon={LangIcon}>Languages known</SectionTitle>
                {data.languages.map((l, idx) => (
                  <div key={l.id} className="grid grid-cols-[1fr_1fr_28px] gap-2 mb-2 items-center">
                    <TextInput
                      value={l.name}
                      onChange={(e) => updateList("languages", l.id, { name: e.target.value })}
                      onBlur={(e) => updateList("languages", l.id, { name: capitalizeWords(e.target.value) })}
                      placeholder="English"
                    />
                    <select
                      value={l.level}
                      onChange={(e) => updateList("languages", l.id, { level: e.target.value })}
                      className="rounded-md border px-2 py-2 text-sm"
                      style={inputStyle}
                    >
                      {["Native", "Fluent", "Conversational", "Basic"].map((lv) => <option key={lv}>{lv}</option>)}
                    </select>
                    {data.languages.length > 1 && (
                      <button onClick={() => removeFromList("languages", l.id)}><Trash2 size={15} style={{ color: "#B3261E" }} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => addToList("languages", emptyLanguage)} className="flex items-center gap-1.5 text-sm font-semibold mt-2" style={{ color: STEEL }}>
                  <Plus size={15} /> Add language
                </button>
              </div>
            )}

            {/* step nav */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: LINE }}>
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-1 text-sm font-semibold disabled:opacity-30"
                style={{ color: INK }}
              >
                <ChevronLeft size={16} /> Back
              </button>
              {step === STEPS.length - 1 ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#2E7D32" }}>
                  <Check size={16} /> All sections covered
                </span>
              ) : (
                <button
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="flex items-center gap-1 text-sm font-semibold"
                  style={{ color: INK }}
                >
                  Next <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ---------- PREVIEW PANE ---------- */}
        <div className={"preview-pane " + (mobileView === "preview" ? "block" : "hidden lg:block")}>
          <div className="lg:sticky lg:top-6">
            <ResumePreview data={data} template={template} printRef={printRef} />
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------- Resume Preview / Templates ----------
function ResumePreview({ data, template, printRef }) {
  const { personal, target, education, experience, skills, languages, certifications } = data;
  const name = personal.fullName || "Your Name";

  const contactRow = [
    personal.email && { icon: Mail, text: personal.email },
    personal.phone && { icon: Phone, text: personal.phone },
    personal.location && { icon: MapPin, text: personal.location },
    personal.linkedin && { icon: Linkedin, text: personal.linkedin },
    personal.website && { icon: Globe, text: personal.website },
  ].filter(Boolean);

  const isAts = template === "ats";

  return (
    <div
      ref={printRef}
      className="print-area mx-auto rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-10"
      style={{
        background: "white",
        width: "100%",
        maxWidth: "780px",
        minHeight: "1000px",
        fontFamily: isAts ? FONT_SANS : FONT_SANS,
        border: `1px solid ${LINE}`
      }}
    >
      {/* Header */}
      <div
        className={isAts ? "mb-5 flex items-start justify-between gap-4" : "mb-6 pb-5 border-b-2 flex items-start justify-between gap-5"}
        style={!isAts ? { borderColor: INK } : {}}
      >
        <div>
          <h1
            className={isAts ? "text-2xl font-bold" : "text-4xl font-bold"}
            style={{ color: INK, fontFamily: isAts ? FONT_SANS : FONT_SERIF, letterSpacing: isAts ? "0" : "0.3px" }}
          >
            {name}
          </h1>
          {target.jobTitle && (
            <div className="mt-1 text-sm font-semibold uppercase tracking-wide" style={{ color: isAts ? SLATE : STEEL }}>
              {target.jobTitle}
            </div>
          )}
          {contactRow.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs" style={{ color: SLATE }}>
              {contactRow.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {!isAts && <c.icon size={12} />} {c.text}
                </span>
              ))}
            </div>
          )}
        </div>
        {!isAts && personal.photo && (
          <img
            src={personal.photo}
            alt={name}
            className="w-24 h-24 rounded-full object-cover flex-shrink-0"
            style={{ border: `3px solid ${PAPER}`, boxShadow: `0 0 0 1px ${LINE}` }}
          />
        )}
      </div>

      {target.summary && (
        <Section title="Summary" isAts={isAts}>
          <p className="text-sm leading-relaxed" style={{ color: "#2A2F3A" }}>{target.summary}</p>
        </Section>
      )}

      {experience.some((e) => e.role || e.company) && (
        <Section title="Experience" isAts={isAts}>
          {experience.filter((e) => e.role || e.company).map((exp) => (
            <div key={exp.id} className="mb-4 last:mb-0">
              <div className="flex justify-between items-baseline flex-wrap gap-x-2">
                <span className="text-sm font-bold" style={{ color: INK }}>{exp.role}{exp.company ? `, ${exp.company}` : ""}</span>
                <span className="text-xs" style={{ color: SLATE }}>{exp.start}{(exp.start || exp.end) && " – "}{exp.end}</span>
              </div>
              {exp.location && <div className="text-xs mb-1" style={{ color: SLATE }}>{exp.location}</div>}
              {exp.bullets && (
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {exp.bullets.split("\n").filter(Boolean).map((b, i) => (
                    <li key={i} className="text-sm leading-relaxed" style={{ color: "#2A2F3A" }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {education.some((e) => e.school || e.degree) && (
        <Section title="Education" isAts={isAts}>
          {education.filter((e) => e.school || e.degree).map((ed) => (
            <div key={ed.id} className="mb-2.5 last:mb-0">
              <div className="flex justify-between items-baseline flex-wrap gap-x-2">
                <span className="text-sm font-bold" style={{ color: INK }}>
                  {ed.degree}{ed.field ? ` in ${ed.field}` : ""}
                </span>
                <span className="text-xs" style={{ color: SLATE }}>{ed.start}{(ed.start || ed.end) && " – "}{ed.end}</span>
              </div>
              <div className="text-xs" style={{ color: SLATE }}>{ed.school}{ed.grade ? ` · ${ed.grade}` : ""}</div>
            </div>
          ))}
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills" isAts={isAts}>
          {isAts ? (
            <p className="text-sm" style={{ color: "#2A2F3A" }}>{skills.join(" · ")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${STEEL}15`, color: STEEL }}>{s}</span>
              ))}
            </div>
          )}
        </Section>
      )}

      {languages.some((l) => l.name) && (
        <Section title="Languages" isAts={isAts}>
          <p className="text-sm" style={{ color: "#2A2F3A" }}>
            {languages.filter((l) => l.name).map((l) => `${l.name} (${l.level})`).join("  ·  ")}
          </p>
        </Section>
      )}

      {certifications.some((c) => c.name) && (
        <Section title="Certifications" isAts={isAts}>
          {certifications.filter((c) => c.name).map((c) => (
            <div key={c.id} className="flex justify-between text-sm mb-1" style={{ color: "#2A2F3A" }}>
              <span>{c.name}{c.issuer ? ` — ${c.issuer}` : ""}</span>
              <span className="text-xs" style={{ color: SLATE }}>{c.year}</span>
            </div>
          ))}
        </Section>
      )}

      {!name.trim() && !target.jobTitle && experience.every((e) => !e.role) && (
        <div className="text-center py-16 text-sm" style={{ color: SLATE }}>
          Fill in the form to see your resume take shape here.
        </div>
      )}
    </div>
  );
}

function Section({ title, children, isAts }) {
  return (
    <div className="mb-5">
      <h3
        className="text-xs font-bold uppercase tracking-widest mb-2 pb-1"
        style={{ color: isAts ? INK : STEEL, borderBottom: `1px solid ${LINE}` }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
