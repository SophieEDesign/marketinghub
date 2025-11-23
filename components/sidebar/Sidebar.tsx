"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Lightbulb,
  Megaphone,
  Newspaper,
  Users,
  CheckSquare,
  Settings,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Moon,
  Sun,
  HelpCircle,
  LayoutGrid,
  Columns3,
  Calendar,
  Timer,
  SquareStack,
  GripVertical,
  Edit3,
  Check,
} from "lucide-react";
import { tables, tableCategories } from "@/lib/tables";
import { useTheme } from "@/app/providers";
import WorkspaceHeader from "./WorkspaceHeader";
import { supabase } from "@/lib/supabaseClient";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import SidebarSortableItem from "./SidebarSortableItem";

// Map view types to icons
const viewIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  grid: LayoutGrid,
  kanban: Columns3,
  calendar: Calendar,
  timeline: Timer,
  cards: SquareStack,
};

import { tableMetadata, getTableIcon, getAllTables } from "@/lib/tableMetadata";
import { BookOpen, Gift, Compass, Image as ImageIcon } from "lucide-react";

// Map table IDs to icons - now uses metadata
const getTableIconComponent = (tableId: string) => {
  return tableMetadata[tableId]?.icon || FileText;
};

// Map table IDs to icons for backward compatibility
const tableIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  content: FileText,
  ideas: Lightbulb,
  campaigns: Megaphone,
  media: Newspaper,
  contacts: Users,
  tasks: CheckSquare,
  briefings: BookOpen,
  sponsorships: Gift,
  strategy: Compass,
  assets: ImageIcon,
};

