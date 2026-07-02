import { buildHeaderLine } from "even-toolkit/text-utils";
import type { AppState } from "../../state";
import type { Screen as ScreenName } from "../../state";
import type { GlassCtx } from "../context";
import type { Screen } from "../types";

export interface MenuItem {
  label: string;
  target?: ScreenName; // no target = no-op
}

export interface MenuDef {
  title: string;
  parent?: ScreenName; // no parent = root (double-tap shuts down)
  items: MenuItem[];
}

export const ROOT_MENU_ITEMS = ["Tasks", "Notes", "Projects", "Tags"];

const rootMenuDef: MenuDef = {
  title: "Ultimate Brain for Even G2",
  items: [
    { label: "Tasks", target: "tasks-menu" },
    { label: "Notes", target: "notes-menu" },
    { label: "Projects", target: "projects-menu" },
    { label: "Tags", target: "tags-menu" },
  ],
};

const tasksMenuDef: MenuDef = {
  title: "TASKS",
  parent: "menu",
  items: [
    { label: "Today", target: "today" },
    { label: "Inbox", target: "inbox" },
    { label: "Next 7 Days" },
    { label: "Tomorrow" },
    { label: "No Due" },
    { label: "Recurring" },
    { label: "Active Projects" },
    { label: "All" },
    { label: "Done" },
    { label: "Overdue", target: "overdue" },
    { label: "Add Task (Voice)", target: "add-task" },
  ],
};

const notesMenuDef: MenuDef = {
  title: "NOTES",
  parent: "menu",
  items: [
    { label: "Notes" },
    { label: "Inbox" },
    { label: "Favorites" },
    { label: "Meetings" },
    { label: "All" },
  ],
};

const projectsMenuDef: MenuDef = {
  title: "PROJECTS",
  parent: "menu",
  items: [{ label: "Active" }, { label: "Planned" }, { label: "Board" }],
};

const tagsMenuDef: MenuDef = {
  title: "TAGS",
  parent: "menu",
  items: [{ label: "Recent" }, { label: "Favorites" }, { label: "A-Z" }],
};

/** Route a target screen through the correct ctx entry point. */
function open(target: ScreenName, ctx: GlassCtx): void {
  switch (target) {
    case "today":
      ctx.enterToday();
      break;
    case "inbox":
      ctx.enterInbox();
      break;
    case "overdue":
      ctx.enterOverdue();
      break;
    case "add-task":
      ctx.navigate("add-task");
      break;
    default:
      // Submenu screens: plain synchronous switch.
      ctx.navigate(target);
  }
}

export function makeMenuScreen(def: MenuDef): Screen<AppState, GlassCtx> {
  return {
    display(_state) {
      return {
        mode: "list",
        header: buildHeaderLine(def.title, ""),
        items: def.items.map((i) => i.label),
      };
    },

    action(action, nav, _state, ctx) {
      if (action.type === "GO_BACK") {
        if (def.parent) ctx.navigate(def.parent);
        else ctx.shutdown();
        return nav;
      }

      if (action.type === "SELECT_HIGHLIGHTED") {
        const idx = action.itemIndex;
        if (typeof idx === "number") {
          const item = def.items[idx];
          if (item?.target) open(item.target, ctx);
        }
        return nav;
      }

      // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
      return nav;
    },
  };
}

export const menuScreen = makeMenuScreen(rootMenuDef);
export const tasksMenuScreen = makeMenuScreen(tasksMenuDef);
export const notesMenuScreen = makeMenuScreen(notesMenuDef);
export const projectsMenuScreen = makeMenuScreen(projectsMenuDef);
export const tagsMenuScreen = makeMenuScreen(tagsMenuDef);
