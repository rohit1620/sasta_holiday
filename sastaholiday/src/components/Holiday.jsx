import React, { useState, useMemo, useCallback } from "react";

/* ============================================================================
   1. DATA LAYER — mirrors the future PostgreSQL "leads" table.
   Swap LeadsAPI's internals for real fetch() calls to Express later;
   every component below only talks to LeadsAPI, never to the array directly.
   ============================================================================ */

const STATUS = {
  NOT_ASSIGNED: "Not Assigned",
  IN_PROCESS: "In Process",
  CONFIRM: "Confirm",
  CANCEL: "Cancel",
};

const AGENTS = ["Riya Sharma", "Karan Mehta", "Aisha Khan"];

// Mirrors: CREATE TABLE leads (
//   id SERIAL PRIMARY KEY, customer_name TEXT, travel_date DATE, pax INT,
//   destination TEXT, hotel_preference TEXT, contact_no TEXT,
//   status TEXT CHECK (status IN (...)), assigned_agent TEXT,
//   vendor_details TEXT, margin NUMERIC, profit NUMERIC, client_review TEXT
// );
const SEED_LEADS = [
  {
    id: 1,
    customerName: "Amit Verma",
    travelDate: "2026-08-12",
    pax: 4,
    destination: "Bali, Indonesia",
    hotelPreference: "4-star, sea view",
    contactNo: "+91 98765 11122",
    status: STATUS.NOT_ASSIGNED,
    assignedAgent: null,
    vendorDetails: "",
    margin: 0,
    profit: 0,
    clientReview: "",
  },
  {
    id: 2,
    customerName: "Sneha Kulkarni",
    travelDate: "2026-09-02",
    pax: 2,
    destination: "Switzerland",
    hotelPreference: "5-star, mountain view",
    contactNo: "+91 98123 44556",
    status: STATUS.NOT_ASSIGNED,
    assignedAgent: null,
    vendorDetails: "",
    margin: 0,
    profit: 0,
    clientReview: "",
  },
  {
    id: 3,
    customerName: "Rohit & Family",
    travelDate: "2026-07-20",
    pax: 5,
    destination: "Manali, India",
    hotelPreference: "3-star, family rooms",
    contactNo: "+91 97000 22334",
    status: STATUS.IN_PROCESS,
    assignedAgent: "Riya Sharma",
    vendorDetails: "Vendor: MountainStay Pvt Ltd, quote sent",
    margin: 12,
    profit: 0,
    clientReview: "",
  },
  {
    id: 4,
    customerName: "Pooja Nair",
    travelDate: "2026-10-05",
    pax: 2,
    destination: "Maldives",
    hotelPreference: "Overwater villa",
    contactNo: "+91 99887 65432",
    status: STATUS.IN_PROCESS,
    assignedAgent: "Karan Mehta",
    vendorDetails: "Vendor: BlueLagoon DMC, awaiting visa docs",
    margin: 18,
    profit: 0,
    clientReview: "",
  },
  {
    id: 5,
    customerName: "The Khannas",
    travelDate: "2026-06-30",
    pax: 6,
    destination: "Dubai, UAE",
    hotelPreference: "4-star, 2 connecting rooms",
    contactNo: "+91 98111 99887",
    status: STATUS.CONFIRM,
    assignedAgent: "Aisha Khan",
    vendorDetails: "Vendor: Desert Star Tourism, booking #DXB-2291",
    margin: 15,
    profit: 21500,
    clientReview: "Excellent service, very responsive agent.",
  },
  {
    id: 6,
    customerName: "Vivek Singh",
    travelDate: "2026-07-15",
    pax: 2,
    destination: "Goa, India",
    hotelPreference: "Budget, near beach",
    contactNo: "+91 90909 80808",
    status: STATUS.CANCEL,
    assignedAgent: "Riya Sharma",
    vendorDetails: "Vendor quote expired, client postponed trip",
    margin: 0,
    profit: 0,
    clientReview: "",
  },
  {
    id: 7,
    customerName: "Meera Iyer",
    travelDate: "2026-08-25",
    pax: 3,
    destination: "Singapore",
    hotelPreference: "4-star, near Sentosa",
    contactNo: "+91 96543 21789",
    status: STATUS.NOT_ASSIGNED,
    assignedAgent: null,
    vendorDetails: "",
    margin: 0,
    profit: 0,
    clientReview: "",
  },
  {
    id: 8,
    customerName: "Arjun Reddy",
    travelDate: "2026-09-18",
    pax: 2,
    destination: "Thailand",
    hotelPreference: "4-star, Phuket beachfront",
    contactNo: "+91 95123 67890",
    status: STATUS.CONFIRM,
    assignedAgent: "Karan Mehta",
    vendorDetails: "Vendor: Siam Holidays, booking #BKK-1187",
    margin: 14,
    profit: 16800,
    clientReview: "Smooth booking, would travel again with us.",
  },
];

