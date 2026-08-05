import type { ChangeEvent, ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Accessible labeled form field with hint and error text. */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextInputProps {
  id: string;
  name?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  error?: boolean;
}

const inputClasses = (error?: boolean) =>
  [
    "block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-offset-1",
    error
      ? "border-red-400 focus:outline-red-500"
      : "border-slate-300 focus:outline-slate-500",
  ].join(" ");

export function TextInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  autoComplete,
  error,
}: TextInputProps) {
  return (
    <input
      id={id}
      name={name ?? id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      aria-invalid={error || undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={inputClasses(error)}
    />
  );
}
