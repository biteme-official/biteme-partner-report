"use client";

interface TabGroupOption<T> {
  value: T;
  label: string;
}

interface TabGroupProps<T extends string | number> {
  options: TabGroupOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  wrapperClassName?: string;
  buttonClassName?: string;
}

export default function TabGroup<T extends string | number>({
  options,
  value,
  onChange,
  wrapperClassName = "",
  buttonClassName = "px-3 py-1.5 text-sm",
}: TabGroupProps<T>) {
  return (
    <div className={`flex gap-1 bg-gray-100 rounded-lg p-1 ${wrapperClassName}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`${buttonClassName} rounded-md transition-colors ${
            value === opt.value
              ? "bg-white text-gray-900 shadow-sm font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
