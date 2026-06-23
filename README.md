import React, { useState, useMemo, useCallback } from "react";

/\* ============================================================================

1.  DATA LAYER — mirrors the future PostgreSQL "leads" table.

The business runs in three phases (per ops notes):
Phase 1 — Lead Capture : source, customer + trip basics, assignment
Phase 2 — Itinerary Builder: vendor research, itinerary, quote building
Phase 3 — Closure : payment, margin, profit, client review

A lead lives in exactly one phase at a time. Moving to the next phase is
an explicit action (not automatic on every field edit) so incomplete data
never silently slides forward — the agent/admin confirms a phase is done.

Swap LeadsAPI's internals for real fetch() calls to Express later;
every component below only talks to LeadsAPI, never to the array directly.
============================================================================ \*/

const PHASE = {
CAPTURE: 1,
ITINERARY: 2,
CLOSURE: 3,
};

const PHASE_META = {
[PHASE.CAPTURE]: { label: "Lead Capture", short: "Capture" },
[PHASE.ITINERARY]: { label: "Itinerary Builder", short: "Itinerary" },
[PHASE.CLOSURE]: { label: "Closure", short: "Closure" },
};

const STATUS = {
NOT_ASSIGNED: "Not Assigned",
IN_PROCESS: "In Process",
CONFIRM: "Confirm",
CANCEL: "Cancel",
};

const SOURCE = ["Facebook", "Instagram", "Referral", "Website", "Walk-in"];
const AGENTS = ["Riya Sharma", "Karan Mehta", "Aisha Khan"];

/\* ----------------------------------------------------------------------------
AUTH LAYER — single shared credential for the whole team (by request).

Real apps should still give each person their own login — a shared
password means anyone with it can act as anyone, and there's no way to
know who actually made a change. For now this matches what was asked:
one email + one password gets in, then the person picks who they are
(Admin or which agent) for the session.

Mirrors a future PostgreSQL setup:
CREATE TABLE app_access (id SERIAL PRIMARY KEY, email TEXT, password_hash TEXT);
CREATE TABLE team_members (id SERIAL PRIMARY KEY, name TEXT, role TEXT);

AuthAPI.login should become a POST to /api/auth/login once there's a
backend, with the server comparing a bcrypt hash — never plain text.
---------------------------------------------------------------------------- \*/
const SHARED_CREDENTIALS = { email: "team@voyagecrm.com", password: "voyage123" };

const TEAM_MEMBERS = [
{ name: "Admin", role: "admin" },
{ name: "Riya Sharma", role: "agent" },
{ name: "Karan Mehta", role: "agent" },
{ name: "Aisha Khan", role: "agent" },
];

const AuthAPI = {
async login(email, password) {
// Future: return fetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
const matches =
email.trim().toLowerCase() === SHARED_CREDENTIALS.email.toLowerCase() &&
password === SHARED_CREDENTIALS.password;
if (!matches) {
throw new Error("Incorrect email or password.");
}
return Promise.resolve(true);
},
};

