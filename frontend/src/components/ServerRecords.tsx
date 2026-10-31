import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  dateLabel,
  downloadCsv,
  money,
  request,
  type Data,
  type User,
} from "../data";
import "./ServerRecords.css";
type Row = Record<string, any>;
const config: Record<
  string,
  { entity: string; create?: string; label?: string }
> = {
  Subscriptions: {
    entity: "subscriptions",
    create: "subscription",
    label: "New subscription",
  },
  Invoices: { entity: "invoices", create: "payment", label: "Record payment" },
  Payments: { entity: "payments", create: "payment", label: "Record payment" },
  Customers: { entity: "customers" },
  "Audit log": { entity: "audit" },
  Quotations: {
    entity: "quotations",
    create: "quotation",
    label: "Create quotation",
  },
};
export function ServerRecords({
  name,
  user,
  data,
  revision,
  initialFilter = "All",
  onCreate,
  onOpen,
  notify,
}: {
  name: string;
  user: User;
  data: Data;
  revision: unknown;
  initialFilter?: string;
  onCreate: (name: string) => void;
  onOpen: (entity: string, row: Row) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const c = config[name];
  const customer = user.role === "CUSTOMER";
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initialFilter === "All" ? "" : initialFilter);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          page: String(page),
          page_size: "50",
          ...(from ? {from} : {}),
          ...(to ? {to} : {}),
        });
        if (search) params.set("search", search);
        if (status === "Overdue") params.set("overdue", "true");
        else if (status === "Outstanding") params.set("outstanding", "true");
        else if (status) params.set("status", status);
        if (customerId) params.set("customer_id", customerId);
        if (planId) params.set("plan_id", planId);
        if (method) params.set("method", method);
        const prefix =
          customer &&
          ["subscriptions", "invoices", "payments"].includes(c.entity)
            ? "/portal"
            : "";
        try {
          const result = await request(`${prefix}/${c.entity}?${params}`);
          if (!cancelled) {
            setRows(result.data);
            setTotal(result.total);
          }
        } catch (e) {
          if (!cancelled)
            setError(e instanceof Error ? e.message : "Unable to load records");
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      search ? 220 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    c.entity,
    page,
    status,
    search,
    customerId,
    planId,
    method,
    from,
    to,
    customer,
    revision,
    reload,
  ]);
  const change = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  const statusOptions =
    c.entity === "subscriptions"
      ? ["Active", "Draft", "Quotation", "Confirmed", "Paused", "Closed"]
      : c.entity === "invoices"
        ? ["Draft", "Confirmed", "Paid", "Outstanding", "Overdue", "Cancelled"]
        : c.entity === "quotations"
          ? ["Quotation", "Converted"]
          : [];
  async function pdf(row: Row) {
    try {
      const blob = await request(
        `${customer ? "/portal" : ""}/invoices/${row.id}/pdf`,
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = row.number + ".pdf";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Download failed", true);
    }
  }
  const badge = (s: string) => (
    <span className={`badge badge-${s.toLowerCase()}`}>
      <i />
      {s}
    </span>
  );
  return (
    <section className="card list-card server-records">
      {statusOptions.length > 0 && (
        <div className="list-tabs">
          {["", ...statusOptions].map((s) => (
            <button
              key={s}
              className={status === s ? "active" : ""}
              onClick={() => change(setStatus, s)}
            >
              {s || `All ${c.entity}`}
            </button>
          ))}
        </div>
      )}
      <div className="list-toolbar">
        <label className="list-search">
          <Search size={16} />
          <input
            aria-label={`Search ${c.entity}`}
            placeholder={`Search ${c.entity} or customers...`}
            value={search}
            onChange={(e) => change(setSearch, e.target.value)}
          />
        </label>
        <div className="toolbar-actions">
          <button
            className="button"
            onClick={() =>
              downloadCsv(
                `brightloop-${c.entity}-page-${page}`,
                rows.map((row) =>
                  Object.fromEntries(
                    Object.entries(row).filter(
                      ([, v]) => typeof v !== "object",
                    ),
                  ),
                ),
              )
            }
          >
            <ArrowDownToLine size={15} />
            Export page
          </button>
          {c.create && !customer && (
            <button
              className="button primary"
              onClick={() => onCreate(c.create!)}
            >
              <Plus size={15} />
              {c.label}
            </button>
          )}
        </div>
      </div>
      <div className="server-filters">
        <label>
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => change(setFrom, e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => change(setTo, e.target.value)}
          />
        </label>
        {!customer &&
          ["subscriptions", "invoices", "payments", "quotations"].includes(
            c.entity,
          ) && (
            <label>
              Customer
              <select
                value={customerId}
                onChange={(e) => change(setCustomerId, e.target.value)}
              >
                <option value="">All customers</option>
                {data.users
                  .filter((u) => u.role === "CUSTOMER")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.company || u.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        {c.entity === "subscriptions" && (
          <label>
            Plan
            <select
              value={planId}
              onChange={(e) => change(setPlanId, e.target.value)}
            >
              <option value="">All plans</option>
              {Array.from(
                new Map(data.plans.map((p) => [p.id, p])).values(),
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {c.entity === "payments" && (
          <label>
            Method
            <select
              value={method}
              onChange={(e) => change(setMethod, e.target.value)}
            >
              <option value="">All methods</option>
              {["bank", "cash", "card", "UPI", "other"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
        <span>
          {loading ? (
            <>
              <LoaderCircle size={13} className="spin" />
              Loading…
            </>
          ) : (
            `${total.toLocaleString()} matching records`
          )}
        </span>
      </div>
      {error ? (
        <div className="form-error" style={{ margin: 20 }}>
          {error}
          <button
            className="text-button"
            onClick={() => setReload((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(c.entity === "subscriptions"
                  ? [
                      "Subscription",
                      "Customer",
                      "Plan",
                      "Status",
                      "Next billing",
                      "Amount",
                      "",
                    ]
                  : c.entity === "invoices"
                    ? [
                        "Invoice",
                        "Customer",
                        "Status",
                        "Due date",
                        "Total",
                        "Balance",
                        "",
                      ]
                    : c.entity === "payments"
                      ? [
                          "Payment",
                          "Customer",
                          "Method",
                          "Date",
                          "Amount",
                          "Note",
                        ]
                      : c.entity === "customers"
                        ? ["Company", "Contact", "Email", "Role"]
                        : c.entity === "quotations"
                          ? [
                              "Quotation",
                              "Customer",
                              "Valid until",
                              "Status",
                              "",
                            ]
                          : ["Activity", "Entity", "Actor", "Date"]
                ).map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name =
                  row.customer?.company ||
                  row.customer?.name ||
                  data.users.find((u) => u.id === row.customer_id)?.company ||
                  "Customer";
                return (
                  <tr
                    key={row.id}
                    onClick={() =>
                      ["subscriptions", "invoices"].includes(c.entity) &&
                      onOpen(c.entity, row)
                    }
                  >
                    {c.entity === "subscriptions" ? (
                      <>
                        <td className="record-number">{row.number}</td>
                        <td>
                          <strong>{name}</strong>
                        </td>
                        <td>{row.plan?.name || "Subscription"}</td>
                        <td>{badge(row.status)}</td>
                        <td>{dateLabel(row.next_billing_date)}</td>
                        <td className="amount-cell">
                          {money(
                            row.lines.reduce(
                              (n: number, l: Row) =>
                                n + l.quantity * l.unit_price,
                              0,
                            ),
                            2,
                          )}
                        </td>
                        <td>
                          <ArrowUpRight size={14} />
                        </td>
                      </>
                    ) : c.entity === "invoices" ? (
                      <>
                        <td>
                          <span className="invoice-number">
                            <FileText size={16} />
                            {row.number}
                          </span>
                        </td>
                        <td>
                          <strong>{name}</strong>
                        </td>
                        <td>
                          {badge(
                            !["Paid", "Cancelled"].includes(row.status) &&
                              row.due_date <
                                new Date().toISOString().slice(0, 10)
                              ? "Overdue"
                              : row.status,
                          )}
                        </td>
                        <td>{dateLabel(row.due_date)}</td>
                        <td>{money(row.total, 2)}</td>
                        <td className="amount-cell">
                          {money(row.total - row.paid_amount, 2)}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Download ${row.number}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void pdf(row);
                            }}
                          >
                            <Download size={16} />
                          </button>
                        </td>
                      </>
                    ) : c.entity === "payments" ? (
                      <>
                        <td className="record-number">{row.id.slice(0, 8)}</td>
                        <td>{name}</td>
                        <td>{row.method}</td>
                        <td>{dateLabel(row.payment_date)}</td>
                        <td className="green-text">{money(row.amount, 2)}</td>
                        <td>{row.note}</td>
                      </>
                    ) : c.entity === "customers" ? (
                      <>
                        <td>
                          <strong>{row.company || row.name}</strong>
                        </td>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>{badge("Customer")}</td>
                      </>
                    ) : c.entity === "quotations" ? (
                      <>
                        <td className="record-number">{row.number}</td>
                        <td>{name}</td>
                        <td>{dateLabel(row.valid_until)}</td>
                        <td>{badge(row.status)}</td>
                        <td>
                          {row.status === "Quotation" && (
                            <button
                              className="button small"
                              onClick={() => {
                                void request(`/quotations/${row.id}/convert`, {
                                  method: "POST",
                                })
                                  .then(() => {
                                    notify(
                                      "Quotation converted into a subscription.",
                                    );
                                    setReload((n) => n + 1);
                                  })
                                  .catch((e) => notify(e.message, true));
                              }}
                            >
                              <RefreshCw size={13} />
                              Convert
                            </button>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="audit-action">
                          {row.action.replaceAll("_", " ")}
                        </td>
                        <td>{row.entity_type}</td>
                        <td>
                          {data.users.find((u) => u.id === row.actor)?.name ||
                            (row.actor === "system"
                              ? "System"
                              : row.actor.slice(0, 8))}
                        </td>
                        <td>{new Date(row.created_at).toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && !loading && (
            <div className="empty-state">
              <Search size={27} />
              <h3>No matching records</h3>
              <p>Try a different date range or filter.</p>
            </div>
          )}
        </div>
      )}
      <div className="pagination">
        <span>
          Showing{" "}
          <strong>
            {total ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)}
          </strong>{" "}
          of <strong>{total.toLocaleString()}</strong> results
        </span>
        <div>
          <button
            className="button small"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="page-number">{page}</span>
          <button
            className="button small"
            disabled={page * 50 >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
