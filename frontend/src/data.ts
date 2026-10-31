export type Role = "ADMIN" | "STAFF" | "CUSTOMER";
export type User = {
  id: string;
  name: string;
  email: string;
  company?: string;
  role: Role;
};
export type Product = {
  id: string;
  name: string;
  type: string;
  sales_price: number;
  cost_price: number;
  notes: string;
  active: boolean;
  variants?: {
    id: string;
    group_name: string;
    option_name: string;
    price_delta: number;
  }[];
};
export type Plan = {
  id: string;
  name: string;
  product_id: string;
  price: number;
  billing_frequency: string;
  min_quantity: number;
  flags: {
    auto_close_on_end: boolean;
    allow_early_close: boolean;
    allow_pause: boolean;
    allow_renew: boolean;
  };
  active: boolean;
};
export type Subscription = {
  id: string;
  number: string;
  customer_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  expiry_date: string;
  next_billing_date: string;
  payment_terms: number;
  customer?: User;
  revision?: number;
  pending_lines?: Subscription["lines"];
  pending_effective_date?: string;
  pricing_preview?: {tax_total:number;total:number;lines: Subscription["lines"]};
  lines: {
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    variant_ids?: string[];
  }[];
  created_at: string;
};
export type Invoice = {
  id: string;
  number: string;
  customer_id: string;
  subscription_id: string;
  status: string;
  period_start: string;
  period_end: string;
  due_date: string;
  total: number;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  paid_amount: number;
  created_at: string;
  lines: Subscription["lines"];
};
export type Payment = {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  method: string;
  payment_date: string;
  note: string;
  created_at: string;
};
export type Rule = {
  id: string;
  name: string;
  type: string;
  value: number;
  active: boolean;
  scope?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_uses?: number;
  used_count?: number;
};
export type Quote = {
  id: string;
  number: string;
  customer_id: string;
  plan_id: string;
  status: string;
  valid_until: string;
  created_at: string;
};
export type Audit = {
  id: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  action: string;
  created_at: string;
  old_value?: unknown;
  new_value?: unknown;
};
export type Data = {
  users: User[];
  products: Product[];
  plans: Plan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  payments: Payment[];
  taxes: Rule[];
  discounts: Rule[];
  quotations: Quote[];
  audit: Audit[];
};
export const DEMO_TODAY = "2026-10-31";
export const uid = () => crypto.randomUUID();
export const money = (v: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
  }).format(v);
export const dateLabel = (value: string, short = false) =>
  new Date(value.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(short ? {} : { year: "numeric" }),
  });
export function nextPeriod(date: string, frequency: string) {
  const d = new Date(date + "T12:00:00Z");
  if (frequency === "daily") d.setDate(d.getDate() + 1);
  else if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}