// Mirrors: CREATE TABLE leads (
// id SERIAL PRIMARY KEY, source TEXT, customer_name TEXT, travel_date DATE,
// pax INT, destination TEXT, hotel_preference TEXT, contact_no TEXT,
// status TEXT CHECK (status IN (...)), phase INT CHECK (phase IN (1,2,3)),
// assigned_agent TEXT, vendor_details TEXT, itinerary_notes TEXT,
// margin NUMERIC, profit NUMERIC, closed BOOLEAN, client_review TEXT
// );
const SEED_LEADS = [
{
id: 1,
source: "Instagram",
customerName: "Amit Verma",
travelDate: "2026-08-12",
pax: 4,
destination: "Bali, Indonesia",
hotelPreference: "4-star, sea view",
contactNo: "+91 98765 11122",
status: STATUS.NOT_ASSIGNED,
phase: PHASE.CAPTURE,
assignedAgent: null,
vendorDetails: "",
itineraryNotes: "",
margin: 0,
profit: 0,
closed: null,
clientReview: "",
},
{
id: 2,
source: "Facebook",
customerName: "Sneha Kulkarni",
travelDate: "2026-09-02",
pax: 2,
destination: "Switzerland",
hotelPreference: "5-star, mountain view",
contactNo: "+91 98123 44556",
status: STATUS.NOT_ASSIGNED,
phase: PHASE.CAPTURE,
assignedAgent: null,
vendorDetails: "",
itineraryNotes: "",
margin: 0,
profit: 0,
closed: null,
clientReview: "",
},
{
id: 3,
source: "Referral",
customerName: "Rohit & Family",
travelDate: "2026-07-20",
pax: 5,
destination: "Manali, India",
hotelPreference: "3-star, family rooms",
contactNo: "+91 97000 22334",
status: STATUS.IN_PROCESS,
phase: PHASE.ITINERARY,
assignedAgent: "Riya Sharma",
vendorDetails: "Vendor: MountainStay Pvt Ltd, quote sent",
itineraryNotes: "Day 1: Arrival + local sightseeing. Day 2: Solang Valley. Day 3: Departure.",
margin: 12,
profit: 0,
closed: null,
clientReview: "",
},
{
id: 4,
source: "Website",
customerName: "Pooja Nair",
travelDate: "2026-10-05",
pax: 2,
destination: "Maldives",
hotelPreference: "Overwater villa",
contactNo: "+91 99887 65432",
status: STATUS.IN_PROCESS,
phase: PHASE.ITINERARY,
assignedAgent: "Karan Mehta",
vendorDetails: "Vendor: BlueLagoon DMC, awaiting visa docs",
itineraryNotes: "Drafting 4N/5D overwater villa package, snorkeling add-on pending vendor quote.",
margin: 18,
profit: 0,
closed: null,
clientReview: "",
},
{
id: 5,
source: "Instagram",
customerName: "The Khannas",
travelDate: "2026-06-30",
pax: 6,
destination: "Dubai, UAE",
hotelPreference: "4-star, 2 connecting rooms",
contactNo: "+91 98111 99887",
status: STATUS.CONFIRM,
phase: PHASE.CLOSURE,
assignedAgent: "Aisha Khan",
vendorDetails: "Vendor: Desert Star Tourism, booking #DXB-2291",
itineraryNotes: "5N/6D itinerary finalized and shared with client.",
margin: 15,
profit: 21500,
closed: true,
clientReview: "Excellent service, very responsive agent.",
},
{
id: 6,
source: "Walk-in",
customerName: "Vivek Singh",
travelDate: "2026-07-15",
pax: 2,
destination: "Goa, India",
hotelPreference: "Budget, near beach",
contactNo: "+91 90909 80808",
status: STATUS.CANCEL,
phase: PHASE.CLOSURE,
assignedAgent: "Riya Sharma",
vendorDetails: "Vendor quote expired, client postponed trip",
itineraryNotes: "Itinerary drafted but not finalized before cancellation.",
margin: 0,
profit: 0,
closed: false,
clientReview: "",
},
{
id: 7,
source: "Referral",
customerName: "Meera Iyer",
travelDate: "2026-08-25",
pax: 3,
destination: "Singapore",
hotelPreference: "4-star, near Sentosa",
contactNo: "+91 96543 21789",
status: STATUS.NOT_ASSIGNED,
phase: PHASE.CAPTURE,
assignedAgent: null,
vendorDetails: "",
itineraryNotes: "",
margin: 0,
profit: 0,
closed: null,
clientReview: "",
},
{
id: 8,
source: "Website",
customerName: "Arjun Reddy",
travelDate: "2026-09-18",
pax: 2,
destination: "Thailand",
hotelPreference: "4-star, Phuket beachfront",
contactNo: "+91 95123 67890",
status: STATUS.CONFIRM,
phase: PHASE.CLOSURE,
assignedAgent: "Karan Mehta",
vendorDetails: "Vendor: Siam Holidays, booking #BKK-1187",
itineraryNotes: "6N/7D itinerary finalized, airport transfers confirmed.",
margin: 14,
profit: 16800,
closed: true,
clientReview: "Smooth booking, would travel again with us.",
},
];

/\*\*

- LeadsAPI — the only place that knows where data actually lives.
- Today: an in-memory array. Tomorrow: replace each method's body with a
- fetch() to Express (e.g. GET/PUT /api/leads) and nothing above this
- layer needs to change.
  \*/
  const LeadsAPI = {
  \_store: SEED_LEADS,

async getAll() {
return Promise.resolve([...this._store]);
},

async assignLead(leadId, agentName) {
this.\_store = this.\_store.map((lead) =>
lead.id === leadId
? { ...lead, status: STATUS.IN_PROCESS, assignedAgent: agentName }
: lead
);
// Future: fetch(`/api/leads/${leadId}/assign`, { method: "PUT", body: JSON.stringify({ agentName }) })
return Promise.resolve(this.\_store.find((l) => l.id === leadId));
},

async updateLead(leadId, patch) {
this.\_store = this.\_store.map((lead) =>
lead.id === leadId ? { ...lead, ...patch } : lead
);
// Future: fetch(`/api/leads/${leadId}`, { method: "PUT", body: JSON.stringify(patch) })
return Promise.resolve(this.\_store.find((l) => l.id === leadId));
},

async advancePhase(leadId, nextPhase, extraPatch = {}) {
this.\_store = this.\_store.map((lead) =>
lead.id === leadId ? { ...lead, phase: nextPhase, ...extraPatch } : lead
);
// Future: fetch(`/api/leads/${leadId}/advance`, { method: "PUT", body: JSON.stringify({ nextPhase, ...extraPatch }) })
return Promise.resolve(this.\_store.find((l) => l.id === leadId));
},
};

/_ ============================================================================ 2. STATE MANAGEMENT HOOK
============================================================================ _/

