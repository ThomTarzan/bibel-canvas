import { BREAK_MARKS } from '../lib/lineBreaks';
import type { LineBreakSettings } from '../types';

export function LineBreakOptions({
  value,
  onChange,
}: {
  value: LineBreakSettings;
  onChange: (next: LineBreakSettings) => void;
}) {
  return (
    <fieldset className="breaks">
      <legend>Bryt linje etter</legend>
      <div className="breaks-grid">
        {BREAK_MARKS.map((mark) => (
          <label key={mark.key} className="check">
            <input
              type="checkbox"
              checked={value[mark.key]}
              onChange={(event) => onChange({ ...value, [mark.key]: event.target.checked })}
            />
            {mark.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
