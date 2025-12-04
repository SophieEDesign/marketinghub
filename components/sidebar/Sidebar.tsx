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
  Zap,
} from "lucide-react";
import { tables, tableCategories } from "@/lib/tables";
import { useTheme } from "@/app/providers";
import WorkspaceHeader from "./WorkspaceHeader";
import { supabase } from "@/lib/supabaseClient";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import SidebarSortableItem from "./SidebarSortableItem";
import TableViewsList from "./TableViewsList";

// Map view types to icons
const viewIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  grid: LayoutGrid,
  kanban: Columns3,
  calendar: Calendar,
  timeline: Timer,
  cards: SquareStack,
};

import { tableMetadata, getTableIcon, getAllTables } from "@/lib/tableMetadata";
import { BookOpen, Gift, Compass, Image as ImageIcon, Layout, Plus } from "lucide-react";
import { useInterfacePages } from "@/lib/hooks/useInterfacePages";
import { useNewPageModal } from "@/components/pages/NewPageModalProvider";

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
  onClick?: () => void;
  children?: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; href: string; onClick?: () => void }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Generate default sidebar items from table metadata
const generateDefaultSidebarItems = (dynamicTableData: Array<{ table_name: string; display_name: string }> = []) => {
  // Create a map of dynamic table data for quick lookup
  const dynamicTableMap = new Map(dynamicTableData.map(t => [t.table_name, t.display_name]));
  
  // Merge hardcoded tables with dynamic tables from database
  const hardcodedTableIds = Object.keys(tableMetadata); // Use synchronous version
  const dynamicTableIds = dynamicTableData.map(t => t.table_name);
  const allTableIds = [...new Set([...hardcodedTableIds, ...dynamicTableIds])];
  
  const tableItems = allTableIds.map((tableId) => {
    const meta = tableMetadata[tableId];
    // Get display name from database if available, otherwise use hardcoded metadata or format tableId
    let displayName = dynamicTableMap.get(tableId) || meta?.label || tableId;
    let defaultView = meta?.defaultView || "grid";
    
    // If not in hardcoded metadata and not in database, format tableId
    if (!meta && !dynamicTableMap.has(tableId)) {
      // Format tableId: "my_table" -> "My Table"
      displayName = tableId
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
    
    const Icon = meta?.icon || FileText;
    return {
      id: tableId,
      label: displayName,
      icon: Icon,
      href: `/${tableId}/${defaultView}`,
    };
  });

  return [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { id: "automations", label: "Automations", icon: Zap, href: "/automations" },
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
  const [dynamicTables, setDynamicTables] = useState<string[]>([]);
  const [sidebarCustomizations, setSidebarCustomizations] = useState<{ groupTitles: Record<string, string>; itemLabels: Record<string, string>; itemOrder: Record<string, string[]> }>({ groupTitles: {}, itemLabels: {}, itemOrder: {} });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { pages } = useInterfacePages();
  const { openModal } = useNewPageModal();

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

  // Load dynamic tables from new tables system
  const [dynamicTablesList, setDynamicTablesList] = useState<Array<{ id: string; name: string; label: string; icon: string }>>([]);
  
  useEffect(() => {
    async function loadDynamicTables() {
      try {
        // Try loading from new tables system first
        const { data: newTables, error: newError } = await supabase
          .from("tables")
          .select("id, name, label, icon")
          .order("created_at", { ascending: true });
        
        if (!newError && newTables && newTables.length > 0) {
          // Use new dynamic tables system
          setDynamicTablesList(newTables);
          setDynamicTables(newTables.map((t) => t.name));
        } else {
          // Fallback to old table_metadata system for backward compatibility
          const { data: oldTables, error: oldError } = await supabase
            .from("table_metadata")
            .select("table_name, display_name")
            .order("display_name", { ascending: true });
          
          if (!oldError && oldTables && oldTables.length > 0) {
            // Convert old format to new format for display
            const convertedTables = oldTables.map((row) => ({
              id: row.table_name,
              name: row.table_name,
              label: row.display_name,
              icon: 'table',
            }));
            setDynamicTablesList(convertedTables);
            setDynamicTables(oldTables.map((row) => row.table_name));
            const updatedItems = generateDefaultSidebarItems(oldTables);
            setOrderedSidebar(updatedItems);
          } else {
            // No tables found, set empty list
            setDynamicTablesList([]);
            setDynamicTables([]);
          }
        }
      } catch (error) {
        console.warn("Error loading dynamic tables:", error);
        setDynamicTablesList([]);
        setDynamicTables([]);
      }
    }
    
    loadDynamicTables();
    
    // Reload when window gains focus (in case table was updated in another tab)
    const handleFocus = () => {
      loadDynamicTables();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

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
          itemOrder: customizations.itemOrder || {},
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
      itemOrder: { ...sidebarCustomizations.itemOrder },
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
      itemOrder: { ...sidebarCustomizations.itemOrder },
    };
    setSidebarCustomizations(newCustomizations);
    localStorage.setItem("sidebarCustomizations", JSON.stringify(newCustomizations));
    // Force re-render by updating state
    setEditing(false);
    setTimeout(() => setEditing(true), 0);
  };

  // Handler for item reordering within a group
  const handleItemReorder = (groupTitle: string, newOrder: string[]) => {
    if (typeof window === 'undefined') return;
    const newCustomizations = {
      groupTitles: { ...sidebarCustomizations.groupTitles },
      itemLabels: { ...sidebarCustomizations.itemLabels },
      itemOrder: { ...sidebarCustomizations.itemOrder, [groupTitle]: newOrder },
    };
    setSidebarCustomizations(newCustomizations);
    localStorage.setItem("sidebarCustomizations", JSON.stringify(newCustomizations));
  };

  // Parse current route
  const pathParts = pathname.split("/").filter(Boolean);
  const currentTable = pathParts[0] || null;
  const currentView = pathParts[1] || null;

  // Build navGroups structure - Pages above Tables
  const navGroups: NavGroup[] = [
    {
      title: "Dashboard",
      items: [
        {
          icon: LayoutDashboard,
          label: "Dashboard",
          href: "/dashboard",
        },
      ],
    },
    {
      title: "Pages",
      items: [
        ...pages.map((page) => ({
          icon: FileText,
          label: page.name,
          href: `/pages/${page.id}/view`,
        })),
        {
          icon: Plus,
          label: "New Page",
          href: "#",
          onClick: openModal,
        },
      ],
    },
    {
      title: "Tables",
      items: [
        ...dynamicTablesList.map((table) => {
          // Always use the new route format /tables/{id} for consistency
          // This ensures ViewTabs are always shown
          const href = `/tables/${table.id}`;
          const Icon = getTableIconComponent(table.name) || FileText;
          return {
            icon: Icon,
            label: table.label || table.name,
            href: href,
          };
        }),
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
    if (href.startsWith("/interface/")) {
      return pathname === href;
    }
    const hrefParts = href.split("/").filter(Boolean);
    return hrefParts[0] === currentTable && (hrefParts[1] === currentView || hrefParts.length === 1);
  };

  const isChildActive = (href: string) => {
    if (href.startsWith("/pages/")) {
      return pathname === href;
    }
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
          {editing && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                <strong>Edit Mode:</strong> Click group titles to rename, drag items to reorder within groups.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                To add new categories, go to Settings → Sidebar
              </p>
            </div>
          )}
          {navGroups.map((group) => {
            // Apply customizations from state
            const customTitle = sidebarCustomizations.groupTitles?.[group.title] || group.title;
            
            // Apply item order if saved
            let orderedItems = group.items;
            const savedOrder = sidebarCustomizations.itemOrder?.[group.title];
            if (savedOrder && savedOrder.length === group.items.length) {
              orderedItems = savedOrder
                .map((href) => group.items.find((item) => item.href === href))
                .filter((item): item is NavItem => item !== undefined);
              // Add any new items that aren't in the saved order
              const newItems = group.items.filter((item) => !savedOrder.includes(item.href));
              orderedItems = [...orderedItems, ...newItems];
            }
            
            const customizedGroup = {
              ...group,
              title: customTitle,
              items: orderedItems.map((item) => ({
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
                onItemReorder={handleItemReorder}
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
  editing?: boolean;
  onGroupTitleChange?: (oldTitle: string, newTitle: string) => void;
  onItemLabelChange?: (href: string, newLabel: string) => void;
  onItemReorder?: (groupTitle: string, newOrder: string[]) => void;
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
  onItemReorder,
}: NavGroupComponentProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onItemReorder) return;

    const items = group.items;
    const oldIndex = items.findIndex((item) => item.href === active.id);
    const newIndex = items.findIndex((item) => item.href === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(items, oldIndex, newIndex);
    onItemReorder(group.title, newOrder.map((item) => item.href));
  };
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
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={group.items.map((item) => item.href)} disabled={!editing}>
          <div className={`space-y-0.5 ${collapsed ? "mt-2" : ""}`}>
            {group.items.map((item) => {
              const active = isItemActive(item.href);
              const hasChildren = item.children && item.children.length > 0;
              const itemCollapsed = hasChildren && isGroupCollapsed(item.label);

              return (
                <SidebarSortableItem
                  key={item.href}
                  id={item.href}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  editing={editing}
                  active={isItemActive(item.href)}
                  collapsed={collapsed}
                  onClick={item.onClick}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// Keep the old rendering for items with children (temporary until we refactor)
function NavGroupComponentOld({
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
  const [editingItemLabel, setEditingItemLabel] = useState<string | null>(null);
  const [itemLabelValue, setItemLabelValue] = useState<string>("");

  return (
    <div className="mb-4">
      {!collapsed && (
        <div className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
        </div>
      )}
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

              {/* Children Items - Show static children OR dynamic views */}
              {!collapsed && !itemCollapsed && (
                <>
                  {/* Static children (from hardcoded table metadata) */}
                  {hasChildren && (
                    <div className="ml-6 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-2">
                      {item.children?.map((child) => {
                        const childActive = isChildActive(child.href);
                        const childOnClick = (child as any).onClick;
                        if (childOnClick) {
                          return (
                            <button
                              key={child.href}
                              onClick={childOnClick}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-200 ease-in-out text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 w-full text-left"
                            >
                              <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{child.label}</span>
                            </button>
                          );
                        }
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
                  {/* Dynamic views from database - REMOVED: Views are now replaced by Interface Pages */}
                  {/* TableViewsList removed - views are now managed through Interface Pages */}
                </>
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
          className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-2 px-2 py-2 rounded-md text-sm font-medium ${
            editing 
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700" 
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          } transition-colors`}
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