function useLeads() {
const [leads, setLeads] = useState(SEED_LEADS);

const assignToAgent = useCallback(async (leadId, agentName) => {
const updated = await LeadsAPI.assignLead(leadId, agentName);
setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
}, []);

const updateLead = useCallback(async (leadId, patch) => {
const updated = await LeadsAPI.updateLead(leadId, patch);
setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
}, []);

const advancePhase = useCallback(async (leadId, nextPhase, extraPatch) => {
const updated = await LeadsAPI.advancePhase(leadId, nextPhase, extraPatch);
setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
}, []);

return { leads, assignToAgent, updateLead, advancePhase };
}

/_ ============================================================================ 3. PRESENTATIONAL HELPERS
============================================================================ _/

const STATUS_DOT = {
[STATUS.NOT_ASSIGNED]: "bg-slate-400",
[STATUS.IN_PROCESS]: "bg-amber-500",
[STATUS.CONFIRM]: "bg-emerald-500",
[STATUS.CANCEL]: "bg-rose-500",
};

const STATUS_PILL = {
[STATUS.NOT_ASSIGNED]: "bg-slate-100 text-slate-600",
[STATUS.IN_PROCESS]: "bg-amber-50 text-amber-700",
[STATUS.CONFIRM]: "bg-emerald-50 text-emerald-700",
[STATUS.CANCEL]: "bg-rose-50 text-rose-700",
};

function StatusPill({ status }) {
return (
<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${STATUS_PILL[status]}`}>
<span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
{status}
</span>
);
}

function formatDate(iso) {
if (!iso) return "—";
const d = new Date(iso);
return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function currency(n) {
return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

function initials(name) {
if (!name) return "?";
const parts = name.trim().split(/\s+/);
return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

const AVATAR_COLORS = [
"bg-indigo-100 text-indigo-700",
"bg-teal-100 text-teal-700",
"bg-amber-100 text-amber-700",
"bg-rose-100 text-rose-700",
"bg-sky-100 text-sky-700",
];

function avatarColor(name) {
if (!name) return "bg-slate-100 text-slate-500";
let hash = 0;
for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/\*\*

- A lead's Phase 1 is "ready to advance" once it has an agent, vendor
- contact started, and the core trip basics — these are exactly the fields
- the ops notes list under Phase 1. Used to gate the "Move to Itinerary"
- action so incomplete leads can't skip ahead by accident.
  \*/
  function isPhase1Complete(lead) {
  return Boolean(lead.assignedAgent) && lead.status !== STATUS.NOT_ASSIGNED;
  }

function isPhase2Complete(lead) {
return Boolean(lead.vendorDetails?.trim()) && Boolean(lead.itineraryNotes?.trim());
}

/_ ============================================================================ 4. ICONS
============================================================================ _/

const Icon = {
search: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><path d="M9 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4.35-4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
),
chevronDown: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
),
chevronRight: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><path d="M7.5 5 12.5 10 7.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
),
close: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><path d="M5 5 15 15M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
),
check: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
),
chart: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><path d="M4 16V9m6 7V4m6 12v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
),
plane: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><path d="M9 13.5 4 12l-1-1.5L4.5 10l3.8 1L13 5.5C13.6 4.6 15 4.4 15.5 5c.5.5.4 1.9-.5 2.5l-5.5 4.7 1 3.8-1.5.5L8 13.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
),
route: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><circle cx="4.5" cy="5" r="1.6" stroke="currentColor" strokeWidth="1.4" /><circle cx="15.5" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.4" /><path d="M5.8 6.2C8 8 8 12 11 12.8c1.4.4 2.6 1 3.4 1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
),
wallet: (p) => (
<svg viewBox="0 0 20 20" fill="none" {...p}><rect x="3" y="6" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M3 9h14M13 13h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
),
};

/_ ============================================================================ 5. PHASE STEPPER — top of page, shows the 3-phase pipeline with counts
============================================================================ _/

function PhaseStepper({ activePhase, onSelectPhase, phaseCounts }) {
const steps = [
{ phase: PHASE.CAPTURE, label: "Lead Capture", icon: Icon.plane },
{ phase: PHASE.ITINERARY, label: "Itinerary Builder", icon: Icon.route },
{ phase: PHASE.CLOSURE, label: "Closure", icon: Icon.wallet },
];

return (
<div className="flex items-stretch bg-white border border-slate-200 rounded-lg overflow-hidden">
{steps.map((step, idx) => {
const active = activePhase === step.phase;
const StepIcon = step.icon;
return (
<React.Fragment key={step.phase}>
<button
onClick={() => onSelectPhase(step.phase)}
className={`flex-1 flex items-center gap-3 px-5 py-3.5 transition-colors ${
                active ? "bg-indigo-50" : "hover:bg-slate-50"
              }`} >
<div
className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                }`} >
<StepIcon className="w-4 h-4" />
</div>
<div className="text-left">
<p className={`text-sm font-semibold ${active ? "text-indigo-700" : "text-slate-700"}`}>
Phase {step.phase} · {step.label}
</p>
<p className="text-xs text-slate-400">{phaseCounts[step.phase]} leads</p>
</div>
</button>
{idx < steps.length - 1 && (
<div className="flex items-center px-1 text-slate-300">
<Icon.chevronRight className="w-4 h-4" />
</div>
)}
</React.Fragment>
);
})}
</div>
);
}

