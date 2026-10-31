import { useEffect, useState, type FormEvent } from "react";
import { Check, LoaderCircle, Plus, Settings2, Trash2, X } from "lucide-react";
import { API_URL, request, uid, type Data, type Plan } from "../data";
import "./ServerRecords.css";
type RecordValue = Record<string, any>;
const titles: Record<string, string> = {
  products: "Products",
  variants: "Product variants",
  plans: "Billing plans",
  taxes: "Tax rules",
  discounts: "Discount rules",
  templates: "Quotation templates",
};
export function CatalogManager({
  page,
  data,
  isAdmin,
  onUpdate,
  notify,
}: {
  page: string;
  data: Data;
  isAdmin: boolean;
  onUpdate: (
    kind: string,
    value: RecordValue,
    remove?: boolean,
  ) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}) {
  const choices =
    page === "Quotations"
      ? ["templates"]
      : page === "Taxes & discounts"
        ? ["taxes", "discounts"]
        : ["products", "variants", "plans"];
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(choices[0]);
  const [selected, setSelected] = useState("");
  const [values, setValues] = useState<RecordValue>({});
  const [extras, setExtras] = useState<RecordValue[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEdit = isAdmin || kind === "templates";
  const productId = values.product_id || data.products[0]?.id || "";
  function defaults(type: string): RecordValue {
    const p = data.plans[0];
    return {
      name: "",
      type: ["taxes", "discounts"].includes(type) ? "percent" : "Software",
      sales_price: 0,
      cost_price: 0,
      notes: "",
      active: true,
      product_id: data.products[0]?.id || "",
      plan_id: p?.id || "",
      price: 0,
      billing_frequency: "monthly",
      min_quantity: 1,
      group_name: "Brand",
      option_name: "",
      price_delta: 0,
      validity_days: 30,
      value: 0,
      min_amount: 0,
      scope: "subscription",
      product_ids: [],
      flags: {
        auto_close_on_end: true,
        allow_pause: true,
        allow_early_close: true,
        allow_renew: true,
      },
      lines: p
        ? [{ product_id: p.product_id, quantity: 1, variant_ids: [] }]
        : [],
    };
  }
  useEffect(() => {
    if (!open) return;
    setError("");
    if (kind === "templates") {
      if (API_URL)
        void request("/templates?page_size=100")
          .then((r) => setExtras(r.data))
          .catch((e) => setError(e.message));
      else {
        const stored = localStorage.getItem("brightloop-templates");
        setExtras(stored ? JSON.parse(stored) : []);
      }
    } else if (kind === "variants") {
      if (API_URL && productId)
        void request(`/products/${productId}/variants`)
          .then((r) => setExtras(r.data))
          .catch((e) => setError(e.message));
      else
        setExtras(
          data.products.find((p) => p.id === productId)?.variants || [],
        );
    }
  }, [open, kind, productId, data.products]);
  const records: RecordValue[] = ["variants", "templates"].includes(kind)
    ? extras
    : ((data[kind as keyof Data] || []) as RecordValue[]);
  function switchKind(value: string) {
    setKind(value);
    setSelected("");
    setValues(defaults(value));
    setError("");
  }
  function choose(value: string) {
    setSelected(value);
    setValues(
      value
        ? { ...defaults(kind), ...records.find((r) => r.id === value) }
        : defaults(kind),
    );
    setError("");
  }
  const set = (key: string, value: unknown) =>
    setValues((v) => ({ ...v, [key]: value }));
  const field = (
    label: string,
    key: string,
    type = "text",
    required = true,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        value={values[key] ?? ""}
        required={required}
        min={type === "number" && key !== "price_delta" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(e) =>
          set(key, type === "number" ? Number(e.target.value) : e.target.value)
        }
      />
    </label>
  );
  const dropdown = (
    label: string,
    key: string,
    options: { value: string; label: string }[],
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={values[key] || ""}
        required
        onChange={(e) => set(key, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  function payload() {
    const v = values;
    if (kind === "products")
      return {
        name: v.name,
        type: v.type,
        sales_price: v.sales_price,
        cost_price: v.cost_price,
        notes: v.notes,
        active: v.active,
      };
    if (kind === "variants")
      return {
        group_name: v.group_name,
        option_name: v.option_name,
        price_delta: v.price_delta,
      };
    if (kind === "plans")
      return {
        name: v.name,
        product_id: v.product_id,
        price: v.price,
        billing_frequency: v.billing_frequency,
        min_quantity: v.min_quantity,
        available_from: v.available_from || null,
        available_to: v.available_to || null,
        flags: v.flags,
        active: v.active,
      };
    if (kind === "templates")
      return {
        name: v.name,
        plan_id: v.plan_id,
        lines: v.lines,
        validity_days: v.validity_days,
      };
    if (kind === "taxes")
      return {
        name: v.name,
        type: v.type,
        value: v.value,
        product_ids: v.product_ids?.length ? v.product_ids : null,
        active: v.active,
      };
    return {
      name: v.name,
      type: v.type,
      value: v.value,
      product_ids: v.product_ids?.length ? v.product_ids : null,
      min_amount: v.min_amount,
      min_quantity: v.min_quantity,
      start_date: v.start_date || null,
      end_date: v.end_date || null,
      max_uses: v.max_uses ? Number(v.max_uses) : null,
      scope: v.scope,
      active: v.active,
    };
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = payload();
      if (
        "value" in input &&
        input.type === "percent" &&
        Number(input.value) > 100
      )
        throw new Error("Percentages cannot exceed 100.");
      const path =
        kind === "variants" ? `/products/${productId}/variants` : `/${kind}`;
      const result = API_URL
        ? await request(path + (selected ? `/${selected}` : ""), {
            method: selected ? "PUT" : "POST",
            body: JSON.stringify(input),
          })
        : {
            ...input,
            id: selected || uid(),
            ...(kind === "variants" ? { product_id: productId } : {}),
          };
      if (kind === "templates" && !API_URL) {
        const updated = [...extras.filter((r) => r.id !== result.id), result];
        localStorage.setItem("brightloop-templates", JSON.stringify(updated));
        setExtras(updated);
      } else await onUpdate(kind, result);
      notify(
        `${titles[kind]} ${selected ? "updated" : "created"} successfully.`,
      );
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (
      !selected ||
      !window.confirm(
        `Archive this ${kind === "variants" ? "variant" : "record"}? Existing invoices are preserved.`,
      )
    )
      return;
    setBusy(true);
    try {
      if (API_URL)
        await request(
          (kind === "variants"
            ? `/products/${productId}/variants`
            : `/${kind}`) + `/${selected}`,
          { method: "DELETE" },
        );
      if (kind === "templates" && !API_URL)
        localStorage.setItem(
          "brightloop-templates",
          JSON.stringify(extras.filter((r) => r.id !== selected)),
        );
      else
        await onUpdate(
          kind,
          { ...values, id: selected, active: false, product_id: productId },
          true,
        );
      setOpen(false);
      notify("Record archived.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to archive");
    } finally {
      setBusy(false);
    }
  }
  if (!canEdit) return null;
  return (
    <>
      <div className="advanced-setup">
        <div>
          <Settings2 size={19} />
          <span>
            <strong>
              {page === "Quotations"
                ? "Make every offer your own."
                : "The details make the difference."}
            </strong>
            <p>
              {page === "Quotations"
                ? "Create and edit reusable quotation templates."
                : "Edit records, manage variants, set availability, and fine-tune your rules."}
            </p>
          </span>
        </div>
        <button
          className="button small"
          onClick={() => {
            setValues(defaults(choices[0]));
            setSelected("");
            setKind(choices[0]);
            setOpen(true);
          }}
        >
          {page === "Quotations" ? "Manage templates" : "Advanced setup"}
          <Settings2 size={13} />
        </button>
      </div>
      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <section
            className="modal editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Advanced setup"
          >
            <button
              className="icon-button modal-close"
              aria-label="Close editor"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
            <span className="modal-emblem">
              <Settings2 size={24} />
            </span>
            <h2>A thoughtful setup.</h2>
            <p className="modal-description">
              The right details, for a smoother subscription lifecycle.
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Manage</span>
                <select
                  value={kind}
                  onChange={(e) => switchKind(e.target.value)}
                >
                  {choices.map((k) => (
                    <option key={k} value={k}>
                      {titles[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Record</span>
                <select
                  value={selected}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="">Create new record</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || `${r.group_name} = ${r.option_name}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <form onSubmit={save}>
              <div className="editor-grid">
                {kind !== "variants" && (
                  <div className="wide">{field("Name", "name")}</div>
                )}
                {["plans", "variants"].includes(kind) && (
                  <div className="wide">
                    {dropdown(
                      "Product",
                      "product_id",
                      data.products
                        .filter((p) => p.active)
                        .map((p) => ({ value: p.id, label: p.name })),
                    )}
                  </div>
                )}
                {kind === "products" && (
                  <>
                    {dropdown(
                      "Product type",
                      "type",
                      ["Software", "Add-on", "Service"].map((s) => ({
                        value: s,
                        label: s,
                      })),
                    )}
                    {field("Sales price (USD)", "sales_price", "number")}
                    {field("Cost price (USD)", "cost_price", "number")}
                    <div className="wide">
                      <label className="field">
                        <span>Notes</span>
                        <textarea
                          rows={2}
                          value={values.notes || ""}
                          onChange={(e) => set("notes", e.target.value)}
                        />
                      </label>
                    </div>
                  </>
                )}
                {kind === "variants" && (
                  <>
                    {field("Variant group", "group_name")}
                    {field("Option", "option_name")}
                    {field("Price delta (USD)", "price_delta", "number")}
                    <div className="wide form-note">
                      Effective price = product base price + selected option
                      deltas. Each group allows one selected option.
                    </div>
                  </>
                )}
                {kind === "plans" && (
                  <>
                    {field("Price (USD)", "price", "number")}
                    {dropdown(
                      "Billing frequency",
                      "billing_frequency",
                      ["daily", "weekly", "monthly", "yearly"].map((s) => ({
                        value: s,
                        label: s,
                      })),
                    )}
                    {field("Minimum quantity", "min_quantity", "number")}
                    {field("Available from", "available_from", "date", false)}
                    {field("Available until", "available_to", "date", false)}
                    <div className="wide checkbox-fields">
                      {(
                        [
                          "auto_close_on_end",
                          "allow_pause",
                          "allow_early_close",
                          "allow_renew",
                        ] as (keyof Plan["flags"])[]
                      ).map((flag) => (
                        <label key={flag}>
                          <input
                            type="checkbox"
                            checked={values.flags?.[flag] || false}
                            onChange={(e) =>
                              set("flags", {
                                ...values.flags,
                                [flag]: e.target.checked,
                              })
                            }
                          />
                          {flag.replaceAll("_", " ")}
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {["taxes", "discounts"].includes(kind) && (
                  <>
                    {dropdown("Calculation", "type", [
                      { value: "percent", label: "Percentage (%)" },
                      { value: "fixed", label: "Fixed amount ($)" },
                    ])}
                    {field("Value", "value", "number")}
                    {kind === "discounts" && (
                      <>
                        {dropdown("Scope", "scope", [
                          { value: "products", label: "Selected products" },
                          {
                            value: "subscription",
                            label: "Entire subscription",
                          },
                        ])}
                        {field("Minimum amount", "min_amount", "number")}
                        {field("Minimum quantity", "min_quantity", "number")}
                        {field("Maximum uses", "max_uses", "number", false)}
                        {field("Start date", "start_date", "date", false)}
                        {field("End date", "end_date", "date", false)}
                      </>
                    )}
                    <div className="wide">
                      <span className="subtle">
                        Eligible products (leave empty for all)
                      </span>
                      <div className="editor-products">
                        {data.products.map((p) => (
                          <label key={p.id}>
                            <input
                              type="checkbox"
                              checked={
                                values.product_ids?.includes(p.id) || false
                              }
                              onChange={(e) =>
                                set(
                                  "product_ids",
                                  e.target.checked
                                    ? [...(values.product_ids || []), p.id]
                                    : (values.product_ids || []).filter(
                                        (id: string) => id !== p.id,
                                      ),
                                )
                              }
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {kind === "templates" && (
                  <>
                    <div className="wide">
                      {dropdown(
                        "Plan",
                        "plan_id",
                        data.plans
                          .filter((p) => p.active)
                          .map((p) => ({ value: p.id, label: p.name })),
                      )}
                    </div>
                    {field("Validity (days)", "validity_days", "number")}
                    <div className="wide">
                      <span className="subtle">Product lines · quantity</span>
                      <div style={{ marginTop: 10 }}>
                        {(values.lines || []).map(
                          (line: RecordValue, index: number) => (
                            <div key={index} className="editor-line">
                              <select
                                aria-label={`Product line ${index + 1}`}
                                value={line.product_id}
                                onChange={(e) =>
                                  set(
                                    "lines",
                                    values.lines.map(
                                      (l: RecordValue, i: number) =>
                                        i === index
                                          ? { ...l, product_id: e.target.value }
                                          : l,
                                    ),
                                  )
                                }
                              >
                                {data.products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                aria-label={`Quantity line ${index + 1}`}
                                type="number"
                                min="1"
                                required
                                value={line.quantity}
                                onChange={(e) =>
                                  set(
                                    "lines",
                                    values.lines.map(
                                      (l: RecordValue, i: number) =>
                                        i === index
                                          ? {
                                              ...l,
                                              quantity: Number(e.target.value),
                                            }
                                          : l,
                                    ),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="icon-button"
                                disabled={values.lines.length <= 1}
                                aria-label="Remove line"
                                onClick={() =>
                                  set(
                                    "lines",
                                    values.lines.filter(
                                      (_: unknown, i: number) => i !== index,
                                    ),
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                      <button
                        type="button"
                        className="button small"
                        onClick={() =>
                          set("lines", [
                            ...values.lines,
                            {
                              product_id: productId,
                              quantity: 1,
                              variant_ids: [],
                            },
                          ])
                        }
                      >
                        <Plus size={13} />
                        Add line
                      </button>
                    </div>
                  </>
                )}
                {!["templates", "variants"].includes(kind) && (
                  <div className="wide checkbox-fields">
                    <label>
                      <input
                        type="checkbox"
                        checked={values.active ?? true}
                        onChange={(e) => set("active", e.target.checked)}
                      />
                      Active and available
                    </label>
                  </div>
                )}
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="editor-actions">
                {selected ? (
                  <button
                    type="button"
                    className="button danger"
                    disabled={busy}
                    onClick={() => void archive()}
                  >
                    <Trash2 size={14} />
                    Archive
                  </button>
                ) : (
                  <span />
                )}
                <div>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={busy}>
                    {busy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {selected ? "Save changes" : "Create record"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
