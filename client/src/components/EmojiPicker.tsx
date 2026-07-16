const EMOJIS = ["😱", "🔥", "😢", "😂", "😍", "🤔", "🥹", "💀"];

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (emoji: string | null) => void;
}) {
  return (
    <div className="emoji-picker">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className={`emoji-option ${value === e ? "selected" : ""}`}
          onClick={() => onChange(value === e ? null : e)}
          aria-label={`React with ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