/_ ============================================================================ 6. STATS BAR — global KPIs, independent of which phase is selected
============================================================================ _/

function StatCard({ label, value, icon, tint }) {
return (
<div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 flex-1 min-w-[160px]">
<div className={`w-9 h-9 rounded-md flex items-center justify-center ${tint}`}>{icon}</div>
<div>
<p className="text-[11px] text-slate-400 uppercase tracking-wide leading-none mb-1">{label}</p>
<p className="text-base font-semibold text-slate-800 leading-none">{value}</p>
</div>
</div>
);
}

function StatsBar({ leads }) {
const total = leads.length;
const inItinerary = leads.filter((l) => l.phase === PHASE.ITINERARY).length;
const confirmed = leads.filter((l) => l.status === STATUS.CONFIRM).length;
const totalProfit = leads.filter((l) => l.status === STATUS.CONFIRM).reduce((s, l) => s + (l.profit || 0), 0);

return (
<div className="flex flex-wrap gap-3 mb-5">
<StatCard label="Total leads" value={total} icon={<Icon.plane className="w-4 h-4 text-slate-500" />} tint="bg-slate-100" />
<StatCard label="In itinerary" value={inItinerary} icon={<Icon.route className="w-4 h-4 text-amber-600" />} tint="bg-amber-50" />
<StatCard label="Confirmed" value={confirmed} icon={<Icon.check className="w-4 h-4 text-emerald-600" />} tint="bg-emerald-50" />
<StatCard label="Confirmed profit" value={currency(totalProfit)} icon={<Icon.chart className="w-4 h-4 text-indigo-600" />} tint="bg-indigo-50" />
</div>
);
}

/_ ============================================================================ 7. FILTER BAR
============================================================================ _/