/**
 * LeadsAPI — the only place that knows where data actually lives.
 * Today: an in-memory array. Tomorrow: replace each method's body with a
 * fetch() to Express (e.g. GET/PUT /api/leads) and nothing above this
 * layer needs to change.
 */
const LeadsAPI = {
  _store: SEED_LEADS,

  async getAll() {
    return Promise.resolve([...this._store]);
  },

  async assignLead(leadId, agentName) {
    this._store = this._store.map((lead) =>
      lead.id === leadId
        ? { ...lead, status: STATUS.IN_PROCESS, assignedAgent: agentName }
        : lead,
    );
    // Future: return fetch(`/api/leads/${leadId}/assign`, { method: "PUT", body: JSON.stringify({ agentName }) })
    return Promise.resolve(this._store.find((l) => l.id === leadId));
  },

  async updateStatus(leadId, status) {
    this._store = this._store.map((lead) =>
      lead.id === leadId ? { ...lead, status } : lead,
    );
    return Promise.resolve(this._store.find((l) => l.id === leadId));
  },

  async updateLead(leadId, patch) {
    this._store = this._store.map((lead) =>
      lead.id === leadId ? { ...lead, ...patch } : lead,
    );
    return Promise.resolve(this._store.find((l) => l.id === leadId));
  },
};

/* ============================================================================
   2. STATE MANAGEMENT HOOK — owns leads, current user, filters.
   Swapping to PostgreSQL only means changing LeadsAPI above; this hook,
   and everything that consumes it, stays the same.
   ============================================================================ */

function useLeads() {
  const [leads, setLeads] = useState(SEED_LEADS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await LeadsAPI.getAll();
    setLeads(data);
    setLoading(false);
  }, []);

  const assignToAgent = useCallback(async (leadId, agentName) => {
    const updated = await LeadsAPI.assignLead(leadId, agentName);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
  }, []);

  const setStatus = useCallback(async (leadId, status) => {
    const updated = await LeadsAPI.updateStatus(leadId, status);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
  }, []);

  const updateLead = useCallback(async (leadId, patch) => {
    const updated = await LeadsAPI.updateLead(leadId, patch);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
  }, []);

  return { leads, loading, refresh, assignToAgent, setStatus, updateLead };
}

