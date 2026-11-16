/**
 * Marks a Letterboxd profile that is not a Discord member. Goes after the name
 * in lists; never inside an `<option>`, which cannot hold markup.
 */
const NonDiscordMark = () => (
  <span title="Not a Discord member" className="ml-1">
    <span aria-hidden="true">⭐</span>
    <span className="sr-only">(not a Discord member)</span>
  </span>
);

export default NonDiscordMark;
