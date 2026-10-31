import {
  cloneElement,
  isValidElement,
  useId,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type ReactElement,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  CircleHelp,
  Clock3,
  CreditCard,
  Download,
  Ellipsis,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  FolderKanban,
  HelpCircle,
  History,
  LayoutDashboard,
  Layers3,
  Leaf,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Package,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  API_URL,
  DEMO_TODAY,
  colors,
  dateLabel,
  downloadCsv,
  money,
  nextPeriod,
  request,
  seedData,
  uid,
  type Data,
  type Invoice,
  type Plan,
  type Role,
  type Subscription,
  type User,
} from "./data";
import { RevenueBreakdown, RevenueChart } from "./components/Charts";
import { ServerRecords } from "./components/ServerRecords";
import { CatalogManager } from "./components/CatalogManager";
const navGroups = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Subscriptions", icon: Layers3 },
      { label: "Customers", icon: Users },
      { label: "Products & plans", icon: Package },
      { label: "Quotations", icon: FileText },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { label: "Invoices", icon: FileClock },
      { label: "Payments", icon: Wallet },
      { label: "Taxes & discounts", icon: Tag },
      { label: "Reports", icon: Activity },
    ],
  },
  {
    label: "MANAGE",
    items: [
      { label: "Team & access", icon: ShieldCheck },
      { label: "Audit log", icon: History },
      { label: "Settings", icon: Settings2 },
    ],
  },
];
const descriptions: Record<string, string> = {
  Overview: "A clear view of your subscriptions. A little more peace of mind.",
  Subscriptions: "Every customer relationship, from first day to next renewal.",
  Customers: "The people and businesses growing with you.",
  "Products & plans": "Thoughtful products. Flexible plans. Room to grow.",
  Quotations: "Turn a promising conversation into a lasting subscription.",
  Invoices: "Accurate billing, from the first line to the final payment.",
  Payments: "Keep every payment connected to the bigger picture.",
  "Taxes & discounts": "The right rules, applied automatically. Every time.",
  Reports: "Less guesswork. More clarity about your business.",
  "Team & access": "The right people, with the right permissions.",
  "Audit log": "A complete, transparent history of your workspace.",
  Settings: "Make Brightloop feel a little more like your business.",
};
function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? "logo-small" : ""}`}>
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <path
          d="M18 5.5C11.1 5.5 5.5 11.1 5.5 18S11.1 30.5 18 30.5 30.5 24.9 30.5 18"
          stroke="currentColor"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M18 14.8a6.3 6.3 0 1 1-6.3 6.3"
          stroke="currentColor"
          strokeWidth="5.2"
          strokeLinecap="round"
        />
        <circle cx="28.6" cy="7.1" r="3.5" fill="currentColor" />
      </svg>
      {!small && (
        <span>
          brightloop<span className="logo-period">.</span>
        </span>
      )}
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge badge-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <i />
      {status}
    </span>
  );
}
function CustomerAvatar({
  name,
  index = 0,
  small = false,
}: {
  name: string;
  index?: number;
  small?: boolean;
}) {
  return (
    <span
      className={`company-avatar ${colors[index % colors.length]} ${small ? "small" : ""}`}
    >
      {index % 6 === 0 ? (
        <Box size={small ? 16 : 20} />
      ) : index % 6 === 1 ? (
        <Layers3 size={small ? 16 : 20} />
      ) : index % 6 === 2 ? (
        <span className="triangle-logo">▲</span>
      ) : index % 6 === 3 ? (
        <span className="capsule-logo" />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
function Empty({
  title = "No records found",
  description = "Try another search or create your first record.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <FolderKanban size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            "aria-labelledby": labelId,
          })
        : children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Pagination({
  count,
  page,
  setPage,
  size = 10,
}: {
  count: number;
  page: number;
  setPage: (v: number) => void;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <div className="pagination">
      <span>
        Showing{" "}
        <strong>
          {count ? (page - 1) * size + 1 : 0}–{Math.min(page * size, count)}
        </strong>{" "}
        of <strong>{count.toLocaleString()}</strong> results
      </span>
      <div>
        <button
          className="button small"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <span className="page-number">{page}</span>
        <button
          className="button small"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
export default function BrightloopApp() {
  const [data, setData] = useState<Data>(() => {
    if (API_URL)
      return {
        users: [],
        products: [],
        plans: [],
        subscriptions: [],
        invoices: [],
        payments: [],
        taxes: [],
        discounts: [],
        quotations: [],
        audit: [],
      };
    try {
      return (
        JSON.parse(localStorage.getItem("brightloop-data-v2") || "null") ||
        seedData()
      );
    } catch {
      return seedData();
    }
  });
  const [user, setUser] = useState<User | null>(() => {
    if (API_URL && !localStorage.getItem("brightloop-token")) return null;
    try {
      return (
        JSON.parse(localStorage.getItem("brightloop-user") || "null") ||
        (API_URL
          ? null
          : {
              id: "admin",
              name: "Alex Morgan",
              email: "admin@brightloop.local",
              role: "ADMIN",
            })
      );
    } catch {
      return null;
    }
  });
  const [pageName, setPageName] = useState("Overview");
  const [modal, setModal] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ type: string; id: string } | null>(
    null,
  );
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [quoteTemplates, setQuoteTemplates] = useState<
    { id: string; name: string; plan_id: string; validity_days: number }[]
  >([]);
  const [tab, setTab] = useState("Products");
  const [page, setPage] = useState(1);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateRange, setDateRange] = useState("This month");
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState(DEMO_TODAY);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [formError, setFormError] = useState("");
  const [serverSummary, setServerSummary] = useState<Record<
    string,
    number
  > | null>(null);
  const [serverAging, setServerAging] = useState<{ amount: number; count: number }[]>([]);
  const [notificationRead, setNotificationRead] = useState(false);
  const [businessName, setBusinessName] = useState(
    localStorage.getItem("brightloop-business") || "Brightloop Software",
  );
  const [billingResult, setBillingResult] = useState<{
    created: number;
    scanned: number;
    skipped: number;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCustomer = user?.role === "CUSTOMER";
  const isAdmin = user?.role === "ADMIN";
  const currentDate = API_URL
    ? new Date().toISOString().slice(0, 10)
    : DEMO_TODAY;
  const notify = useCallback((message: string, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const refresh = useCallback(async () => {
    if (!API_URL || !user) return;
    try {
      if (user.role === "CUSTOMER") {
        const results = await Promise.all(
          [
            "/portal/subscriptions",
            "/portal/invoices",
            "/portal/payments",
            "/portal/overview",
          ].map((p) => request(p)),
        );
        setData((d) => ({
          ...d,
          users: [user],
          subscriptions: results[0].data,
          invoices: results[1].data,
          payments: results[2].data,
          plans: results[0].data
            .map((s: { plan: Plan }) => s.plan)
            .filter(Boolean),
        }));
        setServerSummary(results[3]);
      } else {
        const endpoints = [
          "customers",
          "products",
          "plans",
          "subscriptions",
          "invoices",
          "payments",
          "taxes",
          "discounts",
          "quotations",
          "audit",
        ];
        const results = await Promise.all(
          endpoints.map((p) => request(`/${p}?page_size=100`)),
        );
        const summary = await request(
          `/dashboard/summary?from=${from}&to=${to}`,
        );
        setServerAging((await request(`/reports/aging?from=${from}&to=${to}`)).data);
        const team =
          user.role === "ADMIN" ? await request("/team") : { data: [user] };
        setData({
          users: [...team.data, ...results[0].data],
          products: results[1].data,
          plans: results[2].data,
          subscriptions: results[3].data,
          invoices: results[4].data,
          payments: results[5].data,
          taxes: results[6].data,
          discounts: results[7].data,
          quotations: results[8].data,
          audit: results[9].data,
        });
        setServerSummary(summary);
      }
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not connect to the local API",
        true,
      );
    }
  }, [user, from, to, notify]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!API_URL || detail?.type !== "subscription") return;
    let cancelled = false;
    void request(`/subscriptions/${detail.id}`)
      .then((row) => {
        if (cancelled) return;
        setData((d) => ({
          ...d,
          audit: [
            ...(row.history || []),
            ...d.audit.filter((a) => a.entity_id !== row.id),
          ],
        }));
      })
      .catch((e) => notify(e.message, true));
    return () => {
      cancelled = true;
    };
  }, [detail?.id, detail?.type, notify]);
  useEffect(() => {
    if (!API_URL)
      localStorage.setItem("brightloop-data-v2", JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    if (user) localStorage.setItem("brightloop-user", JSON.stringify(user));
    else localStorage.removeItem("brightloop-user");
  }, [user]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setModal("search");
      }
      if (e.key === "Escape") {
        setModal(null);
        setDetail(null);
        setDateOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  function navigate(name: string, nextFilter = "All") {
    setPageName(name);
    setFilter(nextFilter);
    setSearch("");
    setPage(1);
    setSidebarOpen(false);
    setDetail(null);
  }
  function openModal(name: string) {
    setFormError("");
    setSelectedPlanId(data.plans.find((p) => p.active)?.id || "");
    if (name === "quotation" && API_URL)
      void request("/templates?page_size=100")
        .then((r) => setQuoteTemplates(r.data))
        .catch((e) => notify(e.message, true));
    setModal(name);
    setProfileOpen(false);
  }
  const customers = data.users.filter((u) => u.role === "CUSTOMER");
  const getCustomer = (id: string) =>
    data.users.find((u) => u.id === id) || {
      id,
      name: "Customer",
      company: "Customer",
      email: "",
    };
  const getPlan = (id: string) => data.plans.find((p) => p.id === id);
  const subscriptions = useMemo(
    () =>
      data.subscriptions.filter(
        (s) => !isCustomer || s.customer_id === user?.id,
      ),
    [data.subscriptions, isCustomer, user],
  );
  const invoices = useMemo(
    () =>
      data.invoices.filter((s) => !isCustomer || s.customer_id === user?.id),
    [data.invoices, isCustomer, user],
  );
  const payments = useMemo(
    () =>
      data.payments.filter((s) => !isCustomer || s.customer_id === user?.id),
    [data.payments, isCustomer, user],
  );
  const overdue = invoices.filter(
    (i) =>
      !["Paid", "Cancelled"].includes(i.status) && i.due_date < currentDate,
  );
  const activeCount =
    serverSummary?.active_subscriptions ??
    subscriptions.filter((s) => s.status === "Active").length;
  const revenue =
    serverSummary?.revenue_collected ??
    payments
      .filter((p) => p.payment_date >= from && p.payment_date <= to)
      .reduce((s, p) => s + Number(p.amount), 0);
  const outstanding =
    serverSummary?.outstanding ??
    invoices
      .filter((i) => !["Paid", "Cancelled"].includes(i.status))
      .reduce((s, i) => s + Number(i.total) - Number(i.paid_amount), 0);
  const overdueAmount = overdue.reduce(
    (s, i) => s + Number(i.total) - Number(i.paid_amount),
    0,
  );
  const renewals = subscriptions
    .filter((s) => s.status === "Active" && s.expiry_date >= currentDate)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
    .slice(0, 4);
  function auditLocal(
    d: Data,
    type: string,
    entityId: string,
    action: string,
  ): Data {
    return {
      ...d,
      audit: [
        {
          id: uid(),
          entity_type: type,
          entity_id: entityId,
          actor: user?.name || "System",
          action,
          created_at: new Date().toISOString(),
        },
        ...d.audit,
      ],
    };
  }
  async function perform(action: () => Promise<void>, message?: string) {
    setBusy(true);
    setFormError("");
    try {
      await action();
      if (API_URL) await refresh();
      if (message) notify(message);
    } catch (e) {
      const error = e instanceof Error ? e.message : "Something went wrong";
      setFormError(error);
      notify(error, true);
    } finally {
      setBusy(false);
    }
  }
  async function subscriptionAction(s: Subscription, action: string) {
    await perform(
      async () => {
        if (API_URL)
          await request(
            `/${isCustomer ? "portal/" : ""}subscriptions/${s.id}/${action}`,
            { method: "POST" },
          );
        else {
          const p = getPlan(s.plan_id)!;
          const flag = {
            pause: "allow_pause",
            resume: "allow_pause",
            renew: "allow_renew",
            close: "allow_early_close",
          }[action] as keyof Plan["flags"] | undefined;
          if (flag && !p.flags[flag])
            throw new Error("Your plan does not allow this action.");
          const allowed: Record<string, string[]> = {
            confirm: ["Draft", "Quotation"],
            activate: ["Confirmed"],
            pause: ["Active"],
            resume: ["Paused"],
            renew: ["Active", "Paused", "Closed"],
            close: ["Active", "Paused"],
            cancel: ["Draft", "Quotation", "Confirmed"],
          };
          if (!allowed[action]?.includes(s.status))
            throw new Error(`Cannot ${action} this subscription.`);
          const status = {
            confirm: "Confirmed",
            activate: "Active",
            pause: "Paused",
            resume: "Active",
            renew: s.status === "Closed" ? "Active" : s.status,
            close: "Closed",
            cancel: "Closed",
          }[action]!;
          setData((d) =>
            auditLocal(
              {
                ...d,
                subscriptions: d.subscriptions.map((x) =>
                  x.id === s.id
                    ? {
                        ...x,
                        status,
                        ...(action === "renew"
                          ? {
                              expiry_date: nextPeriod(
                                s.expiry_date > currentDate
                                  ? s.expiry_date
                                  : currentDate,
                                p.billing_frequency,
                              ),
                            }
                          : {}),
                      }
                    : x,
                ),
              },
              "subscription",
              s.id,
              action,
            ),
          );
        }
      },
      `Subscription ${action === "renew" ? "renewed for another billing period" : action === "close" ? "closed" : action === "pause" ? "paused" : action === "resume" ? "resumed" : action === "activate" ? "activated" : "confirmed"}.`,
    );
  }
  async function runBilling() {
    await perform(async () => {
      if (API_URL) {
        setBillingResult(await request("/billing/run", { method: "POST" }));
      } else {
        const due = data.subscriptions.filter(
          (s) => s.status === "Active" && s.next_billing_date <= currentDate,
        );
        const newInvoices: Invoice[] = [];
        const updates = new Map<string, string>();
        for (const s of due) {
          const p = getPlan(s.plan_id)!;
          let start = s.next_billing_date;
          for (let j = 0; start <= currentDate && j < 120; j++) {
            const end = nextPeriod(start, p.billing_frequency);
            if (
              !data.invoices.some(
                (i) => i.subscription_id === s.id && i.period_start === start,
              )
            ) {
              const subtotal = s.lines.reduce(
                (n, l) => n + l.unit_price * l.quantity,
                0,
              );
              const tax =
                subtotal *
                data.taxes
                  .filter((t) => t.active && t.type === "percent")
                  .reduce((n, t) => n + t.value / 100, 0);
              const validDiscounts = data.discounts.filter(
                (r) =>
                  r.active &&
                  (!r.end_date || r.end_date >= currentDate) &&
                  (!r.max_uses || (r.used_count || 0) < r.max_uses),
              );
              const discount = Math.min(
                subtotal,
                validDiscounts.reduce(
                  (n, r) =>
                    n +
                    (r.type === "percent"
                      ? (subtotal * r.value) / 100
                      : r.value),
                  0,
                ),
              );
              newInvoices.push({
                id: uid(),
                number: `INV-2026-${1085 + newInvoices.length + data.invoices.length - 40}`,
                customer_id: s.customer_id,
                subscription_id: s.id,
                status: "Draft",
                period_start: start,
                period_end: end,
                due_date: new Date(
                  Date.parse(start) + s.payment_terms * 86400000,
                )
                  .toISOString()
                  .slice(0, 10),
                subtotal,
                total: Math.round((subtotal + tax - discount) * 100) / 100,
                tax_total: tax,
                discount_total: discount,
                paid_amount: 0,
                created_at: new Date().toISOString(),
                lines: s.lines,
              });
            }
            start = end;
          }
          updates.set(s.id, start);
        }
        setData((d) =>
          auditLocal(
            {
              ...d,
              invoices: [...newInvoices, ...d.invoices],
              subscriptions: d.subscriptions.map((s) =>
                updates.has(s.id)
                  ? { ...s, next_billing_date: updates.get(s.id)! }
                  : s,
              ),
            },
            "billing_run",
            uid(),
            "completed",
          ),
        );
        setBillingResult({
          created: newInvoices.length,
          scanned: due.length,
          skipped: due.length - newInvoices.length,
        });
      }
      setModal("billing-result");
    }, "Billing run completed. Every due subscription checked.");
  }
  async function invoiceAction(i: Invoice, action: string) {
    await perform(
      async () => {
        if (API_URL)
          await request(`/invoices/${i.id}/${action}`, { method: "POST" });
        else {
          if (action === "cancel" && i.paid_amount > 0)
            throw new Error("A partially paid invoice cannot be cancelled.");
          if (action !== "send")
            setData((d) =>
              auditLocal(
                {
                  ...d,
                  invoices: d.invoices.map((x) =>
                    x.id === i.id
                      ? {
                          ...x,
                          status:
                            action === "confirm" ? "Confirmed" : "Cancelled",
                        }
                      : x,
                  ),
                },
                "invoice",
                i.id,
                action,
              ),
            );
          else
            setData((d) =>
              auditLocal(d, "invoice", i.id, "sent_to_demo_outbox"),
            );
        }
      },
      action === "send"
        ? API_URL
          ? "Invoice PDF saved and notification written to the local outbox."
          : "Invoice marked as sent in the demo audit log. No email was sent."
        : `Invoice ${action === "confirm" ? "confirmed" : "cancelled"}.`,
    );
  }
  async function downloadInvoice(invoice: Invoice) {
    await perform(async () => {
      if (API_URL) {
        const blob = await request(
          `/${isCustomer ? "portal/" : ""}invoices/${invoice.id}/pdf`,
        );
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${invoice.number}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        const { default: jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setTextColor("#16836b");
        doc.setFontSize(25);
        doc.text("brightloop.", 20, 25);
        doc.setTextColor("#26372f");
        doc.setFontSize(12);
        doc.text("INVOICE  " + invoice.number, 20, 45);
        doc.text(
          "Bill to: " +
            (getCustomer(invoice.customer_id).company ||
              getCustomer(invoice.customer_id).name),
          20,
          56,
        );
        doc.text(
          `Due: ${dateLabel(invoice.due_date)}    Status: ${invoice.status}`,
          20,
          66,
        );
        doc.text(
          `Period: ${invoice.period_start} to ${invoice.period_end}`,
          20,
          76,
        );
        invoice.lines.forEach((l, n) =>
          doc.text(
            `${l.name}    ${l.quantity} x ${money(l.unit_price, 2)}`,
            20,
            95 + n * 10,
          ),
        );
        const y = 110 + invoice.lines.length * 10;
        doc.text(`Subtotal: ${money(invoice.subtotal, 2)}`, 20, y);
        doc.text(`Tax: ${money(invoice.tax_total, 2)}`, 20, y + 10);
        doc.text(`Discount: ${money(invoice.discount_total, 2)}`, 20, y + 20);
        doc.setFontSize(17);
        doc.text(`Total: ${money(invoice.total, 2)}`, 20, y + 35);
        doc.setFontSize(11);
        doc.text(
          `Paid: ${money(invoice.paid_amount, 2)}    Balance: ${money(invoice.total - invoice.paid_amount, 2)}`,
          20,
          y + 48,
        );
        doc.text(
          "Brightloop Software - Demo invoice. Not a payment request.",
          20,
          270,
        );
        doc.save(`${invoice.number}.pdf`);
      }
    }, "Invoice PDF downloaded.");
  }
  async function handleForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
    await perform(async () => {
      if (modal === "subscription") {
        const p = data.plans.find((x) => x.id === form.plan_id)!;
        if (Number(form.quantity) < p.min_quantity)
          throw new Error(
            `This plan requires a minimum quantity of ${p.min_quantity}.`,
          );
        const variantIds = Object.entries(form)
          .filter(([key, value]) => key.startsWith("variant-") && value)
          .map(([, value]) => value);
        const payload = {
          customer_id: form.customer_id,
          plan_id: p.id,
          start_date: form.start_date,
          payment_terms: Number(form.payment_terms),
          lines: [
            {
              product_id: p.product_id,
              quantity: Number(form.quantity),
              variant_ids: variantIds,
            },
          ],
        };
        if (API_URL)
          await request("/subscriptions", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        else {
          const s: Subscription = {
            ...payload,
            id: uid(),
            number: `SUB-2026-${String(1421 + data.subscriptions.length - 1420).padStart(4, "0")}`,
            status: "Draft",
            expiry_date: nextPeriod(form.start_date, p.billing_frequency),
            next_billing_date: form.start_date,
            lines: [
              {
                ...payload.lines[0],
                name:
                  data.products.find((x) => x.id === p.product_id)?.name ||
                  p.name,
                unit_price:
                  p.price +
                  (
                    data.products.find((product) => product.id === p.product_id)
                      ?.variants || []
                  )
                    .filter((v) => variantIds.includes(v.id))
                    .reduce((total, v) => total + Number(v.price_delta), 0),
              },
            ],
            created_at: new Date().toISOString(),
          };
          setData((d) =>
            auditLocal(
              { ...d, subscriptions: [s, ...d.subscriptions] },
              "subscription",
              s.id,
              "created",
            ),
          );
        }
        notify("Subscription created. Confirm it when you’re ready.");
        navigate("Subscriptions");
      } else if (modal === "payment") {
        const i = data.invoices.find((x) => x.id === form.invoice_id)!;
        const amount = Number(form.amount);
        if (amount <= 0 || amount > i.total - i.paid_amount)
          throw new Error("Enter an amount within the outstanding balance.");
        if (form.payment_date > currentDate)
          throw new Error("Payment date cannot be in the future.");
        const payload = {
          invoice_id: i.id,
          amount,
          method: form.method,
          payment_date: form.payment_date,
          note: form.note,
        };
        if (API_URL)
          await request("/payments", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        else {
          const payment = {
            ...payload,
            id: uid(),
            customer_id: i.customer_id,
            created_at: new Date().toISOString(),
          };
          setData((d) =>
            auditLocal(
              {
                ...d,
                payments: [payment, ...d.payments],
                invoices: d.invoices.map((x) =>
                  x.id === i.id
                    ? {
                        ...x,
                        paid_amount:
                          Math.round((x.paid_amount + amount) * 100) / 100,
                        status:
                          x.paid_amount + amount >= x.total - 0.001
                            ? "Paid"
                            : "Confirmed",
                      }
                    : x,
                ),
              },
              "payment",
              payment.id,
              "recorded",
            ),
          );
        }
        notify("Payment recorded and invoice balance updated.");
      } else if (modal === "product") {
        const product = {
          id: uid(),
          name: form.name,
          type: form.type,
          sales_price: Number(form.sales_price),
          cost_price: Number(form.cost_price),
          notes: form.notes,
          active: true,
        };
        if (API_URL)
          await request("/products", {
            method: "POST",
            body: JSON.stringify(product),
          });
        else
          setData((d) =>
            auditLocal(
              { ...d, products: [...d.products, product] },
              "product",
              product.id,
              "created",
            ),
          );
        notify("Product added to your catalog.");
      } else if (modal === "plan") {
        const plan: Plan = {
          id: uid(),
          name: form.name,
          product_id: form.product_id,
          price: Number(form.price),
          billing_frequency: form.billing_frequency,
          min_quantity: Number(form.min_quantity),
          active: true,
          flags: {
            auto_close_on_end: true,
            allow_early_close: form.allow_early_close === "on",
            allow_pause: form.allow_pause === "on",
            allow_renew: form.allow_renew === "on",
          },
        };
        if (API_URL)
          await request("/plans", {
            method: "POST",
            body: JSON.stringify(plan),
          });
        else
          setData((d) =>
            auditLocal(
              { ...d, plans: [...d.plans, plan] },
              "plan",
              plan.id,
              "created",
            ),
          );
        notify("Billing plan created.");
      } else if (modal === "tax" || modal === "discount") {
        if (form.type === "percent" && Number(form.value) > 100)
          throw new Error("Percentage cannot exceed 100.");
        const rule = {
          id: uid(),
          name: form.name,
          type: form.type,
          value: Number(form.value),
          active: true,
          ...(modal === "discount"
            ? {
                scope: form.scope,
                end_date: form.end_date || undefined,
                max_uses: form.max_uses ? Number(form.max_uses) : undefined,
                used_count: 0,
              }
            : {}),
        };
        const key = modal === "tax" ? "taxes" : "discounts";
        if (API_URL)
          await request(`/${key}`, {
            method: "POST",
            body: JSON.stringify(rule),
          });
        else
          setData((d) =>
            auditLocal(
              { ...d, [key]: [...d[key], rule] },
              modal,
              rule.id,
              "created",
            ),
          );
        notify(`${modal === "tax" ? "Tax" : "Discount"} rule created.`);
      } else if (modal === "staff") {
        if (
          !/(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{9,}/.test(form.password)
        )
          throw new Error(
            "Use at least 9 characters, uppercase, lowercase, and a special character.",
          );
        if (
          data.users.some(
            (u) => u.email.toLowerCase() === form.email.toLowerCase(),
          )
        )
          throw new Error("This email already has an account.");
        if (API_URL)
          await request("/admin/staff", {
            method: "POST",
            body: JSON.stringify(form),
          });
        else {
          const staffUser: User = {
            id: uid(),
            name: form.name,
            email: form.email,
            role: "STAFF",
          };
          setData((d) =>
            auditLocal(
              { ...d, users: [...d.users, staffUser] },
              "user",
              staffUser.id,
              "created",
            ),
          );
        }
        notify(
          "Staff account created. Share their temporary password securely.",
        );
      } else if (modal === "quotation") {
        if (API_URL) {
          const templates = await request("/templates");
          if (!templates.data.length)
            throw new Error(
              "Run the seed script to create the quotation template.",
            );
          await request("/quotations", {
            method: "POST",
            body: JSON.stringify({
              template_id: form.template_id || templates.data[0].id,
              customer_id: form.customer_id,
            }),
          });
        } else {
          const quote = {
            id: uid(),
            number: `QUO-2026-${String(data.quotations.length + 25).padStart(4, "0")}`,
            customer_id: form.customer_id,
            plan_id: form.plan_id,
            status: "Quotation",
            valid_until: new Date(
              Date.parse(currentDate) + Number(form.validity_days) * 86400000,
            )
              .toISOString()
              .slice(0, 10),
            created_at: new Date().toISOString(),
          };
          setData((d) =>
            auditLocal(
              { ...d, quotations: [quote, ...d.quotations] },
              "quotation",
              quote.id,
              "created",
            ),
          );
        }
        notify("Quotation created and ready to share.");
      } else if (modal === "customer") {
        if (data.users.some((u) => u.email === form.email))
          throw new Error("This email is already registered.");
        if (API_URL)
          throw new Error(
            "Customers must sign up from the local login screen.",
          );
        const customer: User = {
          id: uid(),
          name: form.name,
          email: form.email,
          company: form.company,
          role: "CUSTOMER",
        };
        setData((d) =>
          auditLocal(
            { ...d, users: [...d.users, customer] },
            "customer",
            customer.id,
            "created",
          ),
        );
        notify("Customer added.");
      }
      setModal(null);
    });
  }
  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
    await perform(async () => {
      if (authMode === "forgot" || authMode === "reset") {
        if (!API_URL) {
          notify(
            "Password recovery is available with the local API. Download the project to run it.",
          );
          return;
        }
        const result = await request(
          `/auth/${authMode === "forgot" ? "forgot-password" : "reset-password"}`,
          { method: "POST", body: JSON.stringify(form) },
        );
        notify(result.message);
        setAuthMode("login");
        return;
      }
      if (API_URL) {
        const result = await request(
          `/auth/${authMode === "signup" ? "signup" : "login"}`,
          { method: "POST", body: JSON.stringify(form) },
        );
        localStorage.setItem("brightloop-token", result.access_token);
        localStorage.setItem("brightloop-refresh", result.refresh_token);
        setUser(result.user);
      } else {
        const match = data.users.find((u) => u.email === form.email);
        if (!match || form.password !== "Brightloop@2026")
          throw new Error("Use a demo email and the password Brightloop@2026.");
        setUser(match);
      }
      setPageName("Overview");
      notify("Welcome back to Brightloop.");
    });
  }
  function exportPage() {
    let rows: Record<string, unknown>[];
    if (pageName === "Subscriptions")
      rows = subscriptions.map((s) => ({
        number: s.number,
        customer: getCustomer(s.customer_id).company,
        plan: getPlan(s.plan_id)?.name,
        status: s.status,
        next_billing: s.next_billing_date,
        amount: s.lines.reduce((n, l) => n + l.unit_price * l.quantity, 0),
      }));
    else if (pageName === "Invoices")
      rows = invoices.map((i) => ({
        number: i.number,
        customer: getCustomer(i.customer_id).company,
        status: i.status,
        total: i.total,
        paid: i.paid_amount,
        due: i.due_date,
      }));
    else if (pageName === "Payments") rows = payments.map((p) => ({ ...p }));
    else
      rows = [
        {
          report: "Brightloop business summary",
          from,
          to,
          active_subscriptions: activeCount,
          revenue_collected: revenue,
          outstanding,
          overdue_count: overdue.length,
          overdue_amount: overdueAmount,
        },
      ];
    downloadCsv(
      `brightloop-${pageName.toLowerCase().replaceAll(" ", "-")}-${currentDate}`,
      rows,
    );
    notify("Your report has been exported as CSV.");
  }
  const matches = (value: string) =>
    value.toLowerCase().includes(search.toLowerCase());
  const filteredSubs = subscriptions.filter(
    (s) =>
      (filter === "All" || s.status === filter) &&
      matches(
        `${s.number} ${getCustomer(s.customer_id).company} ${getCustomer(s.customer_id).name} ${getPlan(s.plan_id)?.name}`,
      ),
  );
  const filteredInvoices = invoices.filter(
    (i) =>
      (filter === "All" ||
        (filter === "Overdue"
          ? overdue.some((x) => x.id === i.id)
          : filter === "Outstanding"
            ? !["Paid", "Cancelled"].includes(i.status)
            : i.status === filter)) &&
      matches(`${i.number} ${getCustomer(i.customer_id).company}`),
  );
  function renderSubscriptions(rows: Subscription[], compact = false) {
    return (
      <div className="table-scroll">
        <table className={compact ? "compact-table" : ""}>
          <thead>
            <tr>
              {!compact && <th>Subscription</th>}
              <th>Customer</th>
              <th>Plan</th>
              <th>Status</th>
              <th>{compact ? "Next billing" : "Next billing date"}</th>
              <th className="align-right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const c = getCustomer(s.customer_id);
              const p = getPlan(s.plan_id);
              return (
                <tr
                  key={s.id}
                  onClick={() => setDetail({ type: "subscription", id: s.id })}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    setDetail({ type: "subscription", id: s.id })
                  }
                >
                  {!compact && <td className="record-number">{s.number}</td>}
                  <td>
                    <div className="customer-cell">
                      <CustomerAvatar
                        name={c.company || c.name}
                        index={Number(s.customer_id.replace(/\D/g, "")) || i}
                        small={compact}
                      />
                      <div>
                        <strong>{c.company || c.name}</strong>
                        <span>{compact ? s.number : c.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="plan-name">
                      {p?.name || "Subscription"}
                    </span>
                    <span className="cell-secondary">
                      {p?.billing_frequency === "yearly" ? "Yearly" : "Monthly"}
                    </span>
                  </td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                  <td className="date-cell">
                    {dateLabel(s.next_billing_date, compact)}
                  </td>
                  <td className="align-right amount-cell">
                    {money(
                      s.lines.reduce(
                        (a, l) => a + Number(l.unit_price) * l.quantity,
                        0,
                      ),
                    )}
                    <span className="cell-secondary">
                      /{p?.billing_frequency === "yearly" ? "year" : "month"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button row-more"
                      aria-label={`View ${s.number}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail({ type: "subscription", id: s.id });
                      }}
                    >
                      <Ellipsis size={17} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty />}
      </div>
    );
  }
  function renderInvoices(rows: Invoice[]) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Due date</th>
              <th className="align-right">Total</th>
              <th className="align-right">Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((i, index) => (
              <tr
                key={i.id}
                onClick={() => setDetail({ type: "invoice", id: i.id })}
              >
                <td>
                  <div className="invoice-number">
                    <FileText size={17} />
                    {i.number}
                  </div>
                </td>
                <td>
                  <div className="customer-cell">
                    <CustomerAvatar
                      name={getCustomer(i.customer_id).company || "C"}
                      index={index}
                      small
                    />
                    <strong>
                      {getCustomer(i.customer_id).company ||
                        getCustomer(i.customer_id).name}
                    </strong>
                  </div>
                </td>
                <td>
                  <Badge
                    status={
                      overdue.some((x) => x.id === i.id) ? "Overdue" : i.status
                    }
                  />
                </td>
                <td className="date-cell">{dateLabel(i.due_date)}</td>
                <td className="align-right amount-cell">{money(i.total, 2)}</td>
                <td className="align-right amount-cell">
                  {money(i.total - i.paid_amount, 2)}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Download ${i.number}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void downloadInvoice(i);
                    }}
                  >
                    <Download size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
    );
  }
  const toolbar = (
    placeholder: string,
    create?: string,
    buttonLabel?: string,
  ) => (
    <div className="list-toolbar">
      <label className="list-search">
        <Search size={17} />
        <input
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <div className="toolbar-actions">
        <button className="button" onClick={exportPage}>
          <Download size={15} />
          Export
        </button>
        {create && (
          <button className="button primary" onClick={() => openModal(create)}>
            <Plus size={16} />
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
  const statCards = (
    <div className="stats-grid">
      <button
        className="stat-card"
        onClick={() => navigate("Subscriptions", "Active")}
      >
        <div className="stat-label">
          Active subscriptions
          <span className="stat-icon">
            <Layers3 size={17} />
          </span>
        </div>
        <div className="stat-value">
          {activeCount.toLocaleString()}
          <span className="mini-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="stat-footer">
          <span className="trend">
            <ArrowUpRight size={13} />
            {API_URL ? "Current" : "12.8%"}
          </span>
          <span>{API_URL ? "active right now" : "vs. last month"}</span>
        </div>
      </button>
      <button className="stat-card" onClick={() => navigate("Payments")}>
        <div className="stat-label">
          Revenue collected
          <span className="stat-icon">
            <CircleDollarSign size={17} />
          </span>
        </div>
        <div className="stat-value">
          {money(revenue)}
          <svg className="mini-chart" viewBox="0 0 80 28">
            <path
              d="M2 25L12 19L20 22L29 14L37 17L46 10L55 13L64 5L73 8L79 1"
              stroke="#389f7e"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>
        <div className="stat-footer">
          <span className="trend">
            <ArrowUpRight size={13} />
            {API_URL ? "Collected" : "18.6%"}
          </span>
          <span>{API_URL ? "in selected period" : "vs. last month"}</span>
        </div>
      </button>
      <button
        className="stat-card"
        onClick={() => navigate("Invoices", "Outstanding")}
      >
        <div className="stat-label">
          Outstanding invoices
          <span className="stat-icon">
            <FileClock size={17} />
          </span>
        </div>
        <div className="stat-value">
          {money(outstanding)}
          <span className="stat-count">
            {
              serverSummary?.outstanding_count ?? invoices.filter((i) => !["Paid", "Cancelled"].includes(i.status))
                .length
            }{" "}
            invoices
          </span>
        </div>
        <div className="stat-footer">
          <span className="trend">
            <ArrowDownLeft size={13} />
            {API_URL ? "Open" : "4.2%"}
          </span>
          <span>{API_URL ? "remaining balance" : "vs. last month"}</span>
        </div>
      </button>
      <button
        className="stat-card overdue-stat"
        onClick={() => navigate("Invoices", "Overdue")}
      >
        <div className="stat-label">
          Overdue invoices
          <span className="stat-icon orange-icon">
            <Clock3 size={17} />
          </span>
        </div>
        <div className="stat-value">
          {serverSummary?.overdue_count ?? overdue.length}
          <span className="overdue-amount">
            {money(serverSummary?.overdue_amount ?? overdueAmount)}
          </span>
        </div>
        <div className="stat-footer">
          <span className="attention-dot" />
          <span className="attention-text">Needs your attention</span>
          <ArrowRight size={14} />
        </div>
      </button>
    </div>
  );
  const selectedSub =
    detail?.type === "subscription"
      ? data.subscriptions.find((s) => s.id === detail.id)
      : null;
  const selectedInvoice =
    detail?.type === "invoice"
      ? data.invoices.find((i) => i.id === detail.id)
      : null;
  if (!user)
    return (
      <div className="auth-screen">
        <div className="auth-art">
          <Logo />
          <div>
            <span className="eyebrow">LESS ADMIN. MORE POSSIBILITY.</span>
            <h1>
              Good business
              <br />
              comes full circle.
            </h1>
            <p>
              One thoughtful workspace for every subscription,
              <br />
              every payment, and every next chapter.
            </p>
            <div className="auth-orbits">
              <span />
              <span />
              <span />
              <Leaf size={55} />
            </div>
          </div>
          <span className="auth-bottom">
            Built for a brighter way to do business.
          </span>
        </div>
        <div className="auth-content">
          <div className="auth-card">
            <span className="green-icon large">
              <LockKeyhole size={25} />
            </span>
            <h1>
              {authMode === "login"
                ? "Welcome back."
                : authMode === "signup"
                  ? "Start your next chapter."
                  : authMode === "forgot"
                    ? "Forgot your password?"
                    : "A fresh start."}
            </h1>
            <p>
              {authMode === "login"
                ? "Sign in to your Brightloop workspace."
                : authMode === "signup"
                  ? "Create your customer portal account."
                  : "Secure password recovery, handled locally."}
            </p>
            <form onSubmit={handleAuth}>
              {authMode === "signup" && (
                <Field label="Full name">
                  <input name="name" required placeholder="Alex Morgan" />
                </Field>
              )}
              {authMode !== "reset" && (
                <Field label="Email address">
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={
                      authMode === "login" ? "admin@brightloop.local" : ""
                    }
                  />
                </Field>
              )}
              {authMode === "reset" && (
                <Field label="Reset token">
                  <input
                    name="token"
                    required
                    placeholder="Paste the token from outbox.log"
                  />
                </Field>
              )}
              {authMode !== "forgot" && (
                <Field
                  label="Password"
                  hint={
                    authMode === "signup" || authMode === "reset"
                      ? "9+ characters, uppercase, lowercase, and a special character."
                      : undefined
                  }
                >
                  <input
                    type="password"
                    name="password"
                    minLength={9}
                    required
                    defaultValue={authMode === "login" ? "Brightloop@2026" : ""}
                  />
                </Field>
              )}
              {formError && <div className="form-error">{formError}</div>}
              <button className="button primary full" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : null}
                {authMode === "login"
                  ? "Sign in to Brightloop"
                  : authMode === "signup"
                    ? "Create account"
                    : authMode === "forgot"
                      ? "Send reset instructions"
                      : "Reset password"}
                <ArrowRight size={16} />
              </button>
            </form>
            <div className="auth-links">
              {authMode === "login" ? (
                <>
                  <button
                    onClick={() => {
                      setAuthMode("forgot");
                      setFormError("");
                    }}
                  >
                    Forgot password?
                  </button>
                  {API_URL && (
                    <button onClick={() => setAuthMode("signup")}>
                      Create account
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setFormError("");
                  }}
                >
                  Back to sign in
                </button>
              )}
              {authMode === "forgot" && (
                <button onClick={() => setAuthMode("reset")}>
                  I have a reset token
                </button>
              )}
            </div>
            <div className="demo-credentials">
              <ShieldCheck size={17} />
              <div>
                <strong>
                  {API_URL
                    ? "Self-hosted. Your data stays yours."
                    : "Explore the interactive demo"}
                </strong>
                <p>
                  admin / staff / customer @brightloop.local
                  <br />
                  Password: Brightloop@2026
                </p>
              </div>
            </div>
          </div>
        </div>
        {toast && (
          <div className={`toast ${toast.error ? "error" : ""}`}>
            <CircleCheck size={18} />
            {toast.message}
          </div>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <div
        className={`sidebar-scrim ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
        </div>
        <button
          className="workspace-switch"
          onClick={() => openModal("workspace")}
        >
          <span className="workspace-logo">
            <Leaf size={17} />
          </span>
          <span>
            <strong>{businessName}</strong>
            <small>{isCustomer ? "Customer portal" : "Your workspace"}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <nav>
          {navGroups.map((group) => {
            const items = group.items.filter((item) =>
              isCustomer
                ? [
                    "Overview",
                    "Subscriptions",
                    "Invoices",
                    "Payments",
                    "Settings",
                  ].includes(item.label)
                : isAdmin ||
                  !["Team & access", "Taxes & discounts"].includes(item.label),
            );
            return items.length ? (
              <div className="nav-group" key={group.label}>
                <span className="nav-group-label">{group.label}</span>
                {items.map((item) => (
                  <button
                    key={item.label}
                    className={`nav-item ${pageName === item.label ? "active" : ""}`}
                    onClick={() => navigate(item.label)}
                  >
                    <item.icon size={18} strokeWidth={1.7} />
                    <span>{item.label}</span>
                    {item.label === "Subscriptions" && (
                      <small className="nav-count">
                        {activeCount.toLocaleString()}
                      </small>
                    )}
                    {item.label === "Invoices" && overdue.length > 0 && (
                      <small className="nav-count alert-count">
                        {overdue.length}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            ) : null;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Sparkles size={17} />
            </span>
            <strong>A little less busywork.</strong>
            <p>Let your billing take care of itself.</p>
            <button onClick={() => openModal("help")}>
              Meet your new workflow <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="help-link" onClick={() => openModal("help")}>
            <CircleHelp size={18} />
            Help & getting started
            <ArrowUpRight size={14} />
          </button>
          <div className="local-status">
            <span className="status-dot" />
            {API_URL
              ? "Self-hosted · Connected locally"
              : "Local demo · Saved on this device"}
            <LockKeyhole size={11} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{isCustomer ? "Customer portal" : pageName}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="global-search"
              onClick={() => openModal("search")}
            >
              <Search size={16} />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="topbar-divider" />
            <button
              className="icon-button help-top"
              aria-label="Help and documentation"
              onClick={() => openModal("help")}
            >
              <CircleHelp size={19} />
            </button>
            <div className="popup-anchor">
              <button
                className="icon-button notification-button"
                aria-label="View notifications"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileOpen(false);
                }}
              >
                <Bell size={19} />
                {!notificationRead && <i />}
              </button>
              {notificationsOpen && (
                <div className="dropdown notification-dropdown">
                  <div className="dropdown-heading">
                    <strong>Your notifications</strong>
                    <button
                      className="text-button"
                      onClick={() => {
                        setNotificationRead(true);
                        notify("All notifications marked as read.");
                      }}
                    >
                      <CheckCheck size={16} />
                    </button>
                  </div>
                  <button
                    className="notification-item"
                    onClick={() => {
                      navigate("Invoices", "Overdue");
                      setNotificationsOpen(false);
                    }}
                  >
                    <span className="notification-icon amber">
                      <FileClock size={18} />
                    </span>
                    <span>
                      <strong>
                        {overdue.length} invoices need a little attention
                      </strong>
                      <small>{money(overdueAmount)} in overdue balances</small>
                      <em>Finance · Today</em>
                    </span>
                  </button>
                  <button
                    className="notification-item"
                    onClick={() => {
                      navigate("Subscriptions", "Active");
                      setNotificationsOpen(false);
                    }}
                  >
                    <span className="notification-icon green">
                      <RefreshCw size={18} />
                    </span>
                    <span>
                      <strong>Your next renewals are coming up</strong>
                      <small>Check upcoming subscription terms.</small>
                      <em>Subscriptions · Today</em>
                    </span>
                  </button>
                  <div className="dropdown-footer">
                    {notificationRead
                      ? "You’re all caught up."
                      : "A helpful heads-up, without the noise."}
                  </div>
                </div>
              )}
            </div>
            <div className="popup-anchor">
              <button
                className="profile-avatar"
                aria-label="Open account menu"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
              >
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </button>
              {profileOpen && (
                <div className="dropdown profile-dropdown">
                  <div className="profile-info">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <Badge
                      status={
                        user.role === "ADMIN"
                          ? "Admin"
                          : user.role === "STAFF"
                            ? "Staff"
                            : "Customer"
                      }
                    />
                  </div>
                  {!API_URL && (
                    <>
                      <span className="dropdown-label">PREVIEW AS</span>
                      {(["ADMIN", "STAFF", "CUSTOMER"] as Role[]).map(
                        (role) => (
                          <button
                            className="dropdown-option"
                            key={role}
                            onClick={() => {
                              setUser(data.users.find((u) => u.role === role)!);
                              setProfileOpen(false);
                              navigate("Overview");
                              notify(
                                `Switched to ${role.toLowerCase()} demo. Server-enforced access is available in local API mode.`,
                              );
                            }}
                          >
                            <Users size={15} />
                            {role === "ADMIN"
                              ? "Administrator"
                              : role === "STAFF"
                                ? "Staff member"
                                : "Customer portal"}
                            {user.role === role && <Check size={14} />}
                          </button>
                        ),
                      )}
                    </>
                  )}
                  <button
                    className="dropdown-option logout"
                    onClick={() => {
                      if (API_URL)
                        void request("/auth/logout", { method: "POST" });
                      localStorage.removeItem("brightloop-token");
                      localStorage.removeItem("brightloop-refresh");
                      setUser(null);
                      setProfileOpen(false);
                    }}
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="title-line">
                <h1>
                  {pageName === "Overview"
                    ? isCustomer
                      ? "Your subscriptions, simplified."
                      : "Business, at a glance."
                    : pageName}
                </h1>
                {pageName === "Overview" && (
                  <span className="live-badge">
                    <i />
                    Live overview
                  </span>
                )}
              </div>
              <p>
                {isCustomer && pageName === "Overview"
                  ? "Your plans, invoices, and payments. All in one place."
                  : descriptions[pageName]}
              </p>
            </div>
            <div className="heading-actions">
              {pageName === "Overview" || pageName === "Reports" ? (
                <>
                  <div className="popup-anchor">
                    <button
                      className="button date-button"
                      onClick={() => setDateOpen(!dateOpen)}
                    >
                      <CalendarDays size={15} />
                      <span>
                        {dateLabel(from, true)} – {dateLabel(to, true)}, 2026
                      </span>
                      <ChevronDown size={13} />
                    </button>
                    {dateOpen && (
                      <div className="dropdown date-dropdown">
                        <strong>Reporting period</strong>
                        {[
                          "This month",
                          "Last month",
                          "This quarter",
                          "This year",
                        ].map((label) => (
                          <button
                            className={`dropdown-option ${dateRange === label ? "selected" : ""}`}
                            key={label}
                            onClick={() => {
                              setDateRange(label);
                              setFrom(
                                label === "This month"
                                  ? "2026-10-01"
                                  : label === "Last month"
                                    ? "2026-09-01"
                                    : label === "This quarter"
                                      ? "2026-10-01"
                                      : "2026-01-01",
                              );
                              setTo(
                                label === "Last month"
                                  ? "2026-09-30"
                                  : currentDate,
                              );
                              setDateOpen(false);
                            }}
                          >
                            {label}
                            {dateRange === label && <Check size={14} />}
                          </button>
                        ))}
                        <div className="custom-dates">
                          <Field label="From">
                            <input
                              type="date"
                              value={from}
                              max={to}
                              onChange={(e) => {
                                setFrom(e.target.value);
                                setDateRange("Custom range");
                              }}
                            />
                          </Field>
                          <Field label="To">
                            <input
                              type="date"
                              value={to}
                              min={from}
                              onChange={(e) => {
                                setTo(e.target.value);
                                setDateRange("Custom range");
                              }}
                            />
                          </Field>
                          <button
                            className="button primary full"
                            onClick={() => setDateOpen(false)}
                          >
                            Apply dates
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button className="button export-button" onClick={exportPage}>
                    <Download size={15} />
                    Export report
                  </button>
                </>
              ) : pageName === "Invoices" && !isCustomer ? (
                <button
                  className="button primary"
                  onClick={() => void runBilling()}
                  disabled={busy}
                >
                  <Zap size={16} />
                  {busy ? "Running billing…" : "Run billing"}
                </button>
              ) : pageName === "Team & access" && isAdmin ? (
                <button
                  className="button primary"
                  onClick={() => openModal("staff")}
                >
                  <Plus size={16} />
                  Add team member
                </button>
              ) : null}
            </div>
          </div>
          {pageName === "Overview" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="overview-actions">
                <div className="greeting">
                  <span className="greeting-sun">☀</span>Good things are
                  growing, {user.name.split(" ")[0]}.
                  <span>Here’s where you stand.</span>
                </div>
                {!isCustomer && (
                  <button
                    className="button primary"
                    onClick={() => openModal("subscription")}
                  >
                    <Plus size={16} />
                    New subscription
                  </button>
                )}
              </div>
              {statCards}
              <div className="charts-grid">
                <RevenueChart
                  revenue={revenue}
                  range={dateRange}
                  from={from}
                  to={to}
                />
                <RevenueBreakdown revenue={revenue} from={from} to={to} />
              </div>
              <div className="bottom-grid">
                <section className="card recent-card">
                  <div className="card-heading">
                    <div>
                      <h2>
                        Recent subscriptions{" "}
                        <span className="count-pill">
                          {subscriptions.length.toLocaleString()}
                        </span>
                      </h2>
                      <p>A new beginning, or the next chapter.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("Subscriptions")}
                    >
                      View all <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {renderSubscriptions(subscriptions.slice(0, 5), true)}
                  <div className="table-card-footer">
                    <span>
                      <span className="status-dot" />
                      Everything’s up to date
                    </span>
                    <button
                      className="text-button"
                      onClick={() => navigate("Subscriptions")}
                    >
                      Manage subscriptions <ArrowRight size={13} />
                    </button>
                  </div>
                </section>
                <section className="card renewals-card">
                  <div className="card-heading">
                    <div>
                      <h2>
                        Upcoming renewals{" "}
                        <span className="count-pill">{renewals.length}</span>
                      </h2>
                      <p>Keep the good things going.</p>
                    </div>
                    <CalendarDays size={17} className="muted-icon" />
                  </div>
                  <div className="renewals-list">
                    {renewals.map((s, i) => (
                      <button
                        key={s.id}
                        className="renewal-item"
                        onClick={() =>
                          setDetail({ type: "subscription", id: s.id })
                        }
                      >
                        <CustomerAvatar
                          name={getCustomer(s.customer_id).company || "C"}
                          index={i}
                          small
                        />
                        <span>
                          <strong>
                            {getCustomer(s.customer_id).company ||
                              getCustomer(s.customer_id).name}
                          </strong>
                          <small>
                            {getPlan(s.plan_id)?.name} ·{" "}
                            {getPlan(s.plan_id)?.billing_frequency}
                          </small>
                        </span>
                        <div>
                          <strong>
                            {money(
                              s.lines.reduce(
                                (n, l) => n + l.unit_price * l.quantity,
                                0,
                              ),
                            )}
                          </strong>
                          <small>{dateLabel(s.expiry_date, true)}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="renewals-note">
                    <span>
                      <RefreshCw size={15} />
                    </span>
                    <p>
                      Ahead of the curve.
                      <br />
                      <strong>Renewal reminders are on.</strong>
                    </p>
                    <ShieldCheck size={18} />
                  </div>
                  <button
                    className="renewals-link"
                    onClick={() => navigate("Subscriptions", "Active")}
                  >
                    View all upcoming renewals <ArrowRight size={14} />
                  </button>
                </section>
              </div>
              <div className="workspace-footer">
                <Logo small />
                <span>A little clarity goes a long way.</span>
                <span className="footer-right">
                  {API_URL ? "All data stored locally" : "Demo workspace"}
                  <i />
                  Last updated just now
                </span>
              </div>
            </motion.div>
          )}
          {API_URL &&
            [
              "Subscriptions",
              "Invoices",
              "Payments",
              "Customers",
              "Quotations",
              "Audit log",
            ].includes(pageName) && (
              <ServerRecords
                key={pageName}
                name={pageName}
                user={user}
                data={data}
                revision={serverSummary}
                initialFilter={filter}
                onCreate={openModal}
                notify={notify}
                onOpen={(entity, row) => {
                  setData((d) => {
                    const users = row.customer
                      ? [
                          ...d.users.filter((u) => u.id !== row.customer.id),
                          { ...row.customer, role: "CUSTOMER" as const },
                        ]
                      : d.users;
                    const plans = row.plan
                      ? [
                          ...d.plans.filter((p) => p.id !== row.plan.id),
                          row.plan as Plan,
                        ]
                      : d.plans;
                    return entity === "subscriptions"
                      ? {
                          ...d,
                          users,
                          plans,
                          subscriptions: [
                            ...d.subscriptions.filter((s) => s.id !== row.id),
                            row as Subscription,
                          ],
                        }
                      : {
                          ...d,
                          users,
                          invoices: [
                            ...d.invoices.filter((i) => i.id !== row.id),
                            row as Invoice,
                          ],
                        };
                  });
                  setDetail({
                    type:
                      entity === "subscriptions" ? "subscription" : "invoice",
                    id: row.id,
                  });
                }}
              />
            )}
          {!API_URL && pageName === "Subscriptions" && (
            <section className="card list-card">
              <div className="list-tabs">
                {[
                  "All",
                  "Active",
                  "Draft",
                  "Confirmed",
                  "Paused",
                  "Closed",
                ].map((s) => (
                  <button
                    key={s}
                    className={filter === s ? "active" : ""}
                    onClick={() => {
                      setFilter(s);
                      setPage(1);
                    }}
                  >
                    {s === "All" ? "All subscriptions" : s}
                    <span>
                      {s === "All"
                        ? subscriptions.length
                        : subscriptions.filter((x) => x.status === s).length}
                    </span>
                  </button>
                ))}
              </div>
              {toolbar(
                "Search subscriptions or customers...",
                isCustomer ? undefined : "subscription",
                "New subscription",
              )}
              {renderSubscriptions(
                filteredSubs.slice((page - 1) * 10, page * 10),
              )}
              <Pagination
                count={filteredSubs.length}
                page={page}
                setPage={setPage}
              />
            </section>
          )}
          {!API_URL && pageName === "Invoices" && (
            <>
              <div className="mini-stats">
                <div>
                  <span>Total invoiced</span>
                  <strong>
                    {money(invoices.reduce((n, i) => n + i.total, 0))}
                  </strong>
                </div>
                <div>
                  <span>Outstanding balance</span>
                  <strong>{money(outstanding)}</strong>
                </div>
                <div>
                  <span>Overdue balance</span>
                  <strong className="amber-text">{money(overdueAmount)}</strong>
                </div>
                <div>
                  <span>Paid invoices</span>
                  <strong>
                    {invoices.filter((i) => i.status === "Paid").length}
                  </strong>
                </div>
              </div>
              <section className="card list-card">
                <div className="list-tabs">
                  {[
                    "All",
                    "Draft",
                    "Confirmed",
                    "Paid",
                    "Outstanding",
                    "Overdue",
                    "Cancelled",
                  ].map((s) => (
                    <button
                      key={s}
                      className={filter === s ? "active" : ""}
                      onClick={() => {
                        setFilter(s);
                        setPage(1);
                      }}
                    >
                      {s === "All" ? "All invoices" : s}
                    </button>
                  ))}
                </div>
                {toolbar(
                  "Search invoices or customers...",
                  isCustomer ? undefined : "payment",
                  "Record payment",
                )}
                {renderInvoices(
                  filteredInvoices.slice((page - 1) * 10, page * 10),
                )}
                <Pagination
                  count={filteredInvoices.length}
                  page={page}
                  setPage={setPage}
                />
              </section>
            </>
          )}
          {!API_URL && pageName === "Payments" && (
            <section className="card list-card">
              {toolbar(
                "Search payments...",
                isCustomer ? undefined : "payment",
                "Record payment",
              )}
              <div className="list-tabs">
                {["All", "bank", "card", "UPI", "cash", "other"].map((s) => (
                  <button
                    key={s}
                    className={filter === s ? "active" : ""}
                    onClick={() => {
                      setFilter(s);
                      setPage(1);
                    }}
                  >
                    {s === "All"
                      ? "All methods"
                      : s === "UPI"
                        ? s
                        : s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Invoice</th>
                      <th>Method</th>
                      <th>Date</th>
                      <th>Note</th>
                      <th className="align-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments
                      .filter(
                        (p) =>
                          (filter === "All" || p.method === filter) &&
                          matches(
                            `${getCustomer(p.customer_id).company} ${p.note} ${p.method}`,
                          ),
                      )
                      .slice((page - 1) * 10, page * 10)
                      .map((p, i) => (
                        <tr
                          key={p.id}
                          onClick={() =>
                            setDetail({ type: "invoice", id: p.invoice_id })
                          }
                        >
                          <td>
                            <div className="customer-cell">
                              <CustomerAvatar
                                name={getCustomer(p.customer_id).company || "C"}
                                index={i}
                                small
                              />
                              <strong>
                                {getCustomer(p.customer_id).company ||
                                  getCustomer(p.customer_id).name}
                              </strong>
                            </div>
                          </td>
                          <td className="record-number">
                            {
                              data.invoices.find((x) => x.id === p.invoice_id)
                                ?.number
                            }
                          </td>
                          <td>
                            <span className="method-label">
                              <CreditCard size={14} />
                              {p.method === "UPI"
                                ? "UPI"
                                : p.method[0].toUpperCase() + p.method.slice(1)}
                            </span>
                          </td>
                          <td>{dateLabel(p.payment_date)}</td>
                          <td className="muted-cell">{p.note}</td>
                          <td className="align-right amount-cell green-text">
                            +{money(p.amount, 2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                count={
                  payments.filter(
                    (p) =>
                      (filter === "All" || p.method === filter) &&
                      matches(
                        `${getCustomer(p.customer_id).company} ${p.note} ${p.method}`,
                      ),
                  ).length
                }
                page={page}
                setPage={setPage}
              />
            </section>
          )}
          {!API_URL && pageName === "Customers" && (
            <section className="card list-card">
              {toolbar(
                "Find a customer...",
                !API_URL ? "customer" : undefined,
                "Add customer",
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Primary contact</th>
                      <th>Email address</th>
                      <th>Subscriptions</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {customers
                      .filter((c) =>
                        matches(`${c.name} ${c.company} ${c.email}`),
                      )
                      .slice((page - 1) * 10, page * 10)
                      .map((c, i) => (
                        <tr
                          key={c.id}
                          onClick={() => {
                            navigate("Subscriptions");
                            setSearch(c.company || c.name);
                          }}
                        >
                          <td>
                            <div className="customer-cell">
                              <CustomerAvatar
                                name={c.company || c.name}
                                index={i}
                              />
                              <strong>{c.company || c.name}</strong>
                            </div>
                          </td>
                          <td>{c.name}</td>
                          <td className="muted-cell">{c.email}</td>
                          <td>
                            {
                              data.subscriptions.filter(
                                (s) => s.customer_id === c.id,
                              ).length
                            }
                          </td>
                          <td>
                            <Badge status="Active" />
                          </td>
                          <td>
                            <ArrowUpRight size={15} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                count={
                  customers.filter((c) =>
                    matches(`${c.name} ${c.company} ${c.email}`),
                  ).length
                }
                page={page}
                setPage={setPage}
              />
            </section>
          )}
          {pageName === "Products & plans" && (
            <>
              <div className="catalog-toolbar">
                <div className="segmented-control">
                  {["Products", "Billing plans"].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t}
                      <span>
                        {t === "Products"
                          ? data.products.filter((p) => p.active).length
                          : data.plans.filter((p) => p.active).length}
                      </span>
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <button
                    className="button primary"
                    onClick={() =>
                      openModal(tab === "Products" ? "product" : "plan")
                    }
                  >
                    <Plus size={16} />
                    {tab === "Products" ? "Add product" : "Create plan"}
                  </button>
                )}
              </div>
              <div className="catalog-grid">
                {tab === "Products"
                  ? data.products
                      .filter((p) => p.active)
                      .map((p, i) => (
                        <section className="card product-card" key={p.id}>
                          <div className="product-card-top">
                            <span className={`product-icon ${colors[i % 6]}`}>
                              <Package size={24} />
                            </span>
                            <Badge status="Active" />
                          </div>
                          <span className="product-category">{p.type}</span>
                          <h2>{p.name}</h2>
                          <p>{p.notes}</p>
                          <div className="product-price">
                            {money(p.sales_price)}
                            <span>base price</span>
                          </div>
                          {p.variants?.length ? (
                            <span className="variant-note">
                              Brand: Odoo <strong>+{money(560)}</strong>
                            </span>
                          ) : (
                            <span className="variant-note">
                              Flexible billing plans available
                            </span>
                          )}
                          <div className="product-card-bottom">
                            <span>Cost {money(p.cost_price)}</span>
                            {isAdmin && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  void perform(async () => {
                                    if (API_URL)
                                      await request(`/products/${p.id}`, {
                                        method: "DELETE",
                                      });
                                    else
                                      setData((d) =>
                                        auditLocal(
                                          {
                                            ...d,
                                            products: d.products.map((x) =>
                                              x.id === p.id
                                                ? { ...x, active: false }
                                                : x,
                                            ),
                                          },
                                          "product",
                                          p.id,
                                          "archived",
                                        ),
                                      );
                                  }, "Product archived. Existing subscriptions are unchanged.")
                                }
                              >
                                Archive <ArrowRight size={13} />
                              </button>
                            )}
                          </div>
                        </section>
                      ))
                  : data.plans
                      .filter((p) => p.active)
                      .map((p, i) => (
                        <section
                          className={`card plan-card ${i === 2 ? "featured-plan" : ""}`}
                          key={p.id}
                        >
                          {i === 2 && (
                            <span className="popular-label">
                              A LITTLE MORE POSSIBILITY
                            </span>
                          )}
                          <span className="green-icon">
                            <Layers3 size={22} />
                          </span>
                          <h2>{p.name}</h2>
                          <p>
                            {
                              data.products.find((x) => x.id === p.product_id)
                                ?.name
                            }
                          </p>
                          <div className="plan-price">
                            {money(p.price)}
                            <span>
                              /
                              {p.billing_frequency === "yearly"
                                ? "year"
                                : "month"}
                            </span>
                          </div>
                          <div className="plan-features">
                            <span>
                              <Check size={15} />
                              Minimum {p.min_quantity} seat
                              {p.min_quantity > 1 ? "s" : ""}
                            </span>
                            <span>
                              <Check size={15} />
                              {p.flags.allow_renew
                                ? "Easy subscription renewal"
                                : "Fixed-term subscription"}
                            </span>
                            <span>
                              {p.flags.allow_pause ? (
                                <Check size={15} />
                              ) : (
                                <X size={15} />
                              )}
                              {p.flags.allow_pause
                                ? "Pause whenever you need"
                                : "Continuous annual access"}
                            </span>
                            <span>
                              {p.flags.allow_early_close ? (
                                <Check size={15} />
                              ) : (
                                <LockKeyhole size={15} />
                              )}
                              {p.flags.allow_early_close
                                ? "Flexible early cancellation"
                                : "Annual commitment"}
                            </span>
                          </div>
                          <button
                            className="button full"
                            onClick={() => openModal("subscription")}
                          >
                            Create subscription <ArrowRight size={14} />
                          </button>
                        </section>
                      ))}
              </div>
            </>
          )}
          {!API_URL && pageName === "Quotations" && (
            <section className="card list-card">
              {toolbar("Search quotations...", "quotation", "Create quotation")}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Quotation</th>
                      <th>Customer</th>
                      <th>Plan</th>
                      <th>Valid until</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.quotations
                      .filter((q) =>
                        matches(
                          `${q.number} ${getCustomer(q.customer_id).company}`,
                        ),
                      )
                      .map((q) => (
                        <tr key={q.id}>
                          <td className="record-number">{q.number}</td>
                          <td>
                            <strong>
                              {getCustomer(q.customer_id).company}
                            </strong>
                          </td>
                          <td>{getPlan(q.plan_id)?.name}</td>
                          <td>{dateLabel(q.valid_until)}</td>
                          <td>
                            <Badge status={q.status} />
                          </td>
                          <td>
                            {q.status === "Quotation" && (
                              <button
                                className="button small"
                                onClick={() =>
                                  void perform(async () => {
                                    if (q.valid_until < currentDate)
                                      throw new Error(
                                        "This quotation has expired.",
                                      );
                                    if (API_URL)
                                      await request(
                                        `/quotations/${q.id}/convert`,
                                        { method: "POST" },
                                      );
                                    else {
                                      const p = getPlan(q.plan_id)!;
                                      const s: Subscription = {
                                        id: uid(),
                                        number: `SUB-2026-${data.subscriptions.length + 1}`,
                                        customer_id: q.customer_id,
                                        plan_id: p.id,
                                        status: "Quotation",
                                        start_date: currentDate,
                                        expiry_date: nextPeriod(
                                          currentDate,
                                          p.billing_frequency,
                                        ),
                                        next_billing_date: currentDate,
                                        payment_terms: 14,
                                        lines: [
                                          {
                                            product_id: p.product_id,
                                            name: p.name,
                                            quantity: 1,
                                            unit_price: p.price,
                                          },
                                        ],
                                        created_at: new Date().toISOString(),
                                      };
                                      setData((d) =>
                                        auditLocal(
                                          {
                                            ...d,
                                            subscriptions: [
                                              s,
                                              ...d.subscriptions,
                                            ],
                                            quotations: d.quotations.map((x) =>
                                              x.id === q.id
                                                ? { ...x, status: "Converted" }
                                                : x,
                                            ),
                                          },
                                          "quotation",
                                          q.id,
                                          "converted",
                                        ),
                                      );
                                    }
                                  }, "Quotation converted into a subscription.")
                                }
                              >
                                <RefreshCw size={13} />
                                Convert
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="info-banner">
                <FileCheck2 size={19} />
                <div>
                  <strong>Start with a thoughtful template.</strong>
                  <span>
                    New quotations use your Professional onboarding template and
                    a 30-day validity window.
                  </span>
                </div>
              </div>
            </section>
          )}
          {pageName === "Taxes & discounts" && (
            <div className="rules-layout">
              {(["taxes", "discounts"] as const).map((key) => (
                <section className="card" key={key}>
                  <div className="card-heading">
                    <div>
                      <h2>
                        {key === "taxes" ? "Tax rules" : "Discount rules"}
                      </h2>
                      <p>
                        {key === "taxes"
                          ? "Applied automatically to your invoice lines."
                          : "A little incentive for the next chapter."}
                      </p>
                    </div>
                    <button
                      className="button small"
                      onClick={() =>
                        openModal(key === "taxes" ? "tax" : "discount")
                      }
                    >
                      <Plus size={14} />
                      Add rule
                    </button>
                  </div>
                  {data[key].map((r) => (
                    <div className="rule-item" key={r.id}>
                      <span className="rule-icon">
                        <Tag size={19} />
                      </span>
                      <div>
                        <strong>{r.name}</strong>
                        <span>
                          {r.type === "percent"
                            ? `${r.value}%`
                            : money(r.value)}{" "}
                          ·{" "}
                          {key === "taxes"
                            ? "All products"
                            : r.scope === "products"
                              ? "Product discount"
                              : "Subscription discount"}
                          {r.max_uses
                            ? ` · ${r.used_count || 0}/${r.max_uses} uses`
                            : ""}
                        </span>
                        {r.end_date && (
                          <small>Valid until {dateLabel(r.end_date)}</small>
                        )}
                      </div>
                      <button
                        className={`toggle ${r.active ? "on" : ""}`}
                        aria-label={`${r.active ? "Disable" : "Enable"} ${r.name}`}
                        onClick={() =>
                          void perform(async () => {
                            if (API_URL)
                              await request(`/${key}/${r.id}`, {
                                method: "PUT",
                                body: JSON.stringify({ active: !r.active }),
                              });
                            else
                              setData((d) =>
                                auditLocal(
                                  {
                                    ...d,
                                    [key]: d[key].map((x) =>
                                      x.id === r.id
                                        ? { ...x, active: !x.active }
                                        : x,
                                    ),
                                  },
                                  key,
                                  r.id,
                                  r.active ? "disabled" : "enabled",
                                ),
                              );
                          }, "Rule updated.")
                        }
                      >
                        <span />
                      </button>
                    </div>
                  ))}
                  <div className="rule-footer">
                    <ShieldCheck size={15} />
                    {key === "taxes"
                      ? "Tax → product discount → subscription discount"
                      : "Expired and exhausted discounts are automatically skipped."}
                  </div>
                </section>
              ))}
            </div>
          )}
          {pageName === "Reports" && (
            <>
              {statCards}
              <div className="charts-grid">
                <RevenueChart
                  revenue={revenue}
                  range={dateRange}
                  from={from}
                  to={to}
                />
                <RevenueBreakdown revenue={revenue} from={from} to={to} />
              </div>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Accounts receivable aging</h2>
                    <p>A clear picture of what’s due, and when.</p>
                  </div>
                  <button className="button small" onClick={exportPage}>
                    <Download size={14} />
                    Export summary
                  </button>
                </div>
                <div className="aging-grid">
                  {["0–30 days", "31–60 days", "61–90 days", "90+ days"].map(
                    (label, i) => {
                      const rows = overdue.filter((v) => {
                        const days = Math.floor(
                          (Date.parse(currentDate) - Date.parse(v.due_date)) /
                            86400000,
                        );
                        return i === 0
                          ? days <= 30
                          : i === 1
                            ? days > 30 && days <= 60
                            : i === 2
                              ? days > 60 && days <= 90
                              : days > 90;
                      });
                      return (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>
                            {money(
                              serverAging[i]?.amount ?? rows.reduce(
                                (n, v) => n + v.total - v.paid_amount,
                                0,
                              ),
                            )}
                          </strong>
                          <small>{serverAging[i]?.count ?? rows.length} invoices</small>
                          <i
                            style={{
                              width: `${Math.max(3, (rows.length / Math.max(overdue.length, 1)) * 100)}%`,
                              background: [
                                "#7cbba4",
                                "#e2bc69",
                                "#e3a076",
                                "#c57268",
                              ][i],
                            }}
                          />
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            </>
          )}
          {pageName === "Team & access" && (
            <>
              <div className="info-banner team-banner">
                <ShieldCheck size={23} />
                <div>
                  <strong>A secure workspace starts with clear roles.</strong>
                  <span>
                    Only administrators can invite staff. Customers can only
                    access their own subscriptions and invoices.
                  </span>
                </div>
              </div>
              <div className="team-grid">
                {data.users
                  .filter((u) => u.role !== "CUSTOMER")
                  .map((u, i) => (
                    <section className="card team-card" key={u.id}>
                      <span className={`team-avatar ${colors[i]}`}>
                        {u.name
                          .split(" ")
                          .map((x) => x[0])
                          .join("")}
                      </span>
                      <h2>{u.name}</h2>
                      <p>{u.email}</p>
                      <Badge status={u.role === "ADMIN" ? "Admin" : "Staff"} />
                      <div className="team-permissions">
                        <Check size={14} />
                        {u.role === "ADMIN"
                          ? "Full workspace access"
                          : "Day-to-day operations"}
                      </div>
                    </section>
                  ))}
                <button
                  className="add-team-card"
                  onClick={() => openModal("staff")}
                >
                  <Plus size={26} />
                  <strong>Good work takes a good team.</strong>
                  <span>Add a staff member</span>
                </button>
              </div>
            </>
          )}
          {!API_URL && pageName === "Audit log" && (
            <section className="card list-card">
              {toolbar("Search activity...")}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Entity</th>
                      <th>Performed by</th>
                      <th>Date & time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit
                      .filter((a) =>
                        matches(`${a.action} ${a.entity_type} ${a.actor}`),
                      )
                      .slice((page - 1) * 10, page * 10)
                      .map((a) => (
                        <tr key={a.id}>
                          <td>
                            <div className="audit-action">
                              <span>
                                <History size={16} />
                              </span>
                              {a.action.replaceAll("_", " ")}
                            </div>
                          </td>
                          <td>
                            <span className="entity-label">
                              {a.entity_type.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            {data.users.find((u) => u.id === a.actor)?.name ||
                              (a.actor.length > 25 ? "Team member" : a.actor)}
                          </td>
                          <td className="date-cell">
                            {new Date(a.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </td>
                          <td>
                            <Badge status="Completed" />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                count={
                  data.audit.filter((a) =>
                    matches(`${a.action} ${a.entity_type} ${a.actor}`),
                  ).length
                }
                page={page}
                setPage={setPage}
              />
            </section>
          )}
          {pageName === "Settings" && (
            <div className="settings-layout">
              <section className="card settings-card">
                <div className="card-heading">
                  <div>
                    <h2>Workspace profile</h2>
                    <p>The small details that make this space yours.</p>
                  </div>
                  <Leaf size={20} className="green-text" />
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const name = String(f.get("business_name"));
                    setBusinessName(name);
                    localStorage.setItem("brightloop-business", name);
                    notify(
                      "Workspace display preferences saved on this device.",
                    );
                  }}
                >
                  <Field label="Workspace display name">
                    <input
                      name="business_name"
                      defaultValue={businessName}
                      required
                      minLength={2}
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Currency">
                      <input value="USD — US Dollar" readOnly />
                    </Field>
                    <Field label="Billing timezone">
                      <input value="UTC" readOnly />
                    </Field>
                  </div>
                  <Field label="Your email">
                    <input value={user.email} readOnly />
                  </Field>
                  <div className="settings-form-footer">
                    <span>Display preferences are stored on this device.</span>
                    <button className="button primary">Save changes</button>
                  </div>
                </form>
              </section>
              <section className="card settings-card">
                <div className="card-heading">
                  <div>
                    <h2>Your data stays yours.</h2>
                    <p>Local-first, by design.</p>
                  </div>
                  <ShieldCheck size={22} className="green-text" />
                </div>
                <div className="system-details">
                  <div>
                    <span>Storage mode</span>
                    <strong>
                      {API_URL
                        ? "Local API + database"
                        : "Browser demo storage"}
                    </strong>
                  </div>
                  <div>
                    <span>Billing scheduler</span>
                    <strong>
                      {API_URL ? "Daily at 00:05 UTC" : "Manual in preview"}
                    </strong>
                  </div>
                  <div>
                    <span>Email delivery</span>
                    <strong>
                      {API_URL
                        ? "Console + outbox.log"
                        : "Simulated in audit log"}
                    </strong>
                  </div>
                  <div>
                    <span>External services</span>
                    <strong>None required</strong>
                  </div>
                </div>
                <a
                  className="button full"
                  href="/downloads/brightloop-source.zip"
                  download
                >
                  <Download size={15} />
                  Download the local project
                </a>
                {!API_URL && (
                  <button
                    className="reset-demo"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Reset all demo data? Changes on this device will be removed.",
                        )
                      ) {
                        setData(seedData());
                        notify("Your demo workspace has been reset.");
                      }
                    }}
                  >
                    Reset demo workspace
                  </button>
                )}
              </section>
            </div>
          )}
          {["Products & plans", "Quotations", "Taxes & discounts"].includes(
            pageName,
          ) && (
            <CatalogManager
              key={pageName}
              page={pageName}
              data={data}
              isAdmin={isAdmin}
              notify={notify}
              onUpdate={async (kind, value, remove) => {
                if (API_URL) {
                  await refresh();
                  return;
                }
                setData((d) => {
                  if (kind === "variants")
                    return auditLocal(
                      {
                        ...d,
                        products: d.products.map((p) =>
                          p.id === value.product_id
                            ? {
                                ...p,
                                variants: [
                                  ...(p.variants || []).filter(
                                    (v) => v.id !== value.id,
                                  ),
                                  ...(remove
                                    ? []
                                    : [
                                        value as NonNullable<
                                          typeof p.variants
                                        >[number],
                                      ]),
                                ],
                              }
                            : p,
                        ),
                      },
                      "variant",
                      value.id,
                      remove ? "archived" : "saved",
                    );
                  const key = kind as keyof Data;
                  return auditLocal(
                    {
                      ...d,
                      [key]: [
                        ...d[key].filter((r) => r.id !== value.id),
                        value,
                      ],
                    } as Data,
                    kind,
                    value.id,
                    remove ? "archived" : "saved",
                  );
                });
              }}
            />
          )}
        </main>
      </div>
      <AnimatePresence>
        {modal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}
          >
            <motion.section
              className={`modal ${modal === "search" ? "search-modal" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label={modal.replaceAll("-", " ")}
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <button
                className="icon-button modal-close"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={19} />
              </button>
              {modal === "search" ? (
                <>
                  <div className="command-search">
                    <Search size={21} />
                    <input
                      autoFocus
                      placeholder="Find a customer, subscription, or page..."
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                    />
                    <kbd>ESC</kbd>
                  </div>
                  <div className="search-results">
                    <span className="dropdown-label">PAGES</span>
                    {navGroups
                      .flatMap((g) => g.items)
                      .filter(
                        (n) =>
                          n.label
                            .toLowerCase()
                            .includes(globalSearch.toLowerCase()) &&
                          (!isCustomer ||
                            [
                              "Overview",
                              "Subscriptions",
                              "Invoices",
                              "Payments",
                              "Settings",
                            ].includes(n.label)),
                      )
                      .slice(0, 5)
                      .map((n) => (
                        <button
                          key={n.label}
                          onClick={() => {
                            navigate(n.label);
                            setModal(null);
                          }}
                        >
                          <n.icon size={17} />
                          <span>{n.label}</span>
                          <ArrowRight size={15} />
                        </button>
                      ))}
                    {globalSearch && (
                      <>
                        <span className="dropdown-label">SUBSCRIPTIONS</span>
                        {subscriptions
                          .filter((s) =>
                            `${s.number} ${getCustomer(s.customer_id).company}`
                              .toLowerCase()
                              .includes(globalSearch.toLowerCase()),
                          )
                          .slice(0, 5)
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setModal(null);
                                setDetail({ type: "subscription", id: s.id });
                              }}
                            >
                              <Layers3 size={17} />
                              <span>
                                {getCustomer(s.customer_id).company}
                                <small>{s.number}</small>
                              </span>
                              <Badge status={s.status} />
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                  <div className="command-footer">
                    <span>Find a little clarity.</span>
                    <span>
                      <kbd>↵</kbd> to open
                    </span>
                  </div>
                </>
              ) : modal === "help" || modal === "workspace" ? (
                <>
                  <span className="modal-emblem">
                    <Leaf size={26} />
                  </span>
                  <span className="eyebrow">
                    WELCOME TO A BRIGHTER WORKFLOW
                  </span>
                  <h2>
                    A little less busywork.
                    <br />A lot more possibility.
                  </h2>
                  <p className="modal-description">
                    One connected home for your entire subscription business.
                    Here’s how the good things come together.
                  </p>
                  <div className="workflow-steps">
                    {[
                      {
                        icon: Package,
                        title: "Build your offering",
                        text: "Set up products, variants, and flexible billing plans.",
                        page: "Products & plans",
                      },
                      {
                        icon: Layers3,
                        title: "Start a lasting relationship",
                        text: "Create a quotation, then turn it into a subscription.",
                        page: "Subscriptions",
                      },
                      {
                        icon: Zap,
                        title: "Let billing do its thing",
                        text: "Run billing, confirm invoices, and record payments.",
                        page: "Invoices",
                      },
                      {
                        icon: TrendingUp,
                        title: "See the bigger picture",
                        text: "Stay on top of revenue, balances, and renewals.",
                        page: "Reports",
                      },
                    ]
                      .filter(
                        (s) =>
                          !isCustomer ||
                          ["Subscriptions", "Invoices"].includes(s.page),
                      )
                      .map((step, i) => (
                        <button
                          key={step.title}
                          onClick={() => {
                            navigate(step.page);
                            setModal(null);
                          }}
                        >
                          <span>
                            <step.icon size={19} />
                          </span>
                          <div>
                            <strong>
                              {i + 1}. {step.title}
                            </strong>
                            <p>{step.text}</p>
                          </div>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                  </div>
                  <div className="local-info">
                    <ShieldCheck size={18} />
                    <p>
                      {API_URL
                        ? "Your workspace is connected to your local API."
                        : "You’re exploring a browser-based demo. Real JWT security, recurring jobs, local PDFs, and email logs are included in the downloadable local API."}
                    </p>
                  </div>
                  <a
                    className="button primary full"
                    href="/downloads/brightloop-source.zip"
                    download
                  >
                    <Download size={16} />
                    Download complete local project
                  </a>
                </>
              ) : modal === "billing-result" ? (
                <>
                  <span className="modal-emblem">
                    <CheckCheck size={27} />
                  </span>
                  <h2>Billing, taken care of.</h2>
                  <p className="modal-description">
                    Every due subscription was checked. Existing billing periods
                    are never invoiced twice.
                  </p>
                  <div className="billing-result-grid">
                    <div>
                      <strong>{billingResult?.scanned || 0}</strong>
                      <span>Subscriptions scanned</span>
                    </div>
                    <div>
                      <strong>{billingResult?.created || 0}</strong>
                      <span>Invoices created</span>
                    </div>
                    <div>
                      <strong>
                        {Math.max(0, billingResult?.skipped || 0)}
                      </strong>
                      <span>Duplicates skipped</span>
                    </div>
                  </div>
                  <div className="info-banner">
                    <ShieldCheck size={20} />
                    <span>
                      This billing run has been saved to the audit log.
                    </span>
                  </div>
                  <button
                    className="button primary full"
                    onClick={() => {
                      setModal(null);
                      navigate("Invoices", "Draft");
                    }}
                  >
                    View draft invoices <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <>
                  <span className="modal-emblem">
                    {modal === "payment" ? (
                      <Wallet size={24} />
                    ) : modal === "subscription" ? (
                      <Layers3 size={24} />
                    ) : modal === "staff" ? (
                      <Users size={24} />
                    ) : (
                      <Plus size={24} />
                    )}
                  </span>
                  <h2>
                    {
                      {
                        subscription: "A new beginning.",
                        payment: "Record a payment",
                        product: "Meet your next product.",
                        plan: "A plan with possibility.",
                        tax: "Create a tax rule",
                        discount: "A little extra incentive.",
                        staff: "Grow your team.",
                        quotation: "Start the conversation.",
                        customer: "A new connection.",
                      }[modal]
                    }
                  </h2>
                  <p className="modal-description">
                    {
                      {
                        subscription:
                          "Bring a customer and a plan together. We’ll handle the details.",
                        payment:
                          "Keep your books clear and your invoice balances up to date.",
                        product: "Add something great to your product catalog.",
                        plan: "Make it easy for customers to find their perfect fit.",
                        tax: "Automatically apply the right tax to every invoice.",
                        discount:
                          "Apply a discount automatically to eligible invoices.",
                        staff:
                          "Give a teammate secure access to day-to-day operations.",
                        quotation:
                          "Create a clear offer from your onboarding template.",
                        customer: "Add a customer to your demo workspace.",
                      }[modal]
                    }
                  </p>
                  <form onSubmit={handleForm}>
                    {(modal === "subscription" || modal === "quotation") && (
                      <>
                        <Field label="Customer">
                          <select name="customer_id" required defaultValue="">
                            <option value="" disabled>
                              Select a customer
                            </option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.company || c.name} · {c.email}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Billing plan">
                          <select
                            name="plan_id"
                            required
                            value={selectedPlanId}
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                          >
                            {data.plans
                              .filter((p) => p.active)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} — {money(p.price)}/
                                  {p.billing_frequency}
                                </option>
                              ))}
                          </select>
                        </Field>
                        {modal === "quotation" && API_URL && (
                          <Field label="Quotation template">
                            <select name="template_id" required>
                              {quoteTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} · {t.validity_days} days
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                        {modal === "subscription" &&
                          (() => {
                            const product = data.products.find(
                              (p) =>
                                p.id ===
                                data.plans.find(
                                  (plan) => plan.id === selectedPlanId,
                                )?.product_id,
                            );
                            return [
                              ...new Set(
                                product?.variants?.map((v) => v.group_name) ||
                                  [],
                              ),
                            ].map((group) => (
                              <Field key={group} label={`${group} variant`}>
                                <select name={`variant-${group}`}>
                                  <option value="">
                                    Standard — no price adjustment
                                  </option>
                                  {product?.variants
                                    ?.filter((v) => v.group_name === group)
                                    .map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.option_name} (+{money(v.price_delta)}
                                        )
                                      </option>
                                    ))}
                                </select>
                              </Field>
                            ));
                          })()}
                        {modal === "subscription" ? (
                          <>
                            <div className="form-grid">
                              <Field label="Start date">
                                <input
                                  type="date"
                                  name="start_date"
                                  defaultValue={currentDate}
                                  required
                                />
                              </Field>
                              <Field label="Quantity">
                                <input
                                  type="number"
                                  name="quantity"
                                  min="1"
                                  defaultValue="1"
                                  required
                                />
                              </Field>
                            </div>
                            <Field label="Payment terms">
                              <select name="payment_terms">
                                <option value="14">
                                  Net 14 — due in 14 days
                                </option>
                                <option value="30">
                                  Net 30 — due in 30 days
                                </option>
                                <option value="0">Due on receipt</option>
                              </select>
                            </Field>
                            <div className="form-note">
                              <CircleHelp size={15} />
                              Starts as a draft. Confirm and activate when
                              you’re ready.
                            </div>
                          </>
                        ) : (
                          <Field label="Quotation valid for">
                            <select name="validity_days">
                              <option value="30">30 days</option>
                              <option value="14">14 days</option>
                              <option value="7">7 days</option>
                            </select>
                          </Field>
                        )}
                      </>
                    )}
                    {modal === "payment" && (
                      <>
                        <Field label="Invoice">
                          <select
                            name="invoice_id"
                            required
                            defaultValue={
                              selectedInvoice?.status === "Confirmed"
                                ? selectedInvoice.id
                                : ""
                            }
                          >
                            <option value="" disabled>
                              Select an outstanding invoice
                            </option>
                            {invoices
                              .filter((i) => i.status === "Confirmed")
                              .map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.number} ·{" "}
                                  {getCustomer(i.customer_id).company} ·{" "}
                                  {money(i.total - i.paid_amount, 2)} due
                                </option>
                              ))}
                          </select>
                        </Field>
                        <div className="form-grid">
                          <Field label="Amount (USD)">
                            <input
                              type="number"
                              name="amount"
                              step="0.01"
                              min="0.01"
                              placeholder="0.00"
                              required
                              defaultValue={
                                selectedInvoice
                                  ? (
                                      selectedInvoice.total -
                                      selectedInvoice.paid_amount
                                    ).toFixed(2)
                                  : ""
                              }
                            />
                          </Field>
                          <Field label="Payment date">
                            <input
                              type="date"
                              name="payment_date"
                              defaultValue={currentDate}
                              max={currentDate}
                              required
                            />
                          </Field>
                        </div>
                        <Field label="Payment method">
                          <select name="method">
                            <option value="bank">Bank transfer</option>
                            <option value="card">Card</option>
                            <option value="cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="other">Other</option>
                          </select>
                        </Field>
                        <Field label="Note (optional)">
                          <textarea
                            name="note"
                            placeholder="Payment reference or a helpful detail..."
                            rows={2}
                          />
                        </Field>
                        <div className="form-note">
                          <ShieldCheck size={15} />
                          This records a payment. It does not charge a card or
                          bank.
                        </div>
                      </>
                    )}
                    {modal === "product" && (
                      <>
                        <Field label="Product name">
                          <input
                            name="name"
                            required
                            placeholder="e.g. Brightloop Workspace"
                            minLength={2}
                          />
                        </Field>
                        <Field label="Product type">
                          <select name="type">
                            <option>Software</option>
                            <option>Add-on</option>
                            <option>Service</option>
                          </select>
                        </Field>
                        <div className="form-grid">
                          <Field label="Sales price (USD)">
                            <input
                              name="sales_price"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              placeholder="99.00"
                            />
                          </Field>
                          <Field label="Cost price (USD)">
                            <input
                              name="cost_price"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              placeholder="20.00"
                            />
                          </Field>
                        </div>
                        <Field label="A little about this product">
                          <textarea
                            name="notes"
                            rows={3}
                            placeholder="What makes it great?"
                          />
                        </Field>
                      </>
                    )}
                    {modal === "plan" && (
                      <>
                        <Field label="Plan name">
                          <input
                            name="name"
                            required
                            placeholder="e.g. Professional"
                          />
                        </Field>
                        <Field label="Product">
                          <select name="product_id" required>
                            {data.products
                              .filter((p) => p.active)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <div className="form-grid">
                          <Field label="Price (USD)">
                            <input
                              name="price"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                            />
                          </Field>
                          <Field label="Billing frequency">
                            <select name="billing_frequency">
                              {["monthly", "yearly", "weekly", "daily"].map(
                                (s) => (
                                  <option key={s}>{s}</option>
                                ),
                              )}
                            </select>
                          </Field>
                        </div>
                        <Field label="Minimum quantity">
                          <input
                            name="min_quantity"
                            type="number"
                            min="1"
                            defaultValue="1"
                            required
                          />
                        </Field>
                        <div className="checkbox-fields">
                          <label>
                            <input
                              type="checkbox"
                              name="allow_pause"
                              defaultChecked
                            />
                            Allow pause & resume
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="allow_renew"
                              defaultChecked
                            />
                            Allow renewal
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="allow_early_close"
                              defaultChecked
                            />
                            Allow early closure
                          </label>
                        </div>
                      </>
                    )}
                    {(modal === "tax" || modal === "discount") && (
                      <>
                        <Field label="Rule name">
                          <input
                            name="name"
                            required
                            placeholder={
                              modal === "tax"
                                ? "e.g. Standard sales tax"
                                : "e.g. Welcome aboard"
                            }
                          />
                        </Field>
                        <div className="form-grid">
                          <Field label="Type">
                            <select name="type">
                              <option value="percent">Percentage (%)</option>
                              <option value="fixed">Fixed amount ($)</option>
                            </select>
                          </Field>
                          <Field label="Value">
                            <input
                              type="number"
                              name="value"
                              min="0"
                              step="0.01"
                              required
                            />
                          </Field>
                        </div>
                        {modal === "discount" && (
                          <>
                            <Field label="Apply discount to">
                              <select name="scope">
                                <option value="subscription">
                                  Entire subscription
                                </option>
                                <option value="products">Product lines</option>
                              </select>
                            </Field>
                            <div className="form-grid">
                              <Field label="Valid until (optional)">
                                <input
                                  name="end_date"
                                  type="date"
                                  min={currentDate}
                                />
                              </Field>
                              <Field label="Usage limit (optional)">
                                <input
                                  name="max_uses"
                                  type="number"
                                  min="1"
                                  placeholder="Unlimited"
                                />
                              </Field>
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {(modal === "staff" || modal === "customer") && (
                      <>
                        <Field label="Full name">
                          <input
                            name="name"
                            required
                            minLength={2}
                            placeholder="Jamie Parker"
                          />
                        </Field>
                        <Field label="Email address">
                          <input
                            type="email"
                            name="email"
                            required
                            placeholder="jamie@example.com"
                          />
                        </Field>
                        {modal === "staff" ? (
                          <Field
                            label="Temporary password"
                            hint="9+ characters, uppercase, lowercase, and a special character."
                          >
                            <input
                              type="password"
                              name="password"
                              required
                              minLength={9}
                            />
                          </Field>
                        ) : (
                          <Field label="Company">
                            <input
                              name="company"
                              required
                              placeholder="Acme Inc."
                            />
                          </Field>
                        )}
                        <div className="form-note">
                          <ShieldCheck size={16} />
                          {modal === "staff"
                            ? "Staff can manage operations, but cannot add team members."
                            : "Demo only. Real customers sign up securely through the local API."}
                        </div>
                      </>
                    )}
                    {formError && <div className="form-error">{formError}</div>}
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="button"
                        onClick={() => setModal(null)}
                      >
                        Cancel
                      </button>
                      <button className="button primary" disabled={busy}>
                        {busy ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <Check size={15} />
                        )}
                        {modal === "payment"
                          ? "Record payment"
                          : modal === "staff"
                            ? "Create staff account"
                            : `Create ${modal}`}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detail && (selectedSub || selectedInvoice) && (
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}
          >
            <motion.aside
              className="detail-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Record details"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="drawer-top">
                <span>
                  {selectedSub ? "Subscription details" : "Invoice details"}
                </span>
                <button
                  className="icon-button"
                  onClick={() => setDetail(null)}
                  aria-label="Close details"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="drawer-content">
                <span className="modal-emblem">
                  {selectedSub ? <Layers3 size={25} /> : <FileText size={25} />}
                </span>
                <h2>{selectedSub?.number || selectedInvoice?.number}</h2>
                <div className="drawer-subtitle">
                  <span>
                    {getCustomer((selectedSub || selectedInvoice)!.customer_id)
                      .company ||
                      getCustomer((selectedSub || selectedInvoice)!.customer_id)
                        .name}
                  </span>
                  <Badge status={(selectedSub || selectedInvoice)!.status} />
                </div>
                {selectedSub && (
                  <>
                    <div className="detail-amount">
                      {money(
                        selectedSub.lines.reduce(
                          (n, l) => n + l.unit_price * l.quantity,
                          0,
                        ),
                      )}
                      <span>
                        /
                        {getPlan(selectedSub.plan_id)?.billing_frequency ===
                        "yearly"
                          ? "year"
                          : "month"}
                      </span>
                    </div>
                    <div className="detail-fields">
                      <div>
                        <span>Plan</span>
                        <strong>{getPlan(selectedSub.plan_id)?.name}</strong>
                      </div>
                      <div>
                        <span>Start date</span>
                        <strong>{dateLabel(selectedSub.start_date)}</strong>
                      </div>
                      <div>
                        <span>Next billing date</span>
                        <strong>
                          {dateLabel(selectedSub.next_billing_date)}
                        </strong>
                      </div>
                      <div>
                        <span>Term expires</span>
                        <strong>{dateLabel(selectedSub.expiry_date)}</strong>
                      </div>
                      <div>
                        <span>Payment terms</span>
                        <strong>Net {selectedSub.payment_terms}</strong>
                      </div>
                    </div>
                    <h3>Included in this subscription</h3>
                    {selectedSub.lines.map((l, i) => (
                      <div className="detail-line" key={i}>
                        <Package size={18} />
                        <span>
                          <strong>{l.name}</strong>
                          <small>
                            {l.quantity} {l.quantity === 1 ? "seat" : "seats"} ×{" "}
                            {money(l.unit_price)}
                          </small>
                        </span>
                        <strong>{money(l.quantity * l.unit_price)}</strong>
                      </div>
                    ))}
                    <h3>Make the next move</h3>
                    <div className="detail-actions">
                      {!isCustomer &&
                        ["Draft", "Quotation"].includes(selectedSub.status) && (
                          <button
                            className="button primary"
                            disabled={busy}
                            onClick={() =>
                              void subscriptionAction(selectedSub, "confirm")
                            }
                          >
                            <Check size={16} />
                            Confirm subscription
                          </button>
                        )}
                      {!isCustomer && selectedSub.status === "Confirmed" && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            void subscriptionAction(selectedSub, "activate")
                          }
                        >
                          <Play size={16} />
                          Activate subscription
                        </button>
                      )}
                      {selectedSub.status === "Active" && (
                        <button
                          className="button"
                          disabled={
                            busy ||
                            !getPlan(selectedSub.plan_id)?.flags.allow_pause
                          }
                          onClick={() =>
                            void subscriptionAction(selectedSub, "pause")
                          }
                        >
                          <Pause size={15} />
                          Pause
                        </button>
                      )}
                      {selectedSub.status === "Paused" && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            void subscriptionAction(selectedSub, "resume")
                          }
                        >
                          <Play size={15} />
                          Resume
                        </button>
                      )}
                      {["Active", "Paused", "Closed"].includes(
                        selectedSub.status,
                      ) && (
                        <button
                          className="button"
                          disabled={
                            busy ||
                            !getPlan(selectedSub.plan_id)?.flags.allow_renew
                          }
                          onClick={() =>
                            void subscriptionAction(selectedSub, "renew")
                          }
                        >
                          <RefreshCw size={15} />
                          Renew for one period
                        </button>
                      )}
                      {["Active", "Paused"].includes(selectedSub.status) && (
                        <button
                          className="button danger"
                          disabled={
                            busy ||
                            !getPlan(selectedSub.plan_id)?.flags
                              .allow_early_close
                          }
                          onClick={() => {
                            if (
                              window.confirm(
                                "Close this subscription? You can renew later if the plan allows.",
                              )
                            )
                              void subscriptionAction(selectedSub, "close");
                          }}
                        >
                          Close subscription
                        </button>
                      )}
                    </div>
                    <div className="form-note">
                      <ShieldCheck size={16} />
                      Available actions follow this plan’s permissions.
                    </div>
                    <h3>Subscription history</h3>
                    <div className="history-timeline">
                      <div>
                        <i />
                        <strong>Subscription created</strong>
                        <span>{dateLabel(selectedSub.created_at)}</span>
                      </div>
                      {data.audit
                        .filter((a) => a.entity_id === selectedSub.id)
                        .slice(0, 8)
                        .map((a) => (
                          <div key={a.id}>
                            <i />
                            <strong>{a.action.replaceAll("_", " ")}</strong>
                            <span>
                              {a.actor} · {dateLabel(a.created_at)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
                {selectedInvoice && (
                  <>
                    <div className="detail-amount">
                      {money(selectedInvoice.total, 2)}
                      <span>total invoice</span>
                    </div>
                    <div className="detail-fields">
                      <div>
                        <span>Billing period</span>
                        <strong>
                          {dateLabel(selectedInvoice.period_start, true)} –{" "}
                          {dateLabel(selectedInvoice.period_end, true)}
                        </strong>
                      </div>
                      <div>
                        <span>Due date</span>
                        <strong>{dateLabel(selectedInvoice.due_date)}</strong>
                      </div>
                      <div>
                        <span>Subtotal</span>
                        <strong>{money(selectedInvoice.subtotal, 2)}</strong>
                      </div>
                      <div>
                        <span>Taxes</span>
                        <strong>{money(selectedInvoice.tax_total, 2)}</strong>
                      </div>
                      <div>
                        <span>Discounts</span>
                        <strong>
                          −{money(selectedInvoice.discount_total, 2)}
                        </strong>
                      </div>
                      <div>
                        <span>Payments received</span>
                        <strong className="green-text">
                          {money(selectedInvoice.paid_amount, 2)}
                        </strong>
                      </div>
                      <div className="balance-row">
                        <span>Outstanding balance</span>
                        <strong>
                          {money(
                            selectedInvoice.total - selectedInvoice.paid_amount,
                            2,
                          )}
                        </strong>
                      </div>
                    </div>
                    <div className="detail-actions">
                      <button
                        className="button"
                        onClick={() => void downloadInvoice(selectedInvoice)}
                      >
                        <Download size={16} />
                        Download PDF
                      </button>
                      {!isCustomer && selectedInvoice.status === "Draft" && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            void invoiceAction(selectedInvoice, "confirm")
                          }
                        >
                          <Check size={15} />
                          Confirm invoice
                        </button>
                      )}
                      {!isCustomer &&
                        selectedInvoice.status === "Confirmed" && (
                          <>
                            <button
                              className="button primary"
                              onClick={() => openModal("payment")}
                            >
                              <Plus size={15} />
                              Record payment
                            </button>
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() =>
                                void invoiceAction(selectedInvoice, "send")
                              }
                            >
                              <Mail size={15} />
                              Send invoice
                            </button>
                          </>
                        )}
                      {!isCustomer &&
                        ["Draft", "Confirmed"].includes(
                          selectedInvoice.status,
                        ) &&
                        selectedInvoice.paid_amount === 0 && (
                          <button
                            className="button danger"
                            disabled={busy}
                            onClick={() =>
                              void invoiceAction(selectedInvoice, "cancel")
                            }
                          >
                            Cancel invoice
                          </button>
                        )}
                    </div>
                    <h3>Payment history</h3>
                    {payments
                      .filter((p) => p.invoice_id === selectedInvoice.id)
                      .map((p) => (
                        <div className="detail-line" key={p.id}>
                          <CircleCheck size={18} className="green-text" />
                          <span>
                            <strong>{p.method} payment</strong>
                            <small>{dateLabel(p.payment_date)}</small>
                          </span>
                          <strong>{money(p.amount, 2)}</strong>
                        </div>
                      ))}
                    {!payments.some(
                      (p) => p.invoice_id === selectedInvoice.id,
                    ) && <p className="subtle">No payments recorded yet.</p>}
                  </>
                )}
              </div>
              <div className="drawer-footer">
                <LockKeyhole size={13} />
                Every change is recorded in your audit log.
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.error ? "error" : ""}`}
            role="status"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast.error ? <CircleHelp size={19} /> : <CircleCheck size={19} />}
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
