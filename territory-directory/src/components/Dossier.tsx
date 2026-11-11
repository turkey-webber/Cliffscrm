import { useState } from "react";
import { downloadText, toCrmCsv, toCrmImportRow } from "../crmBridge";
import type {
  CompanyRecord,
  Contact,
  ContactRole,
  DisqualifyReason,
  IncumbentStaffing,
  BookStatus,
} from "../types";

type Props = {
  company: CompanyRecord & { distanceMi: number };
  onClose: () => void;
  onHide: () => void;
  onDisqualify: (reason: DisqualifyReason, note?: string) => void;
  onWatch: () => void;
  onBlitz: () => void;
  inBlitz: boolean;
  onBook: (s: BookStatus) => void;
  onIncumbent: (s: IncumbentStaffing) => void;
  onManualContact: (c: Contact) => void;
  onRefresh: () => void;
};

export function Dossier({
  company: c,
  onClose,
  onHide,
  onDisqualify,
  onWatch,
  onBlitz,
  inBlitz,
  onBook,
  onIncumbent,
  onManualContact,
  onRefresh,
}: Props) {
  const [showSignal, setShowSignal] = useState(false);
  const [dqOpen, setDqOpen] = useState(false);
  const [dqReason, setDqReason] = useState<DisqualifyReason>("out_of_business");
  const [manualOpen, setManualOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mRole, setMRole] = useState<ContactRole>("hr");

  const verifiedContacts = c.contacts.filter(
    (x) =>
      x.phone?.trust === "verified" ||
      x.email?.trust === "verified" ||
      x.name?.trust === "verified" ||
      x.cell?.trust === "verified",
  );
  const signalContacts = c.contacts.filter(
    (x) =>
      (x.phone?.trust === "signal" ||
        x.email?.trust === "signal" ||
        x.name?.trust === "signal" ||
        x.cell?.trust === "signal") &&
      !verifiedContacts.includes(x),
  );

  const dialPhone = c.contacts.find((x) => x.phone?.trust === "verified" && x.phone.value)?.phone;

  return (
    <div className="dossier">
      <header className="dossier-head">
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
        <div className="dossier-actions">
          <button type="button" className="ghost" onClick={onWatch}>
            {c.watchlist ? "Watching" : "Watch"}
          </button>
          <button type="button" className="ghost" onClick={onBlitz}>
            {inBlitz ? "In blitz" : "Blitz"}
          </button>
          <button type="button" className="icon-btn" aria-label="Hide" title="Hide" onClick={onHide}>
            🗑
          </button>
        </div>
      </header>

      <div className="dossier-body">
        <p className="eyebrow">
          {c.city} · {c.fence} fence · {c.distanceMi} mi · size {c.sizeBand}
        </p>
        <h1>{c.name}</h1>
        <div className="chip-row">
          <span className="chip score">Opp {c.opportunityScore}</span>
          <span className="chip">{c.bookStatus.replaceAll("_", " ")}</span>
          <span className="chip">{c.activeRoles.length ? "Hiring" : "No active roles"}</span>
          <span className="chip">{c.incumbentStaffing} staffing</span>
        </div>

        <section>
          <h2>Research</h2>
          <p>{c.summaryParagraphs[0]}</p>
          <p>{c.summaryParagraphs[1]}</p>
        </section>

        <section>
          <h2>Verified contacts</h2>
          {c.physicalAddress?.trust === "verified" && (
            <p className="claim">
              <strong>Address</strong> {c.physicalAddress.value}
              <span className="src">{c.physicalAddress.sourceLabel}</span>
            </p>
          )}
          {dialPhone ? (
            <p className="claim">
              <strong>Main</strong>{" "}
              <a href={`tel:${dialPhone.value.replace(/[^\d+]/g, "")}`}>{dialPhone.value}</a>
              <span className="src">{dialPhone.sourceLabel}</span>
            </p>
          ) : (
            <p className="muted">No verified phone on file — empty beats guessed.</p>
          )}
          {verifiedContacts.map((ct) => (
            <div key={ct.id} className="contact-card">
              <div className="role">{ct.role}</div>
              {ct.name?.trust === "verified" && <div>{ct.name.value}</div>}
              {ct.title?.trust === "verified" && <div className="muted">{ct.title.value}</div>}
              {ct.phone?.trust === "verified" && <div>{ct.phone.value}</div>}
              {ct.email?.trust === "verified" && <div>{ct.email.value}</div>}
              {ct.cell?.trust === "verified" && <div>Cell {ct.cell.value}</div>}
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => setManualOpen((v) => !v)}>
            Add manual verified contact
          </button>
          {manualOpen && (
            <div className="manual-form">
              <select value={mRole} onChange={(e) => setMRole(e.target.value as ContactRole)}>
                <option value="owner">Owner</option>
                <option value="operations">Operations</option>
                <option value="hr">HR</option>
                <option value="other">Other</option>
              </select>
              <input placeholder="Name" value={mName} onChange={(e) => setMName(e.target.value)} />
              <input placeholder="Title" value={mTitle} onChange={(e) => setMTitle(e.target.value)} />
              <input placeholder="Phone" value={mPhone} onChange={(e) => setMPhone(e.target.value)} />
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (!mName && !mPhone) return;
                  const now = new Date().toISOString().slice(0, 10);
                  onManualContact({
                    id: `manual-${Date.now()}`,
                    role: mRole,
                    name: mName
                      ? {
                          value: mName,
                          trust: "verified",
                          sourceLabel: "Manual card / Cliff",
                          observedAt: now,
                          method: "manual",
                        }
                      : undefined,
                    title: mTitle
                      ? {
                          value: mTitle,
                          trust: "verified",
                          sourceLabel: "Manual card / Cliff",
                          observedAt: now,
                          method: "manual",
                        }
                      : undefined,
                    phone: mPhone
                      ? {
                          value: mPhone,
                          trust: "verified",
                          sourceLabel: "Manual card / Cliff",
                          observedAt: now,
                          method: "manual",
                        }
                      : undefined,
                  });
                  setMName("");
                  setMTitle("");
                  setMPhone("");
                  setManualOpen(false);
                }}
              >
                Save verified
              </button>
            </div>
          )}
        </section>

        <section>
          <button type="button" className="ghost wide" onClick={() => setShowSignal((v) => !v)}>
            Signal (speculative) {showSignal ? "▾" : "▸"} · {signalContacts.length}
          </button>
          {showSignal &&
            (signalContacts.length ? (
              signalContacts.map((ct) => (
                <div key={ct.id} className="contact-card signal">
                  <div className="role">SIGNAL · {ct.role}</div>
                  {ct.name && <div>{ct.name.value}</div>}
                  {ct.title && <div className="muted">{ct.title.value}</div>}
                  <div className="src">{ct.name?.sourceLabel || ct.title?.sourceLabel}</div>
                </div>
              ))
            ) : (
              <p className="muted">No signal contacts queued.</p>
            ))}
        </section>

        <section>
          <h2>Hiring now</h2>
          {c.activeRoles.length ? (
            <ul>
              {c.activeRoles.map((r) => (
                <li key={r.id}>
                  {r.title} <span className="muted">· {r.family} · {r.sourceLabel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No verified open roles in seed.</p>
          )}
          <h3>Hiring history (~10y evidence)</h3>
          <ul>
            {c.hiringHistory.map((h) => (
              <li key={h.id}>
                <strong>{h.year}</strong> — {h.summary}{" "}
                <span className="muted">· {h.sourceLabel}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Opportunity breakdown</h2>
          <ul className="score-list">
            {Object.entries(c.scoreBreakdown).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid-2">
          <label>
            Book status
            <select value={c.bookStatus} onChange={(e) => onBook(e.target.value as BookStatus)}>
              <option value="not_in_book">Not in book</option>
              <option value="in_book">In book</option>
              <option value="missing">Missing / win-back</option>
            </select>
          </label>
          <label>
            Incumbent staffing
            <select
              value={c.incumbentStaffing}
              onChange={(e) => onIncumbent(e.target.value as IncumbentStaffing)}
            >
              <option value="unknown">Unknown</option>
              <option value="express">Express</option>
              <option value="competitor">Competitor</option>
              <option value="unsure">Unsure</option>
            </select>
          </label>
        </section>

        <section>
          <h2>Enrichment</h2>
          <button type="button" className="secondary" onClick={onRefresh}>
            Refresh now
          </button>
          <ul className="log">
            {c.enrichmentLog.map((l) => (
              <li key={l.id}>
                <span className="muted">{l.at}</span> {l.summary}
              </li>
            ))}
          </ul>
        </section>

        <section className="dossier-footer">
          <button
            type="button"
            className="primary"
            onClick={() => downloadText(`${c.name.replace(/\W+/g, "-")}-crm.csv`, toCrmCsv([toCrmImportRow(c)]))}
          >
            Send to CliffsCRM (CSV)
          </button>
          <button type="button" className="danger" onClick={() => setDqOpen((v) => !v)}>
            Disqualify…
          </button>
          {dqOpen && (
            <div className="manual-form">
              <select value={dqReason} onChange={(e) => setDqReason(e.target.value as DisqualifyReason)}>
                <option value="out_of_business">Out of business</option>
                <option value="no_fit">No fit</option>
                <option value="dnc">DNC</option>
                <option value="duplicate">Duplicate</option>
                <option value="other">Other</option>
              </select>
              <button type="button" className="danger" onClick={() => onDisqualify(dqReason)}>
                Confirm hard remove
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
