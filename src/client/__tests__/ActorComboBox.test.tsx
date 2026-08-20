import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActorComboBox } from "../components/ActorGraph";
import { apiService } from "../services/api";

vi.mock("../services/api", () => ({
  apiService: { searchGraph: vi.fn(), getActorPath: vi.fn() },
}));

const ACTORS = [
  { tmdbId: 1, name: "Tom Hanks", profilePath: null },
  { tmdbId: 2, name: "Tom Hardy", profilePath: null },
  { tmdbId: 3, name: "Tom Holland", profilePath: null },
];

const respondWith = (actors: typeof ACTORS) =>
  vi.mocked(apiService.searchGraph).mockResolvedValue({ data: { actors } });

const setup = (props: Partial<Parameters<typeof ActorComboBox>[0]> = {}) => {
  const onSelect = vi.fn();
  render(
    <ActorComboBox
      label="Actor 1"
      selected={null}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect, input: screen.getByRole("combobox", { name: "Actor 1" }) };
};

const options = () => screen.getAllByRole("option");

describe("ActorComboBox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    respondWith(ACTORS);
  });

  it("is a labelled combobox that starts collapsed", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  // A dangling idref is invalid ARIA and the easiest thing to regress here.
  it("keeps aria-controls resolvable while collapsed and while empty", async () => {
    const { input } = setup();

    const listboxId = input.getAttribute("aria-controls");
    expect(listboxId).toBeTruthy();
    expect(document.getElementById(listboxId!)).toBeInTheDocument();

    respondWith([]);
    await userEvent.type(input, "zz");
    await waitFor(() => expect(screen.getByText("No matches")).toBeVisible());
    expect(document.getElementById(listboxId!)).toBeInTheDocument();
  });

  it("lists matches as options once two characters are typed", async () => {
    const { input } = setup();

    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(within(options()[0]!).getByText("Tom Hanks")).toBeInTheDocument();
  });

  it("moves aria-activedescendant with the arrow keys and wraps", async () => {
    const { input } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    expect(input).not.toHaveAttribute("aria-activedescendant");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options()[0]!.id);
    expect(options()[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options()[0]!.id);

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", options()[2]!.id);
  });

  it("selects the active option on Enter", async () => {
    const { input, onSelect } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Tom Hardy" }),
    );
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape without clearing the query", async () => {
    const { input } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("tom");
  });

  // The whole point of aria-activedescendant: one tab stop, not one per result.
  it("adds no tab stops for the options", async () => {
    const { input } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    for (const option of options()) {
      expect(option).not.toHaveAttribute("tabindex");
    }
    expect(screen.queryAllByRole("button", { name: /Tom/ })).toHaveLength(0);
  });

  it("resets the active option when the result list changes", async () => {
    const { input } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant");

    respondWith([{ tmdbId: 9, name: "Tommy Lee Jones", profilePath: null }]);
    await userEvent.type(input, "m");
    await waitFor(() => expect(options()).toHaveLength(1));

    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  // The pointer sets the active option; if it leaves without a reset, Enter
  // still fires on whatever it last crossed.
  it("unarms Enter when the pointer leaves the list", async () => {
    const { input, onSelect } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    fireEvent.mouseEnter(options()[2]!);
    expect(input).toHaveAttribute("aria-activedescendant", options()[2]!.id);

    fireEvent.mouseLeave(screen.getByRole("listbox"));
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  // excludeId shrinks the list without `results` changing identity.
  it("drops the active option when the other picker excludes one", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <ActorComboBox label="Actor 1" selected={null} onSelect={onSelect} />,
    );
    const input = screen.getByRole("combobox", { name: "Actor 1" });
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    fireEvent.keyDown(input, { key: "End" });
    expect(input).toHaveAttribute("aria-activedescendant", options()[2]!.id);

    rerender(
      <ActorComboBox
        label="Actor 1"
        selected={null}
        onSelect={onSelect}
        excludeId={3}
      />,
    );
    await waitFor(() => expect(options()).toHaveLength(2));

    expect(input).not.toHaveAttribute("aria-activedescendant");

    // The index is genuinely reset, not merely pointing past the end: the next
    // ArrowDown must land on the first option. A stale 2 would land on the
    // second, since the wrap is modulo the new length.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options()[0]!.id);
  });

  it("announces the result count politely", async () => {
    const { input } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(screen.getByText("3 results")).toBeInTheDocument());
  });

  it("reports collapsed after the clear button empties the query", async () => {
    const { input } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("does not strand the spinner after selecting mid-flight", async () => {
    const { input } = setup();
    await userEvent.type(input, "tom");
    await waitFor(() => expect(options()).toHaveLength(3));

    // type again so a fetch is in flight, then pick from the visible list
    await userEvent.type(input, "m");
    await userEvent.click(screen.getByText("Tom Hanks"));
    expect(input).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(input);
    await waitFor(() =>
      expect(screen.queryByText("Searching…")).not.toBeInTheDocument(),
    );
  });
});
