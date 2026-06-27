interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <label className="search-box">
      <span>Search lens forms</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Planar, wide-angle, portrait..."
      />
    </label>
  );
}
