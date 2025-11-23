"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import Button from "@/components/ui/Button";

interface ButtonBlockProps {
  block: InterfacePageBlock;
}

export default function ButtonBlock({ block }: ButtonBlockProps) {
  const config = block.config || {};
  const label = config.label || "Button";
  const action = config.action || null;
  const variant = config.variant || "default";

  const handleClick = () => {
    if (action) {
      // TODO: Handle action (navigate, open modal, etc.)
      console.log("Button action:", action);
    }
  };

  return (
    <div className="w-full h-full p-4 flex items-center justify-center">
      <Button variant={variant as any} onClick={handleClick}>
        {label}
      </Button>
    </div>
  );
}