export const colors = ["purple", "blue", "orange", "green", "pink", "slate"];
const companies = [
  "Acme Inc.",
  "Layers",
  "Sisyphus",
  "Capsule",
  "Quotient",
  "Orbit",
  "Northstar",
  "Polymath",
  "FocalPoint",
  "Cloudwatch",
  "Nietzsche",
  "Luminous",
];
export function seedData(): Data {
  const users: User[] = [
    {
      id: "admin",
      name: "Alex Morgan",
      email: "admin@brightloop.local",
      company: "Brightloop Software",
      role: "ADMIN",
    },
    {
      id: "staff",
      name: "Jamie Parker",
      email: "staff@brightloop.local",
      role: "STAFF",
    },
    ...Array.from({ length: 60 }, (_, i): User => ({
      id: `customer-${i}`,
      name: [
        "Olivia Rhye",
        "Phoenix Baker",
        "Lana Steiner",
        "Demi Wilkinson",
        "Drew Cano",
        "Natali Craig",
      ][i % 6],
      email:
        i === 0
          ? "customer@brightloop.local"
          : `hello@${companies[i % 12].replace(/[^a-z]/gi, "").toLowerCase()}${i >= 12 ? i : ""}.example`,
      company: `${companies[i % 12]}${i >= 12 ? ` ${Math.floor(i / 12) + 1}` : ""}`,
      role: "CUSTOMER",
    })),
  ];
  const products: Product[] = [
    {
      id: "prod-1",
      name: "Brightloop Workspace",
      type: "Software",
      sales_price: 49,
      cost_price: 12,
      notes: "A better home for your team’s everyday work.",
      active: true,
      variants: [],
    },
    {
      id: "prod-2",
      name: "Brightloop CRM",
      type: "Software",
      sales_price: 99,
      cost_price: 25,
      notes: "Customer relationships, beautifully connected.",
      active: true,
      variants: [
        {
          id: "variant-odoo",
          group_name: "Brand",
          option_name: "Odoo",
          price_delta: 560,
        },
      ],
    },
    {
      id: "prod-3",
      name: "Analytics Plus",
      type: "Add-on",
      sales_price: 29,
      cost_price: 5,
      notes: "Turn your business data into better decisions.",
      active: true,
      variants: [],
    },
    {
      id: "prod-4",
      name: "Priority Support",
      type: "Service",
      sales_price: 79,
      cost_price: 20,
      notes: "A dedicated team, whenever you need us.",
      active: true,
      variants: [],
    },
  ];
  const plans: Plan[] = [
    "Starter",
    "Professional",
    "Business",
    "Enterprise",
  ].map((name, i) => ({
    id: `plan-${i}`,
    name,
    product_id: i === 3 ? "prod-2" : "prod-1",
    price: [49, 99, 249, 2399][i],
    billing_frequency: i === 3 ? "yearly" : "monthly",
    min_quantity: 1,
    flags: {
      auto_close_on_end: true,
      allow_early_close: i !== 3,
      allow_pause: i !== 3,
      allow_renew: true,
    },
    active: true,
  }));
  const subscriptions: Subscription[] = Array.from({ length: 1420 }, (_, i) => {
    const p = plans[[2, 1, 3, 2, 0, 1][i % 6]];
    return {
      id: `sub-${i}`,
      number: `SUB-2026-${String(1420 - i).padStart(4, "0")}`,
      customer_id: `customer-${i % 60}`,
      plan_id: p.id,
      status:
        i === 4 ? "Draft" : i < 1285 ? "Active" : i < 1353 ? "Paused" : "Draft",
      start_date: `2026-10-${String(28 - (i % 25)).padStart(2, "0")}`,
      expiry_date:
        p.billing_frequency === "yearly"
          ? "2027-10-28"
          : `2026-11-${String(1 + (i % 28)).padStart(2, "0")}`,
      next_billing_date:
        i > 1400
          ? "2026-10-31"
          : `2026-11-${String(1 + (i % 28)).padStart(2, "0")}`,
      payment_terms: 14,
      lines: [
        {
          product_id: p.product_id,
          name: products.find((x) => x.id === p.product_id)!.name,
          quantity: 1,
          unit_price: p.price,
        },
      ],
      created_at: `2026-10-${String(28 - (i % 25)).padStart(2, "0")}T09:00:00Z`,
    };
  });
  const invoices: Invoice[] = Array.from({ length: 40 }, (_, i) => {
    const overdue = i < 12;
    const paid = i >= 20;
    const total = paid
      ? 2426
      : overdue
        ? (i === 11 ? 236.63 : 236.67) + (i === 0 ? 100 : 0)
        : 675;
    return {
      id: `inv-${i}`,
      number: `INV-2026-${String(1084 - i).padStart(4, "0")}`,
      customer_id: `customer-${i % 60}`,
      subscription_id: `sub-${i}`,
      status: paid ? "Paid" : "Confirmed",
      period_start: "2026-10-01",
      period_end: "2026-11-01",
      due_date: overdue
        ? `2026-10-${String(15 + i).padStart(2, "0")}`
        : "2026-11-10",
      total,
      subtotal: total / 1.1,
      tax_total: total - total / 1.1,
      discount_total: 0,
      paid_amount: paid ? total : i === 0 ? 100 : 0,
      created_at: `2026-10-${String(2 + (i % 25)).padStart(2, "0")}T10:00:00Z`,
      lines: [
        {
          product_id: "prod-1",
          name: "Brightloop Workspace",
          quantity: 1,
          unit_price: total / 1.1,
        },
      ],
    };
  });
  const payments: Payment[] = invoices
    .filter((i) => i.status === "Paid")
    .map((inv, i) => ({
      id: `pay-${i}`,
      invoice_id: inv.id,
      customer_id: inv.customer_id,
      amount: inv.total,
      method: ["bank", "card", "UPI"][i % 3],
      payment_date: `2026-10-${String(3 + i).padStart(2, "0")}`,
      note: "Monthly subscription payment",
      created_at: `2026-10-${String(3 + i).padStart(2, "0")}T10:00:00Z`,
    }));
  payments.push({
    id: "pay-partial",
    invoice_id: "inv-0",
    customer_id: "customer-0",
    amount: 100,
    method: "bank",
    payment_date: "2026-09-30",
    note: "Partial payment",
    created_at: "2026-09-30T10:00:00Z",
  });
  return {
    users,
    products,
    plans,
    subscriptions,
    invoices,
    payments,
    taxes: [
      {
        id: "tax-1",
        name: "Standard sales tax",
        type: "percent",
        value: 10,
        active: true,
      },
    ],
    discounts: [
      {
        id: "disc-1",
        name: "Welcome aboard",
        type: "percent",
        value: 10,
        scope: "subscription",
        active: true,
        max_uses: 100,
        used_count: 24,
        end_date: "2026-12-31",
      },
      {
        id: "disc-2",
        name: "Summer savings",
        type: "percent",
        value: 15,
        active: false,
        end_date: "2026-08-31",
      },
      {
        id: "disc-3",
        name: "Early bird",
        type: "fixed",
        value: 25,
        active: true,
        max_uses: 10,
        used_count: 10,
      },
    ],
    quotations: [
      {
        id: "quo-1",
        number: "QUO-2026-0024",
        customer_id: "customer-6",
        plan_id: "plan-2",
        status: "Quotation",
        valid_until: "2026-11-15",
        created_at: "2026-10-28T09:00:00Z",
      },
      {
        id: "quo-2",
        number: "QUO-2026-0023",
        customer_id: "customer-7",
        plan_id: "plan-3",
        status: "Quotation",
        valid_until: "2026-11-07",
        created_at: "2026-10-25T09:00:00Z",
      },
    ],
    audit: [
      {
        id: "audit-1",
        entity_type: "invoice",
        entity_id: "inv-0",
        actor: "Alex Morgan",
        action: "payment_recorded",
        created_at: "2026-10-31T09:42:00Z",
      },
      {
        id: "audit-2",
        entity_type: "subscription",
        entity_id: "sub-0",
        actor: "Jamie Parker",
        action: "activated",
        created_at: "2026-10-31T09:15:00Z",
      },
      {
        id: "audit-3",
        entity_type: "billing_run",
        entity_id: "run-1",
        actor: "System",
        action: "completed",
        created_at: "2026-10-31T00:05:00Z",
      },
    ],
  };
}
export const API_URL = import.meta.env.VITE_API_URL as string | undefined;
let refreshing: Promise<boolean> | null = null;
export async function request(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const token = localStorage.getItem("brightloop-token");
  let response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (
    response.status === 401 &&
    localStorage.getItem("brightloop-refresh") &&
    !path.startsWith("/auth/")
  ) {
    if (!refreshing) refreshing = (async () => {
      const refresh = await fetch(`${API_URL}/auth/refresh`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refresh_token:localStorage.getItem("brightloop-refresh")})});
      if (!refresh.ok) return false;
      const data = await refresh.json();localStorage.setItem("brightloop-token",data.access_token);localStorage.setItem("brightloop-refresh",data.refresh_token);return true;
    })().finally(()=>{refreshing=null;});
    if(await refreshing) response=await fetch(`${API_URL}${path}`,{...options,headers:{"Content-Type":"application/json",...options.headers,Authorization:`Bearer ${localStorage.getItem("brightloop-token")}`}});
    else {
      localStorage.removeItem("brightloop-token");localStorage.removeItem("brightloop-refresh");
      window.dispatchEvent(new Event("brightloop-session-expired"));
    }
  }

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: "API connection failed" }));
    throw new Error(
      body.details?.map((x: { message: string }) => x.message).join(". ") ||
        body.error,
    );
  }
  if (path.endsWith("/pdf")) return response.blob();
  return response.json();
}
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const keys = Array.from(new Set(rows.flatMap(Object.keys)));
  const cell = (v: unknown) => {const text=String(v ?? "");return `"${(/^[=+@\-\t\r]/.test(text)?"'":"")+text.replaceAll('"', '""')}"`;};
  const blob = new Blob(
    [
      keys.map(cell).join(",") +
        "\n" +
        rows.map((r) => keys.map((k) => cell(r[k])).join(",")).join("\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