function FilterBar({ search, onSearch, agentFilter, onAgentFilter }) {
return (
<div className="flex flex-wrap items-center gap-2.5 mb-4">
<div className="relative flex-1 min-w-[240px]">
<Icon.search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
<input
type="text"
value={search}
onChange={(e) => onSearch(e.target.value)}
placeholder="Search by customer name or destination"
className="w-full text-sm border border-slate-200 rounded-md pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
/>
</div>

      <div className="relative">
        <select
          value={agentFilter}
          onChange={(e) => onAgentFilter(e.target.value)}
          className="appearance-none text-sm border border-slate-200 rounded-md pl-3 pr-8 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All agents</option>
          {AGENTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
          <option value="unassigned">Unassigned</option>
        </select>
        <Icon.chevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>

);
}

/* ============================================================================ 8. STATUS FILTER TABS — sub-filter *within* the active phase
============================================================================ */

function StatusFilterTabs({ activeStatus, onStatusChange, statusCounts }) {
const tabs = [
{ key: "all", label: "All" },
{ key: STATUS.NOT_ASSIGNED, label: "Not assigned" },
{ key: STATUS.IN_PROCESS, label: "In process" },
{ key: STATUS.CONFIRM, label: "Confirmed" },
{ key: STATUS.CANCEL, label: "Cancelled" },
];

return (
<div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
{tabs.map((tab) => {
const active = activeStatus === tab.key;
const count = statusCounts[tab.key] ?? 0;
if (tab.key !== "all" && count === 0 && activeStatus !== tab.key) return null;
return (
<button
key={tab.key}
onClick={() => onStatusChange(tab.key)}
className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`} >
{tab.label}
<span className={`text-xs rounded-full px-1.5 py-0.5 ${active ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-500"}`}>
{count}
</span>
</button>
);
})}
</div>
);
}

/_ ============================================================================ 9. PHASE 1 — LEAD CAPTURE TABLE
============================================================================ _/

function CaptureRow({ lead, currentUser, onAssign, onOpenDetails, onAdvance }) {
const canSelfAssign = lead.status === STATUS.NOT_ASSIGNED && currentUser.role === "agent";
const isAdmin = currentUser.role === "admin";
const canAdminAssign = isAdmin && lead.status === STATUS.NOT_ASSIGNED;
const ready = isPhase1Complete(lead);
const canAdvance = ready && (isAdmin || currentUser.name === lead.assignedAgent);

return (
<tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
<td className="py-3 pl-5 pr-3">
<button onClick={() => onOpenDetails(lead)} className="text-left group">
<p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600">{lead.customerName}</p>
<p className="text-xs text-slate-400">{lead.contactNo}</p>
</button>
</td>
<td className="py-3 px-3 text-sm text-slate-600">{lead.source}</td>
<td className="py-3 px-3">
<p className="text-sm text-slate-700">{lead.destination}</p>
<p className="text-xs text-slate-400">{lead.pax} pax · {formatDate(lead.travelDate)}</p>
</td>
<td className="py-3 px-3">
{lead.assignedAgent ? (
<div className="flex items-center gap-2">
<span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(lead.assignedAgent)}`}>
{initials(lead.assignedAgent)}
</span>
<span className="text-sm text-slate-600">{lead.assignedAgent}</span>
</div>
) : canAdminAssign ? (
<div className="relative">
<select
defaultValue=""
onChange={(e) => { if (e.target.value) onAssign(lead.id, e.target.value); }}
className="appearance-none text-xs border border-slate-200 rounded-md pl-2 pr-6 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400" >
<option value="" disabled>Assign to...</option>
{AGENTS.map((a) => (<option key={a} value={a}>{a}</option>))}
</select>
<Icon.chevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
</div>
) : (
<span className="text-sm text-slate-400">Unassigned</span>
)}
</td>
<td className="py-3 px-3"><StatusPill status={lead.status} /></td>
<td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
<div className="flex items-center justify-end gap-2">
{canSelfAssign && (
<button onClick={() => onAssign(lead.id, currentUser.name)} className="text-xs font-medium bg-indigo-600 text-white px-2.5 py-1.5 rounded-md hover:bg-indigo-700">
Assign to me
</button>
)}
{canAdvance && (
<button
onClick={() => onAdvance(lead.id, PHASE.ITINERARY)}
className="text-xs font-medium bg-emerald-600 text-white px-2.5 py-1.5 rounded-md hover:bg-emerald-700 flex items-center gap-1" >
Move to Itinerary <Icon.chevronRight className="w-3 h-3" />
</button>
)}
<button onClick={() => onOpenDetails(lead)} className="text-xs font-medium text-slate-500 border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-100">
Details
</button>
</div>
</td>
</tr>
);
}

function CaptureTable({ leads, currentUser, onAssign, onOpenDetails, onAdvance }) {
return (
<div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse min-w-[860px]">
<thead>
<tr className="bg-slate-50 border-b border-slate-200">
<th className="py-2.5 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Trip</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Agent</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
<th className="py-2.5 pr-5 pl-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">Actions</th>
</tr>
</thead>
<tbody>
{leads.length === 0 && (
<tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">No leads match the current filters.</td></tr>
)}
{leads.map((lead) => (
<CaptureRow key={lead.id} lead={lead} currentUser={currentUser} onAssign={onAssign} onOpenDetails={onOpenDetails} onAdvance={onAdvance} />
))}
</tbody>
</table>
</div>
</div>
);
}

/_ ============================================================================ 10. PHASE 2 — ITINERARY BUILDER TABLE
============================================================================ _/

function ItineraryRow({ lead, currentUser, onOpenDetails, onAdvance }) {
const isAdmin = currentUser.role === "admin";
const ready = isPhase2Complete(lead);
const canAdvance = ready && (isAdmin || currentUser.name === lead.assignedAgent);

return (
<tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
<td className="py-3 pl-5 pr-3">
<button onClick={() => onOpenDetails(lead)} className="text-left group">
<p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600">{lead.customerName}</p>
<p className="text-xs text-slate-400">{lead.destination} · {lead.pax} pax</p>
</button>
</td>
<td className="py-3 px-3">
<div className="flex items-center gap-2">
<span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(lead.assignedAgent)}`}>
{initials(lead.assignedAgent)}
</span>
<span className="text-sm text-slate-600">{lead.assignedAgent}</span>
</div>
</td>
<td className="py-3 px-3 max-w-[220px]">
<p className={`text-sm truncate ${lead.vendorDetails ? "text-slate-700" : "text-slate-400"}`}>
{lead.vendorDetails || "No vendor details yet"}
</p>
</td>
<td className="py-3 px-3">
<span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
<span className={`w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
{ready ? "Itinerary ready" : "In progress"}
</span>
</td>
<td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
<div className="flex items-center justify-end gap-2">
{canAdvance && (
<button
onClick={() => onAdvance(lead.id, PHASE.CLOSURE)}
className="text-xs font-medium bg-emerald-600 text-white px-2.5 py-1.5 rounded-md hover:bg-emerald-700 flex items-center gap-1" >
Move to Closure <Icon.chevronRight className="w-3 h-3" />
</button>
)}
<button onClick={() => onOpenDetails(lead)} className="text-xs font-medium text-slate-500 border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-100">
Build itinerary
</button>
</div>
</td>
</tr>
);
}

function ItineraryTable({ leads, currentUser, onOpenDetails, onAdvance }) {
return (
<div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse min-w-[820px]">
<thead>
<tr className="bg-slate-50 border-b border-slate-200">
<th className="py-2.5 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Agent</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Vendor</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Itinerary status</th>
<th className="py-2.5 pr-5 pl-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">Actions</th>
</tr>
</thead>
<tbody>
{leads.length === 0 && (
<tr><td colSpan={5} className="py-12 text-center text-sm text-slate-400">No leads in itinerary building right now.</td></tr>
)}
{leads.map((lead) => (
<ItineraryRow key={lead.id} lead={lead} currentUser={currentUser} onOpenDetails={onOpenDetails} onAdvance={onAdvance} />
))}
</tbody>
</table>
</div>
</div>
);
}

/_ ============================================================================ 11. PHASE 3 — CLOSURE TABLE
============================================================================ _/

function ClosureRow({ lead, currentUser, onOpenDetails, onClose }) {
const isAdmin = currentUser.role === "admin";
const isOpen = lead.closed === null || lead.closed === undefined;

return (
<tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
<td className="py-3 pl-5 pr-3">
<button onClick={() => onOpenDetails(lead)} className="text-left group">
<p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600">{lead.customerName}</p>
<p className="text-xs text-slate-400">{lead.destination}</p>
</button>
</td>
<td className="py-3 px-3">
<div className="flex items-center gap-2">
<span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(lead.assignedAgent)}`}>
{initials(lead.assignedAgent)}
</span>
<span className="text-sm text-slate-600">{lead.assignedAgent}</span>
</div>
</td>
<td className="py-3 px-3 text-sm text-slate-600">{lead.margin ? `${lead.margin}%` : "—"}</td>
<td className="py-3 px-3 text-sm font-medium text-slate-700">{lead.profit ? currency(lead.profit) : "—"}</td>
<td className="py-3 px-3"><StatusPill status={lead.status} /></td>
<td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
<div className="flex items-center justify-end gap-2">
{isAdmin && isOpen && (
<>
<button onClick={() => onClose(lead.id, true)} className="text-xs font-medium bg-emerald-600 text-white px-2.5 py-1.5 rounded-md hover:bg-emerald-700">
Close · Confirmed
</button>
<button onClick={() => onClose(lead.id, false)} className="text-xs font-medium border border-rose-200 text-rose-600 px-2.5 py-1.5 rounded-md hover:bg-rose-50">
Close · Cancelled
</button>
</>
)}
<button onClick={() => onOpenDetails(lead)} className="text-xs font-medium text-slate-500 border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-100">
Details
</button>
</div>
</td>
</tr>
);
}

function ClosureTable({ leads, currentUser, onOpenDetails, onClose }) {
return (
<div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse min-w-[820px]">
<thead>
<tr className="bg-slate-50 border-b border-slate-200">
<th className="py-2.5 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Agent</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margin</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profit</th>
<th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
<th className="py-2.5 pr-5 pl-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">Actions</th>
</tr>
</thead>
<tbody>
{leads.length === 0 && (
<tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">No leads in closure right now.</td></tr>
)}
{leads.map((lead) => (
<ClosureRow key={lead.id} lead={lead} currentUser={currentUser} onOpenDetails={onOpenDetails} onClose={onClose} />
))}
</tbody>
</table>
</div>
</div>
);
}

/_ ============================================================================ 12. LEAD DETAILS MODAL — adapts fields shown to the lead's current phase
============================================================================ _/

function LeadDetailsModal({ lead, currentUser, onClose, onSave }) {
const [vendorDetails, setVendorDetails] = useState(lead.vendorDetails || "");
const [itineraryNotes, setItineraryNotes] = useState(lead.itineraryNotes || "");
const [margin, setMargin] = useState(lead.margin || 0);
const [profit, setProfit] = useState(lead.profit || 0);
const [clientReview, setClientReview] = useState(lead.clientReview || "");

const isAdmin = currentUser.role === "admin";
const canEditVendor = isAdmin || currentUser.name === lead.assignedAgent;

const handleSave = () => {
onSave(lead.id, {
vendorDetails,
itineraryNotes,
margin: Number(margin),
profit: Number(profit),
clientReview,
});
onClose();
};

return (
<div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
<div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
<div className="flex items-center gap-3">
<span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${avatarColor(lead.customerName)}`}>
{initials(lead.customerName)}
</span>
<div>
<h2 className="text-base font-semibold text-slate-800">{lead.customerName}</h2>
<p className="text-sm text-slate-400">{lead.destination} · {lead.pax} pax</p>
</div>
</div>
<button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100">
<Icon.close className="w-4 h-4" />
</button>
</div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <StatusPill status={lead.status} />
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md px-2 py-1">
              Phase {lead.phase} · {PHASE_META[lead.phase].label}
            </span>
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Lead capture details</h3>
            <div className="text-sm text-slate-700 grid grid-cols-2 gap-y-2 bg-slate-50 rounded-md p-3">
              <span className="text-slate-400">Source</span><span>{lead.source}</span>
              <span className="text-slate-400">Travel date</span><span>{formatDate(lead.travelDate)}</span>
              <span className="text-slate-400">Hotel preference</span><span>{lead.hotelPreference}</span>
              <span className="text-slate-400">Contact no.</span><span>{lead.contactNo}</span>
              <span className="text-slate-400">Assigned agent</span><span>{lead.assignedAgent || "Unassigned"}</span>
            </div>
          </section>

          {lead.phase >= PHASE.ITINERARY && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Vendor details</h3>
                <textarea
                  value={vendorDetails}
                  onChange={(e) => setVendorDetails(e.target.value)}
                  rows={2}
                  disabled={!canEditVendor}
                  className="w-full text-sm border border-slate-200 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="Vendor name, quote status, booking refs..."
                />
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Itinerary notes</h3>
                <textarea
                  value={itineraryNotes}
                  onChange={(e) => setItineraryNotes(e.target.value)}
                  rows={3}
                  disabled={!canEditVendor}
                  className="w-full text-sm border border-slate-200 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="Day-wise plan, flights, hotel confirmations..."
                />
              </section>
            </>
          )}

          {lead.phase >= PHASE.CLOSURE && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Payment / profit analysis</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-500">
                    Margin (%)
                    <input
                      type="number"
                      value={margin}
                      onChange={(e) => setMargin(e.target.value)}
                      disabled={!isAdmin}
                      className="mt-1 w-full text-sm border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Profit (INR)
                    <input
                      type="number"
                      value={profit}
                      onChange={(e) => setProfit(e.target.value)}
                      disabled={!isAdmin}
                      className="mt-1 w-full text-sm border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </label>
                </div>
                {isAdmin && profit > 0 && (
                  <p className="text-xs text-slate-400 mt-1.5">Display value: {currency(profit)}</p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Client review</h3>
                <textarea
                  value={clientReview}
                  onChange={(e) => setClientReview(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder="Feedback after trip completion..."
                />
              </section>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="text-sm px-3.5 py-2 rounded-md border border-slate-200 text-slate-600 hover:bg-white">
            Close
          </button>
          <button onClick={handleSave} className="text-sm px-3.5 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
            Save changes
          </button>
        </div>
      </div>
    </div>

);
}

/_ ============================================================================ 13. LOGIN SCREEN — gates the dashboard behind a shared email/password.
Once that matches, the person picks who they are (Admin or which agent)
so the rest of the app still knows whose actions are whose.
============================================================================ _/

function LoginScreen({ onLogin }) {
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [error, setError] = useState("");
const [submitting, setSubmitting] = useState(false);
const [showPassword, setShowPassword] = useState(false);

const handleSubmit = async (e) => {
e.preventDefault();
setError("");
if (!email.trim() || !password) {
setError("Enter both email and password.");
return;
}
setSubmitting(true);
try {
await AuthAPI.login(email, password);
onLogin({ name: "Admin", role: "admin" });
} catch (err) {
setError(err.message || "Incorrect email or password.");
setSubmitting(false);
}
};

return (
<div className="min-h-[600px] flex items-center justify-center bg-slate-50 font-sans p-4">
<div className="w-full max-w-sm">
<div className="flex flex-col items-center mb-6">
<div className="w-11 h-11 rounded-lg bg-indigo-600 flex items-center justify-center text-white mb-3">
<Icon.plane className="w-5 h-5" />
</div>
<h1 className="text-lg font-semibold text-slate-800">Voyage CRM</h1>
<p className="text-sm text-slate-400 mt-0.5">Sign in to access the lead pipeline</p>
<p className="text-[10px] text-slate-300 mt-1 font-mono">build v2</p>
</div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="team@voyagecrm.com"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2.5 pr-16 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full text-sm font-medium bg-indigo-600 text-white rounded-md py-2.5 hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            Shared login — Email: <span className="font-mono text-slate-500">team@voyagecrm.com</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Password: <span className="font-mono text-slate-500">voyage123</span>
          </p>
        </div>
      </div>
    </div>

);
}

/_ ============================================================================ 14. ROOT APP
============================================================================ _/

export default function TravelCRMDashboard() {
const { leads, assignToAgent, updateLead, advancePhase } = useLeads();

const [search, setSearch] = useState("");
const [agentFilter, setAgentFilter] = useState("all");
const [activeStatus, setActiveStatus] = useState("all");
const [activePhase, setActivePhase] = useState(PHASE.CAPTURE);
const [currentUser, setCurrentUser] = useState(null);
const [selectedLead, setSelectedLead] = useState(null);

// Role-scoped: agents only ever see the unassigned pool + leads assigned to them.
const roleScopedLeads = useMemo(() => {
if (!currentUser) return [];
return leads.filter(
(lead) =>
currentUser.role === "admin" ||
lead.status === STATUS.NOT_ASSIGNED ||
lead.assignedAgent === currentUser.name
);
}, [leads, currentUser]);

const phaseCounts = useMemo(() => ({
[PHASE.CAPTURE]: roleScopedLeads.filter((l) => l.phase === PHASE.CAPTURE).length,
[PHASE.ITINERARY]: roleScopedLeads.filter((l) => l.phase === PHASE.ITINERARY).length,
[PHASE.CLOSURE]: roleScopedLeads.filter((l) => l.phase === PHASE.CLOSURE).length,
}), [roleScopedLeads]);

const phaseLeads = useMemo(
() => roleScopedLeads.filter((l) => l.phase === activePhase),
[roleScopedLeads, activePhase]
);

const statusCounts = useMemo(() => ({
all: phaseLeads.length,
[STATUS.NOT_ASSIGNED]: phaseLeads.filter((l) => l.status === STATUS.NOT_ASSIGNED).length,
[STATUS.IN_PROCESS]: phaseLeads.filter((l) => l.status === STATUS.IN_PROCESS).length,
[STATUS.CONFIRM]: phaseLeads.filter((l) => l.status === STATUS.CONFIRM).length,
[STATUS.CANCEL]: phaseLeads.filter((l) => l.status === STATUS.CANCEL).length,
}), [phaseLeads]);

const filteredLeads = useMemo(() => {
return phaseLeads.filter((lead) => {
const matchesSearch =
search.trim() === "" ||
lead.customerName.toLowerCase().includes(search.toLowerCase()) ||
lead.destination.toLowerCase().includes(search.toLowerCase());
const matchesAgent =
agentFilter === "all" ||
(agentFilter === "unassigned" && !lead.assignedAgent) ||
lead.assignedAgent === agentFilter;
const matchesStatus = activeStatus === "all" || lead.status === activeStatus;
return matchesSearch && matchesAgent && matchesStatus;
});
}, [phaseLeads, search, agentFilter, activeStatus]);

const handleClosure = useCallback((leadId, confirmed) => {
advancePhase(leadId, PHASE.CLOSURE, {
status: confirmed ? STATUS.CONFIRM : STATUS.CANCEL,
closed: confirmed,
});
}, [advancePhase]);

if (!currentUser) {
return <LoginScreen onLogin={setCurrentUser} />;
}

return (
<div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm font-sans">
{/_ Top brand bar _/}
<div className="flex items-center justify-between px-6 h-16 border-b border-slate-200 bg-white">
<div className="flex items-center gap-2.5">
<div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white">
<Icon.plane className="w-4 h-4" />
</div>
<div>
<p className="text-slate-800 font-semibold text-sm tracking-wide leading-tight">Voyage CRM</p>
<p className="text-xs text-slate-400 leading-tight">Lead pipeline</p>
</div>
</div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={currentUser.name}
              onChange={(e) => {
                const member = TEAM_MEMBERS.find((m) => m.name === e.target.value) || TEAM_MEMBERS[0];
                setCurrentUser({ name: member.name, role: member.role });
              }}
              className="appearance-none bg-slate-50 text-slate-700 text-sm rounded-md pl-3 pr-8 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {TEAM_MEMBERS.map((m) => (
                <option key={m.name} value={m.name}>View as: {m.name}</option>
              ))}
            </select>
            <Icon.chevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(currentUser.name)}`}>
              {initials(currentUser.name)}
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-700 leading-tight">{currentUser.name}</p>
              <p className="text-xs text-slate-400 leading-tight capitalize">{currentUser.role}</p>
            </div>
          </div>

          <button
            onClick={() => setCurrentUser(null)}
            className="text-sm font-medium text-slate-500 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>

      <main className="bg-slate-50">
        <div className="p-6">
          <StatsBar leads={roleScopedLeads} />

          <div className="mb-5">
            <PhaseStepper
              activePhase={activePhase}
              onSelectPhase={(p) => { setActivePhase(p); setActiveStatus("all"); }}
              phaseCounts={phaseCounts}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {activePhase === PHASE.CAPTURE ? (
              <StatusFilterTabs activeStatus={activeStatus} onStatusChange={setActiveStatus} statusCounts={statusCounts} />
            ) : (
              <p className="text-sm text-slate-500">
                {PHASE_META[activePhase].label} · <span className="font-medium text-slate-700">{filteredLeads.length} leads</span>
              </p>
            )}
            <p className="text-sm text-slate-400">{filteredLeads.length} of {phaseLeads.length} shown</p>
          </div>

          <FilterBar search={search} onSearch={setSearch} agentFilter={agentFilter} onAgentFilter={setAgentFilter} />

          {activePhase === PHASE.CAPTURE && (
            <CaptureTable
              leads={filteredLeads}
              currentUser={currentUser}
              onAssign={assignToAgent}
              onOpenDetails={setSelectedLead}
              onAdvance={advancePhase}
            />
          )}
          {activePhase === PHASE.ITINERARY && (
            <ItineraryTable
              leads={filteredLeads}
              currentUser={currentUser}
              onOpenDetails={setSelectedLead}
              onAdvance={advancePhase}
            />
          )}
          {activePhase === PHASE.CLOSURE && (
            <ClosureTable
              leads={filteredLeads}
              currentUser={currentUser}
              onOpenDetails={setSelectedLead}
              onClose={handleClosure}
            />
          )}
        </div>
      </main>

      {selectedLead && (
        <LeadDetailsModal
          key={selectedLead.id}
          lead={selectedLead}
          currentUser={currentUser}
          onClose={() => setSelectedLead(null)}
          onSave={updateLead}
        />
      )}
    </div>

);
}
