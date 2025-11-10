"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

interface TooltipContextValue {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

interface TooltipProps {
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  return (
    <TooltipContext.Provider value={{ isVisible, setIsVisible, triggerRef }}>
      <div
        className="relative inline-block"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  children: React.ReactNode;
}

const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ children, asChild, ...props }, ref) => {
    const context = React.useContext(TooltipContext);
    
    if (asChild && React.isValidElement(children)) {
      const combinedRef = (node: HTMLElement | null) => {
        if (context?.triggerRef) {
          context.triggerRef.current = node;
        }
        if (typeof (children as any).ref === 'function') {
          (children as any).ref(node);
        } else if ((children as any).ref) {
          (children as any).ref.current = node;
        }
      };
      return React.cloneElement(children, { ref: combinedRef, ...props } as any);
    }
    const combinedRef = (node: HTMLDivElement | null) => {
      if (context?.triggerRef) {
        context.triggerRef.current = node;
      }
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };
    return (
      <div ref={combinedRef} {...props}>
        {children}
      </div>
    );
  }
);
TooltipTrigger.displayName = "TooltipTrigger";

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, side = "bottom", ...props }, ref) => {
    const context = React.useContext(TooltipContext);
    const isVisible = context?.isVisible ?? false;
    const [position, setPosition] = React.useState({ top: 0, left: 0 });

    React.useEffect(() => {
      if (isVisible && context?.triggerRef?.current) {
        const updatePosition = () => {
          const trigger = context.triggerRef.current;
          if (!trigger) return;
          
          const rect = trigger.getBoundingClientRect();
          let top = 0;
          let left = 0;

          if (side === "top") {
            top = rect.top - 8; // mb-2 equivalent
            left = rect.left + rect.width / 2;
          } else if (side === "bottom") {
            top = rect.bottom + 8; // mt-2 equivalent
            left = rect.left + rect.width / 2;
          } else if (side === "left") {
            top = rect.top + rect.height / 2;
            left = rect.left - 8; // mr-2 equivalent
          } else {
            top = rect.top + rect.height / 2;
            left = rect.right + 8; // ml-2 equivalent
          }

          setPosition({ top, left });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
          window.removeEventListener('scroll', updatePosition, true);
          window.removeEventListener('resize', updatePosition);
        };
      }
    }, [isVisible, side, context]);

    // Render tooltip in a portal to ensure it's always on top
    const [mounted, setMounted] = React.useState(false);
    
    React.useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
      <>
        {isVisible && typeof document !== 'undefined' && createPortal(
          <div
            ref={ref}
            className={cn(
              "fixed z-[9999] rounded-md border bg-white px-3 py-1.5 text-sm text-gray-900 shadow-lg pointer-events-none",
              side === "top" && "-translate-x-1/2 -translate-y-full",
              side === "bottom" && "-translate-x-1/2",
              side === "left" && "-translate-x-full -translate-y-1/2",
              side === "right" && "-translate-y-1/2",
              className
            )}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
            {...props}
          >
            {children}
            <div
              className={cn(
                "absolute w-2 h-2 border border-gray-200 bg-white rotate-45",
                side === "top" && "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-0 border-l-0",
                side === "bottom" && "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-0 border-r-0",
                side === "left" && "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-0 border-b-0",
                side === "right" && "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-0 border-t-0"
              )}
            />
          </div>,
          document.body
        )}
      </>
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