// Capitalize view name
function capitalizeView(view: string): string {
  return view.charAt(0).toUpperCase() + view.slice(1);
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  children?: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Generate default sidebar items from table metadata
const generateDefaultSidebarItems = () => {
  const tableItems = getAllTables().map((tableId) => {
    const meta = tableMetadata[tableId];
    const Icon = meta?.icon || FileText;
    return {
      id: tableId,
      label: meta?.label || tableId,
      icon: Icon,
      href: `/${tableId}/${meta?.defaultView || "grid"}`,
    };
  });

  return [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ...tableItems,
    { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
  ];
};

const defaultSidebarItems = generateDefaultSidebarItems();

export default function Sidebar() {
  const pathname = usePathname();
  const themeContext = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [orderedSidebar, setOrderedSidebar] = useState(defaultSidebarItems);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [sidebarCustomizations, setSidebarCustomizations] = useState<{ groupTitles: Record<string, string>; itemLabels: Record<string, string> }>({ groupTitles: {}, itemLabels: {} });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load collapsed state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") {
      setCollapsed(true);
    }
  }, []);

  // Load collapsed groups from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem("sidebarCollapsedGroups");
    if (saved) {
      try {
        setCollapsedGroups(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Error loading collapsed groups:", e);
      }
    }
  }, []);

  // Save collapsed state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("sidebarCollapsed", collapsed ? "true" : "false");
  }, [collapsed]);

  // Save collapsed groups to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("sidebarCollapsedGroups", JSON.stringify(Array.from(collapsedGroups)));
  }, [collapsedGroups]);

  // Load sidebar customizations from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem("sidebarCustomizations");
    if (saved) {
      try {
        const customizations = JSON.parse(saved);
        setSidebarCustomizations({
          groupTitles: customizations.groupTitles || {},
          itemLabels: customizations.itemLabels || {},
        });
      } catch (e) {
        console.error("Error loading sidebar customizations:", e);
      }
    }
  }, []);

  // Handler for group title changes
  const handleGroupTitleChange = (oldTitle: string, newTitle: string) => {
    if (typeof window === 'undefined') return;
    const newCustomizations = {
      groupTitles: { ...sidebarCustomizations.groupTitles, [oldTitle]: newTitle },
      itemLabels: { ...sidebarCustomizations.itemLabels },
    };
    setSidebarCustomizations(newCustomizations);
    localStorage.setItem("sidebarCustomizations", JSON.stringify(newCustomizations));
    // Force re-render by updating state
    setEditing(false);
    setTimeout(() => setEditing(true), 0);
  };

  // Handler for item label changes
  const handleItemLabelChange = (href: string, newLabel: string) => {
    if (typeof window === 'undefined') return;
    const newCustomizations = {
      groupTitles: { ...sidebarCustomizations.groupTitles },
      itemLabels: { ...sidebarCustomizations.itemLabels, [href]: newLabel },
    };
    setSidebarCustomizations(newCustomizations);
    localStorage.setItem("sidebarCustomizations", JSON.stringify(newCustomizations));
    // Force re-render by updating state
    setEditing(false);
    setTimeout(() => setEditing(true), 0);
  };

  // Parse current route
  const pathParts = pathname.split("/").filter(Boolean);
  const currentTable = pathParts[0] || null;
  const currentView = pathParts[1] || null;

  // Build navGroups structure
  const navGroups: NavGroup[] = [
    {
      title: "General",
      items: [
        {
          icon: LayoutDashboard,
          label: "Dashboard",
          href: "/dashboard",
        },
      ],
    },
    {
      title: "Content",
      items: (tableCategories
        .find((c) => c.id === "content")
        ?.tableIds.map((tableId) => {
          const table = tables.find((t) => t.id === tableId);
          if (!table) return null;
          return {
            icon: getTableIconComponent(table.id),
            label: table.name,
            href: `/${table.id}/grid`,
            children: table.views.map((view) => ({
              icon: viewIcons[view] || LayoutGrid,
              label: capitalizeView(view),
              href: `/${table.id}/${view}`,
            })),
          } as NavItem;
        })
        .filter((item) => item !== null) as NavItem[] || []) as NavItem[],
    },
    {
      title: "Planning",
      items: (tableCategories
        .find((c) => c.id === "planning")
        ?.tableIds.map((tableId) => {
          const table = tables.find((t) => t.id === tableId);
          if (!table) return null;
          return {
            icon: getTableIconComponent(table.id),
            label: table.name,
            href: `/${table.id}/grid`,
            children: table.views.map((view) => ({
              icon: viewIcons[view] || LayoutGrid,
              label: capitalizeView(view),
              href: `/${table.id}/${view}`,
            })),
          } as NavItem;
        })
        .filter((item) => item !== null) as NavItem[] || []) as NavItem[],
    },
    {
      title: "CRM",
      items: (tableCategories
        .find((c) => c.id === "crm")
        ?.tableIds.map((tableId) => {
          const table = tables.find((t) => t.id === tableId);
          if (!table) return null;
          return {
            icon: getTableIconComponent(table.id),
            label: table.name,
            href: `/${table.id}/grid`,
            children: table.views.map((view) => ({
              icon: viewIcons[view] || LayoutGrid,
              label: capitalizeView(view),
              href: `/${table.id}/${view}`,
            })),
          } as NavItem;
        })
        .filter((item) => item !== null) as NavItem[] || []) as NavItem[],
    },
    {
      title: "Settings",
      items: [
        {
          icon: Settings,
          label: "Settings",
          href: "/settings",
        },
        {
          icon: FileSpreadsheet,
          label: "Tables",
          href: "/settings/tables",
        },
      ],
    },
    {
      title: "Tools",
      items: [
        {
          icon: FileSpreadsheet,
          label: "Import CSV",
          href: "/import",
        },
      ],
    },
  ];

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const isGroupCollapsed = (title: string) => {
    // Check if this is a nav group title or an item label
    return collapsedGroups.has(title);
  };

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    const hrefParts = href.split("/").filter(Boolean);
    return hrefParts[0] === currentTable && (hrefParts[1] === currentView || hrefParts.length === 1);
  };

  const isChildActive = (href: string) => {
    const hrefParts = href.split("/").filter(Boolean);
    return hrefParts[0] === currentTable && hrefParts[1] === currentView;
  };

  const handleToggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const handleMouseEnter = () => {
    if (collapsed) {
      hoverTimeoutRef.current = setTimeout(() => {
        // Expand on hover (visual only, doesn't change collapsed state)
      }, 150);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const { theme, setTheme } = themeContext || { theme: "light", setTheme: () => {} };
  const isDark = theme === "dark";

  // Mobile sidebar component
  const MobileSidebar = () => (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <WorkspaceHeader />
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Navigation */}
          <div className="flex-1 overflow-y-auto p-3">
            {navGroups.map((group) => (
              <NavGroupComponent
                key={group.title}
                group={group}
                isGroupCollapsed={isGroupCollapsed}
                toggleGroup={toggleGroup}
                isItemActive={isItemActive}
                isChildActive={isChildActive}
                onItemClick={() => setMobileOpen(false)}
              />
            ))}
          </div>

          {/* Mobile Footer */}
          <SidebarFooter theme={theme} setTheme={setTheme} />
        </div>
      </div>
    </>
  );

  // Desktop sidebar
  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-16 left-4 z-50 p-2 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Desktop Sidebar */}
      <aside
        ref={sidebarRef}
        className={`flex flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 ease-in-out h-full overflow-y-auto ${
          collapsed ? "w-16" : "w-64"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="Sidebar navigation"
      >
        {/* Header */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <WorkspaceHeader collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          {navGroups.map((group) => {
            // Apply customizations from state
            const customTitle = sidebarCustomizations.groupTitles?.[group.title] || group.title;
            const customizedGroup = {
              ...group,
              title: customTitle,
              items: group.items.map((item) => ({
                ...item,
                label: sidebarCustomizations.itemLabels?.[item.href] || item.label,
              })),
            };
            return (
              <NavGroupComponent
                key={group.title}
                group={customizedGroup}
                isGroupCollapsed={isGroupCollapsed}
                toggleGroup={toggleGroup}
                isItemActive={isItemActive}
                isChildActive={isChildActive}
                collapsed={collapsed}
                editing={editing}
                onGroupTitleChange={handleGroupTitleChange}
                onItemLabelChange={handleItemLabelChange}
              />
            );
          })}
        </div>

        {/* Footer */}
        <SidebarFooter 
          theme={theme} 
          setTheme={setTheme} 
          collapsed={collapsed} 
          onToggleCollapse={handleToggleCollapse}
          editing={editing}
          onToggleEdit={() => setEditing(!editing)}
        />
      </aside>
    </>
  );
}

interface NavGroupComponentProps {
  group: NavGroup;
  isGroupCollapsed: (title: string) => boolean;
  toggleGroup: (title: string) => void;
  isItemActive: (href: string) => boolean;
  isChildActive: (href: string) => boolean;
  collapsed?: boolean;
  onItemClick?: () => void;
}

interface NavGroupComponentProps {
  group: NavGroup;
  isGroupCollapsed: (title: string) => boolean;
  toggleGroup: (title: string) => void;
  isItemActive: (href: string) => boolean;
  isChildActive: (href: string) => boolean;
  collapsed?: boolean;
  onItemClick?: () => void;
  editing?: boolean;
  onGroupTitleChange?: (oldTitle: string, newTitle: string) => void;
  onItemLabelChange?: (href: string, newLabel: string) => void;
}

function NavGroupComponent({
  group,
  isGroupCollapsed,
  toggleGroup,
  isItemActive,
  isChildActive,
  collapsed = false,
  onItemClick,
  editing = false,
  onGroupTitleChange,
  onItemLabelChange,
}: NavGroupComponentProps) {
  const groupCollapsed = isGroupCollapsed(group.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(group.title);
  const [editingItemLabel, setEditingItemLabel] = useState<string | null>(null);
  const [itemLabelValue, setItemLabelValue] = useState<string>("");

  return (
    <div className="mb-4">
      {/* Group Header */}
      {!collapsed && (
        <div className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {editing && editingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={() => {
                if (titleValue && titleValue !== group.title && onGroupTitleChange) {
                  onGroupTitleChange(group.title, titleValue);
                }
                setEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (titleValue && titleValue !== group.title && onGroupTitleChange) {
                    onGroupTitleChange(group.title, titleValue);
                  }
                  setEditingTitle(false);
                } else if (e.key === "Escape") {
                  setTitleValue(group.title);
                  setEditingTitle(false);
                }
              }}
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <span>{group.title}</span>
                {groupCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              {editing && (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Edit group title"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Group Items */}
      <div className={`space-y-0.5 ${collapsed ? "mt-2" : ""}`}>
        {group.items.map((item) => {
          const active = isItemActive(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const itemCollapsed = hasChildren && isGroupCollapsed(item.label);

          return (
            <div key={item.href}>
              {/* Parent Item */}
              <div className="flex items-center gap-1">
                {!collapsed && editingItemLabel === item.href ? (
                  <input
                    type="text"
                    value={itemLabelValue}
                    onChange={(e) => setItemLabelValue(e.target.value)}
                    onBlur={() => {
                      if (itemLabelValue && itemLabelValue !== item.label && onItemLabelChange) {
                        onItemLabelChange(item.href, itemLabelValue);
                      }
                      setEditingItemLabel(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (itemLabelValue && itemLabelValue !== item.label && onItemLabelChange) {
                          onItemLabelChange(item.href, itemLabelValue);
                        }
                        setEditingItemLabel(null);
                      } else if (e.key === "Escape") {
                        setItemLabelValue(item.label);
                        setEditingItemLabel(null);
                      }
                    }}
                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                    autoFocus
                  />
                ) : (
                  <>
                    <Link
                      href={item.href}
                      onClick={onItemClick}
                      className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-all duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-blue-400 flex-1 ${
                        active
                          ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium border-l-4 border-blue-500"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      } ${collapsed ? "justify-center" : ""}`}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && hasChildren && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleGroup(item.label);
                          }}
                          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          {itemCollapsed ? (
                            <ChevronRight className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </Link>
                    {!collapsed && editing && (
                      <button
                        onClick={() => {
                          setItemLabelValue(item.label);
                          setEditingItemLabel(item.href);
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        title="Edit item label"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Children Items */}
              {!collapsed && hasChildren && !itemCollapsed && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-2">
                  {item.children?.map((child) => {
                    const childActive = isChildActive(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onItemClick}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-200 ease-in-out ${
                          childActive
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium border-l-4 border-blue-500"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SidebarFooterProps {
  theme: "light" | "dark" | "brand";
  setTheme: (theme: "light" | "dark" | "brand") => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  editing?: boolean;
  onToggleEdit?: () => void;
}

function SidebarFooter({ theme, setTheme, collapsed = false, onToggleCollapse, editing = false, onToggleEdit }: SidebarFooterProps) {
  const isDark = theme === "dark";

  return (
    <div className="sticky bottom-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 p-3 space-y-2">
      {/* Collapse Toggle (Desktop only) */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronRight className="w-4 h-4 rotate-180" />
              {!collapsed && <span>Collapse</span>}
            </>
          )}
        </button>
      )}

      {/* Dark Mode Toggle */}
      <button
        onClick={() => {
          if (theme === "light") setTheme("dark");
          else if (theme === "dark") setTheme("brand");
          else setTheme("light");
        }}
        className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-2 px-2 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
        title={collapsed ? "Toggle theme" : undefined}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        {!collapsed && <span>Theme</span>}
      </button>

            {/* Settings Link */}
            <Link
              href="/settings"
              className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-2 px-2 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="w-4 h-4" />
              {!collapsed && <span>Settings</span>}
            </Link>

      {/* Edit Mode Toggle */}
      {onToggleEdit && (
        <button
          onClick={onToggleEdit}
          className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-2 px-2 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
          title={collapsed ? (editing ? "Exit edit mode" : "Edit sidebar") : undefined}
        >
          <Edit3 className="w-4 h-4" />
          {!collapsed && <span>{editing ? "Done Editing" : "Edit Sidebar"}</span>}
        </button>
      )}

      {/* Documentation Placeholder */}
      {!collapsed && (
        <div className="flex items-center gap-2 px-2 py-2 text-sm text-gray-500 dark:text-gray-500">
          <HelpCircle className="w-4 h-4" />
          <span>Documentation</span>
        </div>
      )}
    </div>
  );
}
