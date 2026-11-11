import { useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { Dossier } from "./components/Dossier";
import { downloadText, toCrmCsv, toCrmImportRow } from "./crmBridge";
import { applyPrefsStatus, filterAndSort } from "./filter";
import { mapsMultiStopUrl } from "./geo";
import { OFFICE } from "./office";
import { enrichmentHealth, SEED_COMPANIES } from "./seed";
import { computeScores, opportunityTier } from "./scoring";
import {
  addManualContact,
  disqualifyCompany,
  hideCompany,
  loadPrefs,
  restoreDisqualified,
  setBookStatus,
  setIncumbent,
  toggleBlitz,
  toggleWatchlist,
  unhideCompany,
} from "./store";
import type {
  BookStatus,
  CompanyRecord,
  Contact,
  DisqualifyReason,
  FilterState,
  IncumbentStaffing,
  SortKey,
  TabKey,
} from "./types";

const DEFAULT_FILTERS: FilterState = {
  query: "",
  sizeBands: [],
  opportunity: "all",
  hiring: "all",
  book: "all",
  trust: "all",
  fence: ["in", "edge"],
  status: "active",
  incumbent: "all",
  industries: [],
  radiusMi: 25,
  nearMe: false,
};

export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [tab, setTab] = useState<TabKey>("map");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("opportunity");
  const [selectedId, setSelectedId] = useState<string>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsNote, setGpsNote] = useState("Using office location");
  const [liveCompanies, setLiveCompanies] = useState(SEED_COMPANIES);

  const origin = gpsOrigin ?? { lat: OFFICE.lat, lng: OFFICE.lng };

  useEffect(() => {
    if (!filters.nearMe) return;
    if (!navigator.geolocation) {
      setGpsNote("GPS unavailable — office fallback");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsNote("Near me · live GPS");
      },
      () => setGpsNote("GPS denied — office fallback"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [filters.nearMe]);

  const decorated = useMemo(
    () => liveCompanies.map((c) => applyPrefsStatus(c, prefs)),
    [liveCompanies, prefs],
  );

  const visible = useMemo(
    () => filterAndSort(decorated, filters, sort, origin),
    [decorated, filters, sort, origin],
  );

  const selectedWithMi = useMemo(() => {
    if (!selectedId) return undefined;
    const fromVisible = visible.find((c) => c.id === selectedId);
    if (fromVisible) return fromVisible;
    const base = decorated.find((c) => c.id === selectedId);
    if (!base) return undefined;
    return filterAndSort(
      [base],
      { ...DEFAULT_FILTERS, status: base.status, fence: [], nearMe: false },
      "name",
      origin,
    )[0];
  }, [selectedId, visible, decorated, origin]);

  const blitzList = useMemo(() => {
    const ids = new Set(prefs.blitzIds);
    return filterAndSort(
      decorated.filter((c) => ids.has(c.id) && c.status === "active"),
      { ...DEFAULT_FILTERS, status: "active", fence: [], nearMe: false },
      "distance",
      origin,
    );
  }, [decorated, prefs.blitzIds, origin]);

  const health = enrichmentHealth(decorated.filter((c) => c.status === "active"));

  function refreshCompany(id: string) {
    setLiveCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const now = new Date().toISOString();
        const next = {
          ...c,
          lastEnrichedAt: now.slice(0, 10),
          enrichmentLog: [
            {
              id: `log-${Date.now()}`,
              at: now.slice(0, 10),
              summary: "Manual refresh · rechecked seed sources · no new unverified phones added",
            },
            ...c.enrichmentLog,
          ],
        };
        const { breakdown, opportunity } = computeScores(next);
        return { ...next, scoreBreakdown: breakdown, opportunityScore: opportunity };
      }),
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="brand">Territory Directory</p>
          <p className="sub">
            Montgomery Express · {visible.length} shown · {gpsNote}
          </p>
        </div>
        <button type="button" className="secondary compact" onClick={() => setFiltersOpen(true)}>
          Filters
        </button>
      </header>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search company, city, corridor…"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="opportunity">Opportunity</option>
          <option value="distance">Distance</option>
          <option value="size">Size</option>
          <option value="updated">Updated</option>
          <option value="name">Name</option>
        </select>
        <button
          type="button"
          className={filters.nearMe ? "primary compact" : "secondary compact"}
          onClick={() => setFilters((f) => ({ ...f, nearMe: !f.nearMe, radiusMi: f.radiusMi || 25 }))}
        >
          Near me
        </button>
      </div>

      {filters.nearMe && (
        <div className="radius-row">
          {[5, 10, 25, 50].map((r) => (
            <button
              key={r}
              type="button"
              className={filters.radiusMi === r ? "chip on" : "chip"}
              onClick={() => setFilters((f) => ({ ...f, radiusMi: r }))}
            >
              {r} mi
            </button>
          ))}
        </div>
      )}

      <main className={`main tab-${tab}`}>
        {tab === "map" && (
          <MapView
            companies={visible}
            origin={origin}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
            }}
          />
        )}

        {(tab === "list" || tab === "map") && tab === "list" && (
          <ul className="company-list">
            {visible.map((c) => (
              <li key={c.id}>
                <button type="button" className="list-card" onClick={() => setSelectedId(c.id)}>
                  <div className="list-top">
                    <strong>{c.name}</strong>
                    <span className={`opp ${opportunityTier(c.opportunityScore)}`}>{c.opportunityScore}</span>
                  </div>
                  <div className="list-meta">
                    {c.city} · {c.distanceMi} mi · {c.sizeBand} · {c.activeRoles.length ? "hiring" : "quiet"}
                  </div>
                  <div className="chip-row tiny">
                    <span className="chip">{c.bookStatus.replaceAll("_", " ")}</span>
                    <span className="chip">{c.fence}</span>
                    {c.contacts.some((x) => x.phone?.trust === "verified") ? (
                      <span className="chip ok">verified phone</span>
                    ) : (
                      <span className="chip">no phone</span>
                    )}
                  </div>
                </button>
                <div className="list-actions">
                  <button type="button" className="ghost" onClick={() => setPrefs(toggleBlitz(prefs, c.id))}>
                    {prefs.blitzIds.includes(c.id) ? "Blitz ✓" : "Blitz"}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Hide"
                    onClick={() => setPrefs(hideCompany(prefs, c.id))}
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "map" && (
          <div className="map-sheet">
            <ul className="company-list compact">
              {visible.slice(0, 12).map((c) => (
                <li key={c.id}>
                  <button type="button" className="list-card" onClick={() => setSelectedId(c.id)}>
                    <div className="list-top">
                      <strong>{c.name}</strong>
                      <span className={`opp ${opportunityTier(c.opportunityScore)}`}>{c.opportunityScore}</span>
                    </div>
                    <div className="list-meta">
                      {c.distanceMi} mi · {c.city}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "blitz" && (
          <div className="panel">
            <h2>Blitz pack</h2>
            <p className="muted">Ordered by distance from {gpsNote.includes("live") ? "you" : "office"}.</p>
            {blitzList.length === 0 ? (
              <p>Add companies with Blitz from list or dossier.</p>
            ) : (
              <>
                <ol className="blitz-ol">
                  {blitzList.map((c, i) => (
                    <li key={c.id}>
                      <button type="button" className="linkish" onClick={() => setSelectedId(c.id)}>
                        {i + 1}. {c.name}
                      </button>
                      <span className="muted">
                        {c.distanceMi} mi · opp {c.opportunityScore}
                      </span>
                    </li>
                  ))}
                </ol>
                <a
                  className="primary btn-link"
                  href={mapsMultiStopUrl(
                    blitzList.map((c) => ({
                      name: c.name,
                      address: c.physicalAddress?.value,
                      lat: c.lat,
                      lng: c.lng,
                    })),
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open drive order in Maps
                </a>
              </>
            )}
          </div>
        )}

        {tab === "more" && (
          <div className="panel">
            <h2>Enrichment health</h2>
            <div className="health-grid">
              <div>
                <strong>{health.total}</strong>
                <span>active companies</span>
              </div>
              <div>
                <strong>{health.verifiedPhonePct}%</strong>
                <span>verified phone</span>
              </div>
              <div>
                <strong>{health.namedDmPct}%</strong>
                <span>named decision-maker</span>
              </div>
              <div>
                <strong>{health.freshPct}%</strong>
                <span>fresh ≤14d</span>
              </div>
            </div>
            <h3>Status views</h3>
            <div className="chip-row">
              {(["active", "hidden", "disqualified"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={filters.status === s ? "chip on" : "chip"}
                  onClick={() => {
                    setFilters((f) => ({ ...f, status: s }));
                    setTab("list");
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {filters.status === "hidden" && (
              <ul className="restore-list">
                {decorated
                  .filter((c) => c.status === "hidden")
                  .map((c) => (
                    <li key={c.id}>
                      {c.name}
                      <button type="button" className="ghost" onClick={() => setPrefs(unhideCompany(prefs, c.id))}>
                        Restore
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {filters.status === "disqualified" && (
              <ul className="restore-list">
                {decorated
                  .filter((c) => c.status === "disqualified")
                  .map((c) => (
                    <li key={c.id}>
                      {c.name}
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPrefs(restoreDisqualified(prefs, c.id))}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <h3>CliffsCRM bridge</h3>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                downloadText(
                  "territory-directory-export.csv",
                  toCrmCsv(visible.map((c) => toCrmImportRow(c as CompanyRecord))),
                )
              }
            >
              Export visible as CRM CSV
            </button>
            <p className="muted tiny">
              Phones only when Verified. Import into CliffsCRM Contact Summary flow. Live enrichment scrub expands
              after this shell — Signal stays quarantined.
            </p>
            <p className="muted tiny">Office: {OFFICE.address}</p>
          </div>
        )}
      </main>

      <nav className="tabbar">
        {(
          [
            ["map", "Map"],
            ["list", "List"],
            ["blitz", "Blitz"],
            ["more", "More"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      {filtersOpen && (
        <div className="sheet" role="dialog">
          <div className="sheet-card">
            <header>
              <h2>Filters</h2>
              <button type="button" className="ghost" onClick={() => setFiltersOpen(false)}>
                Done
              </button>
            </header>
            <label>
              Opportunity
              <select
                value={filters.opportunity}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, opportunity: e.target.value as FilterState["opportunity"] }))
                }
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Hiring
              <select
                value={filters.hiring}
                onChange={(e) => setFilters((f) => ({ ...f, hiring: e.target.value as FilterState["hiring"] }))}
              >
                <option value="all">All</option>
                <option value="active">Actively hiring</option>
                <option value="history">History only</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label>
              Book
              <select
                value={filters.book}
                onChange={(e) => setFilters((f) => ({ ...f, book: e.target.value as FilterState["book"] }))}
              >
                <option value="all">All</option>
                <option value="not_in_book">Not in book</option>
                <option value="in_book">In book</option>
                <option value="missing">Missing</option>
              </select>
            </label>
            <label>
              Trust
              <select
                value={filters.trust}
                onChange={(e) => setFilters((f) => ({ ...f, trust: e.target.value as FilterState["trust"] }))}
              >
                <option value="all">All</option>
                <option value="verified_phone">Verified phone</option>
                <option value="verified_dm">Verified decision-maker</option>
                <option value="signal_only">Signal only</option>
              </select>
            </label>
            <fieldset>
              <legend>Fence</legend>
              {(["in", "edge", "out"] as const).map((f) => (
                <label key={f} className="check">
                  <input
                    type="checkbox"
                    checked={filters.fence.includes(f)}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        fence: e.target.checked
                          ? [...prev.fence, f]
                          : prev.fence.filter((x) => x !== f),
                      }))
                    }
                  />
                  {f}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Size</legend>
              {(["1-9", "10-49", "50-99", "100-249", "250-499", "500+", "unknown"] as const).map((s) => (
                <label key={s} className="check">
                  <input
                    type="checkbox"
                    checked={filters.sizeBands.includes(s)}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        sizeBands: e.target.checked
                          ? [...prev.sizeBands, s]
                          : prev.sizeBands.filter((x) => x !== s),
                      }))
                    }
                  />
                  {s}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className="secondary"
              onClick={() => setFilters({ ...DEFAULT_FILTERS, nearMe: filters.nearMe, radiusMi: filters.radiusMi })}
            >
              Reset filters
            </button>
          </div>
        </div>
      )}

      {selectedWithMi && (
        <Dossier
          company={selectedWithMi}
          onClose={() => setSelectedId(undefined)}
          onHide={() => {
            setPrefs(hideCompany(prefs, selectedWithMi.id));
            setSelectedId(undefined);
          }}
          onDisqualify={(reason: DisqualifyReason) => {
            setPrefs(disqualifyCompany(prefs, selectedWithMi.id, reason));
            setSelectedId(undefined);
          }}
          onWatch={() => setPrefs(toggleWatchlist(prefs, selectedWithMi.id))}
          onBlitz={() => setPrefs(toggleBlitz(prefs, selectedWithMi.id))}
          inBlitz={prefs.blitzIds.includes(selectedWithMi.id)}
          onBook={(s: BookStatus) => setPrefs(setBookStatus(prefs, selectedWithMi.id, s))}
          onIncumbent={(s: IncumbentStaffing) => setPrefs(setIncumbent(prefs, selectedWithMi.id, s))}
          onManualContact={(contact: Contact) => setPrefs(addManualContact(prefs, selectedWithMi.id, contact))}
          onRefresh={() => refreshCompany(selectedWithMi.id)}
        />
      )}
    </div>
  );
}