/* ============================================================================
   3. PRESENTATIONAL HELPERS
   ============================================================================ */

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
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${STATUS_PILL[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function currency(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
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
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ============================================================================
   4. ICONS — tiny inline SVGs, no external icon library needed
   ============================================================================ */

const Icon = {
  search: (p) => (
    <svg viewBox="0 0 20 20" fill="none" {...p}>
      <path
        d="M9 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4.35-4.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  chevronDown: (p) => (
    <svg viewBox="0 0 20 20" fill="none" {...p}>
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  close: (p) => (
    <svg viewBox="0 0 20 20" fill="none" {...p}>
      <path
        d="M5 5 15 15M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  users: (p) => (
    <svg viewBox="0 0 20 20" fill="none" {...p}>
      <path
        d="M13 8.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Zm-7.5 7c0-2.2 2.5-3.5 5-3.5s5 1.3 5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  layers: (p) => (
    <svg viewBox="0 0 20 20" fill="none" {...p}>
      <path
        d="M10 3 3 7l7 4 7-4-7-4Zm-7 7 7 4 7-4M3 13.5l7 4 7-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  chart: (p) => (
    <svg viewBox="0 0 20 20" fill="none" {...p}>
      <path
        d="M4 16V9m6 7V4m6 12v-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  plane: (p) => (
    <svg viewBox="0 0 20 20" fill="none" {...p}>
      <path
        d="M9 13.5 4 12l-1-1.5L4.5 10l3.8 1L13 5.5C13.6 4.6 15 4.4 15.5 5c.5.5.4 1.9-.5 2.5l-5.5 4.7 1 3.8-1.5.5L8 13.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

/* ============================================================================
   5. STATUS FILTER TABS — horizontal pipeline filter, lives in the top bar
   now that there's no sidebar. Single source of truth for status filtering.
   ============================================================================ */

function StatusFilterTabs({ activeStatus, onStatusChange, statusCounts }) {
  const tabs = [
    { key: "all", label: "All leads" },
    { key: STATUS.NOT_ASSIGNED, label: "Not assigned" },
    { key: STATUS.IN_PROCESS, label: "In process" },
    { key: STATUS.CONFIRM, label: "Confirmed" },
    { key: STATUS.CANCEL, label: "Cancelled" },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      {tabs.map((tab) => {
        const active = activeStatus === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onStatusChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs rounded-full px-1.5 py-0.5 ${active ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-500"}`}
            >
              {statusCounts[tab.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
   6. TOP STAT BAR
   ============================================================================ */

function StatCard({ label, value, icon, tint }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 flex-1 min-w-[160px]">
      <div
        className={`w-9 h-9 rounded-md flex items-center justify-center ${tint}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wide leading-none mb-1">
          {label}
        </p>
        <p className="text-base font-semibold text-slate-800 leading-none">
          {value}
        </p>
      </div>
    </div>
  );
}

function StatsBar({ leads }) {
  const total = leads.length;
  const inProcess = leads.filter((l) => l.status === STATUS.IN_PROCESS).length;
  const confirmed = leads.filter((l) => l.status === STATUS.CONFIRM).length;
  const totalProfit = leads
    .filter((l) => l.status === STATUS.CONFIRM)
    .reduce((s, l) => s + (l.profit || 0), 0);

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <StatCard
        label="Total leads"
        value={total}
        icon={<Icon.layers className="w-4 h-4 text-slate-500" />}
        tint="bg-slate-100"
      />
      <StatCard
        label="In process"
        value={inProcess}
        icon={<Icon.users className="w-4 h-4 text-amber-600" />}
        tint="bg-amber-50"
      />
      <StatCard
        label="Confirmed"
        value={confirmed}
        icon={<Icon.plane className="w-4 h-4 text-emerald-600" />}
        tint="bg-emerald-50"
      />
      <StatCard
        label="Confirmed profit"
        value={currency(totalProfit)}
        icon={<Icon.chart className="w-4 h-4 text-indigo-600" />}
        tint="bg-indigo-50"
      />
    </div>
  );
}

/* ============================================================================
   7. FILTER BAR
   ============================================================================ */

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
            <option key={a} value={a}>
              {a}
            </option>
          ))}
          <option value="unassigned">Unassigned</option>
        </select>
        <Icon.chevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

/* ============================================================================
   8. STATUS TABS (quick top-level filter, mirrors sidebar selection)
   ============================================================================ */

/* ============================================================================
   9. LEADS TABLE
   ============================================================================ */

function LeadRow({
  lead,
  currentUser,
  onAssign,
  onOpenDetails,
  onStatusChange,
}) {
  const canSelfAssign =
    lead.status === STATUS.NOT_ASSIGNED && currentUser.role === "agent";
  const isAdmin = currentUser.role === "admin";
  const canAdminAssign = isAdmin && lead.status === STATUS.NOT_ASSIGNED;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
      <td className="py-3 pl-5 pr-3">
        <button onClick={() => onOpenDetails(lead)} className="text-left group">
          <p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600">
            {lead.customerName}
          </p>
          <p className="text-xs text-slate-400">{lead.contactNo}</p>
        </button>
      </td>
      <td className="py-3 px-3">
        <p className="text-sm text-slate-700">{lead.destination}</p>
        <p className="text-xs text-slate-400">{lead.pax} pax</p>
      </td>
      <td className="py-3 px-3 text-sm text-slate-600 whitespace-nowrap">
        {formatDate(lead.travelDate)}
      </td>
      <td className="py-3 px-3">
        {lead.assignedAgent ? (
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(lead.assignedAgent)}`}
            >
              {initials(lead.assignedAgent)}
            </span>
            <span className="text-sm text-slate-600">{lead.assignedAgent}</span>
          </div>
        ) : canAdminAssign ? (
          <div className="relative">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) onAssign(lead.id, e.target.value);
              }}
              className="appearance-none text-xs border border-slate-200 rounded-md pl-2 pr-6 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="" disabled>
                Assign to...
              </option>
              {AGENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <Icon.chevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        ) : (
          <span className="text-sm text-slate-400">Unassigned</span>
        )}
      </td>
      <td className="py-3 px-3">
        <StatusPill status={lead.status} />
      </td>
      <td className="py-3 px-3 text-sm text-slate-600 whitespace-nowrap">
        {lead.status === STATUS.CONFIRM ? currency(lead.profit) : "—"}
      </td>
      <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {canSelfAssign && (
            <button
              onClick={() => onAssign(lead.id, currentUser.name)}
              className="text-xs font-medium bg-indigo-600 text-white px-2.5 py-1.5 rounded-md hover:bg-indigo-700"
            >
              Assign to me
            </button>
          )}
          {isAdmin && lead.status === STATUS.IN_PROCESS && (
            <>
              <button
                onClick={() => onStatusChange(lead.id, STATUS.CONFIRM)}
                className="text-xs font-medium bg-emerald-600 text-white px-2.5 py-1.5 rounded-md hover:bg-emerald-700"
              >
                Confirm
              </button>
              <button
                onClick={() => onStatusChange(lead.id, STATUS.CANCEL)}
                className="text-xs font-medium border border-rose-200 text-rose-600 px-2.5 py-1.5 rounded-md hover:bg-rose-50"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={() => onOpenDetails(lead)}
            className="text-xs font-medium text-slate-500 border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-100"
          >
            Details
          </button>
        </div>
      </td>
    </tr>
  );
}

function LeadsTable({
  leads,
  currentUser,
  onAssign,
  onOpenDetails,
  onStatusChange,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[860px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-2.5 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Destination
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Travel date
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Agent
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Profit
              </th>
              <th className="py-2.5 pr-5 pl-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center text-sm text-slate-400"
                >
                  No leads match the current filters.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                currentUser={currentUser}
                onAssign={onAssign}
                onOpenDetails={onOpenDetails}
                onStatusChange={onStatusChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================================
   10. LEAD DETAILS MODAL — itinerary / vendor / profit / review
   ============================================================================ */

function LeadDetailsModal({ lead, currentUser, onClose, onSave }) {
  const [vendorDetails, setVendorDetails] = useState(lead.vendorDetails || "");
  const [margin, setMargin] = useState(lead.margin || 0);
  const [profit, setProfit] = useState(lead.profit || 0);
  const [clientReview, setClientReview] = useState(lead.clientReview || "");

  const isAdmin = currentUser.role === "admin";
  const canEditVendor = isAdmin || currentUser.name === lead.assignedAgent;

  const handleSave = () => {
    onSave(lead.id, {
      vendorDetails,
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
            <span
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${avatarColor(lead.customerName)}`}
            >
              {initials(lead.customerName)}
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {lead.customerName}
              </h2>
              <p className="text-sm text-slate-400">
                {lead.destination} · {lead.pax} pax
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
          >
            <Icon.close className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <StatusPill status={lead.status} />
            <span className="text-xs text-slate-400">
              Lead #{String(lead.id).padStart(4, "0")}
            </span>
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Itinerary
            </h3>
            <div className="text-sm text-slate-700 grid grid-cols-2 gap-y-2 bg-slate-50 rounded-md p-3">
              <span className="text-slate-400">Travel date</span>
              <span>{formatDate(lead.travelDate)}</span>
              <span className="text-slate-400">Hotel preference</span>
              <span>{lead.hotelPreference}</span>
              <span className="text-slate-400">Contact no.</span>
              <span>{lead.contactNo}</span>
              <span className="text-slate-400">Assigned agent</span>
              <span>{lead.assignedAgent || "Unassigned"}</span>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Vendor details
            </h3>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Payment / profit analysis
            </h3>
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
              <p className="text-xs text-slate-400 mt-1.5">
                Display value: {currency(profit)}
              </p>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Client review
            </h3>
            <textarea
              value={clientReview}
              onChange={(e) => setClientReview(e.target.value)}
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Feedback after trip completion..."
            />
          </section>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="text-sm px-3.5 py-2 rounded-md border border-slate-200 text-slate-600 hover:bg-white"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            className="text-sm px-3.5 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   11. ROOT APP
   ============================================================================ */

export default function Holiday() {
  const { leads, assignToAgent, setStatus, updateLead } = useLeads();

  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [currentUser, setCurrentUser] = useState({
    role: "admin",
    name: "Admin",
  });
  const [selectedLead, setSelectedLead] = useState(null);

  // Role-scoped leads: agents only ever see the unassigned pool + their own leads.
  const roleScopedLeads = useMemo(() => {
    return leads.filter(
      (lead) =>
        currentUser.role === "admin" ||
        lead.status === STATUS.NOT_ASSIGNED ||
        lead.assignedAgent === currentUser.name,
    );
  }, [leads, currentUser]);

  const statusCounts = useMemo(() => {
    return {
      all: roleScopedLeads.length,
      [STATUS.NOT_ASSIGNED]: roleScopedLeads.filter(
        (l) => l.status === STATUS.NOT_ASSIGNED,
      ).length,
      [STATUS.IN_PROCESS]: roleScopedLeads.filter(
        (l) => l.status === STATUS.IN_PROCESS,
      ).length,
      [STATUS.CONFIRM]: roleScopedLeads.filter(
        (l) => l.status === STATUS.CONFIRM,
      ).length,
      [STATUS.CANCEL]: roleScopedLeads.filter((l) => l.status === STATUS.CANCEL)
        .length,
    };
  }, [roleScopedLeads]);

  const filteredLeads = useMemo(() => {
    return roleScopedLeads.filter((lead) => {
      const matchesSearch =
        search.trim() === "" ||
        lead.customerName.toLowerCase().includes(search.toLowerCase()) ||
        lead.destination.toLowerCase().includes(search.toLowerCase());

      const matchesAgent =
        agentFilter === "all" ||
        (agentFilter === "unassigned" && !lead.assignedAgent) ||
        lead.assignedAgent === agentFilter;

      const matchesStatus =
        activeStatus === "all" || lead.status === activeStatus;

      return matchesSearch && matchesAgent && matchesStatus;
    });
  }, [roleScopedLeads, search, agentFilter, activeStatus]);

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm font-sans">
      {/* Top brand bar */}
      <div className="flex items-center justify-between px-6 h-16 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white">
            <Icon.plane className="w-4 h-4" />
          </div>
          <div>
            <p className="text-slate-800 font-semibold text-sm tracking-wide leading-tight">
              Sasta-holiday CRM
            </p>
            <p className="text-xs text-slate-400 leading-tight">
              Lead pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={`${currentUser.role}:${currentUser.name}`}
              onChange={(e) => {
                const [role, name] = e.target.value.split(":");
                setCurrentUser({ role, name });
              }}
              className="appearance-none bg-slate-50 text-slate-700 text-sm rounded-md pl-3 pr-8 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="admin:Admin">Viewing as: Admin</option>
              {AGENTS.map((a) => (
                <option key={a} value={`agent:${a}`}>
                  Viewing as: {a}
                </option>
              ))}
            </select>
            <Icon.chevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2.5 pl-4 border-l border-slate-200">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(currentUser.name)}`}
            >
              {initials(currentUser.name)}
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-700 leading-tight">
                {currentUser.name}
              </p>
              <p className="text-xs text-slate-400 leading-tight capitalize">
                {currentUser.role}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="bg-slate-50">
        <div className="p-6">
          <StatsBar leads={roleScopedLeads} />

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <StatusFilterTabs
              activeStatus={activeStatus}
              onStatusChange={setActiveStatus}
              statusCounts={statusCounts}
            />
            <p className="text-sm text-slate-400">
              {filteredLeads.length} of {statusCounts.all} leads
            </p>
          </div>

          <FilterBar
            search={search}
            onSearch={setSearch}
            agentFilter={agentFilter}
            onAgentFilter={setAgentFilter}
          />
          <LeadsTable
            leads={filteredLeads}
            currentUser={currentUser}
            onAssign={assignToAgent}
            onOpenDetails={setSelectedLead}
            onStatusChange={setStatus}
          />
        </div>
      </main>

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          currentUser={currentUser}
          onClose={() => setSelectedLead(null)}
          onSave={updateLead}
        />
      )}
    </div>
  );
}
