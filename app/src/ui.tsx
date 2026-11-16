import { useRef, useState, type ReactNode } from "react";

export const activityEventName = "first100:activity";

export interface ActivityEventDetail {
  id: string;
  label: string;
  state: "running" | "success" | "error";
}

export function Field(props: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  step?: string;
  hint?: string;
}) {
  return <label className="field">
    <span>{props.label}</span>
    <input
      type={props.type ?? "text"}
      value={props.value}
      min={props.min}
      step={props.step}
      onChange={(event) => props.onChange(event.target.value)}
    />
    {props.hint && <small>{props.hint}</small>}
  </label>;
}

export function Button(props: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  secondary?: boolean;
  bare?: boolean;
  className?: string;
  activityLabel?: string;
  loadingLabel?: string;
  title?: string;
}) {
  const [pending, setPending] = useState(false);
  const actionId = useRef(crypto.randomUUID());
  const className = [
    props.bare ? "" : "button",
    props.secondary && !props.bare ? "secondary" : "",
    "async-action",
    pending ? "is-loading" : "",
    props.className ?? "",
  ].filter(Boolean).join(" ");
  const label = props.activityLabel ?? (typeof props.children === "string" ? props.children : "Processing request");

  async function run() {
    if (pending || props.disabled) return;
    setPending(true);
    window.dispatchEvent(new CustomEvent<ActivityEventDetail>(activityEventName, {
      detail: { id: actionId.current, label, state: "running" },
    }));
    try {
      await props.onClick();
      window.dispatchEvent(new CustomEvent<ActivityEventDetail>(activityEventName, {
        detail: { id: actionId.current, label, state: "success" },
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent<ActivityEventDetail>(activityEventName, {
        detail: { id: actionId.current, label, state: "error" },
      }));
      console.error(error);
    } finally {
      setPending(false);
    }
  }

  return <button className={className} disabled={props.disabled || pending} aria-busy={pending} title={props.title} onClick={() => void run()}>
    <span className="action-content">{props.children}</span>
    {pending && <span className="action-pending" aria-live="polite"><i aria-hidden="true" />{props.loadingLabel ?? "Working"}</span>}
  </button>;
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return <div className={accent ? "stat accent" : "stat"}><span>{label}</span><strong>{value}</strong></div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "ok" }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
