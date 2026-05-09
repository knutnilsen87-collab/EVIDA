import { useEffect, useRef, useState } from "react";

type Props = {
  onNewCase: () => void;
  onNewCaseWindow: () => void;
  onOpenCaseSwitcher: () => void;
  onImportDocuments: () => void;
  onExport: () => void;
  onCloseCase: () => void;
  onToggleTheme: () => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenDataFolder: () => void;
};

type MenuId = "file" | "edit" | "view" | "window" | "help";

type MenuItem = {
  label: string;
  shortcut?: string;
  action: () => void;
};

const disabled = () => undefined;

export function DesktopMenuBar({
  onNewCase,
  onNewCaseWindow,
  onOpenCaseSwitcher,
  onImportDocuments,
  onExport,
  onCloseCase,
  onToggleTheme,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenDataFolder
}: Props) {
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function runAction(action: () => void) {
    setActiveMenu(null);
    action();
  }

  const menus: Array<{ id: MenuId; label: string; items: MenuItem[] }> = [
    {
      id: "file",
      label: "Fil",
      items: [
        { label: "Ny sak", shortcut: "Ctrl+N", action: onNewCase },
        { label: "Ny sak i nytt vindu", shortcut: "Ctrl+Shift+N", action: onNewCaseWindow },
        { label: "Åpne tidligere sak", shortcut: "Ctrl+O", action: onOpenCaseSwitcher },
        { label: "Importer dokumenter", shortcut: "Ctrl+I", action: onImportDocuments },
        { label: "Lagre", action: disabled },
        { label: "Eksporter", action: onExport },
        { label: "Lukk sak", action: onCloseCase }
      ]
    },
    {
      id: "edit",
      label: "Rediger",
      items: [
        { label: "Angre", action: disabled },
        { label: "Gjør om", action: disabled },
        { label: "Klipp ut", action: disabled },
        { label: "Kopier", action: disabled },
        { label: "Lim inn", action: disabled },
        { label: "Finn i saken", shortcut: "Ctrl+F", action: disabled }
      ]
    },
    {
      id: "view",
      label: "Vis",
      items: [
        { label: "Lys/mørk modus", action: onToggleTheme },
        { label: "Sakspilot", shortcut: "Ctrl+K", action: onOpenCommandPalette }
      ]
    },
    {
      id: "window",
      label: "Vindu",
      items: [
        { label: "Nytt vindu", action: onNewCaseWindow },
        { label: "Ny sak i nytt vindu", action: onNewCaseWindow },
        { label: "Åpne sak i nytt vindu", action: onOpenCaseSwitcher }
      ]
    },
    {
      id: "help",
      label: "Hjelp",
      items: [
        { label: "Innstillinger", shortcut: "Ctrl+,", action: onOpenSettings },
        { label: "Åpne lokal datamappe", action: onOpenDataFolder },
        { label: "Om Evida", action: disabled }
      ]
    }
  ];

  return (
    <nav className="desktop-menu" aria-label="Programmeny" ref={menuRef}>
      {menus.map((menu) => {
        const isOpen = activeMenu === menu.id;

        return (
          <div className="desktop-menu-item" key={menu.id}>
            <button
              type="button"
              className="desktop-menu-trigger"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() => setActiveMenu(isOpen ? null : menu.id)}
              onMouseEnter={() => {
                if (activeMenu) {
                  setActiveMenu(menu.id);
                }
              }}
            >
              {menu.label}
            </button>
            {isOpen ? (
              <div className="desktop-menu-popover" role="menu">
                {menu.items.map((item) => (
                  <button
                    key={`${menu.id}-${item.label}`}
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(item.action)}
                  >
                    <span>{item.label}</span>
                    {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
