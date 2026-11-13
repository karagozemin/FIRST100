import type { ReactNode } from "react";

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
}) {
  return <button className={props.secondary ? "button secondary" : "button"} disabled={props.disabled} onClick={() => void props.onClick()}>
    {props.children}
  </button>;
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return <div className={accent ? "stat accent" : "stat"}><span>{label}</span><strong>{value}</strong></div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "ok" }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
